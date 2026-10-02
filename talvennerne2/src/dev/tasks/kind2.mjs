// Plays the wave-2 kinds (clockSet, pay, share, colorParts) in the task harness with real touch
// input (CDP touch events: drags turn the clock hands, carry coins, deal things and paint parts) in
// three viewports, and shoots every state to artifacts/kind2/*.png. Dev only. Needs the dev server:
//   npx vite --port 4325 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/dev/tasks/kind2.mjs [filter…]
// Per kind and viewport: the task asked, a drag in mid-air, the right answer (green), a wrong answer
// struck with the strategy and the confirm button, the rest of the kind's examples, the demo film,
// calm mode. Fails on any console error, page error, small tap target or a wrong verdict.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.TASKS_URL ?? 'http://127.0.0.1:4325/tasks.html'
const OUT = fileURLToPath(new URL('../../../artifacts/kind2/', import.meta.url))
const filters = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  phone: { width: 393, height: 852, safe: 'x' },
  ipad: { width: 820, height: 1180, safe: 'ipad' },
  side: { width: 852, height: 393, safe: 'x' },
}
const KINDS = {
  clockSet: { first: 'clock-half', wrongAt: 1 },
  pay: { first: 'pay-17', wrongAt: 1 },
  share: { first: 'share-12-3', wrongAt: 1 },
  colorParts: { first: 'parts-3/4', wrongAt: 1 },
}

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(ok, what) {
  results.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}

// ─── Touch ──────────────────────────────────────────────────────────────────

async function touch(cdp, type, p) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] : [] })
}

/** A finger down at the first point, through the others, up at the last (`mid` runs before lifting). */
async function drag(cdp, points, mid) {
  await touch(cdp, 'touchStart', points[0])
  for (const p of points.slice(1)) {
    await sleep(16)
    await touch(cdp, 'touchMove', p)
  }
  if (mid) await mid()
  await sleep(16)
  await touch(cdp, 'touchEnd', null)
  await sleep(60)
}

async function tap(cdp, p) {
  await touch(cdp, 'touchStart', p)
  await sleep(40)
  await touch(cdp, 'touchEnd', null)
  await sleep(90)
}

const line = (a, b, n = 10) => Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }))

/** Centre of the first visible match (and that nothing covers it there). */
async function centre(page, selector) {
  const r = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect()
      return b.width > 0 && b.height > 0
    })
    if (!el) return null
    const b = el.getBoundingClientRect()
    const x = b.left + b.width / 2
    const y = b.top + b.height / 2
    const hit = document.elementFromPoint(x, y)
    return { x, y, covered: !(hit && (hit === el || el.contains(hit) || hit.contains(el))) }
  }, selector)
  if (!r) throw new Error(`${selector} findes ikke`)
  if (r.covered) throw new Error(`${selector} er dækket`)
  return r
}

// ─── Harness state ──────────────────────────────────────────────────────────

const task = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__drive.currentTask())))
const answers = (page) => page.evaluate(() => window.__harness.answers.slice())
const beat = (page, name, timeout = 15000) => page.waitForSelector(`.tv-round[data-beat="${name}"]`, { timeout })
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` })

async function lastVerdict(page) {
  await page.waitForFunction((n) => window.__harness.answers.length >= n, (await answers(page)).length, { timeout: 4000 }).catch(() => {})
  const a = await answers(page)
  return a[a.length - 1]
}

/** Buttons, sliders and role=button parts under 60 × 60 px inside the answer area. */
async function smallTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.tv-round__answer button, .tv-round__answer [role="button"], .tv-round__answer [role="slider"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 59.5 || r.height < 59.5))
      .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.className.baseVal ?? el.className}:${Math.round(r.width)}x${Math.round(r.height)}`),
  )
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)
}

// ─── Per kind: answering with the finger ────────────────────────────────────

/** Clock geometry in the page: a point at `angle`° (clockwise from 12), r clock units from the centre. */
async function clockGeom(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.tv-round__answer .tv-clockset__clock')
    const b = svg.getBoundingClientRect()
    return { left: b.left, top: b.top, k: b.width / 200, minutes: Number(document.querySelector('.tv-clockset__dial').dataset.minutes) }
  })
}
const at = (g, angle, r) => {
  const a = (angle * Math.PI) / 180
  return { x: g.left + (100 + r * Math.sin(a)) * g.k, y: g.top + (100 - r * Math.cos(a)) * g.k }
}
const arc = (g, from, to, r) => {
  const n = Math.max(2, Math.ceil(Math.abs(to - from) / 10))
  return Array.from({ length: n + 1 }, (_, i) => at(g, from + ((to - from) * i) / n, r))
}

const mod = (v, m) => ((v % m) + m) % m

