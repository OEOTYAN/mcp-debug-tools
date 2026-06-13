# MCP Debug Tools - Thread Debugging Sample

This sample demonstrates multi-threaded debugging with Node.js Worker Threads, shared memory, inter-worker communication, and performance comparison.

## Run

```bash
npm start
node worker-threads.js
```

## Debug

```bash
npm run debug
node --inspect worker-threads.js
npm run debug-workers
```

For SharedArrayBuffer experiments:

```bash
node --no-warnings --experimental-worker worker-threads.js
```

## Suggested Breakpoints

- Worker task dispatch
- Prime search computation
- SharedArrayBuffer writes
- Message handlers
- Worker creation and termination
- Performance measurement

## Useful Watch Expressions

- `threadId`
- `workerData`
- `parentPort`
- `sharedBuffer`
- `sharedArray`
- `pool.workers`
- `pool.activeWorkers`

## References

- [MCP Debug Tools](../../README.md)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [SharedArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Atomics](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Atomics)