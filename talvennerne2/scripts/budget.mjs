// Bundle budget (SPEC §12.5). Fails the build when a budget is exceeded.
// Initial JS = scripts and modulepreloads referenced by dist/index.html.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const dist = path.resolve(import.meta.dirname, '../dist')
const KB = 1024
// total: 750 KB since SPEC A16 (every lazy chunk summed; the initial bundle and each chunk set the waiting time)
const BUDGET = { initial: 160 * KB, chunk: 60 * KB, total: 750 * KB, font: 80 * KB }

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const files = walk(dist)
const gz = (p) => gzipSync(readFileSync(p)).length
const rel = (p) => path.relative(dist, p)

const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const initialRefs = new Set(
  [...html.matchAll(/(?:src|href)="\.?\/?([^"]+\.js)"/g)].map((m) => path.normalize(m[1])),
)

const js = files.filter((p) => p.endsWith('.js'))
let initial = 0
let total = 0
const errors = []
const rows = []
for (const p of js) {
  const size = gz(p)
  total += size
  const isInitial = initialRefs.has(rel(p))
  if (isInitial) initial += size
  else if (size > BUDGET.chunk) errors.push(`lazy chunk ${rel(p)} er ${(size / KB).toFixed(1)} KB gzip (> 60 KB)`)
  rows.push([rel(p), size, isInitial])
}
if (initial > BUDGET.initial) errors.push(`initial JS er ${(initial / KB).toFixed(1)} KB gzip (> 160 KB)`)
if (total > BUDGET.total) errors.push(`al JS er ${(total / KB).toFixed(1)} KB gzip (> ${BUDGET.total / KB} KB)`)
for (const p of files.filter((f) => /\.woff2$/.test(f))) {
  const size = statSync(p).size
  if (size > BUDGET.font) errors.push(`skrift ${rel(p)} er ${(size / KB).toFixed(1)} KB (> 80 KB)`)
}

rows.sort((a, b) => b[1] - a[1])
for (const [name, size, isInitial] of rows.slice(0, 12)) {
  console.log(`${isInitial ? 'I' : ' '} ${(size / KB).toFixed(1).padStart(7)} KB  ${name}`)
}
console.log(`budget: initial ${(initial / KB).toFixed(1)} KB, al JS ${(total / KB).toFixed(1)} KB (gzip)`)
if (errors.length) {
  for (const e of errors) console.error(`budget: ${e}`)
  process.exit(1)
}
