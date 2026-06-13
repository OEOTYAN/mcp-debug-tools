import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import {
    RegistryEntry,
    WorkspaceConfig,
    getWorkspaceConfigPath,
    isProcessAlive,
    loadActiveInstances
} from './discovery.js'

const readFile = promisify(fs.readFile)

/**
 * 설정 파일 탐색 및 VSCode 인스턴스 찾기
 */
export class ConfigFinder {

    /**
     * 현재 디렉토리부터 상위로 탐색하며 레거시 .mcp-debug-tools/config.json 찾기
     */
    static async findWorkspaceConfig(): Promise<{ config: WorkspaceConfig, path: string } | null> {
        let currentDir = process.cwd()
        const root = path.parse(currentDir).root

        while (currentDir !== root) {
            const configPath = getWorkspaceConfigPath(currentDir)

            if (fs.existsSync(configPath)) {
                try {
                    const data = await readFile(configPath, 'utf8')
                    const config = JSON.parse(data) as WorkspaceConfig

                    // VSCode가 살아있는지 확인
                    if (this.isConfigAlive(config)) {
                        console.error(`[자동 연결] Workspace 설정 발견: ${currentDir}`)
                        return { config, path: configPath }
                    } else {
                        console.error(`[자동 연결] Stale 설정 무시: ${configPath}`)
                    }
                } catch (error) {
                    console.error(`[자동 연결] 설정 파일 읽기 실패: ${error}`)
                }
            }

            // 상위 디렉토리로 이동
            currentDir = path.dirname(currentDir)
        }

        return null
    }

    /**
     * Temp/global 레지스트리에서 활성 인스턴스 찾기
     */
    static async findFromGlobalRegistry(): Promise<RegistryEntry[]> {
        try {
            return await loadActiveInstances()
        } catch (error) {
            console.error(`[자동 연결] 레지스트리 읽기 실패: ${error}`)
            return []
        }
    }

    /**
     * 자동으로 VSCode 인스턴스 찾기
     * 1. Temp/global registry 확인
     * 2. 못 찾으면 현재 디렉토리부터 상위로 레거시 workspace config 탐색
     */
    static async findVSCodeInstance(): Promise<{ port: number, workspace?: string } | null> {
        console.error('[자동 연결] VSCode 인스턴스 탐색 시작...')

        // 1. Temp/global registry 확인
        const instances = await this.findFromGlobalRegistry()

        if (instances.length === 1) {
            const instance = instances[0]
            console.error(`[자동 연결] ✅ 단일 VSCode 발견 - ${instance.workspaceName} (Port: ${instance.port})`)
            return {
                port: instance.port,
                workspace: instance.workspacePath
            }
        }

        if (instances.length > 1) {
            console.error(`[자동 연결] 🔍 ${instances.length}개의 활성 VSCode 인스턴스 발견:`)
            instances.forEach((inst, idx) => {
                console.error(`  ${idx + 1}. ${inst.workspaceName} (Port: ${inst.port})`)
            })

            const cwd = path.resolve(process.cwd()).toLowerCase()
            const workspaceMatch = instances.find(inst =>
                cwd === path.resolve(inst.workspacePath).toLowerCase() ||
                cwd.startsWith(path.resolve(inst.workspacePath).toLowerCase() + path.sep)
            )
            const selected = workspaceMatch || instances[0]
            console.error(`[자동 연결] ⚡ 인스턴스 선택: ${selected.workspaceName}`)

            return {
                port: selected.port,
                workspace: selected.workspacePath
            }
        }

        // 2. 레거시 workspace 설정 파일 탐색
        console.error('[자동 연결] Registry에서 못 찾음, 레거시 Workspace 설정 확인...')
        const workspaceConfig = await this.findWorkspaceConfig()
        if (workspaceConfig) {
            console.error(`[자동 연결] ✅ Workspace VSCode 발견 - Port: ${workspaceConfig.config.port}`)
            return {
                port: workspaceConfig.config.port,
                workspace: workspaceConfig.config.workspacePath
            }
        }

        console.error('[자동 연결] ❌ 활성 VSCode 인스턴스를 찾을 수 없음')
        return null
    }

    /**
     * 설정이 살아있는지 확인 (PID 체크만)
     */
    private static isConfigAlive(config: WorkspaceConfig): boolean {
        return isProcessAlive(config.pid)
    }
}
