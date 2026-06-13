import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { promisify } from 'util'
import { WorkspaceConfig, getWorkspaceConfigPath } from './discovery'
import { t } from './i18n'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const unlink = promisify(fs.unlink)

/**
 * Manages workspace config files.
 * Handles .mcp-debug-tools/config.json when workspace config writing is enabled.
 */
export class ConfigManager {
    private configDir: string
    private configPath: string
    private extensionPath: string
    private config: WorkspaceConfig | null = null
    
    constructor(private workspaceFolder: vscode.WorkspaceFolder | undefined, extensionPath: string) {
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }
        
        this.configDir = path.join(workspaceFolder.uri.fsPath, '.mcp-debug-tools')
        this.configPath = getWorkspaceConfigPath(workspaceFolder.uri.fsPath)
        this.extensionPath = extensionPath
    }
    
    /**
     * Create and initialize the config file.
     */
    async initialize(port: number): Promise<void> {
        try {
            const config: WorkspaceConfig = {
                vscodeInstanceId: this.generateInstanceId(),
                port,
                pid: process.pid,
                workspacePath: this.workspaceFolder!.uri.fsPath,
                workspaceName: this.workspaceFolder!.name
            }
            this.config = config
            
            if (process.env.MCP_DEBUG_TOOLS_WRITE_WORKSPACE_CONFIG === '1') {
                await this.ensureConfigDir()
                await this.saveConfig(config)
                console.log(t('config.created', { path: this.configPath }))
            } else {
                console.log(t('config.workspaceConfigSkipped'))
            }
            
            if (process.env.MCP_DEBUG_TOOLS_INJECT_WORKSPACE_SKILL === '1') {
                await this.injectSkillDocument()
            }
        } catch (error) {
            console.error(t('config.initializeFailed', { error }))
            throw error
        }
    }
    
    /**
     * Copy the AI CLI guide (SKILL) document into the workspace.
     * - .gemini/skills/dap-cli-debugging/SKILL.md (auto-detected by Gemini agents)
     * - .claude/skills/dap-cli-debugging/SKILL.md (auto-detected by Claude Code agents)
     */
    private async injectSkillDocument(): Promise<void> {
        const skillSourcePath = path.join(this.extensionPath, 'resources', 'skills', 'dap-cli-debugging.md')

        if (!fs.existsSync(skillSourcePath)) {
            console.warn(t('config.skillSourceMissing', { path: skillSourcePath }))
            return
        }

        const content = await readFile(skillSourcePath, 'utf8')
        const workspacePath = this.workspaceFolder!.uri.fsPath

        const targets = [
            path.join(workspacePath, '.gemini', 'skills', 'dap-cli-debugging', 'SKILL.md'),
            path.join(workspacePath, '.claude', 'skills', 'dap-cli-debugging', 'SKILL.md'),
        ]

        for (const destPath of targets) {
            try {
                await mkdir(path.dirname(destPath), { recursive: true })
                await writeFile(destPath, content, 'utf8')
                console.log(t('config.skillInjected', { path: destPath }))
            } catch (error) {
                console.error(t('config.skillInjectFailed', { path: destPath, error }))
            }
        }
    }
    
    /**
     * Update the config file.
     */
    async updateConfig(updates: Partial<WorkspaceConfig>): Promise<void> {
        try {
            const currentConfig = await this.loadConfig()
            if (!currentConfig) {
                console.error(t('config.noConfigToUpdate'))
                return
            }
            const updatedConfig: WorkspaceConfig = {
                ...currentConfig,
                ...updates
            }
            this.config = updatedConfig
            if (process.env.MCP_DEBUG_TOOLS_WRITE_WORKSPACE_CONFIG !== '1') {
                return
            }
            await this.saveConfig(updatedConfig)
        } catch (error) {
            console.error(t('config.updateFailed', { error }))
            throw error
        }
    }
    
    /**
     * Load the config file.
     */
    async loadConfig(): Promise<WorkspaceConfig | null> {
        if (this.config) {
            return this.config
        }

        try {
            const data = await readFile(this.configPath, 'utf8')
            return JSON.parse(data)
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                return null
            }
            throw error
        }
    }
    
    /**
     * Save the config file.
     */
    private async saveConfig(config: WorkspaceConfig): Promise<void> {
        const data = JSON.stringify(config, null, 2)
        await writeFile(this.configPath, data, 'utf8')
    }
    
    /**
     * Ensure the config directory exists.
     */
    private async ensureConfigDir(): Promise<void> {
        try {
            await mkdir(this.configDir, { recursive: true })
        } catch (error) {
            if ((error as any).code !== 'EEXIST') {
                throw error
            }
        }
    }
    
    /**
     * Delete the config file.
     */
    async cleanup(): Promise<void> {
        this.config = null
        if (process.env.MCP_DEBUG_TOOLS_WRITE_WORKSPACE_CONFIG !== '1') {
            return
        }

        try {
            // Delete the file.
            await unlink(this.configPath)
            console.log(t('config.removed', { path: this.configPath }))
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error(t('config.cleanupFailed', { error }))
            }
        }
    }
    
    /**
     * Generate a unique instance ID.
     */
    private generateInstanceId(): string {
        return `vscode-${process.pid}-${Date.now()}`
    }
    
}
