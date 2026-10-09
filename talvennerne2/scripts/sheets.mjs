// Kontaktark: serverer det byggede sheets-app (artifacts/sheets-app, fra `vite build --mode sheets`)
// på en lille node:http-server, tager PNG i 2x af hver rute til artifacts/sheets/<rute>[-<art>].png og
// kører geometri-lints i siden (getBBox/isPointInFill): sikker zone, elementbudget, pasform og
// butikskortenes fyld. Fejl i lints eller konsolfejl giver exit-kode ≠ 0.
//
//   npm run sheets                       bygger og kører alle ruter for alle arter
//   node scripts/sheets.mjs closeup:cat  kun udvalgte ruter (forudsætter et byg); `closeup` = alle arter
//   node scripts/sheets.mjs scene:skov   én verdens scenark; `scene` = alle tre verdener
//   node scripts/sheets.mjs fitmatrix:ridder   ét sæts pasformsmatrix; `fitmatrix` = alle sæt
//
// Scenearkene (review G2-r2 §5.1) er én side pr. verden. Hvert panel fotograferes for sig i 2x
// (scene-<verden>/<b>x<h>-<tier>.png), og oversigten scene-<verden>.png (1 px pr. CSS-px) sættes sammen af de
// paneler og en helsidesoptagelse af resten af siden (tekst og kort), for en helsidesoptagelse af de tunge
// scener tegner ikke alle fliser færdigt – heller ikke ved 15 megapixel. Pixelene i panelerne og i oversigten
// lint'es for tomme flader (lintScenePixels i src/dev/lints.ts), så arket aldrig er mindre pålideligt end det,
// det dokumenterer.
//
// Pasformsmatrixen (review G2-r3 §6.1) er én side pr. sæt (fitmatrix-<sæt>.png, ca. 20 megapixel i stedet for ét ark på
// 165), og pixelene i optagelsen lint'es felt for felt for tomme eller halvt tegnede felter (lintBlankCells).
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
const GLOBAL = ['silhouettes', 'lineup', 'fitmatrix', 'scene', 'holes']
/** Scenearket er én side pr. verden (?sheet=scene&id=<verden>). */
const SCENE_WORLDS = ['eng', 'bakke', 'skov', 'fjeld']
/** Pasformsmatrixen er én side pr. sæt (?sheet=fitmatrix&id=<sæt>): sættene er mapperne i src/art/items. */
const MATRIX_SETS = readdirSync(path.join(root, 'src/art/items'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()

/** Udvid argumenter: `closeup` → closeup:<hver art>, `closeup:cat` → én. */
function expand(args) {
  const out = []
  for (const a of args.length ? args : [...PER_SPECIES, ...GLOBAL]) {
    const [route, id] = a.split(':')
    if (PER_SPECIES.includes(route)) for (const s of id ? [id] : SPECIES) out.push({ route, id: s })
    else if (route === 'scene') for (const w of id ? [id] : SCENE_WORLDS) out.push({ route, id: w })
    else if (route === 'fitmatrix') for (const m of id ? [id] : MATRIX_SETS) out.push({ route, id: m })
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
    if (route === 'scene') await sceneSheet(page, id, file, lint)
    else {
      const png = (await page.screenshot({ path: file, fullPage: true, timeout: READY_MS })).toString('base64')
      if (route === 'fitmatrix') await matrixPixels(page, png, lint)
    }
    return { lint, size, consoleErrors }
  } catch (e) {
    return { error: `${e.message.split('\n')[0]}${consoleErrors.length ? ` · ${consoleErrors.join(' | ')}` : ''}` }
  } finally {
    await page.close()
  }
}

/**
 * Et scenark: hvert panel som sin egen PNG i 2x (locator.screenshot) og oversigten (1 px pr. CSS-px) sat sammen af
 * panelerne og en helsidesoptagelse af siden uden scener. Lint for tomme flader i hvert panel og i oversigten;
 * fejlene lægges i sidens lint.
 */
async function sceneSheet(page, world, file, lint) {
  const dir = path.join(outDir, `scene-${world}`)
  await mkdir(dir, { recursive: true })
  const panels = await page.evaluate(() => window.__scenePanels())
  const scale = await page.evaluate(() => devicePixelRatio)
  const shots = []
  let maxShare = 0
  for (const p of panels) {
    const el = page.locator(`[data-scene-panel="${p.name}"]`)
    const png = (await el.screenshot({ path: path.join(dir, `${p.name}.png`), timeout: READY_MS })).toString('base64')
    // optagelsen dækker elementets boks; dens hjørne i sidens CSS-px (efter at Playwright har rullet det frem)
    const box = await el.evaluate((n) => {
      const r = n.getBoundingClientRect()
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
    })
    const r = await page.evaluate(([b64, ps, k, o]) => window.__lintScenePixels(b64, ps, k, o), [png, [p], scale, box])
    lint.errors.push(...r.errors.map((e) => `scene-${world}/${e}`))
    lint.checks += r.checks
    maxShare = Math.max(maxShare, r.maxShare)
    shots.push({ png, ...box })
  }
  // siden uden scenerne (tekst, kort og skitsernes pladser), og panelerne lagt ind, hvor de står
  await page.addStyleTag({ content: '[data-scene-panel] > * { visibility: hidden !important; }' })
  const base = (await page.screenshot({ fullPage: true, scale: 'css', timeout: READY_MS })).toString('base64')
  const sheet = await page.evaluate(async ([bg, list]) => {
    const load = async (b64) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const img = await load(bg)
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    g.imageSmoothingQuality = 'high'
    for (const s of list) g.drawImage(await load(s.png), s.x, s.y, s.w, s.h)
    return c.toDataURL('image/png').slice('data:image/png;base64,'.length)
  }, [base, shots])
  await writeFile(file, Buffer.from(sheet, 'base64'))
  const all = await page.evaluate(([b64, ps]) => window.__lintScenePixels(b64, ps, 1, { x: 0, y: 0 }), [sheet, panels])
  lint.errors.push(...all.errors.map((e) => `oversigten ${e}`))
  lint.checks += all.checks
  lint.scenePanels = panels.length
  lint.blankMax = Math.max(maxShare, all.maxShare)
}

/** Pasformsmatrixen: hvert felt i helsidesoptagelsen er tegnet (lintBlankCells); fejlene lægges i sidens lint. */
async function matrixPixels(page, png, lint) {
  const cells = await page.evaluate(() => window.__matrixCells())
  const scale = await page.evaluate(() => devicePixelRatio)
  const r = await page.evaluate(([b64, cs, k]) => window.__lintBlankCells(b64, cs, k, { x: 0, y: 0 }), [png, cells, scale])
  lint.errors.push(...r.errors)
  lint.checks += r.checks
  lint.matrixCells = cells.length
  lint.cellPaperMax = r.maxPaper
  lint.cellInkMin = r.minInk
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
    const card =
      (lint.minCardFill !== undefined ? `, kort ≥ ${(lint.minCardFill * 100).toFixed(0)} %` : '') +
      (lint.scenePanels !== undefined ? `, ${lint.scenePanels} scenepaneler, maks ${lint.maxScene} el./scene, største papirlyse flade ${(lint.blankMax * 100).toFixed(2)} %` : '') +
      (lint.matrixCells !== undefined ? `, ${lint.matrixCells} felter, største papirflade ${(lint.cellPaperMax * 100).toFixed(1)} %, mindst tegning ${(lint.cellInkMin * 100).toFixed(0)} %` : '')
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
