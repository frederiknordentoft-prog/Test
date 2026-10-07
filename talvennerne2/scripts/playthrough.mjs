// The G-slice playthrough (SPEC §15.2), in two parts:
//
// 1. Production: the built app (dist/) served the way GitHub Pages serves it, under
//    /Test/talvennerne2/, opened in Chromium in six viewports (three sizes, both orientations).
//    It boots onto the grown-ups' intro, goes on to the sound check, and is reloaded. Checked:
//    0 console errors, no horizontal scrolling, ≤ 1 500 SVG elements, and V1's save
//    (`talvennerne.save`) and a foreign key (`x:y`) byte-identical, with only `talvennerne2.` keys added.
// 2. Flows: the click-throughs written beside the screens, run on a dev server of this tree:
//    onboarding and profiles, the play loop (map → round → ceremonies → map, pause, reload),
//    Stjernefjeldet (a stone per region, five trials and the finale, by touch; `?worlds=all` until
//    it is released), the parent dashboard and a whole round of every task kind.
//
//   npm run build && npm run playthrough          (PLAYTHROUGH_ONLY=prod|flows runs one part)
//   PLAYTHROUGH_ONLY=prod PLAYTHROUGH_DIST=<dir> node scripts/playthrough.mjs   (a fetched live copy)
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './browser.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// PLAYTHROUGH_DIST: another copy of the build, e.g. the files fetched back from the live site (A7)
const DIST = process.env.PLAYTHROUGH_DIST ?? join(ROOT, 'dist')
const PREFIX = '/Test/talvennerne2/'
const PROD_PORT = 4321
const DEV_PORT = 4322
const ONLY = process.env.PLAYTHROUGH_ONLY ?? null

const VIEWPORTS = [
  { name: 'phone-se', width: 375, height: 667 },
  { name: 'phone', width: 393, height: 852 },
  { name: 'ipad', width: 820, height: 1180 },
].flatMap((v) => [v, { name: `${v.name}-land`, width: v.height, height: v.width }])

const V1_SAVE = JSON.stringify({ v: 1, note: 'V1 data that Talvennerne 2 must never touch', æøå: [1, 2, 3] })
const FOREIGN = 'z'

const results = []
const check = (ok, what) => {
  results.push({ ok, what })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json',
}

/** dist/ under /Test/talvennerne2/, like GitHub Pages (a directory serves its index.html). */
function serveDist() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (!url.pathname.startsWith(PREFIX)) {
      res.writeHead(404).end()
      return
    }
    let file = normalize(join(DIST, decodeURIComponent(url.pathname.slice(PREFIX.length))))
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(PROD_PORT, '127.0.0.1', () => resolve(server)))
}

async function production() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ is missing: run `npm run build` first')
  const server = await serveDist()
  const browser = await launch()
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true })
      // V1's save and a foreign key exist before the app ever runs
      await context.addInitScript(([save, foreign]) => {
        if (localStorage.getItem('talvennerne.save') === null) localStorage.setItem('talvennerne.save', save)
        if (localStorage.getItem('x:y') === null) localStorage.setItem('x:y', foreign)
      }, [V1_SAVE, FOREIGN])
      const page = await context.newPage()
      const errors = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      page.on('pageerror', (e) => errors.push(String(e)))
      const url = `http://127.0.0.1:${PROD_PORT}${PREFIX}?e2e=1&voice=fast`
      await page.goto(url, { waitUntil: 'networkidle' })
      const intro = await page.waitForSelector('.tv-intro [data-next]', { timeout: 30_000 }).then(() => true, () => false)
      check(intro, `${vp.name}: boots onto the grown-ups' intro`)
      if (intro) {
        await page.click('.tv-intro [data-next]')
        await page.waitForTimeout(800)
      }
      const shape = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        svg: document.querySelectorAll('svg *').length,
      }))
      check(shape.overflow <= 1, `${vp.name}: no horizontal scrolling (${shape.overflow} px)`)
      check(shape.svg <= 1500, `${vp.name}: ${shape.svg} SVG elements (≤ 1 500)`)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      const keys = await page.evaluate(() => ({
        v1: localStorage.getItem('talvennerne.save'),
        foreign: localStorage.getItem('x:y'),
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
      }))
      check(keys.v1 === V1_SAVE, `${vp.name}: talvennerne.save byte-identical`)
      check(keys.foreign === FOREIGN, `${vp.name}: x:y byte-identical`)
      const own = [...keys.local, ...keys.session].filter((k) => k !== 'talvennerne.save' && k !== 'x:y')
      check(own.every((k) => k.startsWith('talvennerne2.')), `${vp.name}: only talvennerne2. keys added (${own.join(', ') || 'none'})`)
      check(errors.length === 0, `${vp.name}: 0 console errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`)
      await context.close()
    }
  } finally {
    await browser.close()
    server.close()
  }
}

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function waitForServer(url, ms = 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return true
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function flows() {
  const vite = spawn('npx', ['vite', '--port', String(DEV_PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
  const base = `http://127.0.0.1:${DEV_PORT}/`
  try {
    check(await waitForServer(base), `dev server on ${DEV_PORT}`)
    const suites = [
      ['onboarding and profiles', 'src/ui/screens/child/onboarding/e2e.mjs', { BASE: base }],
      ['play loop: map, round, ceremonies, pause, reload', 'src/ui/screens/child/play/loop.e2e.mjs', { MAP_URL: base }],
      ['Stjernefjeldet: a stone per region, five trials and the finale', 'src/ui/screens/child/play/fjeld.e2e.mjs', { MAP_URL: base }],
      ['parent dashboard', 'src/parent/testing/e2e.mjs', { BASE: base }],
    ]
    for (const [name, file, env] of suites) {
      if (!existsSync(join(ROOT, file))) {
        check(false, `${name}: ${file} is missing`)
        continue
      }
      console.log(`\n── ${name} (${file})`)
      check((await run('node', [file], env)) === 0, name)
    }
  } finally {
    try {
      process.kill(-vite.pid)
    } catch {
      // already gone
    }
  }
}

if (ONLY !== 'flows') {
  console.log('── production build under /Test/talvennerne2/')
  await production()
}
if (ONLY !== 'prod') await flows()

const failed = results.filter((r) => !r.ok)
console.log(`\nplaythrough: ${results.length - failed.length}/${results.length} ok`)
process.exit(failed.length ? 1 : 0)
