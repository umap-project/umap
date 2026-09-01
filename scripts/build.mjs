// Bundle the app's ESM module graph with esbuild.
//
// Same pipeline for dev and prod: the ONLY difference is `--minify` (behavior
// preserving), so what runs in dev is what ships. See docs on the bundle
// strategy.
//
//   node scripts/build.mjs            # one-shot dev build (sourcemaps, no minify)
//   node scripts/build.mjs --watch    # rebuild on change
//   node scripts/build.mjs --minify   # production build

import { rm } from 'node:fs/promises'
import * as esbuild from 'esbuild'

const ROOT = 'umap/static/umap/js'

// Direct script we load synchronally (others end in chunk-xxx).
const entryPoints = [
  `${ROOT}/modules/app.js`,
  `${ROOT}/modules/i18n.js`,
  `${ROOT}/components/fragment.js`,
  `${ROOT}/components/modal.js`,
  `${ROOT}/components/copiable.js`,
  // Standalone module scripts inlined by non-map templates
  `${ROOT}/components/alerts/alert.js`,
  `${ROOT}/components/base.js`,
  `${ROOT}/modules/request.js`,
  `${ROOT}/modules/autocomplete.js`,
  // All CSS (uMap + vendored ol.css) in one bundle; theme.css stays separate.
  'umap/static/umap/css/umap.css',
]

const minify = process.argv.includes('--minify')
const watch = process.argv.includes('--watch')
const verbose = process.argv.includes('--verbose')

const options = {
  entryPoints,
  bundle: true,
  format: 'esm',
  splitting: true,
  platform: 'browser',
  outdir: 'umap/static/umap/dist',
  entryNames: '[name]',
  // Shared split chunks are all named "chunk" by esbuild, so they need [hash] to
  // stay unique. Django's ManifestStaticFilesStorage then re-hashes on top (a
  // harmless double hash) and rewrites the ESM imports between files.
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  target: 'es2022',
  sourcemap: true,
  minify,
  // Fonts/images referenced via CSS url() get copied to dist/assets (hashed via
  // assetNames) with their url() rewritten, so paths stay correct from dist/.
  loader: {
    '.woff': 'file',
    '.woff2': 'file',
    '.png': 'file',
    '.gif': 'file',
    '.svg': 'file',
  },
  // Only used by test (in Node, not browser).
  external: ['jsdom'],
  metafile: true,
  logLevel: 'info',
}

function report(result) {
  const outputs = result.metafile?.outputs ?? {}
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`

  // Boot payload = our real entries + everything reachable through *static*
  // imports. Anything only reachable via `dynamic-import` is a lazy chunk.
  // NB: esbuild sets `entryPoint` on every dynamic-import target too, so we must
  // seed only from OUR entryPoints, not from any output carrying an entryPoint.
  const mine = new Set(entryPoints)
  const boot = new Set()
  const queue = Object.entries(outputs)
    .filter(([, o]) => mine.has(o.entryPoint))
    .map(([f]) => f)
  while (queue.length) {
    const f = queue.shift()
    if (boot.has(f)) continue
    boot.add(f)
    for (const imp of outputs[f]?.imports ?? []) {
      if (imp.kind === 'import-statement') queue.push(imp.path)
    }
  }

  const all = Object.entries(outputs).filter(([f]) => f.endsWith('.js'))
  const sum = (rows) => rows.reduce((n, [, o]) => n + o.bytes, 0)
  const bootRows = all
    .filter(([f]) => boot.has(f))
    .sort((a, b) => b[1].bytes - a[1].bytes)
  const lazyRows = all
    .filter(([f]) => !boot.has(f))
    .sort((a, b) => b[1].bytes - a[1].bytes)

  // Attribute every input module (across all boot chunks) to a source bucket,
  // so we can see what actually fills the boot payload.
  const bucketOf = (p) => {
    let m = p.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
    if (m) return m[1].startsWith('@turf') ? '@turf/*' : m[1]
    m = p.match(/vendors\/([^/]+)/)
    if (m) return `vendors/${m[1]}`
    m = p.match(/js\/(modules\/[^/]+|components|[^/]+)/)
    if (m) return `app: ${m[1]}`
    return p
  }
  const buckets = {}
  for (const f of boot) {
    for (const [inp, meta] of Object.entries(outputs[f]?.inputs ?? {})) {
      const b = bucketOf(inp)
      buckets[b] = (buckets[b] || 0) + meta.bytesInOutput
    }
  }

  const tag = minify ? ' (minified)' : ''
  console.log(
    `\n=== BOOT (${bootRows.length} fichiers, ${kb(sum(bootRows))})${tag} ===`
  )
  if (verbose) {
    console.log('--- par source ---')
    for (const [b, n] of Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)) {
      console.log(`  ${kb(n).padStart(9)}  ${b}`)
    }
    console.log('--- par chunk ---')
    for (const [f, o] of bootRows)
      console.log(
        `  ${kb(o.bytes).padStart(9)}  ${f.replace('umap/static/umap/dist/', '')}`
      )
  }
  console.log(
    `\n=== LAZY (${lazyRows.length} chunks, ${kb(sum(lazyRows))}) — chargés à la demande ===`
  )
  if (verbose) {
    for (const [f, o] of lazyRows.slice(0, 12))
      console.log(
        `  ${kb(o.bytes).padStart(9)}  ${f.replace('umap/static/umap/dist/', '')}`
      )
    if (lazyRows.length > 12) console.log(`  … +${lazyRows.length - 12} autres`)
  }
  console.log(`\nTotal émis: ${kb(sum(all))}`)
}

// Delete stales chunks, so collectstatic does not complain.
await rm(`${options.outdir}/chunks`, { recursive: true, force: true })
await rm(`${options.outdir}/assets`, { recursive: true, force: true })

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log('esbuild: watching…')
} else {
  const result = await esbuild.build(options)
  report(result)
}
