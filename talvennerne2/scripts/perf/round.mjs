// Frame times on the task screen at 4× CPU throttle (SPEC §15.2: p95 ≤ 20 ms; QA2 P3-16), on the
// production build. A child is onboarded with the finger; WORLD=eng plays the first round straight
// after the onboarding, WORLD=bakke|skov onboards in 2nd grade, goes to that world on the map and
// plays its first open stone. Answers are random taps (both feedback paths: the celebration and the
// strategy), so a round runs long; MINUTES caps it. Writes artifacts/perf/round-<world>-<vp>.json.
//   npm run build && flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs
//   WORLD=skov VP=ipad DIST=<copy fetched from the live site> flock … node scripts/perf/round.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../browser.mjs'
import { onboard, serve, startFrames, stats, tapEl, toMap, wait } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const DIST = process.env.DIST ?? `${ROOT}dist`
const OUT = `${ROOT}artifacts/perf/`
mkdirSync(OUT, { recursive: true })
const PORT = Number(process.env.PORT ?? 4373)
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const IPAD = process.env.VP === 'ipad'
const VIEWPORT = IPAD ? { width: 1180, height: 820 } : { width: 393, height: 852 }
const WORLD = process.env.WORLD ?? 'eng'
const MINUTES = Number(process.env.MINUTES ?? 5)
const TAG = `${WORLD}-${IPAD ? 'ipad' : 'phone'}`

/** Whatever a finger can put into an answer; the fallback for kinds without their own branch. */
const TAPPABLE = '[data-option], [data-pair-option], [data-pile-item], [data-source], [data-pool-card], [data-tray-piece], [data-part], [data-plate], [data-take], [data-thing], [data-basket-item]'

async function drag(page, loc, dx, dy) {
  const b = await loc.boundingBox()
  if (!b) return false
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  const cdp = await page.context().newCDPSession(page)
  const pt = (px, py) => [{ x: px, y: py, id: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y) })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x + (dx * i) / 8, y + (dy * i) / 8) })
    await wait(25)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  return true
}

/** One answer with the finger, right or wrong. */
async function answer(page, kind) {
  const r = page.locator('.tv-round')
  const any = async (sel) => {
    const l = r.locator(sel)
    const n = await l.count()
    if (!n) return false
    return tapEl(page, l.nth(Math.floor(Math.random() * n)))
  }
  const check = async () => {
    const c = r.locator('[data-check]')
    if (!(await c.count())) return false
    return tapEl(page, c.first())
  }
  if (kind === 'choice' || kind === 'trueFalse') return any('[data-option]')
  if (kind === 'pair') return any('[data-pair-option]')
  if (kind === 'keypad') {
    await tapEl(page, r.locator(`[data-key="${1 + Math.floor(Math.random() * 9)}"]`))
    await wait(200)
    return check()
  }
  if (kind === 'countTap') {
    const n = await r.locator('[data-pile-item]').count()
    for (let i = 0, take = 1 + Math.floor(Math.random() * Math.max(1, n)); i < take; i++) {
      if (!(await r.locator('[data-pile-item]').count())) break
      await tapEl(page, r.locator('[data-pile-item]').first())
      await wait(180)
    }
    await wait(250)
    return check()
  }
  if (kind === 'numberline' || kind === 'clockSet') {
    const knob = r.locator('[data-knob]').first()
    if (await knob.count()) await drag(page, knob, 40 + Math.random() * 80, kind === 'clockSet' ? 60 : 0)
    else if (await r.locator('[data-line-pad], [data-place]').count()) await tapEl(page, r.locator('[data-line-pad], [data-place]').first())
    await wait(300)
    return check()
  }
  if (kind === 'fillSlots') {
    for (let i = 0; i < 8 && (await r.locator('.tv-slot.is-empty').count()) > 0; i++) {
      if (!(await any('.tv-fill__palette button:not([data-check]):not([disabled])'))) break
      await wait(220)
    }
    await wait(250)
    return check()
  }
  for (let i = 0; i < 3; i++) {
    if (!(await any(TAPPABLE))) break
    await wait(220)
  }
  for (let i = 0; i < 3; i++) {
    if (!(await any('[data-kind] button:not([data-check]):not([disabled])'))) break
    await wait(220)
  }
  await wait(250)
  if (await check()) return true
  return any(TAPPABLE)
}

