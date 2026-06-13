import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { state } from './state'
import { WorkspaceConfig } from './discovery'
import { getLocale, t } from './i18n'

/**
 * Create and show the monitoring panel
 */
export function createMonitoringPanel() {
    const panel = vscode.window.createWebviewPanel(
        'dapProxyMonitor',
        t('monitor.title'),
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    )
    
    // Add to active panels list
    state.addPanel(panel)
    
    // Remove from list when panel is disposed
    panel.onDidDispose(() => {
        state.removePanel(panel)
    })
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'copyMcpConfig':
                copyMcpConfigToClipboard()
                break
            case 'refresh':
                updatePanel(panel)
                break
            case 'startServer':
                vscode.commands.executeCommand('dap-proxy.startServer')
                break
            case 'stopServer':
                vscode.commands.executeCommand('dap-proxy.stopServer')
                break
        }
    })
    
    panel.webview.html = getWebviewContent()
}

/**
 * Update all active panels
 */
export function updateAllPanels() {
    state.activePanels.forEach(panel => updatePanel(panel))
}

/**
 * Update a specific panel
 */
function updatePanel(panel: vscode.WebviewPanel) {
    if (panel.webview) {
        panel.title = t('monitor.title')
        panel.webview.html = getWebviewContent()
    }
}

/**
 * Get current server status information
 */
function getServerStatus() {
    return {
        isRunning: state.isServerRunning(),
        host: 'localhost',
        port: state.currentPort,
        fullUrl: state.currentPort ? `http://localhost:${state.currentPort}` : null,
        startTime: state.serverStartTime?.toLocaleString(getDateLocale()),
        uptime: state.getUptime()
    }
}

function getDateLocale(): string {
    return getLocale() === 'zh' ? 'zh-CN' : 'en-US'
}

/**
 * Get workspace configuration status
 */
function getWorkspaceConfigStatus(): { exists: boolean; config?: WorkspaceConfig; path?: string } {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) {
            return { exists: false }
        }
        
        const configPath = path.join(workspaceFolder.uri.fsPath, '.mcp-debug-tools', 'config.json')
        
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8')
            const config = JSON.parse(configData) as WorkspaceConfig
            return { exists: true, config, path: configPath }
        }
        
        return { exists: false, path: configPath }
    } catch (error) {
        console.error(t('monitor.configReadFailed', { error }))
        return { exists: false }
    }
}

/**
 * Generate mcp.json configuration for current server
 */
function generateMcpConfig(): string {
    if (!state.currentPort) {
        return t('monitor.noServerConfig')
    }
    
    const config = {
        "mcpServers": {
            "dap-proxy": {
                "command": "curl",
                "args": [
                    "-X", "POST",
                    `http://localhost:${state.currentPort}/mcp`,
                    "-H", "Content-Type: application/json"
                ]
            }
        }
    }
    
    return JSON.stringify(config, null, 2)
}

/**
 * Copy MCP configuration to clipboard
 */
function copyMcpConfigToClipboard() {
    const config = generateMcpConfig()
    vscode.env.clipboard.writeText(config).then(() => {
        vscode.window.showInformationMessage(t('monitor.configCopied'))
    })
}

/**
 * Generate HTML content for the monitoring panel
 */
