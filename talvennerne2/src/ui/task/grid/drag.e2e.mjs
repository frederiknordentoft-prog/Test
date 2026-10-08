// The coordinate net holds still under the finger (QA3b P1), in the real app: a child in 3. klasse with
// Stjernefjeldet open plays a stored round of "Sæt punktet …" (gridCoords placePoint, the grid kind)
// on Arealhaven's first stone, by CDP touch, on a phone held sideways (852×393) and upright (393×852).
// On the first task the finger goes down the moment the task is asked and drags slowly (1.2 s, past
// the round's fitting at 650 ms) from (3, 3) towards (1, 3); then a tap on (3, 2), a drag from (3, 3)
// to (3, 2) and one from (5, 1) towards (1, 3). The second task does the same once the round has
// settled. Checks: the net's box never moves (before, during and after each gesture), the point lands
// on the crossing the finger let go on, sideways the companion strip stays (the round is not
// compact), the net and the pair stay inside the answer card, the right point is judged right, and
// there are no console errors. Shots of the first gesture in artifacts/grid-drag/.
//
//   npx vite --port 4398 --strictPort &
//   APP_URL=http://127.0.0.1:4398/ flock /tmp/tv2-chromium.lock node src/ui/task/grid/drag.e2e.mjs
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../scripts/browser.mjs'

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4398/'
const QUERY = '?e2e=1&voice=fast&worlds=all'
const OUT = fileURLToPath(new URL('../../../../artifacts/grid-drag/', import.meta.url))
const VIEWPORTS = { land: { width: 852, height: 393 }, phone: { width: 393, height: 852 } }
const NODE = 'w3-areal-l1'
const POINTS = ['3,2', '4,3']
mkdirSync(OUT, { recursive: true })

const checks = []
function check(ok, what) {
  checks.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Touch (CDP) ────────────────────────────────────────────────────────────

const touch = (cdp, type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }] : [] })
/** A drag along a straight line in `steps` moves over `ms`; `during` runs once halfway. */
async function drag(cdp, a, b, { steps = 12, ms = 240, during } = {}) {
  await touch(cdp, 'touchStart', a)
  for (let i = 1; i <= steps; i++) {
    await sleep(ms / steps)
    await touch(cdp, 'touchMove', { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps })
    if (during && i === Math.floor(steps / 2)) await during()
  }
  await sleep(16)
  await touch(cdp, 'touchEnd', null)
  await sleep(120)
}
async function tap(cdp, p) {
  await touch(cdp, 'touchStart', p)
  await sleep(40)
  await touch(cdp, 'touchEnd', null)
  await sleep(120)
}

// ─── The app ────────────────────────────────────────────────────────────────

async function newChild(page) {
  await page.goto(`${BASE}${QUERY}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(async () => (await import('/src/state/useSession.ts')).useSession.getState().phase === 'ready', null, { timeout: 30000 })
  await page.evaluate(async () => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useMeta } = await import('/src/state/useMeta.ts')
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { useNav } = await import('/src/app/nav.ts')
    const { withOpenings, worldOpenings } = await import('/src/ui/screens/parent/dashboard/openings.ts')
    const { DRAWN } = await import('/src/meta/built.ts')
    const { registeredSkills } = await import('/src/engine/registry.ts')
    await useSession.getState().createProfile({ name: 'Bo', grade: 3 })
    useMeta.getState().chooseStarter('rabbit')
    const registered = new Set(registeredSkills().map((d) => d.id))
    useProfile.getState().update((p) => withOpenings(p, worldOpenings('fjeld', registered, { species: DRAWN.species, items: DRAWN.items })))
    useNav.getState().root({ id: 'map' })
  })
  await page.waitForSelector('[data-map-path]', { timeout: 30000 })
}

/** A stored round of placePoint tasks on the grid, resumed on the stone. */
async function startRound(page) {
  await page.evaluate(async ({ points, node }) => {
    const { skillRegistry } = await import('/src/engine/registry.ts')
    const { buildTask } = await import('/src/engine/tasks.ts')
    const { makeRng, hashSeed } = await import('/src/engine/rng.ts')
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { useNav } = await import('/src/app/nav.ts')
    const def = skillRegistry().get('gridCoords')
    const tasks = points.map((xy, i) => {
      const [x, y] = xy.split(',').map(Number)
      const fact = { id: `crd:p:${xy}`, skill: 'gridCoords', family: 'placePoint', operands: [x, y], answer: `pt:${xy}`, rank: 0 }
      const t = buildTask(def, fact, 'grid', makeRng(hashSeed(fact.id)), 0, { box: 2 }).task
      return { ...t, id: `${t.factId}#drag${i}` }
    })
    const now = Date.now()
    const round = {
      v: 1, roundId: `drag-${now}`, sessionId: `drag-${now}`, mode: 'round', nodeId: node, seed: 1, queue: tasks.slice(1), current: tasks[0],
      phase: 'asking', answered: 0, total: tasks.length, firstTries: [], streak: 0, bestStreak: 0, mistakes: 0, goldenUsed: true,
      goldenCaught: false, planks: 0, startedAt: now,
    }
    useProfile.getState().update((p) => ({ ...p, round }))
    useNav.getState().root({ id: 'round', node, resume: true })
  }, { points: POINTS, node: NODE })
  for (let i = 0; i < 100; i++) {
    const s = await page.evaluate(() => (document.querySelector('[data-play-start]') ? 'start' : document.querySelector('.tv-round') ? 'round' : null))
    if (s === 'round') break
    if (s === 'start') {
      await page.click('[data-play-start]')
      break
    }
    await sleep(100)
  }
}

