import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { t } from './i18n.js'
import {
    RegistryEntry,
    WorkspaceConfig,
    getWorkspaceConfigPath,
    isProcessAlive,
    loadActiveInstances
} from './discovery.js'

const readFile = promisify(fs.readFile)

/**
 * Finds workspace config files and VS Code instances.
 */
export class ConfigFinder {

    /**
     * Search upward from the current directory for legacy .mcp-debug-tools/config.json.
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

                    // Check whether VS Code is still alive.
                    if (this.isConfigAlive(config)) {
                        console.error(t('finder.workspaceConfigFound', { dir: currentDir }))
                        return { config, path: configPath }
                    } else {
                        console.error(t('finder.staleConfigIgnored', { path: configPath }))
                    }
                } catch (error) {
                    console.error(t('finder.configReadFailed', { error }))
                }
            }

            // Move to the parent directory.
            currentDir = path.dirname(currentDir)
        }

        return null
    }

    /**
     * Find active instances from the temp/global registry.
     */
    static async findFromGlobalRegistry(): Promise<RegistryEntry[]> {
        try {
            return await loadActiveInstances()
        } catch (error) {
            console.error(t('finder.registryReadFailed', { error }))
            return []
        }
    }

    /**
     * Automatically find a VS Code instance.
     * 1. Check the temp/global registry.
     * 2. Fall back to searching legacy workspace config upward from cwd.
     */
    static async findVSCodeInstance(): Promise<{ port: number, workspace?: string } | null> {
        console.error(t('finder.discoveryStart'))

        // 1. Check the temp/global registry.
        const instances = await this.findFromGlobalRegistry()

        if (instances.length === 1) {
            const instance = instances[0]
            console.error(t('finder.singleInstanceFound', { name: instance.workspaceName, port: instance.port }))
            return {
                port: instance.port,
                workspace: instance.workspacePath
            }
        }

        if (instances.length > 1) {
            console.error(t('finder.multipleInstancesFound', { count: instances.length }))
            instances.forEach((inst, idx) => {
                console.error(t('finder.instanceListItem', { index: idx + 1, name: inst.workspaceName, port: inst.port }))
            })

            const cwd = path.resolve(process.cwd()).toLowerCase()
            const workspaceMatch = instances.find(inst =>
                cwd === path.resolve(inst.workspacePath).toLowerCase() ||
                cwd.startsWith(path.resolve(inst.workspacePath).toLowerCase() + path.sep)
            )
            const selected = workspaceMatch || instances[0]
            console.error(t('finder.instanceSelected', { name: selected.workspaceName }))

            return {
                port: selected.port,
                workspace: selected.workspacePath
            }
        }

        // 2. Search legacy workspace config.
        console.error(t('finder.checkingLegacyConfig'))
        const workspaceConfig = await this.findWorkspaceConfig()
        if (workspaceConfig) {
            console.error(t('finder.workspaceInstanceFound', { port: workspaceConfig.config.port }))
            return {
                port: workspaceConfig.config.port,
                workspace: workspaceConfig.config.workspacePath
            }
        }

        console.error(t('finder.noActiveInstance'))
        return null
    }

    /**
     * Check config liveness using only the PID.
     */
    private static isConfigAlive(config: WorkspaceConfig): boolean {
        return isProcessAlive(config.pid)
    }
}
