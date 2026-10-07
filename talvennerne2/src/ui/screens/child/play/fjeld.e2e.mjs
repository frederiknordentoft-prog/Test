// Stjernefjeldet in Chromium the way a child in 3. klasse plays it (dev only; `?worlds=all` lets the
// world be played before it is released): a new child in 3. klasse, Stjernefjeldet opened the way a
// grown-up opens it from the dashboard ("Åbn hele Stjernefjeldet"), then the first stone of each of the
// seven regions (one wrong answer each, through the strategy), five mastery trials with Arealhaven's
// first, and the world finale, which the passed trials open. Every task is answered through its own
// view (src/dev/tasks/drive.ts: grid, clockSet, pay, share and the rest by touch). Checks: each round
// starts on its stone and ends in the ceremonies, the trials and the finale are passed, the finale's
// Astronaut things are won, the kinds met include grid, and there are 0 console errors.
//
// Until the art of the four animals and the Astronaut set is merged, the world is not ready and the run
// is skipped (FJELD_REQUIRED=1 makes that a failure, as at the release).
//
//   npx vite --port 4315 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/ui/screens/child/play/fjeld.e2e.mjs
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.MAP_URL ?? 'http://127.0.0.1:4315/'
const QUERY = '?e2e=1&voice=fast&worlds=all'
// FJELD_REQUIRED=1 (the release): a world that cannot be opened fails instead of being skipped
const REQUIRED = process.env.FJELD_REQUIRED === '1'
const PHONE = { width: 393, height: 852 }
const ALL = ['w3-tabellen', 'w3-store-tal', 'w3-klokken', 'w3-division', 'w3-penge-maal', 'w3-areal', 'w3-broeker']
// FJELD_ONLY=<region>[,<region>…] plays only those regions' first stones (to look into one; no trials)
const ONLY = process.env.FJELD_ONLY ? process.env.FJELD_ONLY.split(',') : null
const REGIONS = ONLY ?? ALL
// five of seven trials passed open the finale (WORLD_TRIAL_SHARE 0.6); Arealhaven's is the plan's own
const TRIALS = ONLY ? [] : ['w3-areal', 'w3-tabellen', 'w3-store-tal', 'w3-klokken', 'w3-broeker']
const OUT = fileURLToPath(new URL('../../../../../artifacts/fjeld/', import.meta.url))
const checks = []
const errors = []

function check(ok, what) {
  checks.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}

/** The centre of the first visible match, after making sure nothing covers it there. */
async function centre(page, selector) {
  const r = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect()
      return b.width > 0 && b.height > 0
    })
    if (!el) return { missing: true }
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    const b = el.getBoundingClientRect()
    const x = b.left + b.width / 2
    const y = b.top + b.height / 2
    const hit = document.elementFromPoint(x, y)
    return { x, y, covered: !(hit && (hit === el || el.contains(hit))), by: hit?.className?.toString().slice(0, 60) ?? null }
  }, selector)
  if (r.missing) throw new Error(`${selector} findes ikke`)
  if (r.covered) throw new Error(`${selector} er dækket af ${r.by}`)
  return r
}

async function tap(page, selector) {
  const { x, y } = await centre(page, selector)
  await page.mouse.click(x, y)
  await page.waitForTimeout(60)
}

const drive = (page, fn, arg) => page.evaluate(async ([f, a]) => (await import('/src/dev/tasks/drive.ts'))[f](a), [fn, arg])
const route = (page) => page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().route)
const profile = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/state/useProfile.ts')).useProfile.getState().profile)))

/** A new child in 3. klasse with its first friend, and Stjernefjeldet opened by a grown-up. */
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
    // as released (?worlds=all): every drawn world counts, as the dashboard's button will once fjeld is out
    const drawn = { species: DRAWN.species, items: DRAWN.items }
    const registered = new Set(registeredSkills().map((d) => d.id))
    useProfile.getState().update((p) => withOpenings(p, worldOpenings('fjeld', registered, drawn)))
    useNav.getState().root({ id: 'map' })
  })
  await page.waitForSelector('[data-map-path]', { timeout: 30000 })
  // the dashboard opens only a ready world: its friends and things must be drawn (the art merged)
  return (await profile(page)).unlocked.worlds.includes('fjeld')
}

