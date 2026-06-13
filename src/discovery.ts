import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

export interface WorkspaceConfig {
    vscodeInstanceId: string
    port: number
    pid: number
    workspacePath: string
    workspaceName: string
}

export interface RegistryEntry extends WorkspaceConfig {
    configPath?: string
    lastSeen?: number
}

export interface GlobalRegistry {
    activeInstances: RegistryEntry[]
    lastUpdated: number
}

export function getStateDir(): string {
    return process.env.MCP_DEBUG_TOOLS_STATE_DIR || path.join(os.tmpdir(), 'mcp-debug-tools')
}

export function getRegistryPath(): string {
    return path.join(getStateDir(), 'active-configs.json')
}

export function getLegacyRegistryPath(): string {
    return path.join(os.homedir(), '.mcp-debug-tools', 'active-configs.json')
}

export function getWorkspaceConfigPath(workspacePath: string): string {
    return path.join(workspacePath, '.mcp-debug-tools', 'config.json')
}

export function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

export async function loadRegistry(registryPath: string): Promise<GlobalRegistry> {
    try {
        const data = await readFile(registryPath, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            return {
                activeInstances: [],
                lastUpdated: Date.now()
            }
        }
        throw error
    }
}

export async function saveRegistry(registryPath: string, registry: GlobalRegistry): Promise<void> {
    await mkdir(path.dirname(registryPath), { recursive: true })
    await writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8')
}

function normalizeWorkspacePath(workspacePath: string): string {
    return path.resolve(workspacePath).toLowerCase()
}

function entryKey(entry: RegistryEntry): string {
    return `${normalizeWorkspacePath(entry.workspacePath)}:${entry.port}`
}

export function isEntryAlive(entry: RegistryEntry): boolean {
    return isProcessAlive(entry.pid)
}

export async function loadActiveInstances(): Promise<RegistryEntry[]> {
    const registries = await Promise.all([
        loadRegistry(getRegistryPath()),
        loadRegistry(getLegacyRegistryPath())
    ])

    const entriesByKey = new Map<string, RegistryEntry>()
    for (const registry of registries) {
        for (const entry of registry.activeInstances || []) {
            const normalizedEntry: RegistryEntry = {
                ...entry,
                configPath: entry.configPath
            }

            if (isEntryAlive(normalizedEntry)) {
                entriesByKey.set(entryKey(normalizedEntry), normalizedEntry)
            }
        }
    }

    return Array.from(entriesByKey.values())
}
