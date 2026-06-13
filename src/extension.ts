import * as vscode from 'vscode'
import { state } from './state'
import { initializeMcpServer, createHttpApp, startHttpServer, stopHttpServer } from './server'
import { registerDapTracker } from './dap-tracker'
import { registerCommands, setStatusBarUpdater } from './commands'
import { updateAllPanels } from './monitor-panel'
import { ConfigManager } from './config-manager'
import { registryManager } from './registry-manager'
import { t } from './i18n'

let statusBarItem: vscode.StatusBarItem
let configManager: ConfigManager | undefined

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Create status bar item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
        statusBarItem.command = 'dap-proxy.openMonitorPanel'
        statusBarItem.show()
        context.subscriptions.push(statusBarItem)
        
        // Update status bar to show initializing
        updateStatusBar('initializing')

        // Initialize MCP Server
        const mcpServer = initializeMcpServer()
        state.mcpServer = mcpServer

        // Create HTTP app
        const app = createHttpApp(mcpServer)

        // Start HTTP server with callback to update panels
        await startHttpServer(app, async () => {
            // Register discovery information once the server starts.
            try {
                // Get the workspace folder.
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
                if (workspaceFolder) {
                    // Initialize ConfigManager.
                    configManager = new ConfigManager(workspaceFolder, context.extensionPath)
                    await configManager.initialize(state.currentPort || 3000)
                    
                    // Register in the global registry.
                    await registryManager.initialize()
                    const config = await configManager.loadConfig()
                    if (config) {
                        const configPath = `${workspaceFolder.uri.fsPath}/.mcp-debug-tools/config.json`
                        await registryManager.registerInstance(config, configPath)
                    }
                    
                    console.log(t('extension.registryInitialized'))
                }
            } catch (error) {
                console.error(t('extension.registryInitFailed', { error }))
            }
            
            // Update all active panels when server starts
            updateAllPanels()
            // Update status bar to show running
            updateStatusBar('running')
        })

        // Set status bar updater for commands
        setStatusBarUpdater(updateStatusBar)

        // Register extension commands
        registerCommands(context)

        // Register DAP tracker
        const dapTrackerDisposable = registerDapTracker(context)
        context.subscriptions.push(dapTrackerDisposable)

        console.log(t('extension.activated'))
    } catch (error) {
        console.error(t('extension.activationFailed', { error }))
        vscode.window.showErrorMessage(t('extension.activationFailed', { error }))
        updateStatusBar('error')
    }
}

export async function deactivate() {
    try {
        // Update status bar
        updateStatusBar('stopping')
        
        // Clean up config and registry state.
        if (configManager) {
            const config = await configManager.loadConfig()
            if (config) {
                await registryManager.cleanup(config.vscodeInstanceId)
            }
            await configManager.cleanup()
            configManager = undefined
        }
        
        // Close MCP server
        if (state.mcpServer) {
            state.mcpServer.close()
            console.log(t('extension.serverDeactivated'))
        }

        // Stop HTTP server
        await stopHttpServer()

        // Reset state
        state.reset()
        
        // Dispose status bar item
        if (statusBarItem) {
            statusBarItem.dispose()
        }

        console.log(t('extension.deactivated'))
    } catch (error) {
        console.error(t('extension.deactivationError', { error }))
    }
}

/**
 * Update status bar item based on server state
 */
function updateStatusBar(status: 'initializing' | 'running' | 'stopping' | 'error' | 'stopped') {
    if (!statusBarItem) return
    
    switch (status) {
        case 'initializing':
            statusBarItem.text = '$(sync~spin) MCP Server starting...'
            statusBarItem.tooltip = t('extension.status.starting')
            statusBarItem.backgroundColor = undefined
            break
        case 'running':
            const port = state.currentPort || '????'
            statusBarItem.text = `$(circle-filled) DAP-MCP:${port}`
            statusBarItem.tooltip = t('extension.status.running')
            statusBarItem.backgroundColor = undefined
            statusBarItem.color = new vscode.ThemeColor('terminal.ansiGreen')
            break
        case 'stopping':
            statusBarItem.text = '$(circle-slash) MCP Server stopping...'
            statusBarItem.tooltip = t('extension.status.stopping')
            statusBarItem.backgroundColor = undefined
            statusBarItem.color = new vscode.ThemeColor('terminal.ansiYellow')
            break
        case 'stopped':
            statusBarItem.text = '$(circle-slash) DAP-MCP:stopped'
            statusBarItem.tooltip = t('extension.status.stopped')
            statusBarItem.backgroundColor = undefined
            statusBarItem.color = new vscode.ThemeColor('terminal.ansiGray')
            break
        case 'error':
            statusBarItem.text = '$(error) MCP Server error'
            statusBarItem.tooltip = t('extension.status.error')
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
            statusBarItem.color = undefined
            break
    }
}
