# Change Log

All notable changes to the "mcp-debug-tools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Released]

## [1.0.1] - 2026-03-21

### Fixed
- **`npx @uhd_kr/mcp-debug-tools` command not found** — npm was silently removing the `bin` entry during publish for scoped packages. Fixed by using explicit object format in the `bin` field.

## [1.0.0] - 2026-03-21

### 🤖 AI Agent Skill Auto-Injection
- Extension now automatically injects skill documents into the workspace on activation
- **Gemini** support: `.gemini/skills/dap-cli-debugging/SKILL.md`
- **Claude Code** support: `.claude/skills/dap-cli-debugging/SKILL.md`
- AI agents can discover and use all 29 debugging tools without manual configuration
- Includes YAML frontmatter for Claude Code compatibility

### 📖 Comprehensive Skill Documentation
- All **29 tools** fully documented in the auto-injected skill file
- Organized into 4 categories: Session/Config, Breakpoints, Execution Control, State Inspection
- Complete parameter reference with types and descriptions
- CLI usage examples and standard debugging workflow

### 🔌 Offline CLI Support
- Added local path fallback for running CLI without `npx` or internet
- Documented paths for **macOS**, **Linux**, **Windows (PowerShell)**, and **Windows (CMD)**
- Global npm install tip for direct `mcp-debug-tools` command access

### 🏗️ Resource Architecture Refactor
- Moved static resources from `src/resources/` to top-level `resources/` directory
- Follows VS Code extension standard convention for static assets
- Eliminates VSIX packaging issue where `.vscodeignore` excluded `src/**`
- Resources now correctly included in both VSIX and npm packages

### 📝 README Overhaul
- New value proposition section: "Why MCP Debug Tools?"
- Comparison table showing AI debugging before vs after
- Direct CLI control feature highlights
- Updated architecture and getting started guides

### Changed
- Renamed skill from `mcp-cli-skill` to `dap-cli-debugging` for clarity
- Removed legacy `.mcp-debug-tools/mcp-cli-skill.md` injection (replaced by `.gemini/` and `.claude/` paths)

## [0.2.1] - 2025-09-16

### ⚠️ Important Configuration Change
- **MCP configuration now requires `@latest` tag for proper version management**
  ```json
  {
    "mcpServers": {
      "release-dap-proxy": {
        "command": "npx",
        "args": [
          "-y",
          "@uhd_kr/mcp-debug-tools@latest"
        ]
      }
    }
  }
  ```
  - Without `@latest` tag, npx may use cached outdated versions
  - This ensures you always get the most recent bug fixes and improvements
  - Previous configuration without version tag may cause timeout issues

### Added
- New test suites for MCP connection validation (`test-mcp-connection.js`)
- Comprehensive tool testing framework (`test-all-tools.js`)

### Changed
- **Major refactoring of configuration management and DAP message handling**
  - Simplified `config-manager.ts` and `registry-manager.ts` implementation
  - Optimized `resources.ts` for better performance (reduced from ~115 lines)
  - Improved `server.ts` architecture for better maintainability
  - Streamlined `tools.ts` implementation (reduced by ~180 lines)
- Enhanced package metadata across all package files
- Improved error handling in MCP client connections

### Fixed
- **Critical timeout issue when starting debug sessions** - Connection to VSCode instances is now more stable with improved heartbeat and retry mechanisms
- DAP message tracking performance optimization
- State management memory leaks in long-running sessions

### Performance
- Disabled debug console output collection for performance optimization
- Reduced overall codebase by ~400 lines while maintaining functionality
- Optimized resource handling and state management

## [0.1.5] - Previous releases
- Initial release with basic debugging capabilities
- VSCode extension for DAP-MCP bridge
- CLI tool for AI integration