/** What is on screen when the round seems stuck: the beat, the route, the task and a screenshot. */
async function stuckAt(page, why) {
  const shot = `${OUT}/stuck-${Date.now()}.png`
  await page.screenshot({ path: shot }).catch(() => undefined)
  const state = await page.evaluate(async () => ({
    beat: document.querySelector('.tv-round')?.getAttribute('data-beat') ?? null,
    route: (await import('/src/app/nav.ts')).useNav.getState().route,
    task: (await import('/src/dev/tasks/drive.ts')).currentTask(),
    hooks: [...document.querySelectorAll('[data-confirm],[data-check],[data-teaching],[data-play-start],[data-demo-film],[data-ceremony]')].map((e) => e.outerHTML.slice(0, 80)),
  })).catch((e) => ({ error: String(e) }))
  const t = state.task
  return new Error(`${why}; beat ${state.beat}, rute ${JSON.stringify(state.route)}, opgave ${t ? `${t.id} (${t.kind}, svar ${t.answer})` : '-'}, kroge ${JSON.stringify(state.hooks ?? state.error)}; billede ${shot}`)
}

/** What needs the player now: a task, a demo film, the intro's tap, or the end of the round. */
async function nextThing(page, timeout = 30000) {
  const h = await page.waitForFunction(
    () => {
      if (document.querySelector('[data-ceremony]')) return { what: 'ceremony' }
      if (document.querySelector('[data-play-start]')) return { what: 'start' }
      if (document.querySelector('[data-demo-film]')) return { what: 'demo' }
      if (document.querySelector('[data-teaching] [data-confirm]')) return { what: 'confirm' }
      const r = document.querySelector('.tv-round[data-beat="asking"]')
      if (r) return { what: 'ask', golden: r.classList.contains('is-golden') }
      return null
    },
    null,
    { timeout, polling: 60 },
  ).catch(async () => {
    throw await stuckAt(page, `intet at gøre efter ${timeout / 1000} s`)
  })
  return h.jsonValue()
}

/** Answers until the end of the round; `wrongAt`: the first try answered wrong. Returns the kinds met. */
async function playOn(page, { wrongAt = -1 } = {}) {
  const kinds = new Set()
  let firsts = 0
  for (let guard = 0; guard < 160; guard++) {
    const n = await nextThing(page)
    if (n.what === 'ceremony') return kinds
    if (n.what === 'start') {
      await tap(page, '[data-play-start]')
      continue
    }
    if (n.what === 'demo') {
      await page.waitForTimeout(700)
      await page.mouse.click(10, 300)
      await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 }).catch(() => undefined)
      continue
    }
    if (n.what === 'confirm') {
      await tap(page, '[data-confirm]')
      await page.waitForSelector('[data-teaching]', { state: 'detached', timeout: 8000 })
      continue
    }
    const t = await drive(page, 'currentTask')
    if (!n.golden && !t.retryOf) firsts++
    kinds.add(t.kind)
    const wrong = !n.golden && !t.retryOf && firsts - 1 === wrongAt ? await drive(page, 'wrongFor', t) : null
    await drive(page, 'answer', wrong ?? t.answer)
    await page.waitForFunction(() => {
      const r = document.querySelector('.tv-round')
      return !r || r.getAttribute('data-beat') !== 'asking' || document.querySelector('[data-ceremony]')
    }, null, { timeout: 10000, polling: 50 })
  }
  throw new Error('turen sluttede ikke')
}

/** Taps through the end of a round (an egg is hatched) to its last screen, then goes to the map. */
async function ceremoniesToMap(page) {
  for (let guard = 0; guard < 80; guard++) {
    await page.waitForTimeout(120)
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-ceremony]')
      if (!root) return null
      return {
        index: Number(root.getAttribute('data-ceremony')),
        end: !!root.querySelector('[data-cer-end]'),
        egg: !!root.querySelector('[data-egg]'),
        pick: !!root.querySelector('[data-cer-pick]'),
      }
    })
    if (!s) break
    if (s.end) {
      await tap(page, '[data-cer-map]')
      break
    }
    if (s.egg) {
      for (let i = 0; i < 3; i++) {
        await tap(page, '[data-egg]')
        await page.waitForTimeout(250)
      }
      await page.waitForSelector('[data-name-animal]', { timeout: 8000 })
      await tap(page, '[data-cer-next]')
      continue
    }
    if (s.pick) {
      await tap(page, '[data-pick]')
      continue
    }
    // the screens move on by themselves: tap only the one still showing
    const now = await page.evaluate(() => document.querySelector('[data-ceremony]')?.getAttribute('data-ceremony'))
    if (Number(now) !== s.index) continue
    await tap(page, '[data-cer-next]')
  }
  await page.waitForSelector('[data-map-path]', { timeout: 15000 })
}

