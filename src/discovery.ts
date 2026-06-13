import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)
const rename = promisify(fs.rename)
const unlink = promisify(fs.unlink)

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

function emptyRegistry(): GlobalRegistry {
    return {
        activeInstances: [],
        lastUpdated: Date.now()
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
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
    const maxAttempts = 3

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const data = await readFile(registryPath, 'utf8')
            if (!data.trim()) {
                throw new SyntaxError('Registry file is empty')
            }
            return JSON.parse(data)
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                return emptyRegistry()
            }

            if (error instanceof SyntaxError && attempt < maxAttempts - 1) {
                await sleep(25 * (attempt + 1))
                continue
            }

            throw error
        }
    }

    return emptyRegistry()
}

export async function saveRegistry(registryPath: string, registry: GlobalRegistry): Promise<void> {
    await mkdir(path.dirname(registryPath), { recursive: true })
    const tempPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`

    try {
        await writeFile(tempPath, JSON.stringify(registry, null, 2), 'utf8')
        await rename(tempPath, registryPath)
    } catch (error) {
        try {
            await unlink(tempPath)
        } catch {
            // Ignore cleanup failures for best-effort temp files.
        }
        throw error
    }
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
