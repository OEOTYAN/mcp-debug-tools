/**
 * MCP Debug Tools - Basic Debugging Example
 * This sample demonstrates basic debugging with functions, local variables, loops, and conditionals.
 */

// Global variables
let globalCounter = 0;
const MAX_ITERATIONS = 10;

/**
 * Data processing class
 * Includes several data types and methods.
 */
class DataProcessor {
    constructor(name) {
        this.name = name;
        this.data = [];
        this.processCount = 0;
    }

    // Add data method
    addData(item) {
        if (typeof item === 'object') {
            this.data.push({ ...item, timestamp: Date.now() });
        } else {
            this.data.push({ value: item, timestamp: Date.now() });
        }
        this.processCount++;
    }

    // Filter data method
    filterData(condition) {
        return this.data.filter(item => {
            // Example point for conditional breakpoints
            if (item.value && condition(item.value)) {
                return true;
            }
            return false;
        });
    }

    // Data summary statistics
    getSummary() {
        const summary = {
            totalItems: this.data.length,
            processCount: this.processCount,
            processorName: this.name
        };
        
        // Extract numeric data and calculate statistics
        const numericValues = this.data
            .map(item => item.value)
            .filter(val => typeof val === 'number');
        
        if (numericValues.length > 0) {
            summary.average = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
            summary.max = Math.max(...numericValues);
            summary.min = Math.min(...numericValues);
        }
        
        return summary;
    }
}

/**
 * Fibonacci sequence calculation (recursive)
 * Example function for call stack tracing.
 */
function fibonacci(n) {
    // Base case
    if (n <= 1) {
        return n;
    }
    
    // Recursive call for observing call stack depth
    const result = fibonacci(n - 1) + fibonacci(n - 2);
    globalCounter++;
    
    return result;
}

/**
 * Array sorting algorithm (bubble sort)
 * Loop and conditional debugging example.
 */
function bubbleSort(arr) {
    const array = [...arr]; // Copy array
    const n = array.length;
    let swapped;
    
    // Outer loop
    for (let i = 0; i < n - 1; i++) {
        swapped = false;
        
        // Inner loop
        for (let j = 0; j < n - i - 1; j++) {
            // Compare and swap
            if (array[j] > array[j + 1]) {
                // Perform swap
                let temp = array[j];
                array[j] = array[j + 1];
                array[j + 1] = temp;
                swapped = true;
            }
        }
        
        // Optimization: no swaps means sorting is complete
        if (!swapped) {
            break;
        }
    }
    
    return array;
}

/**
 * Async data processing function
 * Promise and async/await debugging example.
 */
async function fetchDataAsync(id) {
    // Simulate a network request
    return new Promise((resolve, reject) => {
        const delay = Math.random() * 1000;
        
        setTimeout(() => {
            if (id < 0) {
                reject(new Error(`Invalid ID: ${id}`));
            } else {
                resolve({
                    id: id,
                    data: `Data for ID ${id}`,
                    timestamp: new Date().toISOString()
                });
            }
        }, delay);
    });
}

/**
 * Complex object structure processing
 * Nested object and array debugging example.
 */
function processComplexData(input) {
    const result = {
        processed: [],
        errors: [],
        stats: {
            total: 0,
            successful: 0,
            failed: 0
        }
    };
    
    // Validate input data
    if (!Array.isArray(input)) {
        result.errors.push('Input must be an array');
        return result;
    }
    
    // Process each item
    input.forEach((item, index) => {
        result.stats.total++;
        
        try {
            // Conditional processing
            if (item.type === 'number') {
                const processed = item.value * 2;
                result.processed.push({
                    original: item.value,
                    processed: processed,
                    index: index
                });
                result.stats.successful++;
                
            } else if (item.type === 'string') {
                const processed = item.value.toUpperCase();
                result.processed.push({
                    original: item.value,
                    processed: processed,
                    index: index
                });
                result.stats.successful++;
                
            } else if (item.type === 'array') {
                const sum = item.value.reduce((acc, val) => acc + val, 0);
                result.processed.push({
                    original: item.value,
                    processed: sum,
                    index: index
                });
                result.stats.successful++;
                
            } else {
                throw new Error(`Unknown type: ${item.type}`);
            }
            
        } catch (error) {
            result.errors.push({
                index: index,
                error: error.message,
                item: item
            });
            result.stats.failed++;
        }
    });
    
    return result;
}

