import * as vscode from 'vscode'
import { z } from 'zod'
import * as path from 'path'
import * as fs from 'fs'
import { getWorkspaceRoot, getRelativePath } from './utils/path'
import { inputSchemas } from './tools-parameters'
import { parseJsonWithComments } from './utils/json'
import { state } from './state'
import { t } from './i18n'
import {
    RegistryEntry,
    getRegistryPath,
    getWorkspaceConfigPath,
    isEntryAlive,
    loadActiveInstances
} from './discovery'

const DEFAULT_MAX_CHILDREN = 100
const DEFAULT_EXPAND_DEPTH = 0
const REGISTER_SCOPE_NAMES = new Set(['Registers', 'CPU Registers'])

function asJsonContent(value: unknown) {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(value, null, 2)
        }]
    }
}

function asTextContent(text: string, isError = false) {
    return {
        content: [{
            type: 'text' as const,
            text
        }],
        ...(isError ? { isError: true } : {})
    }
}

function asErrorContent(error: any) {
    return asTextContent(t('tools.error', { error: error?.message || error }), true)
}

function getActiveThreadId(): number | undefined {
    const activeStackItem = vscode.debug.activeStackItem
    return activeStackItem ? activeStackItem.threadId : undefined
}

function getActiveFrameId(): number | undefined {
    const activeStackItem = vscode.debug.activeStackItem
    return activeStackItem && 'frameId' in activeStackItem ? (activeStackItem as any).frameId : undefined
}

async function resolveFrameId(
    session: vscode.DebugSession,
    args: { threadId?: number, frameId?: number, frameIndex?: number }
): Promise<{ frameId?: number, threadId?: number, frame?: any }> {
    const activeFrameId = getActiveFrameId()
    const activeThreadId = getActiveThreadId()

    if (args.frameId !== undefined) {
        return {
            frameId: args.frameId,
            threadId: args.threadId || activeThreadId
        }
    }

    if (args.frameIndex === undefined && activeFrameId !== undefined && (!args.threadId || args.threadId === activeThreadId)) {
        return {
            frameId: activeFrameId,
            threadId: activeThreadId
        }
    }

    const threadId = args.threadId || activeThreadId
    if (!threadId) {
        return { frameId: activeFrameId, threadId }
    }

    const frameIndex = args.frameIndex || 0
    const response = await session.customRequest('stackTrace', {
        threadId,
        startFrame: frameIndex,
        levels: 1
    })
    const frame = response?.stackFrames?.[0]

    return {
        frameId: frame?.id,
        threadId,
        frame
    }
}

function summarizeVariable(variable: any) {
    return {
        name: variable.name,
        value: variable.value,
        type: variable.type,
        variablesReference: variable.variablesReference,
        namedVariables: variable.namedVariables,
        indexedVariables: variable.indexedVariables,
        memoryReference: variable.memoryReference,
        presentationHint: variable.presentationHint,
        evaluateName: variable.evaluateName
    }
}

function shouldIncludeScope(scope: any, scopeName?: string, includeRegisters = false): boolean {
    if (scopeName && scope.name !== scopeName) {
        return false
    }

    if (!includeRegisters && REGISTER_SCOPE_NAMES.has(scope.name)) {
        return false
    }

    return true
}

async function getExpandedVariables(
    session: vscode.DebugSession,
    variablesReference: number,
    depth = DEFAULT_EXPAND_DEPTH,
    maxChildren = DEFAULT_MAX_CHILDREN
): Promise<any[]> {
    const response = await session.customRequest('variables', {
        variablesReference,
        count: maxChildren
    })
    const variables = response?.variables || []

    return Promise.all(variables.map(async (variable: any) => {
        const summarized = summarizeVariable(variable)
        if (depth > 0 && variable.variablesReference) {
            return {
                ...summarized,
                children: await getExpandedVariables(
                    session,
                    variable.variablesReference,
                    depth - 1,
                    maxChildren
                )
            }
        }
        return summarized
    }))
}

async function getFrameScopes(
    session: vscode.DebugSession,
    frameId: number,
    options: {
        scopeName?: string,
        includeRegisters?: boolean,
        depth?: number,
        maxChildren?: number
    } = {}
): Promise<any[]> {
    const {
        scopeName,
        includeRegisters = false,
        depth = DEFAULT_EXPAND_DEPTH,
        maxChildren = DEFAULT_MAX_CHILDREN
    } = options

    const scopesResponse = await session.customRequest('scopes', { frameId })
    const scopes = scopesResponse?.scopes || []
    const allScopes = []

    for (const scope of scopes) {
        if (!shouldIncludeScope(scope, scopeName, includeRegisters)) continue

        const variablesResponse = await session.customRequest('variables', {
            variablesReference: scope.variablesReference,
            count: maxChildren
        })
        const variables = variablesResponse?.variables || []

        allScopes.push({
            name: scope.name,
            variablesReference: scope.variablesReference,
            expensive: scope.expensive,
            source: scope.source,
            line: scope.line,
            column: scope.column,
            endLine: scope.endLine,
            endColumn: scope.endColumn,
            variables: await Promise.all(variables.map(async (v: any) => {
                const variable = summarizeVariable(v)
                if (depth > 0 && v.variablesReference) {
                    return {
                        ...variable,
                        children: await getExpandedVariables(
                            session,
                            v.variablesReference,
                            depth - 1,
                            maxChildren
                        )
                    }
                }
                return variable
            }))
        })
    }

    return allScopes
}

