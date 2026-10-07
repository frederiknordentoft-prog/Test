// Frame times on the task screen at 4× CPU throttle (SPEC §15.2: p95 ≤ 20 ms; QA2 P3-16), on the
// production build. A child is onboarded with the finger; WORLD=eng plays the first round straight
// after the onboarding, WORLD=bakke|skov onboards in 2nd grade, goes to that world on the map and
// plays its first open stone, and WORLD=fjeld (once it is released) onboards in 3rd grade, skips the
// placement ladder and plays the first round, which starts on Stjernefjeldet's next stone. Answers are random taps (both feedback paths: the celebration and the
// strategy), seeded by SEED, so a round runs long; MINUTES caps it. RUNS plays that many rounds,
// each from a fresh device, and sums them up together. PROFILE=heavy first puts a long-time player
// (scripts/perf/heavy.ts → artifacts/perf/heavy.json, or HEAVY=<file>) into the child's own export
// and brings it back with "Erstat …s data", then plays WORLD's first stone. DIST_B=<another build>
// plays it turn about with DIST (A, B, A, B …) and sums each up on its own: the machine's speed
// drifts over minutes, so two builds are only comparable side by side. A fixed piece of work timed in
// the page before and after each round (`bench`) shows how fast the machine was.
//
// Each answer is split into its phases by the round's beats (asking → correct, asking → wrong,
// wrong → teaching, correct → the next task, teaching → the next task). Per phase: how many
// transitions had a long task overlapping [t − 100, t + 400] ms, the median and longest of those
// long tasks, the median of the worst frame in [t − 100, t + 600] ms, and the scripts of the long
// animation frames (LoAF) in that window, by invoker. ASSERT=1 exits with 1 when a requirement of the
// performance round (docs/perf.md) fails, or when the run is not valid: the frames away from the
// answers must have p95 ≤ 16.8 ms and ≤ 0.2 % over 20 ms, else the machine was busy.
// Writes artifacts/perf/round-<world>-<vp>[-heavy][-t<throttle>].json.
//   npm run build && flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs
//   WORLD=skov VP=ipad DIST=<copy fetched from the live site> flock … node scripts/perf/round.mjs
//   RUNS=2 ASSERT=1 flock … node scripts/perf/round.mjs
//   PROFILE=heavy flock … node scripts/perf/round.mjs
//   DIST_B=<the build before> RUNS=2 flock … node scripts/perf/round.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../browser.mjs'
import { onboard, replaceChild, serve, startFrames, stats, tapEl, toMap, wait } from './lib.mjs'

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
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1))
const SEED = Number(process.env.SEED ?? 1)
const ASSERT = process.env.ASSERT === '1'
const HEAVY = process.env.PROFILE === 'heavy' ? (process.env.HEAVY ?? `${OUT}heavy.json`) : null
const TAG = `${WORLD}-${IPAD ? 'ipad' : 'phone'}${HEAVY ? `-${HEAVY.includes('heavy-') ? HEAVY.match(/heavy-\w+/)[0] : 'heavy'}` : ''}${THROTTLE !== 4 ? `-t${THROTTLE}` : ''}`
if (HEAVY && !existsSync(HEAVY)) {
  console.error(`${HEAVY} mangler: node scripts/voice/run-vite.mjs scripts/perf/heavy.ts`)
  process.exit(2)
}

/** The performance round's requirements (docs/perf.md). */
const LIMITS = { longShare: 25, worstFrame: 33.4, longMax: 70, p95: 16.8, over20: 0.5, calmP95: 16.8, calmOver20: 0.2, calmTap: 33.4, idbMs: 10, svg: 1500 }