/** Plays the stone `id` from its card on the map; returns the kinds met. */
async function playStone(page, id, opts) {
  await tap(page, `[data-stone="${id}"]`)
  await page.waitForSelector('[data-sheet-play]', { timeout: 10000 })
  await page.waitForTimeout(500)
  await tap(page, '[data-sheet-play]')
  await page.waitForSelector('[data-play]', { timeout: 15000 })
  const r = await route(page)
  check(r.node === id, `turen starter på ${id} (${r.node})`)
  const kinds = await playOn(page, opts)
  check((await route(page)).id === 'ceremonies', `${id}: turens slut går til ceremonierne`)
  await ceremoniesToMap(page)
  return kinds
}

async function run(browser) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  if (!(await newChild(page))) {
    // before the art is merged the world is not ready, and a grown-up cannot open it either
    const what = 'Stjernefjeldet er ikke klar i dette træ (arternes eller tingenes tegninger mangler)'
    if (REQUIRED) check(false, what)
    else console.log(`SPRING OVER: ${what}; FJELD_REQUIRED=1 gør det til en fejl`)
    await ctx.close()
    return
  }
  const shown = await page.evaluate(() => document.querySelector('.tv-map')?.getAttribute('data-world'))
  if (shown !== 'fjeld') await tap(page, '.tv-world[data-world="fjeld"]')
  await page.waitForSelector('.tv-map[data-world="fjeld"]', { timeout: 10000 })
  const stones = await page.evaluate((ids) => ids.map((r) => document.querySelector(`[data-stone="${r}-l1"]`)?.getAttribute('data-state') ?? 'mangler'), ALL)
  check(stones.every((s) => s !== 'locked' && s !== 'mangler'), `fjeldets syv regioner er åbne (${stones.join(', ')})`)

  // ── the first stone of every region, one mistake each ──
  const kinds = new Set()
  for (const region of REGIONS) for (const k of await playStone(page, `${region}-l1`, { wrongAt: 1 })) kinds.add(k)
  const p1 = await profile(page)
  check(REGIONS.every((r) => p1.nodes[`${r}-l1`]), 'alle syv første sten er spillet')

  if (ONLY) {
    check(errors.length === 0, `0 konsolfejl${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`)
    await ctx.close()
    return
  }

  // ── five mastery trials, Arealhaven's first ──
  for (const region of TRIALS) for (const k of await playStone(page, `${region}-trial`)) kinds.add(k)
  const p2 = await profile(page)
  check(TRIALS.every((r) => p2.trials[r]?.passed), `fem prøver er bestået (${TRIALS.map((r) => `${r}:${p2.trials[r]?.passed ? 'ja' : 'nej'}`).join(', ')})`)

  // ── the finale, opened by the trials ──
  const finale = await page.evaluate(() => document.querySelector('[data-stone="fjeld-finale"]')?.getAttribute('data-state') ?? 'mangler')
  check(finale !== 'locked' && finale !== 'mangler', `finalen er åben (${finale})`)
  for (const k of await playStone(page, 'fjeld-finale')) kinds.add(k)
  const p3 = await profile(page)
  check(p3.trials.fjeld?.passed, 'finalen er bestået')
  const owned = Object.keys(p3.inventory ?? {}).filter((i) => i.startsWith('astronaut-'))
  check(['astronaut-neck', 'astronaut-body', 'astronaut-back'].every((i) => owned.includes(i)), `finalens Astronaut-ting er vundet (${owned.join(', ')})`)

  check(kinds.has('grid'), `opgavetyperne i fjeld omfatter grid (${[...kinds].sort().join(', ')})`)
  check(errors.length === 0, `0 konsolfejl${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`)
  await ctx.close()
}

mkdirSync(OUT, { recursive: true })
const browser = await launch()
try {
  await run(browser)
} catch (e) {
  check(false, `stjernefjeldet: ${e.message}`)
} finally {
  await browser.close()
}
const failed = checks.filter((c) => !c.ok)
console.log(`\nstjernefjeldet: ${checks.length - failed.length}/${checks.length} ok`)
process.exit(failed.length ? 1 : 0)
