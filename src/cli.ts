#!/usr/bin/env node

import { Command } from 'commander'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpClient } from './mcp-client.js'
import { ConfigFinder } from './config-finder.js'
import { listToolsAndResources, callTool, readResource } from './cli-action.js'

// 로그 함수 - stdio 통신에 영향을 주지 않도록 별도 처리
function logInfo(message: string) {
    // stderr로 출력하되, stdio 통신과 분리
    process.stderr.write(`[CLI] ${message}\n`)
}

async function getServerUrl(options: any): Promise<string> {
    let domain = options.domain || 'http://localhost'
    let port = options.port ? parseInt(options.port) : null
    let autoConnect = options.auto

    if (port !== null) {
        if (isNaN(port) || port < 1 || port > 65535) {
            console.error('❌ 잘못된 포트 번호입니다')
            process.exit(1)
        }
        autoConnect = false
    }

    if (autoConnect && !port) {
        logInfo('🔍 VSCode 인스턴스 자동 탐색 중...')
        const instance = await ConfigFinder.findVSCodeInstance()
        
        if (instance) {
            port = instance.port
            if (instance.workspace) {
                logInfo(`📁 Workspace: ${instance.workspace}`)
            }
            logInfo(`✨ 자동 탐색 성공! Port: ${port}`)
        } else {
            logInfo('⚠️ VSCode 인스턴스를 찾을 수 없음, 기본 포트 사용')
            port = 8890
        }
    } else if (!port) {
        port = 8890
    }

    return `${domain}:${port}/mcp`
}

async function startProxy(serverUrl: string) {
    logInfo('🚀 DAP Proxy MCP 클라이언트 시작')
    logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logInfo(`🎯 서버 URL: ${serverUrl}`)
    logInfo('🔗 VSCode 확장에 HTTP 연결 시도...')
    
    let retries = 0
    const maxRetries = 3
    let proxy = null
    
    while (retries < maxRetries) {
        try {
            proxy = await createMcpClient(serverUrl)
            logInfo('✅ VSCode 확장 HTTP 연결 성공')
            break
        } catch (error) {
            retries++
            if (retries < maxRetries) {
                logInfo(`⚠️ 연결 실패, 재시도 ${retries}/${maxRetries}...`)
                await new Promise(resolve => setTimeout(resolve, 2000))
            } else {
                console.error('❌ VSCode 확장 연결 실패')
                console.error('VSCode에서 DAP Proxy 확장이 실행 중인지 확인하세요')
                process.exit(1)
            }
        }
    }

    logInfo('📡 stdio transport 시작...')
    try {
        const transport = new StdioServerTransport()
        await proxy!.connect(transport)
        logInfo('✅ MCP 클라이언트 준비 완료!')
        logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
        console.error('❌ 오류 발생:', error)
        if (error instanceof Error) {
            console.error('스택 트레이스:', error.stack)
        }
        process.exit(1)
    }
}

const program = new Command()

program
    .name('mcp-debug-tools')
    .description('CLI and MCP proxy for VSCode debugging via DAP')
    .version('1.0.2')
    .option('--port <number>', 'DAP Proxy 서버 포트 지정 (자동 탐색 비활성화)')
    .option('--domain <url>', 'DAP Proxy 서버 도메인', 'http://localhost')
    .option('--no-auto', '자동 VSCode 탐색 비활성화')

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
    console.error('치명적 오류:', err)
    process.exit(1)
})
