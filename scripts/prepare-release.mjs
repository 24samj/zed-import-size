#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const outDir = path.join(root, 'release', 'import-size')
const keep = new Set([
  'extension.toml',
  'Cargo.toml',
  'src/lib.rs',
  'lsp-server/dist/server.js',
  'lsp-server/package.json',
  'lsp-server/package-lock.json',
])

function copyFileOrDir(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyFileOrDir(path.join(src, entry), path.join(dest, entry))
    }
    return
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
}

function mustExist(rel) {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing required artifact: ${rel}`)
  }
}

function main() {
  mustExist('lsp-server/dist/server.js')
  mustExist('lsp-server/node_modules')

  cleanDir(outDir)

  for (const rel of keep) {
    copyFileOrDir(path.join(root, rel), path.join(outDir, rel))
  }

  // Keep runtime deps for the LSP server.
  copyFileOrDir(
    path.join(root, 'lsp-server', 'node_modules'),
    path.join(outDir, 'lsp-server', 'node_modules'),
  )

  console.log(`Release package prepared at: ${outDir}`)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}

