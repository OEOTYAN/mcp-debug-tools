import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const unlink = promisify(fs.unlink)

export interface WorkspaceConfig {
    vscodeInstanceId: string
    port: number
    pid: number
    workspacePath: string
    workspaceName: string
}

/**
 * Workspace 설정 파일 관리자
 * .mcp-debug-tools/config.json 파일을 관리합니다
 */
export class ConfigManager {
    private configDir: string
    private configPath: string
    private extensionPath: string
    
    constructor(private workspaceFolder: vscode.WorkspaceFolder | undefined, extensionPath: string) {
        if (!workspaceFolder) {
            throw new Error('No workspace folder found')
        }
        
        this.configDir = path.join(workspaceFolder.uri.fsPath, '.mcp-debug-tools')
        this.configPath = path.join(this.configDir, 'config.json')
        this.extensionPath = extensionPath
    }
    
    /**
     * 설정 파일 생성 및 초기화
     */
    async initialize(port: number): Promise<void> {
        try {
            // 디렉토리 생성 (없으면)
            await this.ensureConfigDir()
            
            // 설정 생성
            const config: WorkspaceConfig = {
                vscodeInstanceId: this.generateInstanceId(),
                port,
                pid: process.pid,
                workspacePath: this.workspaceFolder!.uri.fsPath,
                workspaceName: this.workspaceFolder!.name
            }
            
            // 파일 저장
            await this.saveConfig(config)
            
            // 스킬 문서(CLI 가이드) 복사 주입
            await this.injectSkillDocument()
            
            console.log(`Config file created at: ${this.configPath}`)
        } catch (error) {
            console.error('Failed to initialize config:', error)
            throw error
        }
    }
    
    /**
     * AI CLI 가이드(SKILL) 문서를 워크스페이스에 복사하여 제공합니다.
     * - .gemini/skills/dap-cli-debugging/SKILL.md (Gemini 에이전트 자동 인식용)
     * - .claude/skills/dap-cli-debugging/SKILL.md (Claude Code 에이전트 자동 인식용)
     */
    private async injectSkillDocument(): Promise<void> {
        const skillSourcePath = path.join(this.extensionPath, 'resources', 'skills', 'dap-cli-debugging.md')

        if (!fs.existsSync(skillSourcePath)) {
            console.warn(`SKILL document source not found at: ${skillSourcePath}`)
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
                console.log(`SKILL document injected at: ${destPath}`)
            } catch (error) {
                console.error(`Failed to inject SKILL document to ${destPath}:`, error)
            }
        }
    }
    
    /**
     * 설정 파일 업데이트
     */
    async updateConfig(updates: Partial<WorkspaceConfig>): Promise<void> {
        try {
            const currentConfig = await this.loadConfig()
            if (!currentConfig) {
                console.error('No config to update')
                return
            }
            const updatedConfig: WorkspaceConfig = {
                ...currentConfig,
                ...updates
            }
            await this.saveConfig(updatedConfig)
        } catch (error) {
            console.error('Failed to update config:', error)
            throw error
        }
    }
    
    /**
     * 설정 파일 로드
     */
    async loadConfig(): Promise<WorkspaceConfig | null> {
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
     * 설정 파일 저장
     */
    private async saveConfig(config: WorkspaceConfig): Promise<void> {
        const data = JSON.stringify(config, null, 2)
        await writeFile(this.configPath, data, 'utf8')
    }
    
    /**
     * 디렉토리 확인 및 생성
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
     * 설정 파일 삭제
     */
    async cleanup(): Promise<void> {
        try {
            // 파일 삭제
            await unlink(this.configPath)
            console.log(`Config file removed: ${this.configPath}`)
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                console.error('Failed to cleanup config:', error)
            }
        }
    }
    
    /**
     * 고유 인스턴스 ID 생성
     */
    private generateInstanceId(): string {
        return `vscode-${process.pid}-${Date.now()}`
    }
    
}