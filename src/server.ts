import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { state } from './state'
import { findAvailablePort } from './utils/port'
import { allTools } from './tools'
import { allResources } from './resources'
import { t } from './i18n'

const MCP_SERVER_PORT = 8890
type HttpApp = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

/**
 * Initialize MCP server with resources and tools
 */
export function initializeMcpServer(): McpServer {
    const mcpServer = new McpServer({ name: 'dap-proxy', version: '1.0.0' })

    // Register all tools.
    for (const tool of allTools) {
        console.info(t('server.registeringTool', { tool: tool.name }))
        mcpServer.registerTool(tool.name, tool.config, tool.handler)
    }

    // Register all resources.
    for (const resource of allResources) {
        console.info(t('server.registeringResource', { resource: resource.name }))
        mcpServer.registerResource(
            resource.name,
            resource.uri,
            resource.config,
            resource.handler
        )
    }

    console.info(t('server.initComplete', { tools: allTools.length, resources: allResources.length }))
    return mcpServer
}


/**
 * Create and configure the HTTP handler for MCP
 */
export function createHttpApp(mcpServer: McpServer): HttpApp {
    return async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname !== '/mcp') {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('Not found')
            return
        }

        if (req.method === 'POST') {
            await handlePostRequest(mcpServer, req, res)
            return
        }

        if (req.method === 'GET' || req.method === 'DELETE') {
            await handleSessionRequest(req, res)
            return
        }

        res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Method not allowed')
    }
}

async function handlePostRequest(mcpServer: McpServer, req: IncomingMessage, res: ServerResponse) {
    try {
        const body = await readJsonBody(req)

        // Handle POST requests for client-to-server communication.
        // Handle tools/call directly for one-off CLI requests, bypassing transport.
        if (body?.method === 'tools/call') {
            const { name: toolName, arguments: toolArgs } = body.params || {}
            
            console.info(t('server.directToolCall', { tool: toolName }))
            
            // Find the tool.
            const tool = allTools.find(t => t.name === toolName)
            
            if (!tool) {
                sendJson(res, 404, {
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: `Tool not found: ${toolName}`
                    },
                    id: body.id
                })
                return
            }
            
            try {
                // Run the tool handler directly.
                const startTime = Date.now()
                const result = await tool.handler(toolArgs)
                const elapsed = Date.now() - startTime
                
                // Send the JSON-RPC response directly.
                sendJson(res, 200, {
                    jsonrpc: '2.0',
                    result: result,
                    id: body.id
                })
                
                console.info(t('server.directToolComplete', { tool: toolName, elapsed }))
                return  // Do not use transport for direct handling.
                
            } catch (error: any) {
                console.error(t('server.directToolFailed', { tool: toolName, error: error.message }))
                sendJson(res, 500, {
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: error.message
                    },
                    id: body.id
                })
                return
            }
        }

        // Handle resources/read directly for one-off CLI requests, bypassing transport.
        if (body?.method === 'resources/read') {
            const { uri: resourceUri } = body.params || {}

            console.info(t('server.directResourceRead', { uri: resourceUri }))

            const resource = allResources.find(r => r.uri === resourceUri)

            if (!resource) {
                sendJson(res, 404, {
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: `Resource not found: ${resourceUri}`
                    },
                    id: body.id
                })
                return
            }

            try {
                const startTime = Date.now()
                const result = await resource.handler(new URL(resourceUri))
                const elapsed = Date.now() - startTime

                sendJson(res, 200, {
                    jsonrpc: '2.0',
                    result: result,
                    id: body.id
                })

                console.info(t('server.directResourceComplete', { uri: resourceUri, elapsed }))
                return
            } catch (error: any) {
                console.error(t('server.directResourceFailed', { uri: resourceUri, error: error.message }))
                sendJson(res, 500, {
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: error.message
                    },
                    id: body.id
                })
                return
            }
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined
        let transport: StreamableHTTPServerTransport

        // Stateless flow: create a new session for each initialize request.
        if (isInitializeRequest(body)) {
            // Clean up any existing session.
            if (sessionId && state.getTransport(sessionId)) {
                console.info(t('server.cleaningExistingSession', { sessionId }))
                state.removeTransport(sessionId)
            }
            
            // Create a new transport.
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                    state.addTransport(id, transport)
                    console.info(t('server.sessionCreated', { sessionId: id }))
                },
                // For local development, disable DNS rebinding protection
                enableDnsRebindingProtection: false,
            })
            transport.onclose = () => {
                if (transport.sessionId) {
                    state.removeTransport(transport.sessionId)
                    console.info(t('server.sessionClosed', { sessionId: transport.sessionId }))
                }
            }
            transport.onerror = (error) => {
                console.error(t('server.transportError', { error }))
                if (transport.sessionId) {
                    state.removeTransport(transport.sessionId)
                }
            }
            await mcpServer.connect(transport)
        } else if (sessionId && state.getTransport(sessionId)) {
            // Reuse the existing session without reconnecting.
            transport = state.getTransport(sessionId)!
            console.info(t('server.reusingSession', { sessionId }))
        } else {
            // Missing or invalid session ID.
            sendJson(res, 400, {
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: Invalid or missing session' },
                id: null
            })
            return
        }
        try {
            // Use the transport for initialize, notifications, and related requests.
            await transport.handleRequest(req, res, body)
        } catch (error) {
            console.error(t('server.transportHandlingFailed', { error }))
            // Clean up the session after errors.
            if (sessionId) {
                state.removeTransport(sessionId)
            }
            sendJson(res, 500, {
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal error' },
                id: null
            })
        }
    } catch (error) {
        console.error(t('server.transportHandlingFailed', { error }))
        sendJson(res, 400, {
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Invalid JSON request' },
            id: null
        })
    }
}

