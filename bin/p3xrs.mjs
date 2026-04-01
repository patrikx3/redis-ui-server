#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDevelopment = process.env.NODE_ENV === 'development'
const srcBootModule = '../src/lib/boot.mjs'
const distBootModule = '../dist/lib/boot.mjs'
const distBootFilename = path.resolve(__dirname, '../dist/lib/boot.mjs')

const bootModule = isDevelopment || !fs.existsSync(distBootFilename)
    ? srcBootModule
    : distBootModule

const bootPath = path.resolve(__dirname, bootModule)
const mod = await import(bootPath)
const boot = mod.default
boot()
