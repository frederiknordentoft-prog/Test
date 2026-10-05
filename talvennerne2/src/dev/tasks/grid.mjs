// Plays the grid kind (SPEC A21: gridCoords' points) in the task harness with real touch input — CDP
// touch events: a point is tapped onto the net and dragged to its crossing, an axis number is tapped
// and another reached by a finger drawn along its strip — in three viewports, and shoots every state to
// artifacts/sk3geo/*.png. Dev only. Needs the dev server:
//   npx vite --port 4382 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/dev/tasks/grid.mjs [filter…]
// Per viewport: the point asked (set), a drag in mid-air, the right answer (green); the point read by
// touch (a tap, then a drag along the other strip); a wrong answer struck with the strategy and the
// confirm button; the point on an axis; both demo films; calm mode; and the mouse on the iPad. Fails
// on any console error, page error, small tap target, overflow or a wrong verdict.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.TASKS_URL ?? 'http://127.0.0.1:4382/tasks.html'
const OUT = fileURLToPath(new URL('../../../artifacts/sk3geo/', import.meta.url))
const filters = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  se: { width: 375, height: 667, safe: 'se', mobile: true },
  phone: { width: 393, height: 852, safe: 'x', mobile: true },
  ipad: { width: 1180, height: 820, safe: 'ipad', mobile: false },
}

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(ok, what) {
  results.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}

// ─── Touch (CDP) ────────────────────────────────────────────────────────────

async function touch(cdp, type, p) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] : [] })
}
async function drag(cdp, points, mid) {
  await touch(cdp, 'touchStart', points[0])
  for (const p of points.slice(1)) {
    await sleep(16)
    await touch(cdp, 'touchMove', p)
  }
  if (mid) await mid()
  await sleep(16)
  await touch(cdp, 'touchEnd', null)
  await sleep(80)
}
async function tap(cdp, p) {
  await touch(cdp, 'touchStart', p)
  await sleep(40)
  await touch(cdp, 'touchEnd', null)
  await sleep(120)
}
const line = (a, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }))

// ─── Where things are on the net (src/ui/task/grid/geometry.ts) ───────────

async function geom(page) {
  return page.evaluate(async () => {
    const g = await import('/src/ui/task/grid/geometry.ts')
    const root = document.querySelector('.tv-round__answer [data-kind="grid"]')
    const r = root.querySelector('.tv-grid__svg').getBoundingClientRect()
    const w = Number(root.dataset.w)
    const h = Number(root.dataset.h)
    return { left: r.left, top: r.top, k: r.width / g.frameOf(w, h).W, w, h, pad: g.PAD, cell: g.CELL, mode: root.dataset.gridMode }
  })
}
const at = (g, ux, uy) => ({ x: g.left + ux * g.k, y: g.top + uy * g.k })
const crossing = (g, x, y) => at(g, g.pad.l + x * g.cell, g.pad.t + (g.h - y) * g.cell)
const xNumber = (g, n) => at(g, g.pad.l + n * g.cell, g.pad.t + g.h * g.cell + 32)
const yNumber = (g, n) => at(g, g.pad.l - 32, g.pad.t + (g.h - n) * g.cell)

/** What a point in the page hits: the net, a strip, or something else. */
const hitAt = (page, p) => page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y)
  return el?.closest('[data-board]') ? 'board' : el?.closest('[data-axis]')?.getAttribute('data-axis') ?? el?.className?.toString() ?? null
}, p)

// ─── Harness state ──────────────────────────────────────────────────────────

