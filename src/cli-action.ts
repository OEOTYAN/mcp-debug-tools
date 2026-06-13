import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { inputSchemas } from './tools-parameters.js'

function logStderr(message: string) {
    process.stderr.write(`[CLI Action] ${message}\n`)
}

async function createClient(serverUrl: string): Promise<{ client: Client, transport: StreamableHTTPClientTransport }> {
    logStderr(`🔗 연결 시도: ${serverUrl}`)
    
    const client = new Client({
        name: 'dap-proxy-action-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    })

    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    await client.connect(transport)
    logStderr('✅ 연결 성공')
    
    return { client, transport }
}

async function postJsonRpc(serverUrl: string, method: string, params: any, timeoutMs = 30000) {
    logStderr(`🔗 직접 연결: ${serverUrl}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            }),
            signal: controller.signal
        })

        const responseText = await response.text()
        let payload: any
        try {
            payload = responseText ? JSON.parse(responseText) : {}
        } catch {
            throw new Error(`Invalid JSON response: ${responseText}`)
        }

        if (!response.ok || payload.error) {
            throw new Error(payload.error?.message || `HTTP ${response.status}: ${responseText}`)
        }

        logStderr('✅ 직접 호출 성공')
        return payload.result
    } finally {
        clearTimeout(timeout)
    }
}

export async function listToolsAndResources(serverUrl: string) {
    let clientObj
    try {
        clientObj = await createClient(serverUrl)
        const { client } = clientObj
        
        logStderr('도구 및 리소스 목록 가져오는 중...')
        
        const toolsResult = await client.listTools()
        const resourcesResult = await client.listResources()

        const tools = toolsResult.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: inputSchemas[t.name as keyof typeof inputSchemas] || t.inputSchema
        }))

        const resources = resourcesResult.resources.map(r => ({
            name: r.name,
            uri: r.uri,
            description: r.description,
            mimeType: r.mimeType
        }))

        // stdout에는 순수 JSON 결과만 출력
        process.stdout.write(JSON.stringify({ tools, resources }, null, 2) + '\n')
    } catch (error: any) {
        logStderr(`❌ 오류: ${error.message}`)
        process.exit(1)
    } finally {
        if (clientObj?.transport) {
            await clientObj.transport.close()
        }
        process.exit(0)
    }
}

export async function callTool(serverUrl: string, toolName: string, argsStr?: string) {
    try {
        let args = {}
        if (argsStr) {
            try {
                args = JSON.parse(argsStr)
            } catch (err) {
                logStderr(`❌ 인자 JSON 파싱 오류: ${argsStr}`)
                process.exit(1)
            }
        }

        logStderr(`🛠️ 도구 호출: ${toolName}`)

        const result = await postJsonRpc(serverUrl, 'tools/call', {
            name: toolName,
            arguments: args
        })

        // stdout에는 순수 JSON 결과만 출력
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } catch (error: any) {
        logStderr(`❌ 오류: ${error.message}`)
        process.stdout.write(JSON.stringify({ error: error.message }, null, 2) + '\n')
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

export async function readResource(serverUrl: string, resourceUri: string) {
    try {
        logStderr(`📖 리소스 읽기: ${resourceUri}`)

        const result = await postJsonRpc(serverUrl, 'resources/read', {
            uri: resourceUri
        })
        
        // stdout에는 순수 JSON 결과만 출력
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } catch (error: any) {
        logStderr(`❌ 오류: ${error.message}`)
        process.stdout.write(JSON.stringify({ error: error.message }, null, 2) + '\n')
        process.exit(1)
    } finally {
        process.exit(0)
    }
}
