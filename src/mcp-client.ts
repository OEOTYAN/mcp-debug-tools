import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { inputSchemas } from './tools-parameters'
import { t } from './i18n'


function logInfo(message: string) {
    // Keep logs on stderr so stdio transport remains clean.
    process.stderr.write(`[CLI] ${message}\n`)
}

/**
 * Create MCP proxy that connects to DAP Proxy extension via HTTP
 * and exposes tools/resources via stdio
 */
export async function createMcpClient(serverUrl: string): Promise<McpServer> {
    logInfo(t('mcpClient.httpClientCreating', { url: serverUrl }))
    
    // Connect to the VS Code extension over HTTP.
    const client = new Client({
        name: 'dap-proxy-client',
        version: '1.0.0'
    }, {
        capabilities: {
            tools: {}
        }
    })

    logInfo(t('mcpClient.httpTransportConnecting'))
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await client.connect(transport)
    logInfo(t('mcpClient.httpTransportConnected'))

    // MCP proxy server exposed to clients such as Cursor.
    const proxy = new McpServer({
        name: 'dap-proxy-client',
        version: '1.0.0'
    })

    // Forward extension tools through the proxy.
    logInfo(t('mcpClient.fetchingTools'))
    const { tools } = await client.listTools()
    logInfo(t('mcpClient.toolsFound', { count: tools.length }))

    for (const tool of tools) {
        logInfo(t('mcpClient.registeringTool', { tool: tool.name }))
        proxy.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: inputSchemas[tool.name as keyof typeof inputSchemas],
                outputSchema: tool.outputSchema as any,
                annotations: tool.annotations as any
            },
            async (args: any) => {
                logInfo(t('mcpClient.callingTool', { tool: tool.name, args: JSON.stringify(args) }))
                const startTime = Date.now()
                
                try {
                    // Timeout guard (30 seconds).
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Tool ${tool.name} timed out after 30 seconds`))
                        }, 30000)
                    })
                    
                    // Actual tool call.
                    const toolPromise = client.callTool({
                        name: tool.name,
                        arguments: args
                    })
                    
                    // Return whichever finishes first: timeout or tool call.
                    const result = await Promise.race([toolPromise, timeoutPromise])
                    
                    const duration = Date.now() - startTime
                    logInfo(t('mcpClient.toolCallComplete', { tool: tool.name, elapsed: duration }))
                    return result as any
                } catch (error: any) {
                    const duration = Date.now() - startTime
                    logInfo(t('mcpClient.toolCallFailed', { tool: tool.name, error: error.message, elapsed: duration }))
                    throw error
                }
            }
        )
    }

    // Forward extension resources through the proxy.
    logInfo(t('mcpClient.fetchingResources'))
    const { resources } = await client.listResources()
    logInfo(t('mcpClient.resourcesFound', { count: resources.length }))

    for (const resource of resources) {
        logInfo(t('mcpClient.registeringResource', { name: resource.name, description: resource.description }))
        proxy.registerResource(
            resource.name,
            resource.uri,
            {
                title: resource.name,
                description: resource.description || `${resource.name} resource`,
                mimeType: resource.mimeType || 'application/json'
            },
            async (uri) => {
                logInfo(t('mcpClient.readingResource', { name: resource.name }))
                const result = await client.readResource({ uri: uri.href })
                logInfo(t('mcpClient.readResourceComplete', { name: resource.name }))
                return result
            }
        )
    }

    logInfo(t('mcpClient.proxyReady'))
    return proxy
}
