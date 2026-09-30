// Kontaktark: serverer det byggede sheets-app (artifacts/sheets-app, fra `vite build --mode sheets`)
// på en lille node:http-server, tager PNG i 2× af hver rute til artifacts/sheets/<rute>.png og
// kører geometri-lints i siden (getBBox/isPointInFill): sikker zone, elementbudget og pasform.
// Fejl i lints eller konsolfejl giver exit-kode ≠ 0.
//
//   npm run sheets                 bygger og kører alle ruter
//   node scripts/sheets.mjs fit    kun udvalgte ruter (forudsætter et byg)
//
// Chromium deles med andre agenter: scriptet kører altid sig selv bag flock /tmp/tv2-chromium.lock.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
const PORT = Number(process.env.SHEETS_PORT ?? 4302)
const ALL = ['species', 'moods', 'closeup', 'sizes', 'silhouettes', 'fit', 'filmstrip', 'lineup']
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ALL

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
const browser = await launch()
const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } })
const report = {}
let failed = false

try {
  for (const route of routes) {
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
    page.on('pageerror', (e) => consoleErrors.push(String(e)))
    await page.goto(`http://127.0.0.1:${PORT}/sheets.html?sheet=${route}`, { waitUntil: 'load' })
    try {
      await page.waitForFunction(() => window.__sheetReady === true, null, { timeout: 30_000 })
    } catch (e) {
      console.log(`FEJL ${route.padEnd(12)} siden blev ikke klar: ${consoleErrors.join(' | ') || e.message}`)
      report[route] = { errors: [`siden blev ikke klar`, ...consoleErrors] }
      failed = true
      await page.close()
      continue
    }
    const lint = await page.evaluate(() => window.__lint())
    const size = await page.evaluate(() => ({
      w: Math.ceil(document.documentElement.scrollWidth),
      h: Math.ceil(document.documentElement.scrollHeight),
    }))
    await page.setViewportSize({ width: size.w, height: Math.min(size.h, 1200) })
    const file = path.join(outDir, `${route}.png`)
    await page.screenshot({ path: file, fullPage: true })
    await page.close()

    const errors = [...lint.errors, ...consoleErrors.map((e) => `konsolfejl: ${e}`)]
    report[route] = { ...lint, errors, png: path.relative(root, file), size }
    const status = errors.length ? 'FEJL' : 'ok'
    console.log(
      `${status.padEnd(4)} ${route.padEnd(12)} ${String(lint.rigs).padStart(3)} dyr, ${String(lint.items).padStart(3)} genstande, ` +
        `${String(lint.checks).padStart(4)} tjek, maks ${lint.maxAnimal} el./dyr, ${lint.maxItem} el./genstand → ${path.relative(root, file)}`,
    )
    for (const e of errors.slice(0, 20)) console.log(`       ${e}`)
    if (errors.length > 20) console.log(`       … og ${errors.length - 20} mere`)
    if (errors.length) failed = true
  }
} finally {
  await browser.close()
  server.close()
}

await writeFile(path.join(outDir, 'lint.json'), JSON.stringify(report, null, 2))
if (failed) {
  console.error('sheets: lints fejlede (se ovenfor og artifacts/sheets/lint.json)')
  process.exitCode = 1
}
