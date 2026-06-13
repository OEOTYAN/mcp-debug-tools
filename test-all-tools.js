#!/usr/bin/env node

const http = require('http');

async function testAllTools() {
    console.log('Starting all-tool test...\n');

    try {
        const client = createHttpClient('http://localhost:8890');
        const tools = [
            { name: 'list-breakpoints', description: 'List breakpoints' },
            { name: 'get-debug-state', description: 'Get debug state' },
            { name: 'get-workspace-info', description: 'Get workspace info' },
            { name: 'list-debug-configs', description: 'List debug configurations' },
            { name: 'get-active-session', description: 'Get active debug session' }
        ];

        const results = [];

        for (const tool of tools) {
            console.log(`Test: ${tool.description} (${tool.name})`);
            const start = Date.now();

            try {
                const result = await callTool(client, tool.name, {});
                const elapsed = Date.now() - start;
                console.log(`  Success (${elapsed}ms)`);

                const content = JSON.stringify(result);
                const preview = content.substring(0, 100);
                console.log(`  Response: ${preview}${content.length > 100 ? '...' : ''}`);

                results.push({ tool: tool.name, success: true, time: elapsed });
            } catch (error) {
                const elapsed = Date.now() - start;
                console.log(`  Failed (${elapsed}ms): ${error.message}`);
                results.push({ tool: tool.name, success: false, time: elapsed, error: error.message });
            }

            console.log();
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
        const slowest = results.reduce((a, b) => a.time > b.time ? a : b);
        const fastest = results.reduce((a, b) => a.time < b.time ? a : b);

        console.log('Test summary\n');
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        console.log(`Average response time: ${avgTime.toFixed(2)}ms`);

        if (failCount > 0) {
            console.log('\nFailed tools:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.tool}: ${r.error}`);
            });
        }

        console.log(`\nSlowest tool: ${slowest.tool} (${slowest.time}ms)`);
        console.log(`Fastest tool: ${fastest.tool} (${fastest.time}ms)`);
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

function createHttpClient(baseUrl) {
    return { baseUrl };
}

function callTool(client, name, args) {
    const body = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args }
    });

    return new Promise((resolve, reject) => {
        const req = http.request(`${client.baseUrl}/mcp`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(parsed.error.message));
                    } else {
                        resolve(parsed.result);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

testAllTools();