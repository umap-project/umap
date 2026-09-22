#!/usr/bin/env node
// Extract translatable strings from our JS and refresh the source-language
// catalog (umap/static/umap/locale/en.json). Other languages are pulled from
// Transifex, so we only ever (re)generate `en` here.
//
// We walk each file's AST and collect the first string argument of every
// `translate(...)` / `_(...)` call. Obsolete keys are dropped; new keys default
// to their English source (value === key). Run it via `make messages`.

import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'acorn'

const SOURCE_DIRS = ['umap/static/umap/js']
const CATALOG = 'umap/static/umap/locale/en.json'
const CALLEES = new Set(['_', 'translate'])
const dryRun = process.argv.includes('--dry-run')

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name
  }
  return null
}

function collect(node, strings) {
  if (!node || typeof node.type !== 'string') return
  if (node.type === 'CallExpression' && CALLEES.has(calleeName(node.callee))) {
    const [first] = node.arguments
    if (first?.type === 'Literal' && typeof first.value === 'string') {
      strings.add(first.value)
    }
  }
  for (const key in node) {
    const child = node[key]
    if (Array.isArray(child)) for (const c of child) collect(c, strings)
    else if (child && typeof child.type === 'string') collect(child, strings)
  }
}

const strings = new Set()
for (const dir of SOURCE_DIRS) {
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    if (!file.endsWith('.js')) continue
    const code = fs.readFileSync(path.join(dir, file), 'utf8')
    collect(parse(code, { ecmaVersion: 'latest', sourceType: 'module' }), strings)
  }
}

const existing = fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, 'utf8')) : {}
const catalog = {}
// Keep still-used entries (preserving order and any existing value)…
for (const [key, value] of Object.entries(existing)) {
  if (strings.has(key)) catalog[key] = value
}
// …then append newly-found strings, defaulting to their English source.
for (const key of strings) {
  if (!(key in catalog)) catalog[key] = key
}

const content = JSON.stringify(catalog, null, 4)
if (dryRun) {
  process.stdout.write(`${content}\n`)
} else {
  fs.writeFileSync(CATALOG, content, 'utf8')
  process.stdout.write(`Wrote ${Object.keys(catalog).length} strings to ${CATALOG}\n`)
}
