type Locale = 'en' | 'zh'

type MessageValue = string | ((params: Record<string, unknown>) => string)

const messages: Record<string, Record<Locale, MessageValue>> = {
    'cli.invalidPort': {
        en: 'Invalid port number.',
        zh: '端口号无效。'
    },
    'cli.autoDiscovering': {
        en: 'Auto-discovering VS Code instances...',
        zh: '正在自动发现 VS Code 实例...'
    },
    'cli.autoDiscoverSuccess': {
        en: ({ port }) => `Auto-discovery succeeded. Port: ${port}`,
        zh: ({ port }) => `自动发现成功。端口: ${port}`
    },
    'cli.workspace': {
        en: ({ workspace }) => `Workspace: ${workspace}`,
        zh: ({ workspace }) => `工作区: ${workspace}`
    },
    'cli.autoDiscoverFallback': {
        en: 'No VS Code instance found. Using the default port.',
        zh: '未找到 VS Code 实例，将使用默认端口。'
    },
    'cli.proxyStarting': {
        en: 'Starting DAP proxy MCP client',
        zh: '正在启动 DAP 代理 MCP 客户端'
    },
    'cli.serverUrl': {
        en: ({ url }) => `Server URL: ${url}`,
        zh: ({ url }) => `服务器 URL: ${url}`
    },
    'cli.connectingExtension': {
        en: 'Connecting to the VS Code extension over HTTP...',
        zh: '正在通过 HTTP 连接 VS Code 扩展...'
    },
    'cli.extensionConnected': {
        en: 'Connected to the VS Code extension over HTTP.',
        zh: '已通过 HTTP 连接到 VS Code 扩展。'
    },
    'cli.connectionRetry': {
        en: ({ retry, max }) => `Connection failed. Retrying ${retry}/${max}...`,
        zh: ({ retry, max }) => `连接失败。正在重试 ${retry}/${max}...`
    },
    'cli.extensionConnectionFailed': {
        en: 'Failed to connect to the VS Code extension.',
        zh: '无法连接到 VS Code 扩展。'
    },
    'cli.checkExtensionRunning': {
        en: 'Make sure the MCP Debug Tools extension is running in VS Code.',
        zh: '请确认 MCP Debug Tools 扩展正在 VS Code 中运行。'
    },
    'cli.stdioStarting': {
        en: 'Starting stdio transport...',
        zh: '正在启动 stdio 传输...'
    },
    'cli.clientReady': {
        en: 'MCP client is ready.',
        zh: 'MCP 客户端已就绪。'
    },
    'cli.errorOccurred': {
        en: ({ error }) => `Error: ${error}`,
        zh: ({ error }) => `错误: ${error}`
    },
    'cli.stackTrace': {
        en: ({ stack }) => `Stack trace: ${stack}`,
        zh: ({ stack }) => `堆栈跟踪: ${stack}`
    },
    'cli.fatalError': {
        en: ({ error }) => `Fatal error: ${error}`,
        zh: ({ error }) => `致命错误: ${error}`
    },
    'cli.option.port': {
        en: 'Specify the DAP proxy server port and disable auto-discovery',
        zh: '指定 DAP 代理服务器端口并禁用自动发现'
    },
    'cli.option.domain': {
        en: 'Specify the DAP proxy server domain',
        zh: '指定 DAP 代理服务器域名'
    },
    'cli.option.noAuto': {
        en: 'Disable automatic VS Code discovery',
        zh: '禁用 VS Code 自动发现'
    },

    'cliAction.connecting': {
        en: ({ url }) => `Connecting to ${url}`,
        zh: ({ url }) => `正在连接 ${url}`
    },
    'cliAction.connected': {
        en: 'Connected.',
        zh: '已连接。'
    },
    'cliAction.directConnecting': {
        en: ({ url }) => `Direct request to ${url}`,
        zh: ({ url }) => `正在直接请求 ${url}`
    },
    'cliAction.directSuccess': {
        en: 'Direct request succeeded.',
        zh: '直接请求成功。'
    },
    'cliAction.listToolsResources': {
        en: 'Fetching tool and resource list...',
        zh: '正在获取工具和资源列表...'
    },
    'cliAction.error': {
        en: ({ error }) => `Error: ${error}`,
        zh: ({ error }) => `错误: ${error}`
    },
    'cliAction.argsJsonParseError': {
        en: ({ args }) => `Failed to parse args JSON: ${args}`,
        zh: ({ args }) => `参数 JSON 解析失败: ${args}`
    },
    'cliAction.callingTool': {
        en: ({ tool }) => `Calling tool: ${tool}`,
        zh: ({ tool }) => `正在调用工具: ${tool}`
    },
    'cliAction.readingResource': {
        en: ({ uri }) => `Reading resource: ${uri}`,
        zh: ({ uri }) => `正在读取资源: ${uri}`
    },

    'finder.workspaceConfigFound': {
        en: ({ dir }) => `[Auto-connect] Workspace config found: ${dir}`,
        zh: ({ dir }) => `[自动连接] 发现工作区配置: ${dir}`
    },
    'finder.staleConfigIgnored': {
        en: ({ path }) => `[Auto-connect] Ignoring stale config: ${path}`,
        zh: ({ path }) => `[自动连接] 已忽略过期配置: ${path}`
    },
    'finder.configReadFailed': {
        en: ({ error }) => `[Auto-connect] Failed to read config file: ${error}`,
        zh: ({ error }) => `[自动连接] 读取配置文件失败: ${error}`
    },
    'finder.registryReadFailed': {
        en: ({ error }) => `[Auto-connect] Failed to read registry: ${error}`,
        zh: ({ error }) => `[自动连接] 读取注册表失败: ${error}`
    },
    'finder.discoveryStart': {
        en: '[Auto-connect] Searching for VS Code instances...',
        zh: '[自动连接] 正在查找 VS Code 实例...'
    },
    'finder.singleInstanceFound': {
        en: ({ name, port }) => `[Auto-connect] Found one VS Code instance: ${name} (port ${port})`,
        zh: ({ name, port }) => `[自动连接] 发现一个 VS Code 实例: ${name} (端口 ${port})`
    },
    'finder.multipleInstancesFound': {
        en: ({ count }) => `[Auto-connect] Found ${count} active VS Code instances:`,
        zh: ({ count }) => `[自动连接] 发现 ${count} 个活动 VS Code 实例:`
    },
    'finder.instanceListItem': {
        en: ({ index, name, port }) => `  ${index}. ${name} (port ${port})`,
        zh: ({ index, name, port }) => `  ${index}. ${name} (端口 ${port})`
    },
    'finder.instanceSelected': {
        en: ({ name }) => `[Auto-connect] Selected instance: ${name}`,
        zh: ({ name }) => `[自动连接] 已选择实例: ${name}`
    },
    'finder.checkingLegacyConfig': {
        en: '[Auto-connect] No registry match. Checking legacy workspace config...',
        zh: '[自动连接] 注册表无匹配项，正在检查旧版工作区配置...'
    },
    'finder.workspaceInstanceFound': {
        en: ({ port }) => `[Auto-connect] Workspace VS Code instance found on port ${port}`,
        zh: ({ port }) => `[自动连接] 发现工作区 VS Code 实例，端口 ${port}`
    },
    'finder.noActiveInstance': {
        en: '[Auto-connect] No active VS Code instance found.',
        zh: '[自动连接] 未找到活动 VS Code 实例。'
    },

    'mcpClient.httpClientCreating': {
        en: ({ url }) => `Creating HTTP client: ${url}`,
        zh: ({ url }) => `正在创建 HTTP 客户端: ${url}`
    },
    'mcpClient.httpTransportConnecting': {
        en: 'Connecting HTTP transport...',
        zh: '正在连接 HTTP 传输...'
    },
    'mcpClient.httpTransportConnected': {
        en: 'HTTP transport connected.',
        zh: 'HTTP 传输已连接。'
    },
    'mcpClient.fetchingTools': {
        en: 'Fetching tool list...',
        zh: '正在获取工具列表...'
    },
    'mcpClient.toolsFound': {
        en: ({ count }) => `Found ${count} tools.`,
        zh: ({ count }) => `发现 ${count} 个工具。`
    },
    'mcpClient.registeringTool': {
        en: ({ tool }) => `Registering tool: ${tool}`,
        zh: ({ tool }) => `正在注册工具: ${tool}`
    },
    'mcpClient.callingTool': {
        en: ({ tool, args }) => `Calling tool: ${tool} - ${args}`,
        zh: ({ tool, args }) => `正在调用工具: ${tool} - ${args}`
    },
    'mcpClient.toolCallComplete': {
        en: ({ tool, elapsed }) => `Tool call complete: ${tool} (${elapsed}ms)`,
        zh: ({ tool, elapsed }) => `工具调用完成: ${tool} (${elapsed}ms)`
    },
    'mcpClient.toolCallFailed': {
        en: ({ tool, error, elapsed }) => `Tool call failed: ${tool} - ${error} (${elapsed}ms)`,
        zh: ({ tool, error, elapsed }) => `工具调用失败: ${tool} - ${error} (${elapsed}ms)`
    },
    'mcpClient.fetchingResources': {
        en: 'Fetching resource list...',
        zh: '正在获取资源列表...'
    },
    'mcpClient.resourcesFound': {
        en: ({ count }) => `Found ${count} resources.`,
        zh: ({ count }) => `发现 ${count} 个资源。`
    },
    'mcpClient.registeringResource': {
        en: ({ name, description }) => `Registering resource: ${name}: ${description}`,
        zh: ({ name, description }) => `正在注册资源: ${name}: ${description}`
    },
    'mcpClient.readingResource': {
        en: ({ name }) => `Reading resource: ${name}`,
        zh: ({ name }) => `正在读取资源: ${name}`
    },
    'mcpClient.readResourceComplete': {
        en: ({ name }) => `Resource read complete: ${name}`,
        zh: ({ name }) => `资源读取完成: ${name}`
    },
    'mcpClient.proxyReady': {
        en: 'MCP proxy server is ready.',
        zh: 'MCP 代理服务器已就绪。'
    },

    'server.registeringTool': {
        en: ({ tool }) => `Registering tool: ${tool}`,
        zh: ({ tool }) => `正在注册工具: ${tool}`
    },
    'server.registeringResource': {
        en: ({ resource }) => `Registering resource: ${resource}`,
        zh: ({ resource }) => `正在注册资源: ${resource}`
    },
    'server.initComplete': {
        en: ({ tools, resources }) => `MCP server initialized: ${tools} tools, ${resources} resources`,
        zh: ({ tools, resources }) => `MCP 服务器初始化完成: ${tools} 个工具，${resources} 个资源`
    },
    'server.directToolCall': {
        en: ({ tool }) => `[Direct] Tool call: ${tool}`,
        zh: ({ tool }) => `[直接处理] 工具调用: ${tool}`
    },
    'server.directToolComplete': {
        en: ({ tool, elapsed }) => `[Direct] Tool complete: ${tool} (${elapsed}ms)`,
        zh: ({ tool, elapsed }) => `[直接处理] 工具执行完成: ${tool} (${elapsed}ms)`
    },
    'server.directToolFailed': {
        en: ({ tool, error }) => `[Direct] Tool failed: ${tool} - ${error}`,
        zh: ({ tool, error }) => `[直接处理] 工具执行失败: ${tool} - ${error}`
    },
    'server.directResourceRead': {
        en: ({ uri }) => `[Direct] Resource read: ${uri}`,
        zh: ({ uri }) => `[直接处理] 资源读取: ${uri}`
    },
    'server.directResourceComplete': {
        en: ({ uri, elapsed }) => `[Direct] Resource read complete: ${uri} (${elapsed}ms)`,
        zh: ({ uri, elapsed }) => `[直接处理] 资源读取完成: ${uri} (${elapsed}ms)`
    },
    'server.directResourceFailed': {
        en: ({ uri, error }) => `[Direct] Resource read failed: ${uri} - ${error}`,
        zh: ({ uri, error }) => `[直接处理] 资源读取失败: ${uri} - ${error}`
    },
    'server.cleaningExistingSession': {
        en: ({ sessionId }) => `Cleaning existing session ${sessionId}`,
        zh: ({ sessionId }) => `正在清理现有会话 ${sessionId}`
    },
    'server.sessionCreated': {
        en: ({ sessionId }) => `New session created: ${sessionId}`,
        zh: ({ sessionId }) => `已创建新会话: ${sessionId}`
    },
    'server.sessionClosed': {
        en: ({ sessionId }) => `Session closed: ${sessionId}`,
        zh: ({ sessionId }) => `会话已关闭: ${sessionId}`
    },
    'server.transportError': {
        en: ({ error }) => `Transport error: ${error}`,
        zh: ({ error }) => `传输错误: ${error}`
    },
    'server.reusingSession': {
        en: ({ sessionId }) => `Reusing existing session: ${sessionId}`,
        zh: ({ sessionId }) => `正在复用现有会话: ${sessionId}`
    },
    'server.transportHandlingFailed': {
        en: ({ error }) => `Transport handling failed: ${error}`,
        zh: ({ error }) => `传输处理失败: ${error}`
    },
    'server.sessionHandlingFailed': {
        en: ({ sessionId, error }) => `Session handling failed (${sessionId}): ${error}`,
        zh: ({ sessionId, error }) => `会话处理失败 (${sessionId}): ${error}`
    },
    'server.httpRunning': {
        en: 'MCP Streamable HTTP server is running.',
        zh: 'MCP Streamable HTTP 服务器正在运行。'
    },
    'server.httpServerUrl': {
        en: ({ url }) => `Server URL: ${url}`,
        zh: ({ url }) => `服务器 URL: ${url}`
    },
    'server.httpEndpoint': {
        en: ({ url }) => `MCP endpoint: ${url}`,
        zh: ({ url }) => `MCP 端点: ${url}`
    },
    'server.port': {
        en: ({ port }) => `Port: ${port}`,
        zh: ({ port }) => `端口: ${port}`
    },
    'server.domain': {
        en: ({ domain }) => `Domain: ${domain}`,
        zh: ({ domain }) => `域名: ${domain}`
    },
    'server.portBusy': {
        en: ({ originalPort, port }) => `Original port ${originalPort} was busy. Using port ${port} instead.`,
        zh: ({ originalPort, port }) => `原端口 ${originalPort} 被占用，改用端口 ${port}。`
    },
    'server.startFailed': {
        en: ({ error }) => `Failed to start HTTP server: ${error}`,
        zh: ({ error }) => `HTTP 服务器启动失败: ${error}`
    },
    'server.httpClosed': {
        en: 'HTTP server closed.',
        zh: 'HTTP 服务器已关闭。'
    },

    'extension.registryInitialized': {
        en: 'MCP Debug Tools discovery registry initialized.',
        zh: 'MCP Debug Tools 发现注册表已初始化。'
    },
    'extension.registryInitFailed': {
        en: ({ error }) => `Failed to initialize discovery registry: ${error}`,
        zh: ({ error }) => `发现注册表初始化失败: ${error}`
    },
    'extension.activated': {
        en: 'MCP Debug Tools extension is active.',
        zh: 'MCP Debug Tools 扩展已激活。'
    },
    'extension.activationFailed': {
        en: ({ error }) => `Failed to activate MCP Debug Tools: ${error}`,
        zh: ({ error }) => `MCP Debug Tools 激活失败: ${error}`
    },
    'extension.serverDeactivated': {
        en: 'MCP server deactivated.',
        zh: 'MCP 服务器已停用。'
    },
    'extension.deactivated': {
        en: 'MCP Debug Tools extension is deactivated.',
        zh: 'MCP Debug Tools 扩展已停用。'
    },
    'extension.deactivationError': {
        en: ({ error }) => `Error during deactivation: ${error}`,
        zh: ({ error }) => `停用过程中发生错误: ${error}`
    },
    'extension.status.starting': {
        en: 'MCP server is starting',
        zh: 'MCP 服务器正在启动'
    },
    'extension.status.running': {
        en: 'MCP server is running. Click to open the monitor panel.',
        zh: 'MCP 服务器正在运行。点击打开监控面板。'
    },
    'extension.status.stopping': {
        en: 'MCP server is stopping',
        zh: 'MCP 服务器正在停止'
    },
    'extension.status.stopped': {
        en: 'MCP server is stopped. Click to open the monitor panel.',
        zh: 'MCP 服务器已停止。点击打开监控面板。'
    },
    'extension.status.error': {
        en: 'MCP server failed to start. Click to retry.',
        zh: 'MCP 服务器启动失败。点击重试。'
    },

    'commands.addBreakpointFailed': {
        en: ({ error }) => `Failed to add breakpoint: ${error}`,
        zh: ({ error }) => `添加断点失败: ${error}`
    },
    'commands.serverAlreadyRunning': {
        en: 'Server is already running.',
        zh: '服务器已在运行。'
    },
    'commands.serverStarted': {
        en: 'Server started successfully.',
        zh: '服务器启动成功。'
    },
    'commands.startServerFailed': {
        en: ({ error }) => `Failed to start server: ${error}`,
        zh: ({ error }) => `服务器启动失败: ${error}`
    },
    'commands.serverNotRunning': {
        en: 'Server is not running.',
        zh: '服务器未运行。'
    },
    'commands.serverStopped': {
        en: 'Server stopped successfully.',
        zh: '服务器已停止。'
    },
    'commands.stopServerFailed': {
        en: ({ error }) => `Failed to stop server: ${error}`,
        zh: ({ error }) => `服务器停止失败: ${error}`
    },
    'commands.commandRegisterFailed': {
        en: ({ commandId }) => `[Command] Command ${commandId} could not be registered, possibly because it already exists.`,
        zh: ({ commandId }) => `[命令] 无法注册命令 ${commandId}，可能是因为该命令已存在。`
    },
    'commands.noActiveEditor': {
        en: 'No active text editor. Open a file and try again.',
        zh: '没有活动文本编辑器。请打开文件后重试。'
    },
    'commands.linePrompt': {
        en: 'Enter the line number to set the breakpoint on',
        zh: '输入要设置断点的行号'
    },
    'commands.invalidLineNumber': {
        en: 'Invalid line number.',
        zh: '行号无效。'
    },
    'commands.breakpointAdded': {
        en: ({ file, line }) => `Breakpoint added to ${file}:${line}`,
        zh: ({ file, line }) => `已在 ${file}:${line} 添加断点`
    },

    'config.created': {
        en: ({ path }) => `Config file created at: ${path}`,
        zh: ({ path }) => `配置文件已创建: ${path}`
    },
    'config.workspaceConfigSkipped': {
        en: 'Workspace config file skipped; using temp registry discovery.',
        zh: '已跳过工作区配置文件；使用临时注册表发现。'
    },
    'config.initializeFailed': {
        en: ({ error }) => `Failed to initialize config: ${error}`,
        zh: ({ error }) => `配置初始化失败: ${error}`
    },
    'config.skillSourceMissing': {
        en: ({ path }) => `SKILL document source not found at: ${path}`,
        zh: ({ path }) => `未找到 SKILL 文档源文件: ${path}`
    },
    'config.skillInjected': {
        en: ({ path }) => `SKILL document injected at: ${path}`,
        zh: ({ path }) => `SKILL 文档已注入: ${path}`
    },
    'config.skillInjectFailed': {
        en: ({ path, error }) => `Failed to inject SKILL document to ${path}: ${error}`,
        zh: ({ path, error }) => `注入 SKILL 文档到 ${path} 失败: ${error}`
    },
    'config.noConfigToUpdate': {
        en: 'No config to update.',
        zh: '没有可更新的配置。'
    },
    'config.updateFailed': {
        en: ({ error }) => `Failed to update config: ${error}`,
        zh: ({ error }) => `配置更新失败: ${error}`
    },
    'config.removed': {
        en: ({ path }) => `Config file removed: ${path}`,
        zh: ({ path }) => `配置文件已删除: ${path}`
    },
    'config.cleanupFailed': {
        en: ({ error }) => `Failed to cleanup config: ${error}`,
        zh: ({ error }) => `清理配置失败: ${error}`
    },

    'monitor.configReadFailed': {
        en: ({ error }) => `Error reading workspace config: ${error}`,
        zh: ({ error }) => `读取工作区配置失败: ${error}`
    },
    'monitor.noServerConfig': {
        en: 'MCP server has not started yet.',
        zh: 'MCP 服务器尚未启动。'
    },
    'monitor.configCopied': {
        en: 'MCP configuration has been copied to the clipboard.',
        zh: 'MCP 配置已复制到剪贴板。'
    },

    'registry.registered': {
        en: ({ id, port }) => `Instance registered: ${id} at port ${port}`,
        zh: ({ id, port }) => `实例已注册: ${id}，端口 ${port}`
    },
    'registry.registerFailed': {
        en: ({ error }) => `Failed to register instance: ${error}`,
        zh: ({ error }) => `注册实例失败: ${error}`
    },
    'registry.unregistered': {
        en: ({ id }) => `Instance unregistered: ${id}`,
        zh: ({ id }) => `实例已注销: ${id}`
    },
    'registry.unregisterFailed': {
        en: ({ error }) => `Failed to unregister instance: ${error}`,
        zh: ({ error }) => `注销实例失败: ${error}`
    },
    'registry.activeInstancesFailed': {
        en: ({ error }) => `Failed to get active instances: ${error}`,
        zh: ({ error }) => `获取活动实例失败: ${error}`
    },
    'registry.cleanupFailed': {
        en: ({ error }) => `Cleanup failed: ${error}`,
        zh: ({ error }) => `清理失败: ${error}`
    },
    'registry.staleCleaned': {
        en: ({ count }) => `Cleaned up ${count} stale entries.`,
        zh: ({ count }) => `已清理 ${count} 个过期条目。`
    },
    'registry.staleCleanupFailed': {
        en: ({ error }) => `Failed to clean up stale entries: ${error}`,
        zh: ({ error }) => `清理过期条目失败: ${error}`
    },

    'state.transportRemoved': {
        en: ({ sessionId }) => `Transport removed: ${sessionId}`,
        zh: ({ sessionId }) => `传输已移除: ${sessionId}`
    },
    'state.cleaningSession': {
        en: ({ sessionId }) => `Cleaning up session: ${sessionId}`,
        zh: ({ sessionId }) => `正在清理会话: ${sessionId}`
    },

    'tools.error': {
        en: ({ error }) => `Error: ${error}`,
        zh: ({ error }) => `错误: ${error}`
    },
    'tools.breakpointAdded': {
        en: 'Breakpoint added successfully',
        zh: '断点添加成功'
    },
    'tools.conditionalBreakpointAdded': {
        en: 'Conditional breakpoint added successfully',
        zh: '条件断点添加成功'
    },
    'tools.breakpointRemoved': {
        en: ({ file, line }) => `Breakpoint removed from ${file}:${line}`,
        zh: ({ file, line }) => `已从 ${file}:${line} 移除断点`
    },
    'tools.breakpointNotFound': {
        en: ({ file, line }) => `No breakpoint found at ${file}:${line}`,
        zh: ({ file, line }) => `未在 ${file}:${line} 找到断点`
    },
    'tools.breakpointsClearedFromFiles': {
        en: ({ count, files, fileList }) => `Cleared ${count} breakpoint(s) from ${files} file(s): ${fileList}`,
        zh: ({ count, files, fileList }) => `已从 ${files} 个文件清除 ${count} 个断点: ${fileList}`
    },
    'tools.noBreakpointsInFiles': {
        en: ({ files }) => `No breakpoints found in specified files: ${files}`,
        zh: ({ files }) => `指定文件中没有断点: ${files}`
    },
    'tools.breakpointsClearedAll': {
        en: ({ count }) => `Cleared ${count} breakpoint(s) from all files`,
        zh: ({ count }) => `已清除所有文件中的 ${count} 个断点`
    },
    'tools.noBreakpointsToClear': {
        en: 'No breakpoints to clear',
        zh: '没有可清除的断点'
    },
    'tools.noWorkspaceFolder': {
        en: 'No workspace folder open',
        zh: '未打开工作区文件夹'
    },
    'tools.noActiveDebugSession': {
        en: 'No active debug session',
        zh: '没有活动调试会话'
    },
    'tools.debugStarted': {
        en: ({ config }) => `Debug session '${config}' started`,
        zh: ({ config }) => `调试会话 '${config}' 已启动`
    },
    'tools.debugStartFailed': {
        en: 'Failed to start debug session',
        zh: '调试会话启动失败'
    },
    'tools.debugStopped': {
        en: 'Debug session stopped',
        zh: '调试会话已停止'
    },
    'tools.executionContinued': {
        en: 'Execution continued',
        zh: '已继续执行'
    },
    'tools.executionPaused': {
        en: 'Execution paused',
        zh: '执行已暂停'
    },
    'tools.steppedOver': {
        en: 'Stepped over',
        zh: '已单步跳过'
    },
    'tools.steppedInto': {
        en: 'Stepped into',
        zh: '已单步进入'
    },
    'tools.steppedOut': {
        en: 'Stepped out',
        zh: '已单步跳出'
    },
    'resources.debugConsoleUnavailable': {
        en: 'No debug console output available (DAP message tracking disabled)',
        zh: '没有可用的调试控制台输出（DAP 消息跟踪已禁用）'
    },
    'resources.noFocusedStackItem': {
        en: 'No focused thread or stack frame',
        zh: '没有聚焦的线程或栈帧'
    },
    'resources.noActiveStackFrame': {
        en: 'No active stack frame',
        zh: '没有活动栈帧'
    },
    'resources.callStackFailed': {
        en: 'Failed to get call stack',
        zh: '获取调用栈失败'
    },
    'resources.variablesFailed': {
        en: 'Failed to get variables and scopes',
        zh: '获取变量和作用域失败'
    },
    'resources.threadListFailed': {
        en: 'Failed to get thread list',
        zh: '获取线程列表失败'
    },
    'resources.exceptionUnavailable': {
        en: 'Exception information not available (DAP message tracking disabled)',
        zh: '异常信息不可用（DAP 消息跟踪已禁用）'
    },

    'duration.short': {
        en: ({ minutes, seconds }) => `${minutes}m ${seconds}s`,
        zh: ({ minutes, seconds }) => `${minutes}分 ${seconds}秒`
    }
}

let forcedLocale: Locale | undefined

export function setLocale(locale: string | undefined): void {
    forcedLocale = normalizeLocale(locale)
}

export function getLocale(): Locale {
    if (forcedLocale) {
        return forcedLocale
    }

    return normalizeLocale(
        process.env.MCP_DEBUG_TOOLS_LANG ||
        process.env.MCP_DEBUG_TOOLS_LOCALE ||
        process.env.LC_ALL ||
        process.env.LC_MESSAGES ||
        process.env.LANG
    )
}

export function t(key: string, params: Record<string, unknown> = {}): string {
    const locale = getLocale()
    const entry = messages[key]
    const value = entry?.[locale] ?? entry?.en

    if (!value) {
        return key
    }

    if (typeof value === 'function') {
        return value(params)
    }

    return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
}

export function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return t('duration.short', { minutes, seconds })
}

function normalizeLocale(locale: string | undefined): Locale {
    if (locale && /^zh/i.test(locale)) {
        return 'zh'
    }

    return 'en'
}
