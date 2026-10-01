// Plays the game's loop in Chromium the way a child would (dev only): map → round → the end of the
// round → map, twice. Round 1 starts from the "Næste sted" tile, has one mistake, ends with "Det
// lærte du", level 2 with the Hverdag hat and "Prøv den på" (the wardrobe and back), and returns to
// the map with the stone done. Round 2 starts from the stone's card, is paused with ✕ → "Til
// kortet", continued from "Fortsæt turen" (same task), then the page is reloaded mid-round (the app
// starts in the round, the same task again), and it ends with the hatch: three taps and a name.
// Screenshots of the map at 393×852, 820×1180 and 852×393 and of the ceremonies go to
// artifacts/map/. Fails on any console error or page error.
//
//   npx vite --port 4314 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/ui/screens/child/play/loop.e2e.mjs
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.MAP_URL ?? 'http://127.0.0.1:4314/'
const QUERY = '?e2e=1&voice=fast'
const OUT = fileURLToPath(new URL('../../../../../artifacts/map/', import.meta.url))
const EXTRA = process.env.MAP_SHOTS ?? null
const PHONE = { width: 393, height: 852 }
const IPAD = { width: 820, height: 1180 }
const SIDE = { width: 852, height: 393 }
const checks = []
const errors = []

function check(ok, what) {
  checks.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}

async function shot(page, name, keep = false) {
  const dir = keep ? OUT : EXTRA
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/${name}.png` })
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
    return { x, y, w: b.width, h: b.height, covered: !(hit && (hit === el || el.contains(hit))), by: hit?.className?.toString().slice(0, 60) ?? null }
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
const roundState = (page) => drive(page, 'roundState')

async function newChild(page) {
  await page.goto(`${BASE}${QUERY}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(async () => (await import('/src/state/useSession.ts')).useSession.getState().phase === 'ready', null, { timeout: 30000 })
  await page.evaluate(async () => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useMeta } = await import('/src/state/useMeta.ts')
    const { useNav } = await import('/src/app/nav.ts')
    await useSession.getState().createProfile({ name: 'Ada', grade: 0 })
    useMeta.getState().chooseStarter('rabbit')
    useNav.getState().root({ id: 'map' })
  })
  await page.waitForSelector('[data-map-path] [data-next]', { timeout: 30000 })
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
  )
  return h.jsonValue()
}

/**
 * Answers until the end of the round (or until `stop` says so). `wrongAt`: the first try answered
 * wrong (index among first tries). Returns the number of first tries answered.
 */
