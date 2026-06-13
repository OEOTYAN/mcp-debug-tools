# MCP Debug Tools - Basic Debugging Sample

This sample demonstrates basic debugging with functions, local variables, loops, conditionals, async code, complex data structures, and error handling.

## Run

```bash
npm start
node app.js
```

## Debug

```bash
npm run debug
node --inspect app.js
```

Open the folder in VS Code, choose a launch configuration, and press F5.

## Suggested Breakpoints

- `filterData`: conditional filtering logic
- `fibonacci`: recursive call stack tracing
- `bubbleSort`: swap logic
- `fetchDataAsync`: Promise handling
- `processComplexData`: type-specific branches
- `divideNumbers`: error handling

## Useful Watch Expressions

- `globalCounter`
- `processor.data`
- `array`
- `result`
- `error`

## References

- [MCP Debug Tools](../../README.md)
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)