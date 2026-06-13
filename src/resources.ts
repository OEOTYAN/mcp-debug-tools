import * as vscode from 'vscode'
import { state } from './state'
import { getRelativePath } from './utils/path'
import { parseJsonWithComments } from './utils/json'
import { t } from './i18n'

// DAP log (legacy resource)
export const dapLogResource = {
    name: 'dap-log',
    uri: 'dap-log://current',
    config: {
        title: 'DAP Log',
        description: 'Debug Adapter Protocol messages log',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify([], null, 2)  // DAP messages no longer tracked
            }]
        }
    }
}

// Breakpoint list
export const breakpointsResource = {
    name: 'breakpoints',
    uri: 'debug://breakpoints',
    config: {
        title: 'Current Breakpoints',
        description: 'List of all breakpoints',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
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
            contents: [{ 
                uri: uri.href,
                text: JSON.stringify(breakpoints, null, 2) 
            }] 
        }
    }
}

// Active debug session
export const activeSessionResource = {
    name: 'active-session',
    uri: 'debug://active-session',
    config: {
        title: 'Active Debug Session',
        description: 'Information about the currently active debug session',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        const session = vscode.debug.activeDebugSession
        
        if (!session) {
            return {
                contents: [{
                    uri: uri.href,
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
            contents: [{ 
                uri: uri.href,
                text: JSON.stringify(sessionInfo, null, 2) 
            }] 
        }
    }
}

// Debug console output
export const debugConsoleResource = {
    name: 'debug-console',
    uri: 'debug://console',
    config: {
        title: 'Debug Console Output',
        description: 'Recent debug console output',
        mimeType: 'text/plain'
    },
    handler: async (uri: URL) => {
        // DAP messages are no longer tracked
        return {
            contents: [{
                uri: uri.href,
                text: t('resources.debugConsoleUnavailable')
            }]
        }
    }
}

// Active stack item (thread or stack frame)
export const activeStackItemResource = {
    name: 'active-stack-item',
    uri: 'debug://active-stack-item',
    config: {
        title: 'Active Stack Item',
        description: 'Currently focused thread or stack frame',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        const activeStackItem = vscode.debug.activeStackItem
        
        if (!activeStackItem) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ message: t('resources.noFocusedStackItem') }, null, 2)
                }]
            }
        }
        
        // VS Code Debug API exposes limited activeStackItem internals,
        // so return only basic information.
        const itemInfo: any = {
            type: 'frameId' in activeStackItem ? 'stackFrame' : 'thread',
            sessionId: activeStackItem.session.id,
            sessionName: activeStackItem.session.name,
            sessionType: activeStackItem.session.type
        }
        
        // Stack frame case
        if ('frameId' in activeStackItem) {
            itemInfo.frameId = (activeStackItem as any).frameId
            itemInfo.threadId = activeStackItem.threadId
        } else {
            // Thread case
            itemInfo.threadId = activeStackItem.threadId
        }
        
        return {
            contents: [{
                uri: uri.href,
                text: JSON.stringify(itemInfo, null, 2)
            }]
        }
    }
}

// Call stack information
export const callStackResource = {
    name: 'call-stack',
    uri: 'debug://call-stack',
    config: {
        title: 'Call Stack',
        description: 'Complete call stack information',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        try {
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            const activeStackItem = vscode.debug.activeStackItem
            if (!activeStackItem) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('resources.noActiveStackFrame') }, null, 2)
                    }]
                }
            }
            
            // Fetch call stack information through the DAP stackTrace request.
            try {
                const response = await session.customRequest('stackTrace', {
                    threadId: activeStackItem.threadId,
                    startFrame: 0,
                    levels: 100 // Fetch enough frames for inspection
                })
                
                if (response && response.stackFrames) {
                    const callStack = {
                        threadId: activeStackItem.threadId,
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
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(callStack, null, 2)
                        }]
                    }
                }
            } catch (error) {
                console.log('Stack trace request failed:', error)
            }
            
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ message: t('resources.callStackFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ error: error.message }, null, 2)
                }]
            }
        }
    }
}

// Variables and scope information
export const variablesScopeResource = {
    name: 'variables-scope',
    uri: 'debug://variables-scope',
    config: {
        title: 'Variables and Scopes',
        description: 'All variables in current scope',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        try {
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            const activeStackItem = vscode.debug.activeStackItem
            if (!activeStackItem) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('resources.noActiveStackFrame') }, null, 2)
                    }]
                }
            }
            
            // Fetch scope information through the DAP scopes request.
            try {
                const scopesResponse = await session.customRequest('scopes', {
                    frameId: 'frameId' in activeStackItem ? (activeStackItem as any).frameId : undefined
                })
                
                if (scopesResponse && scopesResponse.scopes) {
                    const allScopes = []
                    
                    // Request variables for each scope.
                    for (const scope of scopesResponse.scopes) {
                        const variablesResponse = await session.customRequest('variables', {
                            variablesReference: scope.variablesReference
                        })
                        
                        const scopeInfo = {
                            name: scope.name,
                            variablesReference: scope.variablesReference,
                            expensive: scope.expensive,
                            source: scope.source,
                            line: scope.line,
                            column: scope.column,
                            endLine: scope.endLine,
                            endColumn: scope.endColumn,
                            variables: variablesResponse && variablesResponse.variables ? 
                                variablesResponse.variables.map((v: any) => ({
                                    name: v.name,
                                    value: v.value,
                                    type: v.type,
                                    variablesReference: v.variablesReference,
                                    presentationHint: v.presentationHint,
                                    evaluateName: v.evaluateName
                                })) : []
                        }
                        
                        allScopes.push(scopeInfo)
                    }
                    
                    const result = {
                        frameId: 'frameId' in activeStackItem ? (activeStackItem as any).frameId : undefined,
                        threadId: activeStackItem.threadId,
                        scopes: allScopes
                    }
                    
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(result, null, 2)
                        }]
                    }
                }
            } catch (error) {
                console.log('Variables and scopes request failed:', error)
            }
            
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ message: t('resources.variablesFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ error: error.message }, null, 2)
                }]
            }
        }
    }
}

// Thread list
export const threadListResource = {
    name: 'thread-list',
    uri: 'debug://thread-list',
    config: {
        title: 'Thread List',
        description: 'All threads in debug session',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        try {
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            // Fetch the thread list through the DAP threads request.
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
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(threadList, null, 2)
                        }]
                    }
                }
            } catch (error) {
                console.log('Threads request failed:', error)
            }
            
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ message: t('resources.threadListFailed') }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ error: error.message }, null, 2)
                }]
            }
        }
    }
}

// Exception information
export const exceptionInfoResource = {
    name: 'exception-info',
    uri: 'debug://exception-info',
    config: {
        title: 'Exception Information',
        description: 'Exception details and stack trace',
        mimeType: 'application/json'
    },
    handler: async (uri: URL) => {
        try {
            const session = vscode.debug.activeDebugSession
            if (!session) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ message: t('tools.noActiveDebugSession') }, null, 2)
                    }]
                }
            }
            
            // DAP messages are no longer tracked
            // Exception information cannot be extracted without DAP message tracking
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({
                        message: t('resources.exceptionUnavailable')
                    }, null, 2)
                }]
            }
        } catch (error: any) {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ error: error.message }, null, 2)
                }]
            }
        }
    }
}

// Export all resources
export const allResources = [
    dapLogResource,
    breakpointsResource,
    activeSessionResource,
    debugConsoleResource,
    activeStackItemResource,
    callStackResource,
    variablesScopeResource,
    threadListResource,
    exceptionInfoResource
]
