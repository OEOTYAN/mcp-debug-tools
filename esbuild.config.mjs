import { chmodSync, rmSync } from 'node:fs'
import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const commonOptions = {
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: true,
    sourcesContent: false,
    legalComments: 'none',
    minifyWhitespace: true,
    logLevel: 'info',
}

const buildOptions = [
    {
        ...commonOptions,
        entryPoints: ['src/extension.ts'],
        outfile: 'out/extension.js',
        external: ['vscode'],
    },
    {
        ...commonOptions,
        entryPoints: ['src/cli.ts'],
        outfile: 'out/cli.js',
    },
]

if (!watch) {
    rmSync('out', { recursive: true, force: true })
    await Promise.all(buildOptions.map(options => esbuild.build(options)))
    chmodSync('out/cli.js', 0o755)
} else {
    rmSync('out', { recursive: true, force: true })
    const contexts = await Promise.all(buildOptions.map(options => esbuild.context(options)))
    await Promise.all(contexts.map(context => context.watch()))
    console.log('Watching source files...')
}