async function playOn(page, { wrongAt = -1, stop = null } = {}) {
  let firsts = 0
  let demos = 0
  for (let guard = 0; guard < 120; guard++) {
    const n = await nextThing(page)
    if (n.what === 'ceremony') return firsts
    if (n.what === 'start') {
      await tap(page, '[data-play-start]')
      continue
    }
    if (n.what === 'demo') {
      demos++
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
    if (!n.golden && !t.retryOf) {
      if (stop && (await stop(firsts, t))) return firsts
      firsts++
    }
    const wrong = !n.golden && !t.retryOf && firsts - 1 === wrongAt ? await drive(page, 'wrongFor', t) : null
    await drive(page, 'answer', wrong ?? t.answer)
    await page.waitForFunction(() => {
      const r = document.querySelector('.tv-round')
      return !r || r.getAttribute('data-beat') !== 'asking' || document.querySelector('[data-ceremony]')
    }, null, { timeout: 10000, polling: 50 })
  }
  throw new Error('turen sluttede ikke')
}

/** Records every screen of the end of a round as it appears (they move on by themselves). */
async function watchCeremonies(page) {
  await page.evaluate(() => {
    window.__cer = []
    const note = () => {
      const root = document.querySelector('[data-ceremony]')
      if (!root) return
      const index = Number(root.getAttribute('data-ceremony'))
      const kind = [...root.classList].find((c) => c.startsWith('is-'))?.slice(3) ?? '?'
      const last = window.__cer[window.__cer.length - 1]
      if (!last || last.index !== index) window.__cer.push({ index, kind })
    }
    new MutationObserver(note).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ceremony'] })
  })
}
const ceremonyLog = (page) => page.evaluate(() => window.__cer ?? [])

/** Taps through the end of a round; `onScreen` may act on a screen first. Ends on the last screen. */
async function ceremonies(page, onScreen = async () => undefined) {
  const seen = []
  for (let guard = 0; guard < 80; guard++) {
    await page.waitForTimeout(120)
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-ceremony]')
      if (!root) return null
      const kind = [...root.classList].find((c) => c.startsWith('is-'))?.slice(3) ?? '?'
      return {
        index: Number(root.getAttribute('data-ceremony')),
        kind,
        end: !!root.querySelector('[data-cer-end]'),
        egg: !!root.querySelector('[data-egg]'),
        pick: !!root.querySelector('[data-cer-pick]'),
        name: !!root.querySelector('[data-name-animal]'),
        tryOn: !!root.querySelector('[data-try-on]'),
      }
    })
    if (!s) return seen
    if (!seen.some((x) => x.index === s.index)) {
      seen.push(s)
      await onScreen(s)
    }
    if (s.end) return seen
    const now = await page.evaluate(() => document.querySelector('[data-ceremony]')?.getAttribute('data-ceremony'))
    if (Number(now) !== s.index) continue
    if (s.egg) {
      for (let i = 0; i < 3; i++) {
        await tap(page, '[data-egg]')
        await page.waitForTimeout(250)
      }
      await page.waitForSelector('[data-name-animal]', { timeout: 8000 })
      await onScreen({ ...s, egg: false, name: true })
      await tap(page, '[data-cer-next]')
      continue
    }
    if (s.pick) {
      await tap(page, '[data-pick]')
      continue
    }
    await tap(page, '[data-cer-next]')
  }
  throw new Error('ceremonierne sluttede ikke')
}

