import {
    RegistryEntry,
    WorkspaceConfig,
    getRegistryPath,
    isEntryAlive,
    loadRegistry,
    saveRegistry
} from './discovery'
import { t } from './i18n'

/**
 * Manages the global active instance registry.
 * Stores active instances in ~/.mcp-debug-tools/active-configs.json.
 */
export class RegistryManager {
    private registryPath: string
    private cleanupTimer?: NodeJS.Timeout
    
    constructor() {
        this.registryPath = getRegistryPath()
    }
    
    /**
     * Initialize the registry manager.
     */
    async initialize(): Promise<void> {
        // Periodically clean up stale entries every 30 seconds.
        this.startCleanupTimer()
    }
    
    /**
     * Register a VS Code instance.
     */
    async registerInstance(config: WorkspaceConfig, configPath?: string): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // Create a new entry.
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
            
            // Remove existing entries for the same workspace.
            registry.activeInstances = registry.activeInstances.filter(
                e => e.workspacePath !== config.workspacePath
            )
            
            // Add the new entry.
            registry.activeInstances.push(entry)
            registry.lastUpdated = Date.now()
            
            // Save the registry.
            await saveRegistry(this.registryPath, registry)
            
            console.log(t('registry.registered', { id: config.vscodeInstanceId, port: config.port }))
        } catch (error) {
            console.error(t('registry.registerFailed', { error }))
            throw error
        }
    }
    
    /**
     * Unregister a VS Code instance.
     */
    async unregisterInstance(vscodeInstanceId: string): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // Remove the instance.
            registry.activeInstances = registry.activeInstances.filter(
                e => e.vscodeInstanceId !== vscodeInstanceId
            )
            registry.lastUpdated = Date.now()
            
            // Save the registry.
            await saveRegistry(this.registryPath, registry)
            
            console.log(t('registry.unregistered', { id: vscodeInstanceId }))
        } catch (error) {
            console.error(t('registry.unregisterFailed', { error }))
        }
    }
    
    /**
     * Get active instances.
     */
    async getActiveInstances(): Promise<RegistryEntry[]> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // Keep entries whose PIDs are still alive.
            const activeInstances = registry.activeInstances.filter(
                e => isEntryAlive(e)
            )
            
            return activeInstances
        } catch (error) {
            console.error(t('registry.activeInstancesFailed', { error }))
            return []
        }
    }
    
    /**
     * Find the active instance for a specific workspace.
     */
    async findInstanceByWorkspace(workspacePath: string): Promise<RegistryEntry | null> {
        const instances = await this.getActiveInstances()
        return instances.find(e => e.workspacePath === workspacePath) || null
    }
    
    /**
     * Start the stale-entry cleanup timer.
     */
    private startCleanupTimer(): void {
        // Clear any existing timer.
        this.stopCleanupTimer()
        
        // Clean up stale entries every 30 seconds.
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanupStaleEntries()
            } catch (error) {
                console.error(t('registry.cleanupFailed', { error }))
            }
        }, 30000)
    }
    
    /**
     * Stop the stale-entry cleanup timer.
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer as unknown as number)
            this.cleanupTimer = undefined
        }
    }
    
    /**
     * Clean up stale entries.
     */
    private async cleanupStaleEntries(): Promise<void> {
        try {
            const registry = await loadRegistry(this.registryPath)
            
            // Keep only live instances.
            const aliveInstances = registry.activeInstances.filter(
                e => isEntryAlive(e)
            )
            
            if (aliveInstances.length !== registry.activeInstances.length) {
                registry.activeInstances = aliveInstances
                registry.lastUpdated = Date.now()
                await saveRegistry(this.registryPath, registry)
                
                const removed = registry.activeInstances.length - aliveInstances.length
                console.log(t('registry.staleCleaned', { count: removed }))
            }
        } catch (error) {
            console.error(t('registry.staleCleanupFailed', { error }))
        }
    }
    
    /**
     * Clean up resources.
     */
    async cleanup(vscodeInstanceId?: string): Promise<void> {
        // Stop the timer.
        this.stopCleanupTimer()
        
        // Unregister the instance.
        if (vscodeInstanceId) {
            await this.unregisterInstance(vscodeInstanceId)
        }
    }
}

// Singleton instance.
export const registryManager = new RegistryManager()