/** Tap randomness, seeded (mulberry32). */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let random = rng(SEED)

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
    return tapEl(page, l.nth(Math.floor(random() * n)))
  }
  const check = async () => {
    const c = r.locator('[data-check]')
    if (!(await c.count())) return false
    return tapEl(page, c.first())
  }
  if (kind === 'choice' || kind === 'trueFalse') return any('[data-option]')
  if (kind === 'pair') return any('[data-pair-option]')
  if (kind === 'keypad') {
    await tapEl(page, r.locator(`[data-key="${1 + Math.floor(random() * 9)}"]`))
    await wait(200)
    return check()
  }
  if (kind === 'countTap') {
    const n = await r.locator('[data-pile-item]').count()
    for (let i = 0, take = 1 + Math.floor(random() * Math.max(1, n)); i < take; i++) {
      if (!(await r.locator('[data-pile-item]').count())) break
      await tapEl(page, r.locator('[data-pile-item]').first())
      await wait(180)
    }
    await wait(250)
    return check()
  }
  if (kind === 'numberline' || kind === 'clockSet') {
    const knob = r.locator('[data-knob]').first()
    if (await knob.count()) await drag(page, knob, 40 + random() * 80, kind === 'clockSet' ? 60 : 0)
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

// ─── Phases ─────────────────────────────────────────────────────────────────

const PHASES = ['asking→correct', 'asking→wrong', 'wrong→teaching', 'correct→next', 'teaching→next']
const ASKING = new Set(['intro', 'asking'])
const NEXT = new Set(['intro', 'demo', 'asking'])

function phaseOf(from, to) {
  if (ASKING.has(from) && to === 'correct') return 'asking→correct'
  if (ASKING.has(from) && to === 'wrong') return 'asking→wrong'
  if (from === 'wrong' && to === 'teaching') return 'wrong→teaching'
  if (from === 'correct' && NEXT.has(to)) return 'correct→next'
  if (from === 'teaching' && NEXT.has(to)) return 'teaching→next'
  return null
}

const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return +s[Math.floor((s.length - 1) / 2)].toFixed(1)
}
const overlaps = (t0, d, a, b) => t0 < b && t0 + d > a
const IDB = /IDB|indexedDB/i

/** Every transition of a run with what happened around it. */
function transitions(raw, endT) {
  const out = []
  for (const [t, from, to] of raw.beats) {
    if (t > endT) continue
    const phase = phaseOf(from, to)
    if (!phase) continue
    const longs = raw.long.filter(([s, d]) => overlaps(s, d, t - 100, t + 400)).map(([, d]) => d)
    const frames = raw.frames.filter(([ft]) => ft >= t - 100 && ft <= t + 600).map(([, d]) => d)
    const scripts = raw.loaf.filter((f) => overlaps(f.t, f.d, t - 100, t + 400)).flatMap((f) => f.scripts)
    // the tap's click (Event Timing) just before the beat it committed: handler time and time to paint
    const click = (raw.events ?? []).filter(([s, name]) => name === 'click' && s <= t && s >= t - 400).at(-1)
    out.push({ t, phase, long: longs.length ? Math.max(...longs) : null, worst: frames.length ? Math.max(...frames) : null, scripts, click: click ? { ms: click[2], paint: click[3] } : null })
  }
  return out
}

/** Per phase: share with a long task, the long tasks, the worst frames and the biggest LoAF invokers. */
function phaseTable(list) {
  const table = {}
  for (const phase of PHASES) {
    const xs = list.filter((x) => x.phase === phase)
    const longs = xs.filter((x) => x.long !== null).map((x) => x.long)
    const by = new Map()
    for (const sc of xs.flatMap((x) => x.scripts)) {
      const key = sc.invoker || sc.type
      const e = by.get(key) ?? { invoker: key, n: 0, ms: 0, max: 0, forced: 0 }
      e.n++
      e.ms += sc.d
      e.max = Math.max(e.max, sc.d)
      e.forced += sc.forced ?? 0
      by.set(key, e)
    }
    table[phase] = {
      n: xs.length,
      withLong: longs.length,
      longShare: xs.length ? +((100 * longs.length) / xs.length).toFixed(0) : 0,
      longMedian: median(longs),
      longMax: longs.length ? +Math.max(...longs).toFixed(0) : null,
      worstFrameMedian: median(xs.map((x) => x.worst).filter((w) => w !== null)),
      // the tap itself (answer and confirm taps): handler time with React's render, and time to the next paint
      clicks: xs.filter((x) => x.click).length,
      clickMedian: median(xs.filter((x) => x.click).map((x) => x.click.ms)),
      clickToPaintMedian: median(xs.filter((x) => x.click).map((x) => x.click.paint)),
      invokers: [...by.values()]
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 5)
        .map((e) => ({ ...e, ms: +e.ms.toFixed(0), max: +e.max.toFixed(0), forced: +e.forced.toFixed(0), perTransition: +(e.ms / xs.length).toFixed(1) })),
    }
  }
  return table
}