async function run(browser) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  // ── a new child on the map ──
  await newChild(page)
  const map0 = await page.evaluate(() => ({
    next: document.querySelector('[data-next]')?.getAttribute('data-stone'),
    locked: document.querySelectorAll('[data-stone][data-state="locked"]').length,
    stones: document.querySelectorAll('[data-stone]').length,
    worlds: [...document.querySelectorAll('.tv-world[data-world]')].map((w) => `${w.getAttribute('data-world')}:${w.hasAttribute('data-open') ? 'open' : 'locked'}`),
    tiles: [...document.querySelectorAll('[data-tile]')].map((t) => t.getAttribute('data-tile')),
  }))
  check(map0.next === 'w0-tal10-l1', `kortet peger på den første sten (${map0.next})`)
  check(map0.stones === 37 && map0.locked > 20, `alle sten vises, de låste som låste (${map0.locked} af ${map0.stones})`)
  check(map0.worlds.join(',') === 'eng:open,bakke:locked,skov:locked,fjeld:locked', `fire verdener, tre låste (${map0.worlds})`)
  check(map0.tiles.includes('next') && map0.tiles.includes('practice'), `"Næste sted" og "Blandet øvelse" (${map0.tiles})`)
  await shot(page, 'map-phone-new', true)

  // a locked stone says what opens it
  await tap(page, '[data-stone="w0-tal10-l2"]')
  await page.waitForSelector('[data-stone-sheet="w0-tal10-l2"]')
  check(!(await page.$('[data-sheet-play]')), 'en låst sten har ingen "Spil"-knap')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.tv-sheet-root', { state: 'detached' })

  // ── round 1: from the "Næste sted" tile, one mistake ──
  await watchCeremonies(page)
  await tap(page, '[data-tile="next"]')
  await page.waitForSelector('[data-play]', { timeout: 15000 })
  check((await route(page)).node === 'w0-tal10-l1', 'turen starter på den første sten')
  await page.waitForTimeout(700)
  await shot(page, 'intro-phone')
  await playOn(page, { wrongAt: 2 })
  check((await route(page)).id === 'ceremonies', 'turens slut går til ceremonierne')
  await page.waitForSelector('[data-cer-summary]', { timeout: 10000 })
  check(!!(await page.$('[data-learned]')), '"Det lærte du" viser hvad der blev lært')
  await page.waitForTimeout(1300)
  await shot(page, 'ceremony-phone', true)
  let triedOn = false
  let named = false
  const nameIt = async (s) => {
    if (!s.name || named) return
    named = true
    await shot(page, 'hatch-phone')
    const names = await page.$$eval('[data-name-option]', (els) => els.map((e) => e.getAttribute('data-name-option')))
    check(names.length === 6, `navngivning med seks oplæste forslag (${names.join(', ')})`)
    await tap(page, `[data-name-option="${names[2]}"]`)
    const p = await profile(page)
    check(p.animals.some((a) => a.name === names[2]), `vennen hedder nu ${names[2]}`)
  }
  const seen1 = await ceremonies(page, async (s) => {
    await nameIt(s)
    if (s.tryOn && !triedOn) {
      triedOn = true
      await shot(page, 'levelup-phone')
      await tap(page, '[data-try-on]')
      await page.waitForFunction(async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'wardrobe', null, { timeout: 8000 })
      const p = await profile(page)
      const buddy = p.animals.find((a) => a.uid === p.buddyUid)
      check(buddy?.outfit?.head?.item === 'hverdag-head', 'Prøv den på: huen sidder på vennen i garderoben')
      await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().back())
      await page.waitForSelector('[data-ceremony]', { timeout: 8000 })
    }
  })
  const log1 = await ceremonyLog(page)
  check(log1[0]?.kind === 'summary', `ceremonierne starter med "Det lærte du" (${log1.map((s) => s.kind).join(' → ')})`)
  check(log1.some((s) => s.kind === 'levelUp'), 'niveau 2 fejres')
  check(triedOn, 'niveau 2 giver Hverdag-huen med "Prøv den på"')
  check(log1.filter((s) => s.kind !== 'summary' && s.kind !== 'end').length <= 3, 'højst tre fuldskærmsceremonier')
  check(seen1.length > 0, `skærmene blev trykket igennem (${seen1.map((s) => s.kind).join(' → ')})`)
  const buttons = await page.evaluate(() => {
    const a = document.querySelector('[data-cer-next]')?.getBoundingClientRect()
    const b = document.querySelector('[data-cer-map]')?.getBoundingClientRect()
    return { a: a && [Math.round(a.width), Math.round(a.height)], b: b && [Math.round(b.width), Math.round(b.height)], auto: document.querySelectorAll('[autofocus]').length }
  })
  check(
    buttons.a && buttons.b && buttons.a.join() === buttons.b.join() && buttons.auto === 0,
    `"Næste" og "Til kortet" er lige store, og ingen får fokus af sig selv (${JSON.stringify(buttons)})`,
  )
  await tap(page, '[data-cer-map]')
  await page.waitForSelector('[data-map-path]', { timeout: 10000 })
  const after1 = await page.evaluate(() => ({
    done: document.querySelector('[data-stone="w0-tal10-l1"]')?.getAttribute('data-state'),
    next: document.querySelector('[data-next]')?.getAttribute('data-stone'),
  }))
  check(after1.done === 'done' && after1.next === 'w0-tal10-l2', `stenen er spillet, og den næste lyser (${after1.done}, ${after1.next})`)

  // ── round 2: from the stone's card; pause, continue, reload ──
  await tap(page, '[data-stone="w0-tal10-l2"]')
  await page.waitForSelector('[data-sheet-play]')
  await page.waitForTimeout(700)
  await tap(page, '[data-sheet-play]')
  await playOn(page, { stop: async (firsts) => firsts === 3 })
  const before = await drive(page, 'currentTask')
  await tap(page, '.tv-topbar [data-clip="s.ui.close"]')
  await page.waitForSelector('[data-pause]')
  await tap(page, '[data-pause] [data-leave]')
  await page.waitForSelector('[data-tile="resume"]', { timeout: 10000 })
  check(true, 'pausen gemmer turen, og kortet viser "Fortsæt turen"')
  await shot(page, 'map-phone-resume')
  await tap(page, '[data-tile="resume"]')
  await page.waitForSelector('[data-play]', { timeout: 10000 })
  await nextThing(page)
  const resumed = await drive(page, 'currentTask')
  check(resumed.id === before.id, `"Fortsæt turen" fortsætter med samme opgave (${resumed.id})`)
  await playOn(page, { stop: async (firsts) => firsts === 3 })
  const beforeReload = await drive(page, 'currentTask')
  const st = await roundState(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-play]', { timeout: 30000 })
  check((await route(page)).id === 'round', 'efter genindlæsning starter appen i turen')
  const n = await nextThing(page)
  if (n.what === 'start') await tap(page, '[data-play-start]')
  await nextThing(page)
  const reloaded = await drive(page, 'currentTask')
  const st2 = await roundState(page)
  check(reloaded.id === beforeReload.id && st2.cleared === st.cleared, `genindlæsning midt i turen: samme opgave (${reloaded.id}) og samme sten (${st2.cleared})`)
  await watchCeremonies(page)
  await playOn(page)
  const seen2 = await ceremonies(page, nameIt)
  const log2 = (await ceremonyLog(page)).map((s) => s.kind)
  const hatchAt = [...log1.map((s) => s.kind), 'end', ...log2]
  check(hatchAt.includes('hatch') && seen2.length > 0, `ægget klækkes (${log1.map((s) => s.kind).join(' → ')} | ${log2.join(' → ')})`)
  for (const log of [log1.map((s) => s.kind), log2]) {
    const i = log.indexOf('hatch')
    if (i >= 0) check(log[i + 1] === 'end' || i === log.length - 1, 'klækningen er den sidste ceremoni')
  }
  await shot(page, 'ceremony-end-phone')
  await tap(page, '[data-cer-map]')
  await page.waitForSelector('[data-map-path]', { timeout: 10000 })
  const p2 = await profile(page)
  check(p2.nodes['w0-tal10-l2']?.plays === 1 && p2.round === null, 'anden tur er bogført, og der er ingen gemt tur')
  check(p2.animals.length === 2 && named, `ægget gav en ny ven med navn (${p2.animals.length} dyr)`)
  await shot(page, 'map-phone', true)

  // ── the same map at the other sizes ──
  for (const [name, size] of [['map-ipad', IPAD], ['map-side', SIDE]]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(700)
    const fit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      small: [...document.querySelectorAll('.tv-map button')].filter((b) => {
        const r = b.getBoundingClientRect()
        return r.width > 0 && (r.width < 59.5 || r.height < 59.5)
      }).map((b) => b.className.toString().split(' ')[0]),
    }))
    check(!fit.overflow, `${name}: ingen vandret rulning`)
    check(fit.small.length === 0, `${name}: alle trykmål ≥ 60 px (${[...new Set(fit.small)].join(', ') || 'ok'})`)
    await shot(page, name, true)
  }
  await ctx.close()
}

const browser = await launch()
const t0 = Date.now()
try {
  await run(browser)
} catch (err) {
  check(false, `afbrudt: ${err instanceof Error ? err.message : String(err)}`)
} finally {
  await browser.close()
}
check(errors.length === 0, `ingen konsolfejl (${errors.length})`)
for (const e of errors.slice(0, 10)) console.log(`     ${e}`)
const failed = checks.filter((c) => !c.ok).length
console.log(`${checks.length - failed}/${checks.length} tjek bestået på ${Math.round((Date.now() - t0) / 1000)} s`)
process.exit(failed === 0 ? 0 : 1)