const task = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__drive.currentTask())))
const answers = (page) => page.evaluate(() => window.__harness.answers.slice())
const beat = (page, name, timeout = 15000) => page.waitForSelector(`.tv-round[data-beat="${name}"]`, { timeout })
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` })
async function lastVerdict(page, before) {
  await page.waitForFunction((n) => window.__harness.answers.length > n, before, { timeout: 5000 }).catch(() => {})
  const a = await answers(page)
  return a.length > before ? a[a.length - 1] : null
}
async function smallTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.tv-round__answer button, .tv-round__answer [role="button"], .tv-round__answer [role="slider"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 59.5 || r.height < 59.5))
      .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.className}:${Math.round(r.width)}x${Math.round(r.height)}`),
  )
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)
/** The answer area's content stays inside its card (nothing hangs over the edge). */
const insideCard = (page) => page.evaluate(() => {
  const card = document.querySelector('.tv-round__answer').getBoundingClientRect()
  const kids = [...document.querySelectorAll('.tv-round__answer .tv-grid__figure, .tv-round__answer .tv-grid__foot')]
  return kids.every((k) => { const r = k.getBoundingClientRect(); return r.top >= card.top - 1 && r.bottom <= card.bottom + 1 && r.left >= card.left - 1 && r.right <= card.right + 1 })
})
async function tapCheck(page, cdp) {
  await page.waitForSelector('.tv-round__answer [data-check]:not([disabled])', { timeout: 4000 })
  const b = await page.evaluate(() => { const r = document.querySelector('.tv-round__answer [data-check]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await tap(cdp, b)
}
const pointShown = (page) => page.evaluate(() => document.querySelector('.tv-round__answer [data-point]')?.getAttribute('data-point') ?? null)
const picked = (page) => page.evaluate(() => [...document.querySelectorAll('.tv-round__answer [data-axis]')].map((el) => el.getAttribute('aria-valuenow')))

// ─── Answering with the finger ──────────────────────────────────────────────

/** Sets a point: a tap a little off another crossing, then a drag to the crossing asked (shot mid-drag). */
async function placePoint(page, cdp, target, tag) {
  const g = await geom(page)
  const start = { x: target.x > 1 ? 1 : 5, y: target.y > 1 ? 1 : 5 }
  const a = crossing(g, start.x, start.y)
  check((await hitAt(page, a)) === 'board', `${tag}: nettet tager trykket`)
  await tap(cdp, { x: a.x + 6 * g.k, y: a.y - 5 * g.k })
  check((await pointShown(page)) === `${start.x},${start.y}`, `${tag}: et tryk sætter punktet på nærmeste kryds (${await pointShown(page)})`)
  const b = crossing(g, target.x, target.y)
  await drag(cdp, line(a, { x: b.x + 4 * g.k, y: b.y + 7 * g.k }, 14), tag ? () => shot(page, `drag-place-${tag}`) : null)
  check((await pointShown(page)) === `${target.x},${target.y}`, `${tag}: trækket flytter punktet til ${target.x},${target.y}`)
}

/** Reads a point: the x number tapped, the y number reached by a drag along its strip (shot mid-drag). */
async function readPoint(page, cdp, target, tag) {
  const g = await geom(page)
  const xs = xNumber(g, target.x)
  check((await hitAt(page, xs)) === 'x', `${tag}: tallene forneden tager trykket`)
  await tap(cdp, { x: xs.x - 5 * g.k, y: xs.y + 4 * g.k })
  const from = yNumber(g, target.y > 2 ? 0 : g.h)
  check((await hitAt(page, from)) === 'y', `${tag}: tallene til venstre tager trykket`)
  await drag(cdp, line(from, yNumber(g, target.y), 12), tag ? () => shot(page, `drag-read-${tag}`) : null)
  const [x, y] = await picked(page)
  check(x === String(target.x) && y === String(target.y), `${tag}: valgt ${x}, ${y}`)
}

// ─── One viewport ───────────────────────────────────────────────────────────

async function play(browser, vpName) {
  const vp = VIEWPORTS[vpName]
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: vp.mobile })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
  const url = (ex, extra = {}) => `${BASE}?${new URLSearchParams({ view: 'kind', ex, shot: '1', e2e: '1', voice: 'fast', safe: vp.safe, demo: '0', ...extra })}`
  try {
    await page.goto(url('grid-place'), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    let index = 0
    for (let guard = 0; guard < 10; guard++) {
      const state = await page.waitForFunction(() => {
        if (document.querySelector('[data-exit]')) return 'exit'
        return document.querySelector('.tv-round[data-beat="asking"]') ? 'ask' : null
      }, null, { timeout: 20000, polling: 50 })
      if ((await state.jsonValue()) === 'exit') break
      const t = await task(page)
      await page.waitForSelector('.tv-round__answer [data-kind="grid"]', { timeout: 8000 })
      // past the entrance and the round's fitting check (650 ms): the net stands still from here
      await sleep(900)
      const tag = `${t.factId.replace(/[:,]/g, '-')}-${vpName}`
      const small = await smallTargets(page)
      check(small.length === 0, `${tag}: trykmål ≥ 60 px${small.length ? ` (${small.join(', ')})` : ''}`)
      check(await noOverflow(page), `${tag}: intet overløb`)
      check(await insideCard(page), `${tag}: nettet og parret står inde i svarfeltet`)
      if (!t.retryOf) await shot(page, `ask-${tag}`)
      // the third task (a new key, with the walk) is answered wrong: the numbers swapped
      const wrong = t.factId === 'crd:p:5,4' && !t.retryOf
      const [, mode, xy] = t.factId.split(':')
      const [x, y] = xy.split(',').map(Number)
      const target = wrong ? { x: y, y: x } : { x, y }
      const before = (await answers(page)).length
      if (mode === 'p') await placePoint(page, cdp, target, t.retryOf ? null : tag)
      else await readPoint(page, cdp, target, t.retryOf ? null : tag)
      if (mode === 'p') {
        const walk = await page.evaluate(() => !!document.querySelector('.tv-round__answer .tv-grid__walk'))
        check(walk === !!t.scaffold, `${tag}: vejen hen og op vises ${t.scaffold ? 'på en ny nøgle' : 'ikke uden støtte'}`)
      }
      if (!t.retryOf) await shot(page, `built-${tag}`)
      await tapCheck(page, cdp)
      const verdict = await lastVerdict(page, before)
      check(verdict && verdict.correct === !wrong, `${tag}: ${JSON.stringify(verdict?.given)} er ${wrong ? 'forkert' : 'rigtigt'}`)
      await sleep(300)
      if (!t.retryOf) await shot(page, `${wrong ? 'wrong' : 'correct'}-${tag}`)
      if (wrong) {
        await beat(page, 'teaching')
        await sleep(1500)
        await shot(page, `teach-${tag}`)
        check(await noOverflow(page), `${tag}: fejlflowet uden overløb`)
        const c = await page.evaluate(() => { const r = document.querySelector('[data-confirm]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
        await tap(cdp, c)
      }
      index++
    }
    check(index >= 4, `${vpName}: alle fire eksempler (og gensvaret) blev spillet (${index})`)

    // the demo films: setting a point, and reading one
    for (const [ex, name] of [['grid-place', 'place'], ['grid-read', 'read']]) {
      await page.goto(url(ex, { demo: '1' }), { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-demo-film]', { timeout: 15000 })
      await sleep(name === 'place' ? 1500 : 2000)
      await shot(page, `demo-${name}-${vpName}`)
      await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 })
      check(true, `${vpName}: demofilmen (${name}) kørte til ende`)
    }

    // calm mode: nothing loops in the answer area
    await page.goto(url('grid-read', { calm: '1' }), { waitUntil: 'networkidle' })
    await beat(page, 'asking')
    await page.waitForSelector('.tv-round__answer [data-kind="grid"]', { timeout: 8000 })
    await sleep(600)
    const loops = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === 'running' && a.effect?.target?.closest?.('.tv-round__answer')).length,
    )
    check(loops === 0, `${vpName}: rolig tilstand uden løkker i svarfeltet (${loops})`)
    await shot(page, `calm-${vpName}`)

    // the mouse (a pointer that is not a finger) sets and drags a point too
    if (vpName === 'ipad') {
      await page.goto(url('grid-place'), { waitUntil: 'networkidle' })
      await beat(page, 'asking')
      await page.waitForSelector('.tv-round__answer [data-kind="grid"]', { timeout: 8000 })
      await sleep(400)
      const g = await geom(page)
      const a = crossing(g, 5, 5)
      const b = crossing(g, 3, 2)
      await page.mouse.click(a.x, a.y)
      check((await pointShown(page)) === '5,5', `${vpName}: musen sætter punktet`)
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      for (const p of line(a, b, 10)) await page.mouse.move(p.x, p.y)
      await page.mouse.up()
      check((await pointShown(page)) === '3,2', `${vpName}: musen trækker punktet til 3,2`)
      await shot(page, `mouse-${vpName}`)
    }
  } catch (err) {
    check(false, `${vpName}: ${String(err).split('\n')[0]}`)
    await shot(page, `error-${vpName}`).catch(() => {})
  }
  check(errors.length === 0, `${vpName}: ingen konsolfejl${errors.length ? ` (${errors.join(' | ').slice(0, 500)})` : ''}`)
  await ctx.close()
}

const browser = await launch()
try {
  for (const vpName of Object.keys(VIEWPORTS)) {
    if (filters.length && !filters.some((f) => vpName.includes(f))) continue
    await play(browser, vpName)
  }
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} ok`)
if (failed.length) process.exitCode = 1