/** Turns the minute hand clockwise to the minutes, then drags the hour hand to the hour. */
async function setClock(page, cdp, value, midShot) {
  const target = mod(value, 720)
  const m = target % 60
  const h = Math.floor(target / 60)
  let g = await clockGeom(page)
  const m0 = g.minutes % 60
  // the minute hand clockwise from where it is to the minutes (a whole turn would move the hour)
  const from = m0 * 6
  let to = m * 6
  if (to < from) to += 360
  if (to !== from) await drag(cdp, arc(g, from, to, 66), midShot)
  g = await clockGeom(page)
  const hourNow = mod(g.minutes, 720) * 0.5
  const hourTo = h * 30 + m * 0.5
  let d = mod(hourTo - hourNow, 360)
  if (d > 180) d -= 360
  if (Math.abs(d) > 0.1) await drag(cdp, arc(g, hourNow, hourNow + d, 36))
  g = await clockGeom(page)
  return g.minutes
}

const ANSWER = {
  async clockSet(page, cdp, t, value, vp) {
    const shown = await setClock(page, cdp, value, vp ? () => shot(page, `drag-clockSet-${vp}`) : null)
    check(mod(shown, 720) === mod(value, 720), `uret viser ${mod(value, 720)} (${shown})`)
  },
  async pay(page, cdp, t, value, vp) {
    const purse = await page.evaluate(() => [...document.querySelectorAll('[data-source]')].map((el) => Number(el.dataset.source)))
    const pieces = typeof value === 'string' ? value.split('|').map((s) => Number(s.slice(1))) : fewest(value, purse)
    if (vp) {
      // one coin by drag (shot in mid-air), one laid and taken back, the rest by taps
      const src = await centre(page, `[data-source="${pieces[0]}"]`)
      const tray = await centre(page, '[data-tray]')
      await drag(cdp, line(src, tray, 12), () => shot(page, `drag-pay-${vp}`))
      const extra = purse.find((p) => p !== pieces[0]) ?? purse[0]
      await tap(cdp, await centre(page, `[data-source="${extra}"]`))
      await tap(cdp, await centre(page, `[data-take="${extra}"]`))
      for (const p of pieces.slice(1)) await tap(cdp, await centre(page, `[data-source="${p}"]`))
    } else {
      for (const p of pieces) await tap(cdp, await centre(page, `[data-source="${p}"]`))
    }
  },
  async share(page, cdp, t, value, vp) {
    const plates = await page.evaluate(() => document.querySelectorAll('[data-plate]').length)
    const n = await page.evaluate(() => document.querySelectorAll('[data-pile] [data-thing]').length)
    let start = 0
    if (vp && value >= 0) {
      // the first thing dragged from the pile to plate 0 (shot in mid-air), dragged back, given again
      const thing = await centre(page, '[data-pile] [data-thing]')
      const plate = await centre(page, '[data-plate="0"]')
      await drag(cdp, line(thing, plate, 12), () => shot(page, `drag-share-${vp}`))
      const onPlate = await centre(page, '[data-plate="0"] [data-plate-item]')
      const pile = await centre(page, '[data-pile]')
      await drag(cdp, line(onPlate, pile, 10))
      await tap(cdp, await centre(page, '[data-plate="0"]'))
      start = 1
    }
    for (let i = start; i < n; i++) {
      const p = value < 0 ? 0 : i % plates
      await tap(cdp, await centre(page, `[data-plate="${p}"]`))
    }
  },
  async colorParts(page, cdp, t, value, vp) {
    const parts = await page.evaluate(() => Number(document.querySelector('[data-parts]').getAttribute('data-parts')))
    const f = /^frac:(\d+)\/(\d+)$/.exec(String(value))
    const k = f ? Math.round((Number(f[1]) / Number(f[2])) * parts) : 0
    const partPoint = (i) => centre(page, `path[data-part="${i}"]`)
    if (vp && k >= 2) {
      // a finger drawn across the first two parts colours both; a part tapped twice stays white
      const a = await partPoint(0)
      const b = await partPoint(1)
      await drag(cdp, line(a, b, 10), () => shot(page, `drag-colorParts-${vp}`))
      const last = await partPoint(parts - 1)
      await tap(cdp, last)
      await tap(cdp, last)
      for (let i = 2; i < k; i++) await tap(cdp, await partPoint(i))
    } else {
      for (let i = 0; i < k; i++) await tap(cdp, await partPoint(i))
    }
  },
}

