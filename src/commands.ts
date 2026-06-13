import * as vscode from 'vscode'
import { getRelativePath, getWorkspaceRoot } from './utils/path'
import * as path from 'path'
import { createMonitoringPanel } from './monitor-panel'
import { initializeMcpServer, createHttpApp, startHttpServer, stopHttpServer } from './server'
import { state } from './state'
import { updateAllPanels } from './monitor-panel'
import { t } from './i18n'

// Status bar update function (import from extension.ts)
let updateStatusBar: (status: 'initializing' | 'running' | 'stopping' | 'error' | 'stopped') => void

export function setStatusBarUpdater(updater: typeof updateStatusBar) {
    updateStatusBar = updater
}

/**
 * Core logic to add a breakpoint to a specified URI and line number.
 * @param filePath - Relative path from workspace root or absolute path
 * @param lineNumber - Line number (1-based)
 */
export async function addBreakpointToUri(filePath: string, lineNumber: number) {
    try {
        let absolutePath: string
        
        // If path is already absolute, use it as is
        if (path.isAbsolute(filePath)) {
            absolutePath = filePath
        } else {
            // Convert relative path to absolute path using workspace root
            const workspaceRoot = getWorkspaceRoot()
            absolutePath = path.join(workspaceRoot, filePath)
        }
        
        const uri = vscode.Uri.file(absolutePath)
        const range = new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0)
        const location = new vscode.Location(uri, range)
        const newBreakpoint = new vscode.SourceBreakpoint(location)
        
        vscode.debug.addBreakpoints([newBreakpoint])
    } catch (error) {
        console.error(t('commands.addBreakpointFailed', { error }))
        throw error
    }
}

/**
 * Start the MCP server
 */
async function startServer() {
    if (state.isServerRunning()) {
        vscode.window.showInformationMessage(t('commands.serverAlreadyRunning'))
        return
    }
    
    try {
        updateStatusBar('initializing')
        
        // Initialize MCP Server
        const mcpServer = initializeMcpServer()
        state.mcpServer = mcpServer

        // Create HTTP app
        const app = createHttpApp(mcpServer)

        // Start HTTP server
        await startHttpServer(app, () => {
            updateStatusBar('running')
            updateAllPanels()
            vscode.window.showInformationMessage(t('commands.serverStarted'))
        })
    } catch (error) {
        updateStatusBar('error')
        vscode.window.showErrorMessage(t('commands.startServerFailed', { error }))
        throw error
    }
}

/**
 * Stop the MCP server
 */
async function stopServer() {
    if (!state.isServerRunning()) {
        vscode.window.showInformationMessage(t('commands.serverNotRunning'))
        return
    }
    
    try {
        updateStatusBar('stopping')
        
        // Stop HTTP server
        await stopHttpServer()

        // Close MCP server
        if (state.mcpServer) {
            state.mcpServer.close()
        }

        // Reset state
        state.reset()
        
        updateStatusBar('stopped')
        updateAllPanels()
        vscode.window.showInformationMessage(t('commands.serverStopped'))
    } catch (error) {
        vscode.window.showErrorMessage(t('commands.stopServerFailed', { error }))
        throw error
    }
}

/**
 * Helper to safely register a command
 */
function safeRegisterCommand(context: vscode.ExtensionContext, commandId: string, callback: (...args: any[]) => any) {
    try {
        const command = vscode.commands.registerCommand(commandId, callback)
        context.subscriptions.push(command)
    } catch (error) {
        console.warn(t('commands.commandRegisterFailed', { commandId }))
    }
}

/**
 * Register all extension commands
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    // Command to add a breakpoint, does NOT require an active debug session
    safeRegisterCommand(context, 'dap-proxy.addUnboundBreakpoint', async () => {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) {
            vscode.window.showErrorMessage(t('commands.noActiveEditor'))
            return
        }
        
        const lineNumberStr = await vscode.window.showInputBox({
            prompt: t('commands.linePrompt'),
            placeHolder: '10'
        })

        if (!lineNumberStr) {
            return // User cancelled
        }

        const lineNumber = parseInt(lineNumberStr, 10)
        if (isNaN(lineNumber) || lineNumber <= 0) {
            vscode.window.showErrorMessage(t('commands.invalidLineNumber'))
            return
        }
        
        const absolutePath = activeEditor.document.uri.fsPath
        const relativePath = getRelativePath(absolutePath)
        
        await addBreakpointToUri(relativePath, lineNumber)
        vscode.window.showInformationMessage(t('commands.breakpointAdded', { file: relativePath, line: lineNumber }))
    })

    // Command to open monitor panel
    safeRegisterCommand(context, 'dap-proxy.openMonitorPanel', () => {
        createMonitoringPanel()
    })

    // Command to start server
    safeRegisterCommand(context, 'dap-proxy.startServer', startServer)

    // Command to stop server
    safeRegisterCommand(context, 'dap-proxy.stopServer', stopServer)
}
