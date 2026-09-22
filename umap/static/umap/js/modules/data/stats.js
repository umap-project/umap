// Re-export only the simple-statistics functions we use, so a dynamic
// `import('./stats.js')` stays lazy while esbuild tree-shakes the rest of the
// 145 KB library away (a dynamic `import('simple-statistics')` would keep the
// whole namespace — no tree-shaking across the import() boundary).
export {
  ckmeans,
  equalIntervalBreaks,
  jenks,
  max,
  quantile,
} from 'simple-statistics'