/** Fewest pieces from a purse (exact). */
function fewest(ore, purse) {
  const kinds = [...new Set(purse)].sort((a, b) => b - a)
  const n = ore / 50
  const best = new Array(n + 1).fill(Infinity)
  const last = new Array(n + 1).fill(0)
  best[0] = 0
  for (let i = 1; i <= n; i++) for (const v of kinds) if (v / 50 <= i && best[i - v / 50] + 1 < best[i]) {
    best[i] = best[i - v / 50] + 1
    last[i] = v
  }
  const out = []
  for (let i = n; i > 0; i -= last[i] / 50) out.push(last[i])
  return out
}

async function tapCheck(page, cdp) {
  await page.waitForSelector('.tv-round__answer [data-check]:not([disabled])', { timeout: 4000 })
  await tap(cdp, await centre(page, '.tv-round__answer [data-check]'))
}

// ─── One kind in one viewport ───────────────────────────────────────────────

async function playKind(browser, kind, vpName) {
  const vp = VIEWPORTS[vpName]
  const conf = KINDS[kind]
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: vpName !== 'ipad' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`))
  const q = (extra) => new URLSearchParams({ view: 'kind', ex: conf.first, shot: '1', e2e: '1', voice: 'fast', safe: vp.safe, ...extra })
  const tag = `${kind}-${vpName}`
  try {
    await page.goto(`${BASE}?${q({ demo: '0' })}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    let index = 0
    for (let guard = 0; guard < 12; guard++) {
      const state = await page.waitForFunction(() => {
        if (document.querySelector('[data-exit]')) return 'exit'
        return document.querySelector('.tv-round[data-beat="asking"]') ? 'ask' : null
      }, null, { timeout: 20000, polling: 50 })
      if ((await state.jsonValue()) === 'exit') break
      const t = await task(page)
      await page.waitForSelector(`.tv-round__answer [data-kind="${kind}"]`, { timeout: 8000 })
      await sleep(350)
      const first = index === 0
      if (first) {
        await shot(page, `ask-${tag}`)
        const small = await smallTargets(page)
        check(small.length === 0, `${tag}: trykmål ≥ 60 px${small.length ? ` (${small.join(', ')})` : ''}`)
        check(await noOverflow(page), `${tag}: intet overløb`)
      }
      const wrong = index === conf.wrongAt && !t.retryOf
      const value = wrong ? await page.evaluate((x) => window.__drive.wrongFor(x), t) : t.answer
      if (first || wrong) {
        await ANSWER[kind](page, cdp, t, value, first ? vpName : null)
        if (first) await shot(page, `built-${tag}`)
        await tapCheck(page, cdp)
      } else {
        await page.evaluate((v) => window.__drive.answer(v), value)
      }
      const verdict = await lastVerdict(page)
      check(verdict && verdict.correct === !wrong, `${tag}: ${t.factId} ${JSON.stringify(verdict?.given)} er ${wrong ? 'forkert' : 'rigtigt'}`)
      if (first) {
        await sleep(250)
        await shot(page, `correct-${tag}`)
      }
      if (wrong) {
        await sleep(300)
        await shot(page, `wrong-${tag}`)
        await beat(page, 'teaching')
        await sleep(1500)
        await shot(page, `teach-${tag}`)
        check(await noOverflow(page), `${tag}: fejlflowet uden overløb`)
        await tap(cdp, await centre(page, '[data-confirm]'))
      }
      index++
    }
    // the demo film, then calm mode
    await page.goto(`${BASE}?${q({ demo: '1' })}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-demo-film]', { timeout: 15000 })
    await sleep(2400)
    await shot(page, `demo-${tag}`)
    await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 })
    check(true, `${tag}: demofilmen kørte til ende`)
    await page.goto(`${BASE}?${q({ demo: '0', calm: '1' })}`, { waitUntil: 'networkidle' })
    await beat(page, 'asking')
    await page.waitForSelector(`.tv-round__answer [data-kind="${kind}"]`, { timeout: 8000 })
    await sleep(600)
    const loops = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === 'running' && a.effect?.target?.closest?.('.tv-round__answer')).length,
    )
    check(loops === 0, `${tag}: rolig tilstand uden løkker i svarfeltet (${loops})`)
    await shot(page, `calm-${tag}`)
  } catch (err) {
    check(false, `${tag}: ${String(err).split('\n')[0]}`)
    await shot(page, `error-${tag}`).catch(() => {})
  }
  check(errors.length === 0, `${tag}: ingen konsolfejl${errors.length ? ` (${errors.join(' | ').slice(0, 500)})` : ''}`)
  await ctx.close()
}

const browser = await launch()
try {
  for (const kind of Object.keys(KINDS)) {
    for (const vpName of Object.keys(VIEWPORTS)) {
      if (filters.length && !filters.some((f) => `${kind}-${vpName}`.includes(f))) continue
      await playKind(browser, kind, vpName)
    }
  }
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} ok`)
if (failed.length) process.exitCode = 1
