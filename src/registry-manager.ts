import {
    RegistryEntry,
    WorkspaceConfig,
    getRegistryPath,
    isEntryAlive,
    loadRegistry,
    saveRegistry
} from './discovery'

/**
 * 글로벌 레지스트리 관리자
 * ~/.mcp-debug-tools/active-configs.json 파일을 관리합니다
 */
export class RegistryManager {
    private registryPath: string
    private cleanupTimer?: NodeJS.Timeout
    
    constructor() {
        this.registryPath = getRegistryPath()
    }
    
    /**
     * 레지스트리 초기화
     */
    async initialize(): Promise<void> {
        // 정기적으로 stale 엔트리 정리 (30초마다)
        this.startCleanupTimer()
    }
    
    /**
     * VSCode 인스턴스 등록
     */
    async registerInstance(config: WorkspaceConfig, configPath?: string): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // 새 엔트리 생성
            const entry: RegistryEntry = {
                vscodeInstanceId: config.vscodeInstanceId,
                workspacePath: config.workspacePath,
                workspaceName: config.workspaceName,
                port: config.port,
                pid: config.pid,
                lastSeen: Date.now()
            }

            if (process.env.MCP_DEBUG_TOOLS_WRITE_WORKSPACE_CONFIG === '1' && configPath) {
                entry.configPath = configPath
            }
            
            // 기존 엔트리 제거 (같은 workspace)
            registry.activeInstances = registry.activeInstances.filter(
                e => e.workspacePath !== config.workspacePath
            )
            
            // 새 엔트리 추가
            registry.activeInstances.push(entry)
            registry.lastUpdated = Date.now()
            
            // 저장
            await saveRegistry(this.registryPath, registry)
            
            console.log(`Instance registered: ${config.vscodeInstanceId} at port ${config.port}`)
        } catch (error) {
            console.error('Failed to register instance:', error)
            throw error
        }
    }
    
    /**
     * VSCode 인스턴스 등록 해제
     */
    async unregisterInstance(vscodeInstanceId: string): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // 인스턴스 제거
            registry.activeInstances = registry.activeInstances.filter(
                e => e.vscodeInstanceId !== vscodeInstanceId
            )
            registry.lastUpdated = Date.now()
            
            // 저장
            await saveRegistry(this.registryPath, registry)
            
            console.log(`Instance unregistered: ${vscodeInstanceId}`)
        } catch (error) {
            console.error('Failed to unregister instance:', error)
        }
    }
    
    /**
     * 활성 인스턴스 목록 조회
     */
    async getActiveInstances(): Promise<RegistryEntry[]> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // PID가 살아있는 엔트리만 필터링
            const activeInstances = registry.activeInstances.filter(
                e => isEntryAlive(e)
            )
            
            return activeInstances
        } catch (error) {
            console.error('Failed to get active instances:', error)
            return []
        }
    }
    
    /**
     * 특정 workspace의 활성 인스턴스 찾기
     */
    async findInstanceByWorkspace(workspacePath: string): Promise<RegistryEntry | null> {
        const instances = await this.getActiveInstances()
        return instances.find(e => e.workspacePath === workspacePath) || null
    }
    
    /**
     * Stale 엔트리 정리 타이머 시작
     */
    private startCleanupTimer(): void {
        // 기존 타이머 정리
        this.stopCleanupTimer()
        
        // 30초마다 stale 엔트리 정리
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanupStaleEntries()
            } catch (error) {
                console.error('Cleanup failed:', error)
            }
        }, 30000)
    }
    
    /**
     * Stale 엔트리 정리 타이머 중지
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer as unknown as number)
            this.cleanupTimer = undefined
        }
    }
    
    /**
     * Stale 엔트리 정리
     */
    private async cleanupStaleEntries(): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // 살아있는 인스턴스만 유지
            const aliveInstances = registry.activeInstances.filter(
                e => isEntryAlive(e)
            )
            
            if (aliveInstances.length !== registry.activeInstances.length) {
                registry.activeInstances = aliveInstances
                registry.lastUpdated = Date.now()
                await saveRegistry(this.registryPath, registry)
                
                const removed = registry.activeInstances.length - aliveInstances.length
                console.log(`Cleaned up ${removed} stale entries`)
            }
        } catch (error) {
            console.error('Failed to cleanup stale entries:', error)
        }
    }
    
    /**
     * 정리
     */
    async cleanup(vscodeInstanceId?: string): Promise<void> {
        // 타이머 중지
        this.stopCleanupTimer()
        
        // 인스턴스 등록 해제
        if (vscodeInstanceId) {
            await this.unregisterInstance(vscodeInstanceId)
        }
    }
}

// 싱글톤 인스턴스
export const registryManager = new RegistryManager()