function summarizeActiveStackItem() {
    const activeStackItem = vscode.debug.activeStackItem
    if (!activeStackItem) {
        return undefined
    }

    const result: any = {
        type: 'frameId' in activeStackItem ? 'stackFrame' : 'thread',
        sessionId: activeStackItem.session.id,
        sessionName: activeStackItem.session.name,
        sessionType: activeStackItem.session.type,
        threadId: activeStackItem.threadId
    }

    if ('frameId' in activeStackItem) {
        result.frameId = (activeStackItem as any).frameId
    }

    return result
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function revealFrameSource(frame: any): Promise<any> {
    if (!frame?.source?.path || frame.line === undefined || frame.line <= 0) {
        return {
            revealed: false,
            reason: 'Frame has no file source location'
        }
    }

    const uri = vscode.Uri.file(frame.source.path)
    const position = new vscode.Position(Math.max(frame.line - 1, 0), Math.max((frame.column || 1) - 1, 0))
    const document = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false,
        selection: new vscode.Range(position, position)
    })
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport)

    return {
        revealed: true,
        file: uri.fsPath,
        line: frame.line,
        column: frame.column,
        activeEditor: {
            file: vscode.window.activeTextEditor?.document.uri.fsPath,
            line: vscode.window.activeTextEditor ? vscode.window.activeTextEditor.selection.active.line + 1 : undefined,
            column: vscode.window.activeTextEditor ? vscode.window.activeTextEditor.selection.active.character + 1 : undefined
        }
    }
}