/**
 * Error handling example function
 * try-catch and exception debugging.
 */
function divideNumbers(a, b) {
    try {
        // Validate inputs
        if (typeof a !== 'number' || typeof b !== 'number') {
            throw new TypeError('Both arguments must be numbers');
        }
        
        // Check division by zero
        if (b === 0) {
            throw new Error('Division by zero is not allowed');
        }
        
        const result = a / b;
        
        // Validate result
        if (!isFinite(result)) {
            throw new Error('Result is not finite');
        }
        
        return {
            success: true,
            result: result,
            operation: `${a} / ${b}`
        };
        
    } catch (error) {
        // Log and return errors
        console.error('Division error:', error.message);
        return {
            success: false,
            error: error.message,
            operation: `${a} / ${b}`
        };
    }
}

/**
 * Main execution function
 * Runs all example functions and prints results.
 */
async function main() {
    console.log('=== MCP Debug Tools - Basic Debugging Example ===\n');
    
    // 1. Use the DataProcessor class
    console.log('1. DataProcessor class test');
    const processor = new DataProcessor('MainProcessor');
    
    // Add several data types
    for (let i = 1; i <= 5; i++) {
        processor.addData(i * 10);
        processor.addData({ id: i, value: i * 100 });
    }
    
    const filtered = processor.filterData(value => value > 25);
    console.log('Filtered data:', filtered);
    console.log('Summary:', processor.getSummary());
    console.log('');
    
    // 2. Calculate Fibonacci sequence
    console.log('2. Fibonacci sequence calculation');
    const fibNumbers = [];
    for (let i = 1; i <= 8; i++) {
        const fib = fibonacci(i);
        fibNumbers.push(fib);
        console.log(`Fibonacci(${i}) = ${fib}`);
    }
    console.log('Global counter:', globalCounter);
    console.log('');
    
    // 3. Sort array
    console.log('3. Bubble sort algorithm');
    const unsorted = [64, 34, 25, 12, 22, 11, 90, 88, 45, 33];
    console.log('Before sorting:', unsorted);
    const sorted = bubbleSort(unsorted);
    console.log('After sorting:', sorted);
    console.log('');
    
    // 4. Async processing
    console.log('4. Async data processing');
    try {
        const promises = [
            fetchDataAsync(1),
            fetchDataAsync(2),
            fetchDataAsync(3)
        ];
        
        const results = await Promise.all(promises);
        results.forEach(result => {
            console.log(`Fetched:`, result);
        });
        
        // Test error case
        try {
            await fetchDataAsync(-1);
        } catch (error) {
            console.log('Caught error:', error.message);
        }
    } catch (error) {
        console.error('Async error:', error);
    }
    console.log('');
    
    // 5. Process complex data
    console.log('5. Complex object structure processing');
    const complexInput = [
        { type: 'number', value: 42 },
        { type: 'string', value: 'hello' },
        { type: 'array', value: [1, 2, 3, 4, 5] },
        { type: 'number', value: 100 },
        { type: 'unknown', value: {} },  // Error case
        { type: 'string', value: 'world' }
    ];
    
    const processResult = processComplexData(complexInput);
    console.log('Process result:', JSON.stringify(processResult, null, 2));
    console.log('');
    
    // 6. Error handling example
    console.log('6. Error handling example');
    const divisionTests = [
        { a: 10, b: 2 },
        { a: 100, b: 0 },    // Division by zero
        { a: '10', b: 2 },   // Type error
        { a: 50, b: 5 },
        { a: NaN, b: 10 }    // NaN case
    ];
    
    divisionTests.forEach(test => {
        const result = divideNumbers(test.a, test.b);
        console.log(`Division test:`, result);
    });
    
    console.log('\n=== All tests complete ===');
    console.log('Set breakpoints and start debugging.');
}

// Run program
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});