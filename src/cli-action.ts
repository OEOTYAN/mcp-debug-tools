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
    let clientObj
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

        clientObj = await createClient(serverUrl)
        const { client } = clientObj
        
        logStderr(`🛠️ 도구 호출: ${toolName}`)
        
        // 타임아웃 Promise 설정 (30초)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool ${toolName} timed out after 30 seconds`))
            }, 30000)
        })
        
        const toolPromise = client.callTool({
            name: toolName,
            arguments: args
        })
        
        const result = await Promise.race([toolPromise, timeoutPromise])
        
        // stdout에는 순수 JSON 결과만 출력
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } catch (error: any) {
        logStderr(`❌ 오류: ${error.message}`)
        process.stdout.write(JSON.stringify({ error: error.message }, null, 2) + '\n')
        process.exit(1)
    } finally {
        if (clientObj?.transport) {
            await clientObj.transport.close()
        }
        process.exit(0)
    }
}

export async function readResource(serverUrl: string, resourceUri: string) {
    let clientObj
    try {
        clientObj = await createClient(serverUrl)
        const { client } = clientObj
        
        logStderr(`📖 리소스 읽기: ${resourceUri}`)
        
        const result = await client.readResource({ uri: resourceUri })
        
        // stdout에는 순수 JSON 결과만 출력
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    } catch (error: any) {
        logStderr(`❌ 오류: ${error.message}`)
        process.stdout.write(JSON.stringify({ error: error.message }, null, 2) + '\n')
        process.exit(1)
    } finally {
        if (clientObj?.transport) {
            await clientObj.transport.close()
        }
        process.exit(0)
    }
}