// Add a breakpoint
export const addBreakpointTool = {
    name: 'add-breakpoint',
    config: {
        title: 'Add Breakpoint',
        description: 'Add a breakpoint to a file at specified line with optional conditions',
        inputSchema: inputSchemas['add-breakpoint']
    },
    handler: async (args: any) => {
        const { file, line, condition, hitCondition, logMessage } = args
        const tmpLogMessage = null
        
        console.log(`[DEBUG] addBreakpoint start: ${file}:${line}`)
        const startTime = Date.now()
        
        try {
            const uri = vscode.Uri.file(path.join(getWorkspaceRoot(), file))
            const location = new vscode.Location(uri, new vscode.Position(line - 1, 0))
            
            console.log(`[DEBUG] Creating breakpoint...`)
            // Create breakpoint
            const breakpoint = new vscode.SourceBreakpoint(location)
            
            // Optional condition settings
            if (condition) {
                (breakpoint as any).condition = condition
            }
            
            if (hitCondition) {
                (breakpoint as any).hitCondition = hitCondition
            }
            
            // if (logMessage) {
            //     (breakpoint as any).logMessage = logMessage
            // }
            
            console.log(`[DEBUG] Before VS Code API call: vscode.debug.addBreakpoints`)
            
            // Timeout guard (10 seconds)
            const addBreakpointPromise = vscode.debug.addBreakpoints([breakpoint])
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('VSCode addBreakpoints API timed out after 10 seconds'))
                }, 10000)
            })
            
            await Promise.race([addBreakpointPromise, timeoutPromise])
            
            const duration = Date.now() - startTime
            console.log(`[DEBUG] Breakpoint added (${duration}ms)`)
            
            const result = {
                file: file,
                line: line,
                condition: condition || null,
                hitCondition: hitCondition || null,
                logMessage: tmpLogMessage || null,
                message: condition || hitCondition || tmpLogMessage ? 
                    t('tools.conditionalBreakpointAdded') :
                    t('tools.breakpointAdded')
            }
            
            return { 
                content: [{ 
                    type: 'text' as const, 
                    text: JSON.stringify(result, null, 2) 
                }] 
            }
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Add multiple breakpoints
export const addBreakpointsTool = {
    name: 'add-breakpoints',
    config: {
        title: 'Add Multiple Breakpoints',
        description: 'Add multiple breakpoints to files with specified lines and optional conditions',
        inputSchema: inputSchemas['add-breakpoints']
    },
    handler: async (args: any) => {
        const { breakpoints } = args
        
        try {
            const results: any[] = []
            const BATCH_SIZE = 5
            
            // Process in batches
            for (let i = 0; i < breakpoints.length; i += BATCH_SIZE) {
                const batch = breakpoints.slice(i, i + BATCH_SIZE)
                const batchBreakpoints: vscode.SourceBreakpoint[] = []
                
                for (const bp of batch) {
                    const { file, line, condition, hitCondition } = bp
                    const uri = vscode.Uri.file(path.join(getWorkspaceRoot(), file))
                    const location = new vscode.Location(uri, new vscode.Position(line - 1, 0))
                    
                    // Create breakpoint
                    const breakpoint = new vscode.SourceBreakpoint(location)
                    
                    // Optional condition settings
                    if (condition) {
                        (breakpoint as any).condition = condition
                    }
                    
                    if (hitCondition) {
                        (breakpoint as any).hitCondition = hitCondition
                    }
                    
                    batchBreakpoints.push(breakpoint)
                    results.push({
                        file: file,
                        line: line,
                        condition: condition || null,
                        hitCondition: hitCondition || null,
                        logMessage: null,
                        message: condition || hitCondition ? 
                            t('tools.conditionalBreakpointAdded') :
                            t('tools.breakpointAdded')
                    })
                }
                
                // Process each batch separately
                await vscode.debug.addBreakpoints(batchBreakpoints)
                
                // Add a short delay between batches
                if (i + BATCH_SIZE < breakpoints.length) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
            }
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        totalBreakpoints: breakpoints.length,
                        results: results
                    }, null, 2)
                }]
            }
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Remove a breakpoint
export const removeBreakpointTool = {
    name: 'remove-breakpoint',
    config: {
        title: 'Remove Breakpoint',
        description: 'Remove breakpoint from a file at specified line',
        inputSchema: inputSchemas['remove-breakpoint']
    },
    handler: async (args: any) => {
        const { file, line } = args
        try {
            const uri = vscode.Uri.file(path.join(getWorkspaceRoot(), file))
            const breakpoints = vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.SourceBreakpoint &&
                bp.location.uri.fsPath === uri.fsPath &&
                bp.location.range.start.line === line - 1
            )
            
            if (breakpoints.length > 0) {
                vscode.debug.removeBreakpoints(breakpoints)
                return asTextContent(t('tools.breakpointRemoved', { file, line }))
            }
            return asTextContent(t('tools.breakpointNotFound', { file, line }))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Clear all breakpoints
export const clearBreakpointsTool = {
    name: 'clear-breakpoints',
    config: {
        title: 'Clear Breakpoints',
        description: 'Remove all breakpoints or breakpoints from a specific file',
        inputSchema: inputSchemas['clear-breakpoints']
    },
    handler: async (args: any) => {
        const startTime = Date.now()
        console.error(`[clear-breakpoints] Handler start`)
        
        const { files } = args as { files?: string[] }
        
        try {
            let breakpoints: vscode.Breakpoint[]
            
            if (files && files.length > 0) {
                // Remove only breakpoints in the specified files
                const uris = files.map(file => vscode.Uri.file(path.join(getWorkspaceRoot(), file)))
                breakpoints = vscode.debug.breakpoints.filter(bp =>
                    bp instanceof vscode.SourceBreakpoint &&
                    uris.some(uri => bp.location.uri.fsPath === uri.fsPath)
                )
                
                if (breakpoints.length > 0) {
                    console.error(`[clear-breakpoints] Before VS Code API call`)
                    vscode.debug.removeBreakpoints(breakpoints)
                    const elapsed = Date.now() - startTime
                    console.error(`[clear-breakpoints] VS Code API call complete (${elapsed}ms)`)
                    
                    const result = asTextContent(t('tools.breakpointsClearedFromFiles', { count: breakpoints.length, files: files.length, fileList: files.join(', ') }))
                    console.error(`[clear-breakpoints] Returning result`)
                    return result
                }
                return asTextContent(t('tools.noBreakpointsInFiles', { files: files.join(', ') }))
            } else {
                // Clear all breakpoints
                breakpoints = vscode.debug.breakpoints.filter(bp => bp instanceof vscode.SourceBreakpoint)
                
                if (breakpoints.length > 0) {
                    console.error(`[clear-breakpoints] Before VS Code API call`)
                    vscode.debug.removeBreakpoints(breakpoints)
                    const elapsed = Date.now() - startTime
                    console.error(`[clear-breakpoints] VS Code API call complete (${elapsed}ms)`)
                    
                    const result = asTextContent(t('tools.breakpointsClearedAll', { count: breakpoints.length }))
                    console.error(`[clear-breakpoints] Returning result`)
                    return result
                }
                return asTextContent(t('tools.noBreakpointsToClear'))
            }
        } catch (error: any) {
            const elapsed = Date.now() - startTime
            console.error(`[clear-breakpoints] Error (${elapsed}ms):`, error)
            return asErrorContent(error)
        }
    }
}

// List all breakpoints
export const listBreakpointsTool = {
    name: 'list-breakpoints',
    config: {
        title: 'List Breakpoints',
        description: 'List all breakpoints in the workspace',
        inputSchema: {}
    },
    handler: async () => {
        try {
            const breakpoints = vscode.debug.breakpoints
                .filter(bp => bp instanceof vscode.SourceBreakpoint)
                .map(bp => {
                    const sbp = bp as vscode.SourceBreakpoint
                    return {
                        file: getRelativePath(sbp.location.uri.fsPath),
                        line: sbp.location.range.start.line + 1,
                        enabled: sbp.enabled
                    }
                })
            
            return { content: [{ type: 'text' as const, text: JSON.stringify(breakpoints, null, 2) }] }
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Start debugging
export const startDebugTool = {
    name: 'start-debug',
    config: {
        title: 'Start Debug Session',
        description: 'Start a debug session with specified configuration',
        inputSchema: inputSchemas['start-debug']
    },
    handler: async (args: any) => {
        const { config } = args
        try {
            const folder = vscode.workspace.workspaceFolders?.[0]
            if (!folder) {
                return asTextContent(t('tools.noWorkspaceFolder'), true)
            }
            
            const success = await vscode.debug.startDebugging(folder, config)
            return asTextContent(success ? t('tools.debugStarted', { config }) : t('tools.debugStartFailed'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Stop debugging
export const stopDebugTool = {
    name: 'stop-debug',
    config: {
        title: 'Stop Debug Session',
        description: 'Stop the active debug session',
        inputSchema: {}
    },
    handler: async () => {
        try {
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.debug.stopDebugging(session)
            return asTextContent(t('tools.debugStopped'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Continue execution
export const continueTool = {
    name: 'continue',
    config: {
        title: 'Continue Execution',
        description: 'Continue execution in debug session',
        inputSchema: {}
    },
    handler: async () => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.commands.executeCommand('workbench.action.debug.continue')
            return asTextContent(t('tools.executionContinued'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Step over
export const stepOverTool = {
    name: 'step-over',
    config: {
        title: 'Step Over',
        description: 'Step over the current line',
        inputSchema: {}
    },
    handler: async () => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.commands.executeCommand('workbench.action.debug.stepOver')
            return asTextContent(t('tools.steppedOver'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Step into
export const stepIntoTool = {
    name: 'step-into',
    config: {
        title: 'Step Into',
        description: 'Step into the function',
        inputSchema: {}
    },
    handler: async () => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.commands.executeCommand('workbench.action.debug.stepInto')
            return asTextContent(t('tools.steppedInto'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Step out
export const stepOutTool = {
    name: 'step-out',
    config: {
        title: 'Step Out',
        description: 'Step out of the current function',
        inputSchema: {}
    },
    handler: async () => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.commands.executeCommand('workbench.action.debug.stepOut')
            return asTextContent(t('tools.steppedOut'))
        } catch (error: any) {
            return asErrorContent(error)
        }
    }
}

// Pause execution
export const pauseTool = {
    name: 'pause',
    config: {
        title: 'Pause Execution',
        description: 'Pause the running debug session',
        inputSchema: {}
    },
    handler: async () => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return asTextContent(t('tools.noActiveDebugSession'))
            }
            
            await vscode.commands.executeCommand('workbench.action.debug.pause')
            return asTextContent(t('tools.executionPaused'))
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Get debug state
export const getDebugStateTool = {
    name: 'get-debug-state',
    config: {
        title: 'Get Debug State',
        description: 'Get current debug session state and information',
        inputSchema: {}
    },
    handler: async () => {
        try {
            const session = vscode.debug.activeDebugSession
            const breakpoints = vscode.debug.breakpoints
            
            const state = {
                hasActiveSession: !!session,
                sessionName: session?.name,
                sessionType: session?.type,
                breakpointCount: breakpoints.length,
                breakpoints: breakpoints
                    .filter(bp => bp instanceof vscode.SourceBreakpoint)
                    .map(bp => {
                        const sbp = bp as vscode.SourceBreakpoint
                        return {
                            file: getRelativePath(sbp.location.uri.fsPath),
                            line: sbp.location.range.start.line + 1,
                            enabled: sbp.enabled
                        }
                    })
            }
            
            return { content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }] }
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Evaluate expression
export const evaluateExpressionTool = {
    name: 'evaluate-expression',
    config: {
        title: 'Evaluate Expression',
        description: 'Evaluate expression in debug context',
        inputSchema: inputSchemas['evaluate-expression']
    },
    handler: async (args: any) => {
        const { expression, frameId, context = 'repl' } = args
        
        try {
            // Check debug session
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return { 
                    content: [{ type: 'text' as const, text: t('tools.noActiveDebugSession') }],
                    isError: true 
                }
            }
            
            console.log('Debug session:', session.name, session.type)
            console.log('Expression to evaluate:', expression)
            
            // Use DebugSession.customRequest for evaluate.
            try {
                const requestBody = {
                    expression: expression,
                    context,
                    frameId: frameId || getActiveFrameId()
                }
                
                console.log('Evaluate request body:', requestBody)
                
                const response = await session.customRequest('evaluate', requestBody)
                
                console.log('Evaluate response:', response)
                
                if (response && response.result !== undefined) {
                    return asJsonContent({
                        expression,
                        frameId: requestBody.frameId,
                        result: response.result,
                        type: response.type,
                        variablesReference: response.variablesReference,
                        namedVariables: response.namedVariables,
                        indexedVariables: response.indexedVariables,
                        memoryReference: response.memoryReference
                    })
                } else {
                    return asJsonContent({ expression, frameId: requestBody.frameId, response })
                }
            } catch (evaluateError) {
                console.log('Evaluate request failed:', evaluateError)
                return { 
                    content: [{ 
                        type: 'text' as const, 
                        text: `Evaluate error: ${evaluateError}` 
                    }],
                    isError: true 
                }
            }
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Inspect a specific variable
export const inspectVariableTool = {
    name: 'inspect-variable',
    config: {
        title: 'Inspect Variable',
        description: 'Get detailed information about a variable',
        inputSchema: inputSchemas['inspect-variable']
    },
    handler: async (args: any) => {
        const {
            variableName,
            frameId,
            scopeName,
            includeRegisters = false,
            depth = DEFAULT_EXPAND_DEPTH,
            maxChildren = DEFAULT_MAX_CHILDREN
        } = args
        
        try {
            // Check debug session
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return { 
                    content: [{ type: 'text' as const, text: t('tools.noActiveDebugSession') }],
                    isError: true 
                }
            }
            
            // First request scopes to inspect variable scopes.
            try {
                const resolvedFrame = await resolveFrameId(session, { frameId })
                if (resolvedFrame.frameId === undefined) {
                    return asJsonContent({ message: 'No stack frame available' })
                }

                const scopesResponse = await session.customRequest('scopes', {
                    frameId: resolvedFrame.frameId
                })
                
                if (scopesResponse && scopesResponse.scopes) {
                    // Request variables for each scope.
                    for (const scope of scopesResponse.scopes) {
                        if (!shouldIncludeScope(scope, scopeName, includeRegisters)) continue

                        const variablesResponse = await session.customRequest('variables', {
                            variablesReference: scope.variablesReference,
                            count: maxChildren
                        })
                        
                        if (variablesResponse && variablesResponse.variables) {
                            // Search by variable name
                            const variable = variablesResponse.variables.find((v: any) => v.name === variableName)
                            if (variable) {
                                const result = {
                                    ...summarizeVariable(variable),
                                    frameId: resolvedFrame.frameId,
                                    threadId: resolvedFrame.threadId,
                                    scope: scope.name,
                                    children: depth > 0 && variable.variablesReference ?
                                        await getExpandedVariables(session, variable.variablesReference, depth - 1, maxChildren) :
                                        undefined
                                }
                                
                                return asJsonContent(result)
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('Variable inspection failed:', error)
            }
            
            // Variable not found
            return asJsonContent({ message: `Variable "${variableName}" not found in scope`, frameId, scopeName })
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// List debug configurations
export const listDebugConfigsTool = {
    name: 'list-debug-configs',
    config: {
        title: 'List Debug Configurations',
        description: 'List all available debug configurations from launch.json',
        inputSchema: inputSchemas['list-debug-configs']
    },
    handler: async () => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
            if (!workspaceFolder) {
                return { 
                    content: [{ type: 'text' as const, text: t('tools.noWorkspaceFolder') }],
                    isError: true 
                }
            }
            
            // Read launch.json
            const launchJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'launch.json')
            
            try {
                const launchJsonContent = await vscode.workspace.fs.readFile(launchJsonUri)
                const contentString = launchJsonContent.toString()
                
                // Print content details for debugging
                console.log('Launch.json content length:', contentString.length)
                console.log('Launch.json first 100 chars:', contentString.substring(0, 100))
                
                // Parse JSON after removing comments
                let launchJson
                try {
                    launchJson = parseJsonWithComments(contentString)
                } catch (parseError: any) {
                    return { 
                        content: [{ 
                            type: 'text' as const, 
                            text: JSON.stringify({
                                workspace: workspaceFolder.name,
                                message: 'launch.json JSON parsing failed',
                                error: parseError.message,
                                contentLength: contentString.length,
                                contentPreview: contentString.substring(0, 200),
                                configurations: []
                            }, null, 2) 
                        }] 
                    }
                }
                
                if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
                    const configs = launchJson.configurations.map((config: any, index: number) => ({
                        name: config.name || `Configuration ${index + 1}`,
                        type: config.type || 'unknown',
                        request: config.request || 'unknown',
                        program: config.program || config.args?.[0] || 'not specified',
                        cwd: config.cwd || 'not specified',
                        env: config.env || {},
                        args: config.args || []
                    }))
                    
                    return { 
                        content: [{ 
                            type: 'text' as const, 
                            text: JSON.stringify({
                                workspace: workspaceFolder.name,
                                configurations: configs,
                                total: configs.length
                            }, null, 2) 
                        }] 
                    }
                } else {
                    return { 
                        content: [{ 
                            type: 'text' as const, 
                            text: JSON.stringify({
                                workspace: workspaceFolder.name,
                                message: 'No debug configurations found in launch.json',
                                configurations: []
                            }, null, 2) 
                        }] 
                    }
                }
            } catch (fileError: any) {
                return { 
                    content: [{ 
                        type: 'text' as const, 
                        text: JSON.stringify({
                            workspace: workspaceFolder.name,
                            message: 'launch.json not found or invalid',
                            error: fileError.message,
                            configurations: []
                        }, null, 2) 
                    }] 
                }
            }
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Select debug configuration
export const selectDebugConfigTool = {
    name: 'select-debug-config',
    config: {
        title: 'Select Debug Configuration',
        description: 'Select a debug configuration by name',
        inputSchema: inputSchemas['select-debug-config']
    },
    handler: async (args: any) => {
        const { configName } = args
        
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
            if (!workspaceFolder) {
                return { 
                    content: [{ type: 'text' as const, text: t('tools.noWorkspaceFolder') }],
                    isError: true 
                }
            }
            
            // Read launch.json
            const launchJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'launch.json')
            
            try {
                const launchJsonContent = await vscode.workspace.fs.readFile(launchJsonUri)
                const launchJson = parseJsonWithComments(launchJsonContent.toString())
                
                if (launchJson.configurations && Array.isArray(launchJson.configurations)) {
                    const selectedConfig = launchJson.configurations.find((config: any) => config.name === configName)
                    
                    if (selectedConfig) {
                        return { 
                            content: [{ 
                                type: 'text' as const, 
                                text: JSON.stringify({
                                    message: `Debug configuration "${configName}" selected`,
                                    configuration: {
                                        name: selectedConfig.name,
                                        type: selectedConfig.type || 'unknown',
                                        request: selectedConfig.request || 'unknown',
                                        program: selectedConfig.program || selectedConfig.args?.[0] || 'not specified',
                                        cwd: selectedConfig.cwd || 'not specified',
                                        env: selectedConfig.env || {},
                                        args: selectedConfig.args || []
                                    }
                                }, null, 2) 
                            }] 
                        }
                    } else {
                        const availableConfigs = launchJson.configurations.map((config: any) => config.name)
                        return { 
                            content: [{ 
                                type: 'text' as const, 
                                text: JSON.stringify({
                                    message: `Debug configuration "${configName}" not found`,
                                    requestedConfig: configName,
                                    availableConfigs: availableConfigs,
                                    suggestion: availableConfigs.length > 0 ? 
                                        `Available configurations: ${availableConfigs.join(', ')}` : 
                                        'No debug configurations available'
                                }, null, 2) 
                            }],
                            isError: true 
                        }
                    }
                } else {
                    return { 
                        content: [{ 
                            type: 'text' as const, 
                            text: 'No debug configurations found in launch.json' 
                        }],
                        isError: true 
                    }
                }
            } catch (fileError: any) {
                return { 
                    content: [{ 
                        type: 'text' as const, 
                        text: `Error reading launch.json: ${fileError.message}` 
                    }],
                    isError: true 
                }
            }
        } catch (error: any) {
            return { 
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true 
            }
        }
    }
}

// Additional tools

// 1. DAP log tool
export const getDapLogTool = {
    name: 'get-dap-log',
    config: {
        title: 'Get DAP Log',
        description: 'Retrieve all DAP protocol messages',
        inputSchema: inputSchemas['get-dap-log']
    },
    handler: async (args: any) => {
        try {
            // DAP message collection is disabled.
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        message: 'DAP message collection is disabled for performance optimization',
                        messages: []
                    }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 2. Breakpoint list tool
export const getBreakpointsTool = {
    name: 'get-breakpoints',
    config: {
        title: 'Get Breakpoints',
        description: 'Retrieve all current breakpoints',
        inputSchema: inputSchemas['get-breakpoints']
    },
    handler: async (args: any) => {
        try {
            const breakpoints = vscode.debug.breakpoints
                .filter(bp => bp instanceof vscode.SourceBreakpoint)
                .map(bp => {
                    const sbp = bp as vscode.SourceBreakpoint
                    return {
                        file: getRelativePath(sbp.location.uri.fsPath),
                        line: sbp.location.range.start.line + 1,
                        enabled: sbp.enabled,
                        condition: sbp.condition,
                        hitCondition: sbp.hitCondition,
                        logMessage: sbp.logMessage
                    }
                })
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(breakpoints, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 3. Active session tool
export const getActiveSessionTool = {
    name: 'get-active-session',
    config: {
        title: 'Get Active Session',
        description: 'Retrieve information about the currently active debug session',
        inputSchema: inputSchemas['get-active-session']
    },
    handler: async (args: any) => {
        try {
            const session = vscode.debug.activeDebugSession
            
            if (!session) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            const sessionInfo = {
                id: session.id,
                name: session.name,
                type: session.type,
                workspaceFolder: session.workspaceFolder?.name,
                configuration: session.configuration
            }
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(sessionInfo, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 4. Debug console tool
export const getDebugConsoleTool = {
    name: 'get-debug-console',
    config: {
        title: 'Get Debug Console',
        description: 'Retrieve recent debug console output',
        inputSchema: inputSchemas['get-debug-console']
    },
    handler: async (args: any) => {
        try {
            const { limit, filter } = args
            
            // DAP message collection is disabled.
            return {
                content: [{
                    type: 'text' as const,
                    text: 'Debug console output collection is disabled for performance optimization'
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 5. Active stack item tool
export const getActiveStackItemTool = {
    name: 'get-active-stack-item',
    config: {
        title: 'Get Active Stack Item',
        description: 'Retrieve currently focused thread or stack frame',
        inputSchema: inputSchemas['get-active-stack-item']
    },
    handler: async (args: any) => {
        try {
            const itemInfo = summarizeActiveStackItem()
            if (!itemInfo) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: 'No focused thread or stack frame' }, null, 2)
                    }]
                }
            }

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(itemInfo, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 6. Call stack tool
export const getCallStackTool = {
    name: 'get-call-stack',
    config: {
        title: 'Get Call Stack',
        description: 'Retrieve complete call stack information',
        inputSchema: inputSchemas['get-call-stack']
    },
    handler: async (args: any) => {
        try {
            const { threadId, startFrame = 0, levels = 100 } = args
            const session = vscode.debug.activeDebugSession
            
            if (!session) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            let targetThreadId = threadId || getActiveThreadId()
            if (!targetThreadId) {
                const threadsResponse = await session.customRequest('threads')
                targetThreadId = threadsResponse?.threads?.[0]?.id
            }

            if (!targetThreadId) {
                return asJsonContent({ message: 'No thread available' })
            }
            
            try {
                const response = await session.customRequest('stackTrace', {
                    threadId: targetThreadId,
                    startFrame: startFrame,
                    levels: levels
                })
                
                if (response && response.stackFrames) {
                    const callStack = {
                        threadId: targetThreadId,
                        totalFrames: response.totalFrames,
                        stackFrames: response.stackFrames.map((frame: any) => ({
                            id: frame.id,
                            name: frame.name,
                            source: frame.source ? {
                                name: frame.source.name,
                                path: frame.source.path,
                                sourceReference: frame.source.sourceReference
                            } : null,
                            line: frame.line,
                            column: frame.column,
                            endLine: frame.endLine,
                            endColumn: frame.endColumn,
                            canRestart: frame.canRestart,
                            instructionPointerReference: frame.instructionPointerReference,
                            moduleId: frame.moduleId,
                            presentationHint: frame.presentationHint
                        }))
                    }
                    
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify(callStack, null, 2)
                        }]
                    }
                }
            } catch (error) {
                console.log('Stack trace request failed:', error)
            }
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ message: t('resources.callStackFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 6-1. Select a call stack frame and sync the UI
export const selectStackFrameTool = {
    name: 'select-stack-frame',
    config: {
        title: 'Select Stack Frame',
        description: 'Select a stack frame and reveal its source location in VS Code',
        inputSchema: inputSchemas['select-stack-frame']
    },
    handler: async (args: any) => {
        try {
            const {
                threadId,
                frameId,
                frameIndex = 0,
                revealSource = true
            } = args
            const session = vscode.debug.activeDebugSession

            if (!session) {
                return asJsonContent({ message: t('tools.noActiveDebugSession') })
            }

            let targetThreadId = threadId || getActiveThreadId()
            if (!targetThreadId) {
                const threadsResponse = await session.customRequest('threads')
                targetThreadId = threadsResponse?.threads?.[0]?.id
            }

            if (!targetThreadId) {
                return asJsonContent({ message: 'No thread available' })
            }

            const stackResponse = await session.customRequest('stackTrace', {
                threadId: targetThreadId,
                startFrame: 0,
                levels: 100
            })
            const frames = stackResponse?.stackFrames || []
            const targetIndex = frameId !== undefined ?
                frames.findIndex((frame: any) => frame.id === frameId) :
                frameIndex
            const targetFrame = frames[targetIndex]

            if (!targetFrame) {
                return asJsonContent({
                    message: 'Stack frame not found',
                    threadId: targetThreadId,
                    frameId,
                    frameIndex,
                    totalFrames: stackResponse?.totalFrames || frames.length
                })
            }

            const before = summarizeActiveStackItem()
            const commandErrors = []

            try {
                await vscode.commands.executeCommand('workbench.action.debug.callStackTop')
            } catch (error: any) {
                commandErrors.push(`workbench.action.debug.callStackTop: ${error?.message || String(error)}`)
            }

            for (let i = 0; i < targetIndex; i++) {
                try {
                    await vscode.commands.executeCommand('workbench.action.debug.callStackDown')
                } catch (error: any) {
                    commandErrors.push(`workbench.action.debug.callStackDown[${i}]: ${error?.message || String(error)}`)
                    break
                }
            }

            if (targetIndex > 0) {
                await sleep(100)
            }

            const activeAfterCommands = summarizeActiveStackItem()
            if (activeAfterCommands?.type !== 'stackFrame' || activeAfterCommands.frameId !== targetFrame.id) {
                try {
                    await vscode.commands.executeCommand('workbench.action.debug.callStackTop')
                    for (let i = 0; i < targetIndex; i++) {
                        await vscode.commands.executeCommand('workbench.action.debug.callStackDown')
                    }
                    await sleep(100)
                } catch (error: any) {
                    commandErrors.push(`callStack retry: ${error?.message || String(error)}`)
                }
            }

            let after = summarizeActiveStackItem()
            if (after?.type !== 'stackFrame' || after.frameId !== targetFrame.id) {
                try {
                    await vscode.commands.executeCommand('workbench.action.debug.callStackTop')
                    await sleep(50)
                    for (let i = 0; i < targetIndex; i++) {
                        await vscode.commands.executeCommand('workbench.action.debug.callStackDown')
                        await sleep(50)
                    }
                    await sleep(100)
                } catch (error: any) {
                    commandErrors.push(`callStack slow retry: ${error?.message || String(error)}`)
                }
            }

            after = summarizeActiveStackItem()

            if (after?.type !== 'stackFrame' || after.frameId !== targetFrame.id) {
                try {
                    await vscode.commands.executeCommand('workbench.action.debug.callStackBottom')
                    const fromBottomSteps = Math.max(frames.length - targetIndex - 1, 0)
                    for (let i = 0; i < fromBottomSteps; i++) {
                        await vscode.commands.executeCommand('workbench.action.debug.callStackUp')
                    }
                    await sleep(100)
                } catch (error: any) {
                    commandErrors.push(`callStack bottom retry: ${error?.message || String(error)}`)
                }
            }

            after = summarizeActiveStackItem()

            if (after?.type !== 'stackFrame' || after.frameId !== targetFrame.id) {
                try {
                    await vscode.commands.executeCommand('workbench.action.debug.callStackTop')
                    await sleep(100)
                    after = summarizeActiveStackItem()
                } catch (error: any) {
                    commandErrors.push(`callStack top reset: ${error?.message || String(error)}`)
                }
            }

            if (after?.type === 'stackFrame' && after.frameId === frames[0]?.id && targetIndex > 0) {
                try {
                    for (let i = 0; i < targetIndex; i++) {
                        await vscode.commands.executeCommand('workbench.action.debug.callStackDown')
                        await sleep(100)
                    }
                    await sleep(150)
                } catch (error: any) {
                    commandErrors.push(`callStack final down: ${error?.message || String(error)}`)
                }
            }

            after = summarizeActiveStackItem()

            if (after?.type !== 'stackFrame' || after.frameId !== targetFrame.id) {
                commandErrors.push('VS Code did not expose a command path that changed debug.activeStackItem to the target frame')
            }

            const sourceReveal = revealSource ? await revealFrameSource(targetFrame) : undefined
            after = summarizeActiveStackItem()

            return asJsonContent({
                threadId: targetThreadId,
                frameIndex: targetIndex,
                frameId: targetFrame.id,
                frame: {
                    id: targetFrame.id,
                    name: targetFrame.name,
                    source: targetFrame.source ? {
                        name: targetFrame.source.name,
                        path: targetFrame.source.path,
                        sourceReference: targetFrame.source.sourceReference
                    } : null,
                    line: targetFrame.line,
                    column: targetFrame.column,
                    endLine: targetFrame.endLine,
                    endColumn: targetFrame.endColumn
                },
                activeStackItemBefore: before,
                activeStackItemAfter: after,
                debugUiSynced: after?.type === 'stackFrame' && after.frameId === targetFrame.id,
                sourceReveal,
                commandErrors
            })
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 7. Variables and scopes tool
export const getVariablesScopeTool = {
    name: 'get-variables-scope',
    config: {
        title: 'Get Variables and Scopes',
        description: 'Retrieve all variables in current scope',
        inputSchema: inputSchemas['get-variables-scope']
    },
    handler: async (args: any) => {
        try {
            const {
                threadId,
                frameId,
                frameIndex,
                scopeName,
                includeRegisters = false,
                depth = DEFAULT_EXPAND_DEPTH,
                maxChildren = DEFAULT_MAX_CHILDREN
            } = args
            const session = vscode.debug.activeDebugSession
            
            if (!session) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            try {
                const resolvedFrame = await resolveFrameId(session, { threadId, frameId, frameIndex })
                const targetFrameId = resolvedFrame.frameId
                if (targetFrameId === undefined) {
                    return asJsonContent({ message: 'No stack frame available', threadId, frameIndex })
                }

                return asJsonContent({
                    frameId: targetFrameId,
                    threadId: resolvedFrame.threadId,
                    frame: resolvedFrame.frame,
                    depth,
                    maxChildren,
                    scopes: await getFrameScopes(session, targetFrameId, {
                        scopeName,
                        includeRegisters,
                        depth,
                        maxChildren
                    })
                })
            } catch (error) {
                console.log('Variables and scopes request failed:', error)
            }
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ message: t('resources.variablesFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 7-1. Variables by call stack frame tool
export const getStackVariablesTool = {
    name: 'get-stack-variables',
    config: {
        title: 'Get Stack Variables',
        description: 'Retrieve variables for each stack frame in one request',
        inputSchema: inputSchemas['get-stack-variables']
    },
    handler: async (args: any) => {
        try {
            const {
                threadId,
                startFrame = 0,
                levels = 20,
                scopeName,
                includeRegisters = false,
                depth = DEFAULT_EXPAND_DEPTH,
                maxChildren = DEFAULT_MAX_CHILDREN
            } = args
            const session = vscode.debug.activeDebugSession

            if (!session) {
                return asJsonContent({ message: t('tools.noActiveDebugSession') })
            }

            let targetThreadId = threadId || getActiveThreadId()
            if (!targetThreadId) {
                const threadsResponse = await session.customRequest('threads')
                targetThreadId = threadsResponse?.threads?.[0]?.id
            }

            if (!targetThreadId) {
                return asJsonContent({ message: 'No thread available' })
            }

            const response = await session.customRequest('stackTrace', {
                threadId: targetThreadId,
                startFrame,
                levels
            })
            const frames = response?.stackFrames || []

            return asJsonContent({
                threadId: targetThreadId,
                startFrame,
                levels,
                totalFrames: response?.totalFrames,
                depth,
                maxChildren,
                frames: await Promise.all(frames.map(async (frame: any, offset: number) => ({
                    index: startFrame + offset,
                    id: frame.id,
                    name: frame.name,
                    source: frame.source ? {
                        name: frame.source.name,
                        path: frame.source.path,
                        sourceReference: frame.source.sourceReference
                    } : null,
                    line: frame.line,
                    column: frame.column,
                    endLine: frame.endLine,
                    endColumn: frame.endColumn,
                    canRestart: frame.canRestart,
                    instructionPointerReference: frame.instructionPointerReference,
                    moduleId: frame.moduleId,
                    presentationHint: frame.presentationHint,
                    scopes: await getFrameScopes(session, frame.id, {
                        scopeName,
                        includeRegisters,
                        depth,
                        maxChildren
                    })
                })))
            })
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 7-2. Expand variable reference tool
export const expandVariableTool = {
    name: 'expand-variable',
    config: {
        title: 'Expand Variable',
        description: 'Expand a DAP variablesReference and optionally recurse into child variables',
        inputSchema: inputSchemas['expand-variable']
    },
    handler: async (args: any) => {
        try {
            const {
                variablesReference,
                depth = DEFAULT_EXPAND_DEPTH,
                maxChildren = DEFAULT_MAX_CHILDREN
            } = args
            const session = vscode.debug.activeDebugSession

            if (!session) {
                return asJsonContent({ message: t('tools.noActiveDebugSession') })
            }

            const variables = await getExpandedVariables(
                session,
                variablesReference,
                depth,
                maxChildren
            )

            return asJsonContent({
                variablesReference,
                depth,
                maxChildren,
                variables
            })
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 8. Thread list tool
export const getThreadListTool = {
    name: 'get-thread-list',
    config: {
        title: 'Get Thread List',
        description: 'Retrieve all threads in debug session',
        inputSchema: inputSchemas['get-thread-list']
    },
    handler: async (args: any) => {
        try {
            const session = vscode.debug.activeDebugSession
            
            if (!session) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            try {
                const response = await session.customRequest('threads')
                
                if (response && response.threads) {
                    const threadList = {
                        sessionId: session.id,
                        sessionName: session.name,
                        sessionType: session.type,
                        threads: response.threads.map((thread: any) => ({
                            id: thread.id,
                            name: thread.name,
                            presentationHint: thread.presentationHint
                        }))
                    }
                    
                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify(threadList, null, 2)
                        }]
                    }
                }
            } catch (error) {
                console.log('Threads request failed:', error)
            }
            
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ message: t('resources.threadListFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 9. Exception info tool
export const getExceptionInfoTool = {
    name: 'get-exception-info',
    config: {
        title: 'Get Exception Information',
        description: 'Retrieve exception details and stack trace',
        inputSchema: inputSchemas['get-exception-info']
    },
    handler: async (args: any) => {
        try {
            const { limit, includeStackTrace } = args
            const session = vscode.debug.activeDebugSession
            
            if (!session) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            // Exception details cannot be collected while DAP message collection is disabled.
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        message: 'Exception information collection is disabled for performance optimization',
                        sessionId: session.id,
                        sessionName: session.name,
                        exceptions: [],
                        totalExceptions: 0
                    }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 10. VS Code instance selection tool
export const selectVSCodeInstanceTool = {
    name: 'select-vscode-instance',
    config: {
        title: 'Select VSCode Instance',
        description: 'Select a specific VSCode instance to connect to',
        inputSchema: inputSchemas['select-vscode-instance']
    },
    handler: async (args: any) => {
        try {
            const { port, workspace } = args
            
            const activeInstances = await loadActiveInstances()
            
            if (activeInstances.length === 0) {
                return asJsonContent({
                    message: 'No active VSCode instances found',
                    registryPath: getRegistryPath()
                })
            }
            
            // Select by port or workspace
            let selectedInstance = null
            
            if (port) {
                selectedInstance = activeInstances.find((i: RegistryEntry) => i.port === port)
            } else if (workspace) {
                selectedInstance = activeInstances.find((i: RegistryEntry) =>
                    i.workspacePath === workspace || i.workspaceName === workspace
                )
            }
            
            if (selectedInstance) {
                return asJsonContent({
                    message: 'VSCode instance selected',
                    instance: {
                        port: selectedInstance.port,
                        workspaceName: selectedInstance.workspaceName,
                        workspacePath: selectedInstance.workspacePath,
                        pid: selectedInstance.pid,
                        connectionUrl: `http://localhost:${selectedInstance.port}/mcp`
                    },
                    recommendation: `Use --port=${selectedInstance.port} when running the CLI`
                })
            } else {
                return asJsonContent({
                    message: 'No matching VSCode instance found',
                    availableInstances: activeInstances.map((i: RegistryEntry) => ({
                        port: i.port,
                        workspaceName: i.workspaceName,
                        workspacePath: i.workspacePath
                    }))
                })
            }
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 11. Workspace information tool
export const getWorkspaceInfoTool = {
    name: 'get-workspace-info',
    config: {
        title: 'Get Workspace Information',
        description: 'Get information about the current workspace',
        inputSchema: inputSchemas['get-workspace-info']
    },
    handler: async (args: any) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
            
            if (!workspaceFolder) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({ message: t('tools.noWorkspaceFolder') }, null, 2)
                    }]
                }
            }
            
            const configPath = getWorkspaceConfigPath(workspaceFolder.uri.fsPath)
            
            const workspaceInfo = {
                name: workspaceFolder.name,
                path: workspaceFolder.uri.fsPath,
                legacyConfigFile: configPath,
                workspaceConfigWritten: fs.existsSync(configPath),
                registryPath: getRegistryPath(),
                serverInfo: {
                    isRunning: state.isServerRunning(),
                    port: state.currentPort,
                    sessionCount: state.getTransportCount(),
                    uptime: state.getUptime()
                }
            }
            
            return asJsonContent(workspaceInfo)
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// 12. VS Code instance list tool
export const listVSCodeInstancesTool = {
    name: 'list-vscode-instances',
    config: {
        title: 'List VSCode Instances',
        description: 'List all active VSCode instances with debug proxy',
        inputSchema: inputSchemas['list-vscode-instances']
    },
    handler: async (args: any) => {
        try {
            const instances = (await loadActiveInstances()).map((entry: RegistryEntry) => ({
                port: entry.port,
                workspaceName: entry.workspaceName,
                workspacePath: entry.workspacePath,
                pid: entry.pid,
                instanceId: entry.vscodeInstanceId,
                status: isEntryAlive(entry) ? 'active' : 'stale',
                connectionUrl: `http://localhost:${entry.port}/mcp`
            }))
            
            // Include current VS Code instance information.
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]
            const currentInfo = currentWorkspace ? {
                currentInstance: {
                    workspaceName: currentWorkspace.name,
                    workspacePath: currentWorkspace.uri.fsPath,
                    serverRunning: state.isServerRunning(),
                    port: state.currentPort
                }
            } : {}
            
            return asJsonContent({
                ...currentInfo,
                registryPath: getRegistryPath(),
                totalInstances: instances.length,
                activeInstances: instances.filter(i => i.status === 'active').length,
                instances: instances
            })
        } catch (error: any) {
            return {
                content: [{ type: 'text' as const, text: t('tools.error', { error: error.message }) }],
                isError: true
            }
        }
    }
}

// Export all tools
export const allTools = [
    addBreakpointTool,
    addBreakpointsTool,
    removeBreakpointTool,
    clearBreakpointsTool,
    listBreakpointsTool,
    startDebugTool,
    stopDebugTool,
    continueTool,
    stepOverTool,
    stepIntoTool,
    stepOutTool,
    pauseTool,
    getDebugStateTool,
    evaluateExpressionTool,
    inspectVariableTool,
    listDebugConfigsTool,
    selectDebugConfigTool,
    
    // Additional tools
    getDapLogTool,
    getBreakpointsTool,
    getActiveSessionTool,
    getDebugConsoleTool,
    getActiveStackItemTool,
    getCallStackTool,
    selectStackFrameTool,
    getVariablesScopeTool,
    getStackVariablesTool,
    expandVariableTool,
    getThreadListTool,
    getExceptionInfoTool,
    
    // Additional workspace-related tools
    selectVSCodeInstanceTool,
    getWorkspaceInfoTool,
    listVSCodeInstancesTool
]