// ─── One round ──────────────────────────────────────────────────────────────

/**
 * A fixed piece of work timed in the page (median of 5), before and after the round: how busy the
 * machine was. The frames away from the answers stay at 16.7 ms on a busy machine (the page does
 * nothing then), but every task of an answer gets longer.
 */
const bench = (page) =>
  page.evaluate(() => {
    const times = []
    let x = 0
    for (let r = 0; r < 5; r++) {
      const t0 = performance.now()
      for (let i = 0; i < 300_000; i++) x += Math.sqrt(i * 1.0001) % 7
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    return x < 0 ? -1 : +times[2].toFixed(1)
  })

const heavy = HEAVY ? JSON.parse(readFileSync(HEAVY, 'utf8')) : null

/** A long-time player in the child's own export: the child keeps its id, name and buddy, now dressed. */
function mergeHeavy(file) {
  const doc = file.profiles[0].doc
  const buddy = doc.animals.find((a) => a.uid === doc.buddyUid) ?? doc.animals[0]
  const dressed = heavy.animals.find((a) => a.species === buddy.species && Object.keys(a.outfit).length >= 3) ?? heavy.animals.find((a) => Object.keys(a.outfit).length >= 3)
  const own = { ...buddy, outfit: dressed ? dressed.outfit : buddy.outfit, stage: 3, shown: 3 }
  Object.assign(doc, heavy, { animals: [own, ...heavy.animals], buddyUid: own.uid, round: null })
  file.profiles[0].daily = []
  file.profiles[0].answers = []
}

async function playRound(browser, url, run) {
  random = rng(SEED + run)
  const result = { run, seed: SEED + run }
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: !IPAD, acceptDownloads: !!heavy })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  const cdp = await context.newCDPSession(page)

  if (WORLD === 'eng' && !heavy) {
    await onboard(page, url, '0')
    result.stone = 'w0-tal10-l1'
  } else if (WORLD === 'fjeld' && !heavy) {
    await onboard(page, url, '3')
    result.stone = 'fjeld: den næste sten efter "Spring over"'
  } else {
    await onboard(page, url, '2')
    await toMap(page)
    if (heavy) {
      result.docBytes = await replaceChild(page, `${OUT}round-${TAG}-export`, mergeHeavy)
      await page.waitForSelector('.tv-map', { timeout: 20_000 })
    }
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
  console.log(`kørsel ${run + 1}/${RUNS}: ${result.stone}${result.docBytes ? ` (dokumentet er ${(result.docBytes / 1024).toFixed(0)} KB)` : ''}`)

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const benchStart = await bench(page)
  await startFrames(page)
  const mark = (what) => page.evaluate((w) => window.__marks.push([performance.now(), w]), what)
  const kinds = {}
  let answers = 0
  let stuck = 0
  let endedAt = null
  let svg = 0
  const deadline = Date.now() + MINUTES * 60_000
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      if (document.querySelector('[data-ceremony]')) return { what: 'ceremony' }
      if (document.querySelector('[data-play-start]')) return { what: 'start' }
      if (document.querySelector('[data-demo-film]')) return { what: 'demo' }
      if (document.querySelector('[data-teaching] [data-confirm]')) return { what: 'confirm' }
      const r = document.querySelector('.tv-round[data-beat="asking"]')
      if (r) return { what: 'ask', kind: r.querySelector('[data-kind]')?.getAttribute('data-kind') ?? null, svg: document.querySelectorAll('svg *').length }
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
    svg = Math.max(svg, s.svg ?? 0)
    await wait(900)
    const k = s.kind ?? '?'
    if (!kinds[k] && run === 0) await page.screenshot({ path: `${OUT}round-${TAG}-${k}.png` })
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
  const raw = await page.evaluate(() => ({ frames: window.__frames, long: window.__long, marks: window.__marks, loaf: window.__loaf, beats: window.__beats, events: window.__events }))
  const benchEnd = await bench(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const list = transitions(raw, endT)
  // taps: the answers and the confirm button, as their beats committed them
  const taps = list.filter((x) => x.phase === 'asking→correct' || x.phase === 'asking→wrong' || x.phase === 'teaching→next').map((x) => x.t)
  const near = (t, a, b) => taps.some((x) => t >= x + a && t <= x + b) || raw.marks.some(([m]) => t >= m + a && t <= m + b)
  const round = raw.frames.filter(([t]) => t <= endT)
  const idb = raw.loaf
    .flatMap((f) => f.scripts)
    .filter((sc) => IDB.test(sc.invoker ?? '') && sc.d >= LIMITS.idbMs && taps.some((x) => sc.t >= x - 100 && sc.t <= x + 300))
    .map((sc) => ({ invoker: sc.invoker, ms: +sc.d.toFixed(0) }))
  Object.assign(result, {
    bench: [benchStart, benchEnd],
    finished: endedAt !== null,
    answers,
    kinds,
    round: stats(round.map(([, d]) => d).slice(1)),
    roundCalm: stats(round.filter(([t]) => !near(t, -200, 2500)).map(([, d]) => d).slice(1)),
    roundAroundAnswers: stats(round.filter(([t]) => near(t, 0, 2500)).map(([, d]) => d)),
    ceremony: stats(raw.frames.filter(([t]) => t > endT).map(([, d]) => d)),
    longTasks: { n: raw.long.filter(([t]) => t <= endT).length, ...(stats(raw.long.filter(([t]) => t <= endT).map(([, d]) => d)) ?? {}) },
    phases: phaseTable(list),
    idbNearTaps: idb,
    svgElements: Math.max(svg, await page.evaluate(() => document.querySelectorAll('svg *').length)),
    errors,
  })
  await context.close()
  return { result, raw, list, endT }
}

// ─── The runs, summed up ────────────────────────────────────────────────────

function verdict(sum) {
  const fails = []
  for (const [phase, p] of Object.entries(sum.phases)) {
    if (!p.n) continue
    if (p.longShare > LIMITS.longShare) fails.push(`${phase}: lang opgave i ${p.longShare} % af overgangene (> ${LIMITS.longShare} %)`)
    if (p.worstFrameMedian > LIMITS.worstFrame) fails.push(`${phase}: medianen af det værste billede er ${p.worstFrameMedian} ms (> ${LIMITS.worstFrame} ms)`)
  }
  if (sum.longTasks.max > LIMITS.longMax) fails.push(`en lang opgave på ${sum.longTasks.max} ms (> ${LIMITS.longMax} ms)`)
  if (sum.round.p95 > LIMITS.p95 || sum.round.over20 > LIMITS.over20) fails.push(`hele turen: p95 ${sum.round.p95} ms, ${sum.round.over20} % over 20 ms`)
  if (THROTTLE === 1 && sum.roundAroundAnswers && sum.roundAroundAnswers.max > LIMITS.calmTap) fails.push(`THROTTLE=1: et billede på ${sum.roundAroundAnswers.max} ms inden for 2,5 s af et tryk`)
  if (sum.idbNearTaps.length) fails.push(`${sum.idbNearTaps.length} IndexedDB-scripts ≥ ${LIMITS.idbMs} ms inden for 300 ms af et tryk (maks. ${Math.max(...sum.idbNearTaps.map((x) => x.ms))} ms)`)
  if (sum.errors.length) fails.push(`${sum.errors.length} konsolfejl`)
  if (sum.svgElements > LIMITS.svg) fails.push(`${sum.svgElements} SVG-elementer`)
  const invalid = !sum.roundCalm || sum.roundCalm.p95 > LIMITS.calmP95 || sum.roundCalm.over20 > LIMITS.calmOver20
  return { ok: fails.length === 0 && !invalid, valid: !invalid, fails }
}

/** The runs of one build, summed up. */
function summarize(runs) {
  const all = (pick) => runs.flatMap((r) => pick(r))
  const sum = {
    world: WORLD,
    viewport: VIEWPORT,
    throttle: THROTTLE,
    profile: heavy ? HEAVY.split('/').pop() : 'new',
    seed: SEED,
    runs: runs.map((r) => ({ stone: r.result.stone, answers: r.result.answers, finished: r.result.finished, docBytes: r.result.docBytes, bench: r.result.bench })),
    answers: runs.reduce((n, r) => n + r.result.answers, 0),
    round: stats(all((r) => r.raw.frames.filter(([t]) => t <= r.endT).slice(1).map(([, d]) => d))),
    roundCalm: null,
    roundAroundAnswers: null,
    longTasks: { n: all((r) => r.raw.long.filter(([t]) => t <= r.endT)).length, ...(stats(all((r) => r.raw.long.filter(([t]) => t <= r.endT).map(([, d]) => d))) ?? {}) },
    phases: phaseTable(all((r) => r.list)),
    idbNearTaps: all((r) => r.result.idbNearTaps),
    svgElements: Math.max(...runs.map((r) => r.result.svgElements)),
    errors: all((r) => r.result.errors),
  }
  // the frames away from the taps and right after them, each run with its own taps
  const calm = []
  const around = []
  for (const r of runs) {
    const taps = r.list.filter((x) => x.phase === 'asking→correct' || x.phase === 'asking→wrong' || x.phase === 'teaching→next').map((x) => x.t)
    const near = (t, a, b) => taps.some((x) => t >= x + a && t <= x + b) || r.raw.marks.some(([m]) => t >= m + a && t <= m + b)
    const fr = r.raw.frames.filter(([t]) => t <= r.endT).slice(1)
    calm.push(...fr.filter(([t]) => !near(t, -200, 2500)).map(([, d]) => d))
    around.push(...fr.filter(([t]) => near(t, 0, 2500)).map(([, d]) => d))
  }
  sum.roundCalm = stats(calm)
  sum.roundAroundAnswers = stats(around)
  sum.verdict = verdict(sum)
  return sum
}

function print(label, sum) {
  const v = sum.verdict
  console.log(`\n${label}: ${sum.answers} svar, maskinens målestok ${sum.runs.map((r) => r.bench?.join('/')).join(', ')} ms`)
  console.log(JSON.stringify({ ...sum, phases: undefined }, null, 1))
  console.log('fase              n   lang   median/maks   værste billede (median)   største LoAF-invokere')
  for (const [phase, p] of Object.entries(sum.phases)) {
    const inv = p.invokers.slice(0, 3).map((e) => `${e.invoker} ${e.perTransition} ms`).join(', ')
    console.log(`${phase.padEnd(16)} ${String(p.n).padStart(3)}  ${`${p.withLong}/${p.n}`.padStart(5)}  ${`${p.longMedian ?? '–'} / ${p.longMax ?? '–'}`.padStart(11)}   ${String(p.worstFrameMedian ?? '–').padStart(8)} ms   ${inv}`)
  }
  console.log(v.valid ? (v.ok ? 'alle krav holder' : `krav, der ikke holder:\n  ${v.fails.join('\n  ')}`) : `UGYLDIG kørsel: billederne væk fra svarene har p95 ${sum.roundCalm?.p95} ms og ${sum.roundCalm?.over20} % over 20 ms (maskinen var optaget)`)
}

// DIST_B: a second build, played turn about with the first (A, B, A, B …) under the same conditions
const DIST_B = process.env.DIST_B ?? null
const server = await serve(DIST, PORT, DIST_B)
const urls = DIST_B ? [server.url, server.urlB] : [server.url]
const browser = await launch()
const runs = []
try {
  for (let run = 0; run < RUNS; run++) for (const [build, url] of urls.entries()) runs.push({ build, ...(await playRound(browser, url, run)) })
} finally {
  await browser.close()
  server.close()
}

const sum = summarize(runs.filter((r) => r.build === 0))
const sumB = DIST_B ? summarize(runs.filter((r) => r.build === 1)) : null
writeFileSync(
  `${OUT}round-${TAG}${DIST_B ? '-ab' : ''}.json`,
  JSON.stringify({ ...sum, ...(sumB ? { b: sumB, distB: DIST_B } : {}), perRun: runs.map((r) => ({ build: r.build, ...r.result })), raw: runs.map((r) => r.raw) }, null, 1),
)
print(DIST_B ? `A (${DIST})` : 'resultat', sum)
if (sumB) print(`B (${DIST_B})`, sumB)
if (ASSERT && !sum.verdict.ok) process.exit(1)