/** The net's box (client px) and where a crossing is, from the drawing's geometry. */
async function net(page) {
  return page.evaluate(async () => {
    const g = await import('/src/ui/task/grid/geometry.ts')
    const root = document.querySelector('.tv-round__answer [data-kind="grid"]')
    const r = root.querySelector('.tv-grid__svg').getBoundingClientRect()
    const h = Number(root.dataset.h)
    return { left: r.left, top: r.top, width: r.width, k: r.width / g.frameOf(Number(root.dataset.w), h).W, h, pad: g.PAD, cell: g.CELL }
  })
}
const crossing = (g, xy) => {
  const [x, y] = xy.split(',').map(Number)
  return { x: g.left + (g.pad.l + x * g.cell) * g.k, y: g.top + (g.pad.t + (g.h - y) * g.cell) * g.k }
}
const box = (g) => [g.left, g.top, g.width].map((v) => Math.round(v)).join(',')
const shown = (page) => page.evaluate(() => document.querySelector('.tv-round__answer [data-point]')?.getAttribute('data-point') ?? null)
const compact = (page) => page.evaluate(() => document.querySelector('.tv-round').classList.contains('is-compact'))
const inCard = (page) => page.evaluate(() => {
  const card = document.querySelector('.tv-round__answer').getBoundingClientRect()
  return [...document.querySelectorAll('.tv-round__answer .tv-grid__figure, .tv-round__answer .tv-grid__foot')].every((k) => {
    const r = k.getBoundingClientRect()
    return r.top >= card.top - 1 && r.bottom <= card.bottom + 1 && r.left >= card.left - 1 && r.right <= card.right + 1
  })
})

/** The gestures on one task; `first`: the finger goes down the moment the task is asked. */
async function gestures(page, cdp, vp, first) {
  const tag = `${vp}-${first ? 'first' : 'settled'}`
  const g0 = await net(page)
  const stays = async (what) => check(box(await net(page)) === box(g0), `${tag}: nettet står stille ${what} (${box(await net(page))} mod ${box(g0)})`)
  // a slow drag that holds the finger down past the round's fitting check
  await drag(cdp, crossing(g0, '3,3'), crossing(g0, '1,3'), { steps: 24, ms: 1200, during: first ? () => page.screenshot({ path: `${OUT}${tag}-mid.png` }) : undefined })
  check((await shown(page)) === '1,3', `${tag}: et langsomt træk mod (1, 3) lander på (1, 3) (${await shown(page)})`)
  await stays('under det langsomme træk')
  if (first) await page.screenshot({ path: `${OUT}${tag}-after.png` })
  await tap(cdp, crossing(g0, '3,2'))
  check((await shown(page)) === '3,2', `${tag}: et tryk på (3, 2) sætter (3, 2) (${await shown(page)})`)
  await drag(cdp, crossing(g0, '3,3'), crossing(g0, '3,2'))
  check((await shown(page)) === '3,2', `${tag}: et træk fra (3, 3) til (3, 2) lander på (3, 2) (${await shown(page)})`)
  await drag(cdp, crossing(g0, '5,1'), crossing(g0, '1,3'), { steps: 16, ms: 400 })
  check((await shown(page)) === '1,3', `${tag}: et træk fra (5, 1) mod (1, 3) lander på (1, 3) (${await shown(page)})`)
  await sleep(900)
  await stays('efter trækkene')
  if (vp === 'land') check(!(await compact(page)), `${tag}: på tværs bliver kammeratstriben (runden er ikke kompakt)`)
  check(await inCard(page), `${tag}: nettet og parret står inde i svarkortet`)
}

async function play(browser, vp) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'da-DK' })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    await newChild(page)
    await startRound(page)
    for (const [i, xy] of POINTS.entries()) {
      await page.waitForSelector('.tv-round[data-beat="asking"] .tv-round__answer [data-kind="grid"]', { timeout: 30000 })
      const first = i === 0
      if (!first) await sleep(1200)
      await gestures(page, cdp, vp, first)
      // the asked point by a tap, then the tick
      const g = await net(page)
      await tap(cdp, crossing(g, xy))
      const b = await page.evaluate(() => {
        const r = document.querySelector('.tv-round__answer [data-check]').getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
      await tap(cdp, b)
      await page.waitForFunction(async () => (await import('/src/state/useRound.ts')).useRound.getState().lastResult !== null, null, { timeout: 5000 })
      const right = await page.evaluate(async () => (await import('/src/state/useRound.ts')).useRound.getState().lastResult?.correct ?? null)
      check(right === true, `${vp}: (${xy}) sat med fingeren er rigtigt`)
      await page.waitForFunction(() => document.querySelector('.tv-round')?.getAttribute('data-beat') !== 'asking', null, { timeout: 10000 })
    }
  } catch (e) {
    check(false, `${vp}: ${e.message.split('\n')[0]}`)
    await page.screenshot({ path: `${OUT}${vp}-error.png` }).catch(() => undefined)
  }
  check(errors.length === 0, `${vp}: ingen konsolfejl${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`)
  await ctx.close()
}

const browser = await launch()
try {
  for (const vp of Object.keys(VIEWPORTS)) await play(browser, vp)
} finally {
  await browser.close()
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} ok`)
process.exit(bad.length ? 1 : 0)