const server = await serve(DIST, PORT)
const browser = await launch()
const result = { world: WORLD, viewport: VIEWPORT, throttle: THROTTLE }
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: !IPAD })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  const cdp = await context.newCDPSession(page)

  if (WORLD === 'eng') {
    await onboard(page, server.url, '0')
    result.stone = 'w0-tal10-l1'
  } else {
    await onboard(page, server.url, '2')
    await toMap(page)
    const world = page.locator(`.tv-world[data-world="${WORLD}"][data-open]`)
    await world.scrollIntoViewIfNeeded().catch(() => undefined)
    await tapEl(page, world)
    await page.waitForSelector(`.tv-map[data-world="${WORLD}"]`, { timeout: 15_000 })
    await wait(1500)
    const stone = page.locator('.tv-map__path [data-region][data-open] [data-stone]').first()
    result.stone = await stone.getAttribute('data-stone')
    await stone.scrollIntoViewIfNeeded()
    await wait(400)
    await tapEl(page, stone)
    await page.waitForSelector('[data-stone-sheet] [data-sheet-play]', { timeout: 15_000 })
    await wait(600)
    await tapEl(page, page.locator('[data-stone-sheet] [data-sheet-play]'))
    await page.waitForSelector('.tv-round', { timeout: 30_000 })
  }
  console.log(`tur: ${result.stone}`)

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await startFrames(page)
  const mark = (what) => page.evaluate((w) => window.__marks.push([performance.now(), w]), what)
  const kinds = {}
  let answers = 0
  let stuck = 0
  let endedAt = null
  const deadline = Date.now() + MINUTES * 60_000
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      if (document.querySelector('[data-ceremony]')) return { what: 'ceremony' }
      if (document.querySelector('[data-play-start]')) return { what: 'start' }
      if (document.querySelector('[data-demo-film]')) return { what: 'demo' }
      if (document.querySelector('[data-teaching] [data-confirm]')) return { what: 'confirm' }
      const r = document.querySelector('.tv-round[data-beat="asking"]')
      if (r) return { what: 'ask', kind: r.querySelector('[data-kind]')?.getAttribute('data-kind') ?? null }
      return { what: 'wait' }
    })
    if (s.what === 'ceremony') {
      endedAt = await page.evaluate(() => performance.now())
      break
    }
    if (s.what === 'wait') {
      await wait(120)
      continue
    }
    if (s.what === 'start') {
      await tapEl(page, page.locator('[data-play-start]'))
      await wait(300)
      continue
    }
    if (s.what === 'demo') {
      await wait(700)
      await page.touchscreen.tap(10, 300)
      await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15_000 }).catch(() => undefined)
      continue
    }
    if (s.what === 'confirm') {
      await wait(500)
      await mark('confirm')
      await tapEl(page, page.locator('[data-teaching] [data-confirm]'))
      await page.waitForSelector('[data-teaching]', { state: 'detached', timeout: 10_000 }).catch(() => undefined)
      continue
    }
    // the child reads the task, then answers
    await wait(900)
    const k = s.kind ?? '?'
    if (!kinds[k]) await page.screenshot({ path: `${OUT}round-${TAG}-${k}.png` })
    kinds[k] = (kinds[k] ?? 0) + 1
    await mark('answer')
    await answer(page, k)
    answers++
    const moved = await page
      .waitForFunction(() => {
        const x = document.querySelector('.tv-round')
        return !x || x.getAttribute('data-beat') !== 'asking' || document.querySelector('[data-ceremony]')
      }, null, { timeout: 6_000, polling: 50 })
      .then(() => true, () => false)
    if (!moved && ++stuck >= 6) {
      await page.screenshot({ path: `${OUT}round-${TAG}-stuck-${k}.png` })
      console.log(`går i stå på "${k}"; måler det spillede`)
      break
    }
  }
  const endT = endedAt ?? (await page.evaluate(() => performance.now()))
  // the end of the round, still throttled
  if (endedAt !== null) await wait(6000)
  const raw = await page.evaluate(() => ({ frames: window.__frames, long: window.__long, marks: window.__marks }))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const answerTimes = raw.marks.map(([t]) => t)
  const nearAnswer = (t) => answerTimes.some((a) => t >= a && t <= a + 2500)
  const round = raw.frames.filter(([t]) => t <= endT)
  Object.assign(result, {
    finished: endedAt !== null,
    answers,
    kinds,
    round: stats(round.map(([, d]) => d).slice(1)),
    roundCalm: stats(round.filter(([t]) => !answerTimes.some((a) => t >= a - 200 && t <= a + 2500)).map(([, d]) => d).slice(1)),
    roundAroundAnswers: stats(round.filter(([t]) => nearAnswer(t)).map(([, d]) => d)),
    ceremony: stats(raw.frames.filter(([t]) => t > endT).map(([, d]) => d)),
    longTasks: { n: raw.long.filter(([t]) => t <= endT).length, ...(stats(raw.long.filter(([t]) => t <= endT).map(([, d]) => d)) ?? {}) },
    svgElements: await page.evaluate(() => document.querySelectorAll('svg *').length),
    errors,
  })
  writeFileSync(`${OUT}round-${TAG}.json`, JSON.stringify({ ...result, raw }, null, 1))
  console.log(JSON.stringify(result, null, 1))
  await context.close()
} finally {
  await browser.close()
  server.close()
}
