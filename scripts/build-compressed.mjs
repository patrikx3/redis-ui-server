#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { minify } from 'terser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')
const distDir = path.join(rootDir, 'dist')

const walkFiles = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...await walkFiles(fullPath))
        } else if (entry.isFile()) {
            files.push(fullPath)
        }
    }
    return files
}

const minifyJavaScript = async (sourceCode, relativePath) => {
    const result = await minify(sourceCode, {
        module: true,
        compress: {
            passes: 2,
            keep_infinity: true,
            unsafe_arrows: true,
        },
        mangle: true,
        format: {
            ascii_only: true,
            comments: false,
        },
    })

    if (!result || typeof result.code !== 'string' || result.code.length === 0) {
        throw new Error(`minify-empty-output: ${relativePath}`)
    }

    return `${result.code}\n`
}

const buildCompressed = async () => {
    console.log('build-compressed: started')
    await fs.rm(distDir, { recursive: true, force: true })

    const sourceFiles = await walkFiles(srcDir)
    let minifiedCount = 0
    let copiedCount = 0

    for (const sourceFile of sourceFiles) {
        const relativePath = path.relative(srcDir, sourceFile)
        const outputFile = path.join(distDir, relativePath)
        await fs.mkdir(path.dirname(outputFile), { recursive: true })

        if (path.extname(sourceFile) === '.mjs') {
            const sourceCode = await fs.readFile(sourceFile, 'utf8')
            const minifiedCode = await minifyJavaScript(sourceCode, relativePath)
            await fs.writeFile(outputFile, minifiedCode, 'utf8')
            minifiedCount++
            continue
        }

        await fs.copyFile(sourceFile, outputFile)
        copiedCount++
    }

    console.log(`build-compressed: done (minified=${minifiedCount}, copied=${copiedCount})`)
}

buildCompressed().catch((error) => {
    console.error('build-compressed: failed', error)
    process.exit(1)
})
