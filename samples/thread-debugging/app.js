/**
 * MCP Debug Tools - Thread Debugging Example
 * Multi-threaded debugging example using Node.js Worker Threads.
 * Demonstrates memory layout, inter-thread communication, and parallel processing.
 */

const {
    Worker,
    isMainThread,
    parentPort,
    workerData,
    MessageChannel,
    MessagePort,
    threadId
} = require('worker_threads');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

// SharedArrayBuffer for shared memory
const BUFFER_SIZE = 1024;
const THREADS_COUNT = os.cpus().length;

/**
 * Code that runs inside worker threads.
 * Runs in a separate V8 instance.
 */
if (!isMainThread) {
    console.log(`[Worker ${threadId}] Thread started, data:`, workerData);
    
    // Worker task function
    function workerTask() {
        const { taskType, data, sharedBuffer } = workerData;
        
        switch (taskType) {
            case 'compute':
                // CPU-intensive computation
                const result = performHeavyComputation(data);
                parentPort.postMessage({ 
                    type: 'result', 
                    threadId, 
                    result,
                    timestamp: Date.now()
                });
                break;
                
            case 'sort':
                // Sort large data
                const sorted = mergeSort(data);
                parentPort.postMessage({ 
                    type: 'sorted', 
                    threadId, 
                    data: sorted,
                    originalLength: data.length
                });
                break;
                
            case 'search':
                // Parallel search task
                const found = parallelSearch(data.array, data.target);
                parentPort.postMessage({ 
                    type: 'search_result', 
                    threadId, 
                    found,
                    target: data.target
                });
                break;
                
            case 'shared_memory':
                // Shared memory with SharedArrayBuffer
                if (sharedBuffer) {
                    manipulateSharedMemory(sharedBuffer, threadId);
                }
                break;
                
            default:
                parentPort.postMessage({ 
                    type: 'error', 
                    message: `Unknown task type: ${taskType}` 
                });
        }
    }
    
    // CPU-intensive computation function (prime search)
    function performHeavyComputation(limit) {
        const primes = [];
        
        for (let num = 2; num <= limit; num++) {
            let isPrime = true;
            
            for (let i = 2; i <= Math.sqrt(num); i++) {
                if (num % i === 0) {
                    isPrime = false;
                    break;
                }
            }
            
            if (isPrime) {
                primes.push(num);
            }
        }
        
        return {
            count: primes.length,
            largest: primes[primes.length - 1],
            sum: primes.reduce((a, b) => a + b, 0)
        };
    }
    
    // Merge sort algorithm
    function mergeSort(arr) {
        if (arr.length <= 1) return arr;
        
        const mid = Math.floor(arr.length / 2);
        const left = mergeSort(arr.slice(0, mid));
        const right = mergeSort(arr.slice(mid));
        
        return merge(left, right);
    }
    
    function merge(left, right) {
        const result = [];
        let leftIndex = 0;
        let rightIndex = 0;
        
        while (leftIndex < left.length && rightIndex < right.length) {
            if (left[leftIndex] <= right[rightIndex]) {
                result.push(left[leftIndex]);
                leftIndex++;
            } else {
                result.push(right[rightIndex]);
                rightIndex++;
            }
        }
        
        return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
    }
    
    // Parallel search function
    function parallelSearch(array, target) {
        const results = [];
        
        for (let i = 0; i < array.length; i++) {
            if (array[i] === target) {
                results.push({
                    index: i,
                    value: array[i],
                    threadId: threadId
                });
            }
        }
        
        return results;
    }
    
    // Manipulate SharedArrayBuffer
    function manipulateSharedMemory(sharedBuffer, workerId) {
        const sharedArray = new Int32Array(sharedBuffer);
        const startIdx = workerId * 10;
        const endIdx = startIdx + 10;
        
        // Each worker writes to its own region
        for (let i = startIdx; i < endIdx && i < sharedArray.length; i++) {
            // Safe memory access with Atomics
            const oldValue = Atomics.load(sharedArray, i);
            const newValue = oldValue + workerId * 100;
            Atomics.store(sharedArray, i, newValue);
            
            // Log for debugging
            console.log(`[Worker ${workerId}] memory[${i}]: ${oldValue} -> ${newValue}`);
        }
        
        // Synchronization point
        Atomics.notify(sharedArray, 0, 1);
        
        parentPort.postMessage({
            type: 'memory_updated',
            threadId: workerId,
            range: { start: startIdx, end: endIdx }
        });
    }
    
    // Message receive handler
    parentPort.on('message', (msg) => {
        console.log(`[Worker ${threadId}] Message received:`, msg);
        
        if (msg.command === 'stop') {
            console.log(`[Worker ${threadId}] Stop request received`);
            process.exit(0);
        } else if (msg.command === 'ping') {
            parentPort.postMessage({ 
                type: 'pong', 
                threadId,
                timestamp: Date.now()
            });
        }
    });
    
    // Run worker task
    try {
        workerTask();
    } catch (error) {
        parentPort.postMessage({ 
            type: 'error', 
            threadId,
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Main thread code
 */
if (isMainThread) {
    console.log('=== MCP Debug Tools - Thread Debugging Example ===');
    console.log(`Main thread ID: ${threadId}`);
    console.log(`Available CPU cores: ${THREADS_COUNT}`);
    console.log('');
    
    /**
     * Worker pool class
     * Manages multiple worker threads.
     */
    class WorkerPool {
        constructor(size) {
            this.size = size;
            this.workers = [];
            this.queue = [];
            this.activeWorkers = 0;
        }
        
        // Create worker
        createWorker(workerData) {
            return new Promise((resolve, reject) => {
                const worker = new Worker(__filename, { workerData });
                
                worker.on('message', (msg) => {
                    console.log(`[Main] Worker message received:`, msg);
                    resolve({ worker, message: msg });
                });
                
                worker.on('error', (error) => {
                    console.error(`[Main] Worker error:`, error);
                    reject(error);
                });
                
                worker.on('exit', (code) => {
                    console.log(`[Main] Worker exited, code: ${code}`);
                    this.activeWorkers--;
                });
                
                this.workers.push(worker);
                this.activeWorkers++;
            });
        }
        
        // Terminate all workers
        async terminateAll() {
            const promises = this.workers.map(worker => worker.terminate());
            await Promise.all(promises);
            this.workers = [];
            this.activeWorkers = 0;
        }
        
        // Send message to workers
        broadcast(message) {
            this.workers.forEach(worker => {
                worker.postMessage(message);
            });
        }
    }
    
    /**
     * Parallel task runner
     */
    async function runParallelTasks() {
        console.log('1. CPU-intensive computation (prime search)');
        console.log('----------------------------------------');
        
        const pool = new WorkerPool(4);
        const computeTasks = [];
        
        // Calculate primes concurrently in several workers
        const ranges = [1000, 2000, 3000, 4000];
        
        for (let i = 0; i < ranges.length; i++) {
            const task = pool.createWorker({
                taskType: 'compute',
                data: ranges[i]
            });
            computeTasks.push(task);
        }
        
        const computeResults = await Promise.all(computeTasks);
        computeResults.forEach((result, index) => {
            console.log(`Primes up to ${ranges[index]}:`, result.message);
        });
        
        await pool.terminateAll();
        console.log('');
    }
    
    /**
     * Data sorting task
     */
    async function runSortingTask() {
        console.log('2. Parallel data sorting');
        console.log('----------------------------------------');
        
        // Split a large array into chunks and sort them
        const bigArray = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 10000));
        const chunkSize = Math.ceil(bigArray.length / 4);
        const chunks = [];
        
        for (let i = 0; i < bigArray.length; i += chunkSize) {
            chunks.push(bigArray.slice(i, i + chunkSize));
        }
        
        console.log(`Original array size: ${bigArray.length}`);
        console.log(`Chunk count: ${chunks.length}, chunk size: ${chunkSize}`);
        
        const sortWorkers = [];
        
        for (let chunk of chunks) {
            const worker = new Worker(__filename, {
                workerData: {
                    taskType: 'sort',
                    data: chunk
                }
            });
            
            sortWorkers.push(new Promise((resolve) => {
                worker.on('message', (msg) => {
                    resolve(msg.data);
                    worker.terminate();
                });
            }));
        }
        
        const sortedChunks = await Promise.all(sortWorkers);
        
        // Merge sorted chunks
        const finalSorted = sortedChunks.flat().sort((a, b) => a - b);
        console.log(`Sorting complete: ${finalSorted.length} elements`);
        ')}]`);, ')}]`);
        ')}]`);, ')}]`);
        console.log('');
    }
    
    /**
     * Shared memory using SharedArrayBuffer
     */
    async function runSharedMemoryTask() {
        console.log('3. SharedArrayBuffer shared memory');
        console.log('----------------------------------------');
        
        // Create SharedArrayBuffer and check support
        if (typeof SharedArrayBuffer === 'undefined') {
            console.log('SharedArrayBuffer is not supported.');
            console.log('Run Node.js with --no-warnings --experimental-worker.');
            return;
        }
        
        const sharedBuffer = new SharedArrayBuffer(BUFFER_SIZE);
        const sharedArray = new Int32Array(sharedBuffer);
        
        // Set initial values
        for (let i = 0; i < sharedArray.length; i++) {
            sharedArray[i] = i;
        }
        
        console.log(`Shared memory size: ${BUFFER_SIZE} bytes`);
        ')}...]`);, ')}...]`);
        
        const memoryWorkers = [];
        
        // Four workers access memory concurrently
        for (let i = 0; i < 4; i++) {
            const worker = new Worker(__filename, {
                workerData: {
                    taskType: 'shared_memory',
                    data: null,
                    sharedBuffer: sharedBuffer
                }
            });
            
            memoryWorkers.push(new Promise((resolve) => {
                worker.on('message', (msg) => {
                    if (msg.type === 'memory_updated') {
                        resolve(msg);
                        worker.terminate();
                    }
                });
            }));
        }
        
        await Promise.all(memoryWorkers);
        
        ')}...]`);, ')}...]`);
        console.log('');
    }
    
    /**
     * Inter-worker communication using MessageChannel
     */
    async function runInterWorkerCommunication() {
        console.log('4. Direct inter-worker communication');
        console.log('----------------------------------------');
        
        const channel = new MessageChannel();
        
        const worker1 = new Worker(__filename, {
            workerData: {
                taskType: 'search',
                data: {
                    array: Array.from({ length: 100 }, (_, i) => i * 2),
                    target: 50
                }
            },
            transferList: [channel.port1]
        });
        
        const worker2 = new Worker(__filename, {
            workerData: {
                taskType: 'search',
                data: {
                    array: Array.from({ length: 100 }, (_, i) => i * 2 + 1),
                    target: 50
                }
            },
            transferList: [channel.port2]
        });
        
        const results = await Promise.all([
            new Promise(resolve => {
                worker1.on('message', msg => {
                    resolve(msg);
                    worker1.terminate();
                });
            }),
            new Promise(resolve => {
                worker2.on('message', msg => {
                    resolve(msg);
                    worker2.terminate();
                });
            })
        ]);
        
        console.log('Worker 1 result:', results[0]);
        console.log('Worker 2 result:', results[1]);
        console.log('');
    }
    
    /**
     * Performance measurement function
     */
    async function measurePerformance() {
        console.log('5. Performance comparison: single-threaded vs multi-threaded');
        console.log('----------------------------------------');
        
        const testSize = 5000;
        const testArray = Array.from({ length: testSize }, () => Math.random() * 10000);
        
        // Single-threaded sort
        const singleStart = performance.now();
        const singleSorted = testArray.slice().sort((a, b) => a - b);
        const singleEnd = performance.now();
        const singleTime = singleEnd - singleStart;
        
        console.log(`Single-threaded sort: ${singleTime.toFixed(2)}ms`);
        
        // Multi-threaded sort
        const multiStart = performance.now();
        
        // Split array into four chunks
        const chunkSize = Math.ceil(testArray.length / 4);
        const chunks = [];
        for (let i = 0; i < testArray.length; i += chunkSize) {
            chunks.push(testArray.slice(i, i + chunkSize));
        }
        
        const workers = chunks.map(chunk => {
            return new Promise((resolve) => {
                const worker = new Worker(__filename, {
                    workerData: {
                        taskType: 'sort',
                        data: chunk
                    }
                });
                
                worker.on('message', (msg) => {
                    resolve(msg.data);
                    worker.terminate();
                });
            });
        });
        
        const sortedChunks = await Promise.all(workers);
        const multiSorted = sortedChunks.flat().sort((a, b) => a - b);
        const multiEnd = performance.now();
        const multiTime = multiEnd - multiStart;
        
        console.log(`Multi-threaded sort: ${multiTime.toFixed(2)}ms`);
        console.log(`Performance gain: ${((singleTime / multiTime - 1) * 100).toFixed(1)}%`);
        console.log('');
    }
    
    /**
     * Main execution function
     */
    async function main() {
        try {
            // Run all examples sequentially
            await runParallelTasks();
            await runSortingTask();
            await runSharedMemoryTask();
            await runInterWorkerCommunication();
            await measurePerformance();
            
            console.log('=== All tests complete ===');
            console.log('');
            console.log('Debugging tips:');
            console.log('1. Check each worker threadId to distinguish threads');
            console.log('2. Trace message passing');
            console.log('3. Observe SharedArrayBuffer memory changes');
            console.log('4. Inspect worker creation and termination lifecycle');
            
        } catch (error) {
            console.error('Main error:', error);
        }
    }
    
    // Run main function
    main().catch(console.error);
}