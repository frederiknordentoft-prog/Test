// Kontaktark: serverer det byggede sheets-app (artifacts/sheets-app, fra `vite build --mode sheets`)
// på en lille node:http-server, tager PNG i 2× af hver rute til artifacts/sheets/<rute>[-<art>].png og
// kører geometri-lints i siden (getBBox/isPointInFill): sikker zone, elementbudget, pasform og
// butikskortenes fyld. Fejl i lints eller konsolfejl giver exit-kode ≠ 0.
//
//   npm run sheets                       bygger og kører alle ruter for alle arter
//   node scripts/sheets.mjs closeup:cat  kun udvalgte ruter (forudsætter et byg); `closeup` = alle arter
//
// Chromium deles med andre agenter: scriptet kører altid sig selv bag flock /tmp/tv2-chromium.lock.
// Under CPU-belastning venter hver side op til SHEETS_READY_MS (standard 120 s) og prøves én gang til.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const LOCK = '/tmp/tv2-chromium.lock'
if (!process.env.TV2_SHEETS_LOCKED) {
  const r = spawnSync('flock', [LOCK, process.execPath, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TV2_SHEETS_LOCKED: '1' },
  })
  process.exit(r.status ?? 1)
}

const { launch } = await import('./browser.mjs')

const root = path.resolve(import.meta.dirname, '..')
const appDir = path.join(root, 'artifacts/sheets-app')
const outDir = path.join(root, 'artifacts/sheets')
const PORT = Number(process.env.SHEETS_PORT ?? 4314)
const READY_MS = Math.max(90_000, Number(process.env.SHEETS_READY_MS ?? 120_000))

// Arterne er filerne i src/art/species (rækkefølgen fra kontrakten).
const ORDER = ['rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'lamb', 'fox', 'hamster', 'unicorn', 'panda', 'squirrel', 'owl', 'pegasus', 'dragon', 'penguin', 'polarbear']
const present = new Set(readdirSync(path.join(root, 'src/art/species')).filter((f) => /^[a-z]+\.tsx$/.test(f)).map((f) => f.slice(0, -4)))
const SPECIES = ORDER.filter((id) => present.has(id))
const PER_SPECIES = ['species', 'moods', 'closeup', 'sizes', 'fit', 'filmstrip']
const GLOBAL = ['silhouettes', 'lineup', 'fitmatrix']

/** Udvid argumenter: `closeup` → closeup:<hver art>, `closeup:cat` → én. */
function expand(args) {
  const out = []
  for (const a of args.length ? args : [...PER_SPECIES, ...GLOBAL]) {
    const [route, id] = a.split(':')
    if (PER_SPECIES.includes(route)) for (const s of id ? [id] : SPECIES) out.push({ route, id: s })
    else out.push({ route })
  }
  return out
}
const jobs = expand(process.argv.slice(2))

if (!existsSync(path.join(appDir, 'sheets.html'))) {
  console.error('sheets: artifacts/sheets-app mangler – kør `npm run sheets` (bygger med --mode sheets).')
  process.exit(2)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204).end()
    return
  }
  const rel = decodeURIComponent(url.pathname === '/' ? '/sheets.html' : url.pathname)
  const file = path.normalize(path.join(appDir, rel))
  if (!file.startsWith(appDir)) {
    res.writeHead(403).end()
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((ok, fail) => server.once('error', fail).listen(PORT, '127.0.0.1', ok))

await mkdir(outDir, { recursive: true })
const reportFile = path.join(outDir, 'lint.json')
const report = existsSync(reportFile) ? JSON.parse(await readFile(reportFile, 'utf8')) : {}
const browser = await launch()
const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } })
context.setDefaultTimeout(READY_MS)
context.setDefaultNavigationTimeout(READY_MS)
let failed = false

/** Én side: indlæs, vent på klar, lint og fotografér. Returnerer null, hvis siden ikke blev klar. */
async function shoot({ route, id }, file) {
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(String(e)))
  try {
    await page.goto(`http://127.0.0.1:${PORT}/sheets.html?sheet=${route}${id ? `&id=${id}` : ''}`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__sheetReady === true, null, { timeout: READY_MS, polling: 250 })
    const lint = await page.evaluate(() => window.__lint())
    const size = await page.evaluate(() => {
      const r = document.querySelector('.sh-page')?.getBoundingClientRect()
      return {
        w: Math.max(480, Math.ceil(r ? r.right : document.documentElement.scrollWidth)),
        h: Math.ceil(document.documentElement.scrollHeight),
      }
    })
    await page.setViewportSize({ width: size.w, height: Math.min(size.h, 1200) })
    await page.screenshot({ path: file, fullPage: true, timeout: READY_MS })
    return { lint, size, consoleErrors }
  } catch (e) {
    return { error: `${e.message.split('\n')[0]}${consoleErrors.length ? ` · ${consoleErrors.join(' | ')}` : ''}` }
  } finally {
    await page.close()
  }
}

try {
  for (const job of jobs) {
    const name = job.id ? `${job.route}-${job.id}` : job.route
    const file = path.join(outDir, `${name}.png`)
    let r = await shoot(job, file)
    if (r.error) r = await shoot(job, file) // én gang til (CPU-belastning, delt Chromium)
    if (r.error) {
      console.log(`FEJL ${name.padEnd(18)} siden blev ikke klar: ${r.error}`)
      report[name] = { errors: [`siden blev ikke klar: ${r.error}`] }
      failed = true
      continue
    }
    const { lint, size, consoleErrors } = r
    const errors = [...lint.errors, ...consoleErrors.map((e) => `konsolfejl: ${e}`)]
    report[name] = { ...lint, errors, png: path.relative(root, file), size }
    const status = errors.length ? 'FEJL' : 'ok'
    const card = lint.minCardFill !== undefined ? `, kort ≥ ${(lint.minCardFill * 100).toFixed(0)} %` : ''
    console.log(
      `${status.padEnd(4)} ${name.padEnd(18)} ${String(lint.rigs).padStart(3)} dyr, ${String(lint.items).padStart(3)} genstande, ` +
        `${String(lint.checks).padStart(4)} tjek, maks ${lint.maxAnimal} el./dyr, ${lint.maxItem} el./genstand${card} → ${path.relative(root, file)}`,
    )
    for (const e of errors.slice(0, 20)) console.log(`       ${e}`)
    if (errors.length > 20) console.log(`       … og ${errors.length - 20} mere`)
    if (errors.length) failed = true
  }
} finally {
  await browser.close()
  server.close()
}

await writeFile(reportFile, JSON.stringify(report, null, 2))
if (failed) {
  console.error('sheets: lints fejlede (se ovenfor og artifacts/sheets/lint.json)')
  process.exitCode = 1
}