// Reusable handler for GET and DELETE requests.
async function handleSessionRequest(req: IncomingMessage, res: ServerResponse) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (!sessionId || !state.getTransport(sessionId)) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Invalid or missing session ID')
        return
    }
    const transport = state.getTransport(sessionId)!
    try {
        await transport.handleRequest(req, res)
    } catch (error) {
        console.error(t('server.sessionHandlingFailed', { sessionId, error }))
        // Clean up the session after errors.
        state.removeTransport(sessionId)
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Internal server error')
    }
}

/**
 * Start HTTP server
 */
export async function startHttpServer(app: HttpApp, onServerStarted?: () => void): Promise<void> {
    try {
        const availablePort = await findAvailablePort(MCP_SERVER_PORT)

        const httpServer = createServer((req, res) => {
            Promise.resolve(app(req, res)).catch(error => {
                console.error(t('server.transportHandlingFailed', { error }))
                if (!res.headersSent) {
                    sendJson(res, 500, {
                        jsonrpc: '2.0',
                        error: { code: -32603, message: 'Internal error' },
                        id: null
                    })
                } else {
                    res.destroy(error instanceof Error ? error : undefined)
                }
            })
        }).listen(availablePort, () => {
            // Store server information
            state.currentPort = availablePort
            state.serverStartTime = new Date()
            state.httpServer = httpServer

            console.error(t('server.httpRunning'))
            console.error(t('server.httpServerUrl', { url: `http://localhost:${availablePort}` }))
            console.error(t('server.httpEndpoint', { url: `http://localhost:${availablePort}/mcp` }))
            console.error(t('server.port', { port: availablePort }))
            console.error(t('server.domain', { domain: 'localhost' }))
            if (availablePort !== MCP_SERVER_PORT) {
                console.error(t('server.portBusy', { originalPort: MCP_SERVER_PORT, port: availablePort }))
            }

            // Call the callback if provided
            if (onServerStarted) {
                onServerStarted()
            }
        })
    } catch (error) {
        console.error(t('server.startFailed', { error }))
        throw error
    }
}

/**
 * Stop HTTP server
 */
export function stopHttpServer(): Promise<void> {
    return new Promise((resolve) => {
        if (state.httpServer) {
            state.httpServer.close(() => {
                console.error(t('server.httpClosed'))
                state.httpServer = undefined
                state.currentPort = undefined
                state.serverStartTime = undefined
                resolve()
            })
        } else {
            resolve()
        }
    })
}

function readJsonBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', chunk => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
            try {
                const text = Buffer.concat(chunks).toString('utf8')
                resolve(text ? JSON.parse(text) : undefined)
            } catch (error) {
                reject(error)
            }
        })
        req.on('error', reject)
    })
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    const body = JSON.stringify(payload)
    res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
    })
    res.end(body)
}