function getWebviewContent(): string {
    const serverStatus = getServerStatus()
    const mcpConfig = generateMcpConfig()
    const configStatus = getWorkspaceConfigStatus()
    
    // Format config info for display
    let configInfo = ''
    if (configStatus.exists && configStatus.config) {
        configInfo = `
            <div class="info-grid">
                <span class="info-label">${t('monitor.configPath')}</span>
                <span style="font-size: 11px;">${configStatus.path}</span>
                
                <span class="info-label">${t('monitor.workspace')}</span>
                <span>${configStatus.config.workspaceName}</span>
                
                <span class="info-label">${t('monitor.instanceId')}</span>
                <span style="font-size: 11px;">${configStatus.config.vscodeInstanceId}</span>
                
                <span class="info-label">${t('monitor.pid')}</span>
                <span>${configStatus.config.pid}</span>
            </div>
        `
    } else {
        configInfo = `<p>${t('monitor.noWorkspaceConfig')}</p>`
    }
    
    return `
        <!DOCTYPE html>
        <html lang="${getLocale() === 'zh' ? 'zh-CN' : 'en'}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('monitor.title')}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                h1, h2 {
                    color: var(--vscode-titleBar-activeForeground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                    margin-top: 30px;
                }
                .status-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 8px;
                }
                .status-running { background-color: #4CAF50; }
                .status-stopped { background-color: #f44336; }
                .info-grid {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 10px 20px;
                    margin: 15px 0;
                    font-family: monospace;
                }
                .info-label {
                    font-weight: bold;
                    color: var(--vscode-symbolIcon-propertyForeground);
                }
                .code-block {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin: 10px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    white-space: pre-wrap;
                    overflow-x: auto;
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 5px 5px 5px 0;
                    font-size: 13px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .refresh-btn {
                    float: right;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .beta-notice {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid #ff9800;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
                .warning-box {
                    background-color: var(--vscode-inputValidation-warningBackground);
                    border: 1px solid var(--vscode-inputValidation-warningBorder);
                    border-radius: 4px;
                    padding: 15px;
                    margin: 15px 0;
                }
                .info-box {
                    background-color: var(--vscode-textBlockQuote-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin: 15px 0;
                }
                .feature-list {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                .feature-list li {
                    margin: 8px 0;
                }
                .email-link {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                .email-link:hover {
                    text-decoration: underline;
                }
                .section-divider {
                    border-top: 1px solid var(--vscode-panel-border);
                    margin: 30px 0;
                }
            </style>
        </head>
        <body>
            <h1>🔍 ${t('monitor.title')}
                <button class="button refresh-btn" onclick="refresh()">🔄 ${t('monitor.refresh')}</button>
            </h1>
            
            <div class="beta-notice">
                <strong>⚠️ ${t('monitor.betaNoticeTitle')}</strong><br>
                ${t('monitor.betaNoticeBody')}
            </div>
            
            <h2>📊 ${t('monitor.serverStatus')}</h2>
            <div>
                <span class="status-indicator ${serverStatus.isRunning ? 'status-running' : 'status-stopped'}"></span>
                <strong>${serverStatus.isRunning ? `🟢 ${t('monitor.running')}` : `🔴 ${t('monitor.stopped')}`}</strong>
                
                <!-- Server control buttons -->
                <div style="margin-top: 15px;">
                    ${serverStatus.isRunning ?
                        `<button class="button" onclick="stopServer()" style="background-color: #f44336;">🛑 ${t('monitor.stopServer')}</button>` :
                        `<button class="button" onclick="startServer()" style="background-color: #4CAF50;">▶️ ${t('monitor.startServer')}</button>`
                    }
                </div>
            </div>
            
            <div class="info-grid">
                <span class="info-label">${t('monitor.host')}</span>
                <span>${serverStatus.host}</span>
                
                <span class="info-label">${t('monitor.port')}</span>
                <span>${serverStatus.port || t('monitor.unknown')}</span>
                
                <span class="info-label">${t('monitor.serverUrl')}</span>
                <span>${serverStatus.fullUrl || t('monitor.notAvailable')}</span>
                
                <span class="info-label">${t('monitor.startTime')}</span>
                <span>${serverStatus.startTime || t('monitor.unknown')}</span>
                
                <span class="info-label">${t('monitor.uptime')}</span>
                <span>${serverStatus.uptime || t('monitor.unknown')}</span>
            </div>
            
            <div class="section-divider"></div>
            
            <h2>📁 ${t('monitor.workspaceConfig')}</h2>
            ${configInfo}
            
            <div class="warning-box">
                <strong>⚠️ ${t('monitor.currentLimitations')}</strong><br>
                • ${t('monitor.limitationSingleSession')}<br>
                • ${t('monitor.limitationMultipleSessions')}
            </div>
            
            <h2>🔧 ${t('monitor.multipleSessions')}</h2>
            <p>${t('monitor.multipleSessionsHelp')}</p>
            <div class="code-block">{
  "mcpServers": {
    "dap-proxy": {
      "command": "node",
      "args": [
        "/path/to/mcp-debug-tools/out/cli.js",
        "--port=8890"
      ]
    }
  }
}</div>
            
            <div class="section-divider"></div>
            <h2>🚀 ${t('monitor.upcomingFeatures')}</h2>
            <div class="info-box">
                <p><strong>${t('monitor.featuresIntro')}</strong></p>
                <ul class="feature-list">
                    <li><strong>${t('monitor.featureMultiSessionTitle')}</strong> ${t('monitor.featureMultiSessionBody')}</li>
                    <li><strong>${t('monitor.featureDataStructuresTitle')}</strong> ${t('monitor.featureDataStructuresBody')}</li>
                </ul>
                <p><em>${t('monitor.featuresOutro')}</em></p>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function copyMcpConfig() {
                    vscode.postMessage({command: 'copyMcpConfig'});
                }
                
                function refresh() {
                    vscode.postMessage({command: 'refresh'});
                }
                
                function startServer() {
                    vscode.postMessage({command: 'startServer'});
                }
                
                function stopServer() {
                    vscode.postMessage({command: 'stopServer'});
                }
            </script>
        </body>
        </html>
    `
}
