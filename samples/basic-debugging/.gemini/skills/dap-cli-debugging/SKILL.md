---
name: dap-cli-debugging
description: Control the VS Code Debugger (DAP) via CLI commands using mcp-debug-tools. Use when debugging, setting breakpoints, stepping through code, or inspecting variables.
---

# AI Agent Skill: VS Code DAP Debugger Control via CLI

## Objective
You can directly control the VS Code debugger via terminal CLI commands.
No stdio connection is required for one-off commands.

## CLI Interface

Prefer the CLI bundled with the installed VS Code extension when available:

```powershell
node "$env:USERPROFILE\.vscode\extensions\oeotyan.mcp-debug-tools-*\out\cli.js" <command> [args]
```

You may also use the npm package:

```bash
npx mcp-debug-tools <command> [args]
```

**Key Rules:**
- `stdout` is pure JSON. Always parse stdout only.
- `stderr` contains connection logs. Ignore stderr for result parsing.
- On error, read the JSON error message, correct arguments, and retry.

## Commands

| Command | Usage |
|---------|-------|
| **list** | `npx mcp-debug-tools list` - Discover available tools and input schemas |
| **call** | `npx mcp-debug-tools call <toolName> [jsonArgs]` - Execute a tool |
| **read** | `npx mcp-debug-tools read <resourceUri>` - Read a debugger state resource |

## Standard Debugging Workflow

1. Check status with `get-active-session`.
2. List launch configs with `list-debug-configs`.
3. Set breakpoints with `add-breakpoint` or `add-breakpoints`.
4. Start debugging with `start-debug`.
5. Inspect state with `get-call-stack` and `get-variables-scope`.
6. Evaluate details with `inspect-variable`, `expand-variable`, or `evaluate-expression`.
7. Step with `step-over`, `step-into`, or `step-out`, then inspect again.
