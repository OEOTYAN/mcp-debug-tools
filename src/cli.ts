#!/usr/bin/env node

import { Command } from 'commander'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpClient } from './mcp-client.js'
import { ConfigFinder } from './config-finder.js'
import { listToolsAndResources, callTool, readResource } from './cli-action.js'
import { t } from './i18n.js'

function logInfo(message: string) {
    process.stderr.write(`[CLI] ${message}\n`)
}

async function getServerUrl(options: any): Promise<string> {
    let domain = options.domain || 'http://localhost'
    let port = options.port ? parseInt(options.port) : null
    let autoConnect = options.auto

    if (port !== null) {
        if (isNaN(port) || port < 1 || port > 65535) {
            console.error(t('cli.invalidPort'))
            process.exit(1)
        }
        autoConnect = false
    }

    if (autoConnect && !port) {
        logInfo(t('cli.autoDiscovering'))
        const instance = await ConfigFinder.findVSCodeInstance()
        
        if (instance) {
            port = instance.port
            if (instance.workspace) {
                logInfo(t('cli.workspace', { workspace: instance.workspace }))
            }
            logInfo(t('cli.autoDiscoverSuccess', { port }))
        } else {
            logInfo(t('cli.autoDiscoverFallback'))
            port = 8890
        }
    } else if (!port) {
        port = 8890
    }

    return `${domain}:${port}/mcp`
}

async function startProxy(serverUrl: string) {
    logInfo(t('cli.proxyStarting'))
    logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logInfo(t('cli.serverUrl', { url: serverUrl }))
    logInfo(t('cli.connectingExtension'))
    
    let retries = 0
    const maxRetries = 3
    let proxy = null
    
    while (retries < maxRetries) {
        try {
            proxy = await createMcpClient(serverUrl)
            logInfo(t('cli.extensionConnected'))
            break
        } catch (error) {
            retries++
            if (retries < maxRetries) {
                logInfo(t('cli.connectionRetry', { retry: retries, max: maxRetries }))
                await new Promise(resolve => setTimeout(resolve, 2000))
            } else {
                console.error(t('cli.extensionConnectionFailed'))
                console.error(t('cli.checkExtensionRunning'))
                process.exit(1)
            }
        }
    }

    logInfo(t('cli.stdioStarting'))
    try {
        const transport = new StdioServerTransport()
        await proxy!.connect(transport)
        logInfo(t('cli.clientReady'))
        logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
        console.error(t('cli.errorOccurred', { error }))
        if (error instanceof Error) {
            console.error(t('cli.stackTrace', { stack: error.stack }))
        }
        process.exit(1)
    }
}

const program = new Command()

program
    .name('mcp-debug-tools')
    .description('CLI and MCP proxy for VSCode debugging via DAP')
    .version('1.0.2')
    .option('--port <number>', t('cli.option.port'))
    .option('--domain <url>', t('cli.option.domain'), 'http://localhost')
    .option('--no-auto', t('cli.option.noAuto'))

program
    .command('proxy', { isDefault: true })
    .description('Start the stdio MCP proxy (Default)')
    .action(async () => {
        const options = program.opts()
        const serverUrl = await getServerUrl(options)
        await startProxy(serverUrl)
    })

program
    .command('list')
    .description('List all available MCP tools and resources from the VSCode extension')
    .action(async () => {
        const options = program.opts()
        const serverUrl = await getServerUrl(options)
        await listToolsAndResources(serverUrl)
    })

program
    .command('call <toolName> [argsJson]')
    .description('Call a specific MCP tool directly and print the JSON result')
    .action(async (toolName, argsJson) => {
        const options = program.opts()
        const serverUrl = await getServerUrl(options)
        await callTool(serverUrl, toolName, argsJson)
    })

program
    .command('read <resourceUri>')
    .description('Read a specific MCP resource directly and print the JSON result')
    .action(async (resourceUri) => {
        const options = program.opts()
        const serverUrl = await getServerUrl(options)
        await readResource(serverUrl, resourceUri)
    })

program.parseAsync(process.argv).catch(err => {
    console.error(t('cli.fatalError', { error: err }))
    process.exit(1)
})
