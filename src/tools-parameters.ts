import { z } from 'zod'

export const inputSchemas = {
    'add-breakpoint': {
        file: z.string().describe('Relative path from workspace root'),
        line: z.number().int().min(1).describe('Line number (1-based)'),
        condition: z.string().optional().describe('Condition expression'),
        hitCondition: z.string().optional().describe('Hit count condition'),
        logMessage: z.string().optional().describe('Log message to output')
    },
    'add-breakpoints': {
        breakpoints: z.array(z.object({
            file: z.string().describe('Relative path from workspace root'),
            line: z.number().int().min(1).describe('Line number (1-based)'),
            condition: z.string().optional().describe('Condition expression'),
            hitCondition: z.string().optional().describe('Hit count condition'),
            logMessage: z.string().optional().describe('Log message to output')
        })).describe('Array of breakpoint configurations')
    },
    'remove-breakpoint': {
        file: z.string().describe('Relative path from workspace root'),
        line: z.number().int().min(1).describe('Line number (1-based)')
    },
    'clear-breakpoints': {
        files: z.array(z.string()).optional().describe('Array of relative paths from workspace root')
    },
    'start-debug': {
        config: z.string().describe('Configuration name from launch.json'),
        inputs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Values for ${input:id} variables in launch.json or preLaunchTask tasks.json'),
        inputValues: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Alias for inputs; values for ${input:id} variables in launch.json or preLaunchTask tasks.json')
    },
    'evaluate-expression': {
        expression: z.string().describe('Expression to evaluate in debug context'),
        frameId: z.number().optional().describe('Specific stack frame ID to evaluate against'),
        context: z.enum(['watch', 'repl', 'hover', 'clipboard', 'variables']).optional().describe('DAP evaluate context')
    },
    'inspect-variable': {
        variableName: z.string().describe('Name of the variable to inspect'),
        frameId: z.number().optional().describe('Specific stack frame ID to inspect against'),
        scopeName: z.string().optional().describe('Filter by scope name'),
        includeRegisters: z.boolean().optional().describe('Include register scopes when searching variables'),
        depth: z.number().int().min(0).optional().describe('Child expansion depth'),
        maxChildren: z.number().int().min(1).optional().describe('Maximum children to fetch per expanded variable')
    },
    'list-debug-configs': {
        // No parameters
    },
    'select-debug-config': {
        configName: z.string().describe('Debug configuration name to select')
    },
    
    // Additional tool schemas
    'get-dap-log': {
        // No parameters - returns all DAP logs
    },
    
    'get-breakpoints': {
        // No parameters - returns all breakpoints
    },
    
    'get-active-session': {
        // No parameters - returns active session info
    },
    
    'get-debug-console': {
        limit: z.number().optional().describe('Number of recent console messages to retrieve'),
        filter: z.string().optional().describe('Filter messages by type (output, error, etc.)')
    },
    
    'get-active-stack-item': {
        // No parameters - returns the current active stack item
    },
    
    'get-call-stack': {
        threadId: z.number().optional().describe('Specific thread ID'),
        startFrame: z.number().optional().describe('Start frame index'),
        levels: z.number().optional().describe('Number of frames to retrieve')
    },

    'select-stack-frame': {
        threadId: z.number().optional().describe('Specific thread ID'),
        frameId: z.number().optional().describe('Specific frame ID'),
        frameIndex: z.number().int().min(0).optional().describe('Stack frame index within the thread when frameId is omitted'),
        revealSource: z.boolean().optional().describe('Open and reveal the frame source location in the editor')
    },
    
    'get-variables-scope': {
        threadId: z.number().optional().describe('Specific thread ID; used to pick a frame when frameId is omitted'),
        frameId: z.number().optional().describe('Specific frame ID'),
        frameIndex: z.number().int().min(0).optional().describe('Stack frame index within the thread when frameId is omitted; defaults to the current VS Code active frame'),
        scopeName: z.string().optional().describe('Filter by scope name'),
        includeRegisters: z.boolean().optional().describe('Include CPU register scopes in the result'),
        depth: z.number().int().min(0).optional().describe('Child expansion depth'),
        maxChildren: z.number().int().min(1).optional().describe('Maximum children to fetch per scope or expanded variable')
    },

    'get-stack-variables': {
        threadId: z.number().optional().describe('Specific thread ID'),
        startFrame: z.number().int().min(0).optional().describe('Start frame index'),
        levels: z.number().int().min(1).optional().describe('Number of stack frames to retrieve'),
        scopeName: z.string().optional().describe('Filter by scope name'),
        includeRegisters: z.boolean().optional().describe('Include CPU register scopes in the result'),
        depth: z.number().int().min(0).optional().describe('Child expansion depth'),
        maxChildren: z.number().int().min(1).optional().describe('Maximum children to fetch per scope or expanded variable')
    },

    'expand-variable': {
        variablesReference: z.number().int().min(1).describe('DAP variablesReference to expand'),
        depth: z.number().int().min(0).optional().describe('Child expansion depth'),
        maxChildren: z.number().int().min(1).optional().describe('Maximum children to fetch per expanded variable')
    },
    
    'get-thread-list': {
        // No parameters - returns all threads
    },
    
    'get-exception-info': {
        limit: z.number().optional().describe('Number of recent exceptions to retrieve'),
        includeStackTrace: z.boolean().optional().describe('Include stack trace information')
    },
    
    // Additional workspace-related tools
    'select-vscode-instance': {
        port: z.number().optional().describe('Specific VSCode instance port'),
        workspace: z.string().optional().describe('Workspace path to select')
    },
    
    'get-workspace-info': {
        // No parameters - returns current workspace info
    },
    
    'list-vscode-instances': {
        // No parameters - returns all active VS Code instances
    }
}
