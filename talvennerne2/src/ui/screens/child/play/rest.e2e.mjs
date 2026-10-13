// Rest (SPEC A25) in Chromium (dev only), with the rest time cut to 1.5 s (`&rest=1500`) and the cues
// calling for 15 s into it (`&deep=15000`): a new child on the map, a round at Plusengen, Tællelundens
// prøve, Dyrehaven and "Vælg spiller". Checked on each screen that rests: `data-rest` comes on <html>
// by itself, every endless loop that still runs is an attention cue (REST_CUES), no cue and no finite
// animation is paused, the animal's loop stands still at one currentTime, and a tap wakes it from
// that same currentTime (no jump). On the map and in the round the rest then turns deep by itself
// (`data-rest="deep"`): every cue but the blink (REST_ALIVE) stands still too, the lightbulb at one
// currentTime, and a key wakes it from there. The next stone's halo fades out in its pulse, so it
// settles on a clearly visible frame instead (REST_SETTLE: no loop, opacity ≥ 0.3), and a tap lets it
// pulse again from the start. On the map a drag
// and letting go wake it too, a mouse that only hovers does not. In the round: no rest in a demo, in
// teaching or in the pause; rest while a task waits for its answer, with the lightbulb pulsing after
// 10 s during the rest. A finished round goes to the ceremonies by itself and through them never
// rests, and the screens that move on by themselves still do (the prøve's own screen). The sky's
// clouds stand still everywhere, `rest=0` turns rest off, and there are 0 console errors.
//
//   npx vite --port 4421 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/ui/screens/child/play/rest.e2e.mjs
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.MAP_URL ?? 'http://127.0.0.1:4421/'
const REST = 1500
// the lightbulb comes at 10 s: the cues call long enough into the rest to see it pulse there
const DEEP = 15000
const QUERY = `?e2e=1&voice=fast&rest=${REST}&deep=${DEEP}`
const PHONE = { width: 393, height: 852 }
const checks = []
const errors = []
let autoScreens = 0

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
const resting = (page) => page.evaluate(() => document.documentElement.hasAttribute('data-rest'))
const restValue = (page) => page.evaluate(() => document.documentElement.getAttribute('data-rest'))
const beat = (page) => page.evaluate(() => document.querySelector('.tv-round')?.getAttribute('data-beat') ?? null)

/** Waits for rest to come on (true) or for `ms` to pass without it (false). */
async function restWithin(page, ms) {
  return page.waitForFunction(() => document.documentElement.hasAttribute('data-rest'), null, { timeout: ms, polling: 50 }).then(
    () => true,
    () => false,
  )
}

/** Waits for the rest to turn deep (true) or for `ms` to pass without it (false). */
async function deepWithin(page, ms) {
  return page.waitForFunction(() => document.documentElement.getAttribute('data-rest') === 'deep', null, { timeout: ms, polling: 50 }).then(
    () => true,
    () => false,
  )
}

/** How long the last rest lasted before it turned deep, from the log (ms). */
const deepAfter = (page) =>
  page.evaluate(() => {
    const log = window.__restLog
    const deep = log.findLastIndex((e) => e.value === 'deep')
    const rest = deep > 0 ? log[deep - 1] : null
    return rest && rest.value === '' ? log[deep].t - rest.t : null
  })

/** Holds still for `ms` and says whether rest came on at any time in between. */
async function restedDuring(page, ms) {
  const from = await page.evaluate(() => window.__restLog.length)
  await page.waitForTimeout(ms)
  return page.evaluate(([i]) => document.documentElement.hasAttribute('data-rest') || window.__restLog.slice(i).some((e) => e.on), [from])
}

/**
 * Every animation on the page: the endless loops still running that are not cues, the cues that are
 * paused, how many loops are paused, and any finite animation that is paused (none may be). In deep
 * rest (`deep`) only the cues of REST_ALIVE may run, and only they count as cues.
 */
async function loops(page, deep = false) {
  return page.evaluate(async (deep) => {
    const { REST_ALIVE, REST_CUES } = await import('/src/ui/design/restCues.ts')
    const cues = deep ? REST_ALIVE : REST_CUES
    const name = (a) => `${a.animationName ?? '?'} på ${a.effect.target.tagName.toLowerCase()}.${[...a.effect.target.classList].join('.')}${a.effect.pseudoElement ?? ''}`
    const out = { loose: [], cuesPaused: [], cuesRunning: 0, paused: 0, finitePaused: [] }
    for (const a of document.getAnimations()) {
      const el = a.effect?.target
      if (!el) continue
      if (a.effect.getComputedTiming().iterations !== Infinity) {
        if (a.playState === 'paused') out.finitePaused.push(name(a))
        continue
      }
      const cue = !a.effect.pseudoElement && cues.some((c) => el.matches(c))
      if (a.playState === 'running') {
        if (cue) out.cuesRunning++
        else out.loose.push(name(a))
      } else if (a.playState === 'paused') {
        out.paused++
        if (cue) out.cuesPaused.push(name(a))
      }
    }
    return out
  }, deep)
}

/** Follows the first endless animation of the first `selector` (a cue) from then on. */
async function pickCue(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const a = el?.getAnimations().find((x) => x.effect.getComputedTiming().iterations === Infinity)
    if (!a) return null
    window.__cue = a
    return a.animationName
  }, selector)
}
const cueNow = (page) => page.evaluate(() => ({ t: window.__cue.currentTime, state: window.__cue.playState }))

/** How a cue looks now: a settle cue (REST_SETTLE) or not, its running loops, its opacity and transform. */
async function cueLook(page, selector) {
  return page.evaluate(async (sel) => {
    const { REST_SETTLE } = await import('/src/ui/design/restCues.ts')
    const el = document.querySelector(sel)
    if (!el) return null
    const loop = el.getAnimations().find((a) => a.effect.getComputedTiming().iterations === Infinity)
    const cs = getComputedStyle(el)
    return {
      settle: REST_SETTLE.some((c) => el.matches(c)),
      loop: loop ? { t: loop.currentTime, state: loop.playState } : null,
      opacity: Number(cs.opacity),
      transform: cs.transform,
    }
  }, selector)
}

/**
 * The rest turns deep by itself DEEP after it began: every cue but the blink stands still too, the
 * cue at `cueSelector` at one currentTime. Returns where that cue stood, for the wake that follows.
 */
async function turnsDeep(page, where, cueSelector) {
  const cue = await pickCue(page, cueSelector)
  check(!!cue, `${where}: har et signal at følge (${cueSelector}: ${cue})`)
  const a0 = cue ? await cueNow(page) : null
  await page.waitForTimeout(300)
  const a1 = cue ? await cueNow(page) : null
  check(
    (await restValue(page)) === '' && a0?.state === 'running' && a1.t > a0.t,
    `${where}: signalet kalder videre i hvilen (${a0?.state}, ${Math.round(a0?.t ?? 0)} → ${Math.round(a1?.t ?? 0)} ms)`,
  )
  const on = await deepWithin(page, DEEP + 4000)
  const after = await deepAfter(page)
  check(on && after !== null && after >= DEEP - 20 && after < DEEP + 2500, `${where}: hvilen bliver dyb af sig selv ${DEEP} ms inde (${after} ms)`)
  if (!on) return null
  await page.waitForTimeout(150)
  const l = await loops(page, true)
  check(
    l.loose.length === 0 && l.cuesPaused.length === 0,
    `${where}: i den dybe hvile kører kun blinket (${l.cuesRunning} blink kører, ${l.paused} loops står stille${l.loose.length ? `; kører stadig: ${[...new Set(l.loose)].slice(0, 6).join(', ')}` : ''}${l.cuesPaused.length ? `; blink står stille: ${l.cuesPaused.slice(0, 3).join(', ')}` : ''})`,
  )
  check(l.finitePaused.length === 0, `${where}: ingen endelig animation er sat på pause i den dybe hvile (${l.finitePaused.slice(0, 4).join(', ') || 'ingen'})`)
  if (!cue) return null
  const look = await cueLook(page, cueSelector)
  if (look?.settle) {
    // it fades out in its loop: it settles on a clearly visible frame instead of pausing anywhere
    await page.waitForTimeout(600)
    const later = await cueLook(page, cueSelector)
    check(
      look.loop === null && later.loop === null && look.opacity >= 0.3 && later.opacity === look.opacity && later.transform === look.transform,
      `${where}: signalet lægger sig synligt fast (${cue}: opacity ${look.opacity} → ${later.opacity}, ${look.transform}, ${look.loop ? `loop ${look.loop.state}` : 'intet loop'})`,
    )
    return { settled: true }
  }
  const b0 = await cueNow(page)
  await page.waitForTimeout(600)
  const b1 = await cueNow(page)
  check(b0.state === 'paused' && b1.t === b0.t, `${where}: signalet står stille (${cue}: ${Math.round(b0.t)} → ${Math.round(b1.t)} ms, ${b0.state})`)
  return b1
}

/** After a tap from deep rest a settled cue pulses again, from the start of its loop. */
async function settledGoesOn(page, where, selector, c) {
  await page.waitForTimeout(300)
  const d = await cueLook(page, selector)
  check(
    c?.loop?.state === 'running' && c.loop.t < 250 && d?.loop?.state === 'running' && d.loop.t > c.loop.t && d.opacity !== c.opacity,
    `${where}: signalet pulserer igen fra begyndelsen (${Math.round(c?.loop?.t ?? -1)} → ${Math.round(d?.loop?.t ?? -1)} ms, opacity ${c?.opacity} → ${d?.opacity})`,
  )
}

/** After a tap from deep rest the cue goes on from where it stood (`c`: read right after the tap). */
async function cueGoesOn(page, where, stood, c) {
  await page.waitForTimeout(300)
  const d = await cueNow(page)
  check(
    c.state === 'running' && Math.abs(c.t - stood.t) < 250 && d.t > c.t,
    `${where}: signalet fortsætter fra samme sted uden hop (${Math.round(stood.t)} → ${Math.round(c.t)} → ${Math.round(d.t)} ms)`,
  )
}

/** Picks one of the animal's endless loops in `scope` (not the blink) and reads it from then on. */
async function pickRigLoop(page, scope) {
  return page.evaluate((sel) => {
    const rig = document.querySelector(`${sel} .rig`)
    if (!rig) return null
    const a = rig
      .getAnimations({ subtree: true })
      .find((x) => x.effect.getComputedTiming().iterations === Infinity && x.effect.target.matches("[class*='a-']:not(.a-blink)"))
    if (!a) return null
    window.__rigLoop = a
    return a.animationName
  }, scope)
}
const rigLoop = (page) => page.evaluate(() => ({ t: window.__rigLoop.currentTime, state: window.__rigLoop.playState }))

/**
 * A point to tap that hits nothing a child could press, with a margin around it: Chromium moves a
 * touch onto a button close by, as a phone does.
 */
async function quietSpot(page) {
  return page.evaluate(() => {
    const busy = 'button, a, input, label, [role="button"], [tabindex], [data-stone], [data-tile], [data-hut], .tv-sheet-root, .tv-dock'
    const free = (x, y) => {
      const el = document.elementFromPoint(x, y)
      return !!el && !el.closest(busy)
    }
    const around = [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40], [-28, -28], [28, -28], [-28, 28], [28, 28]]
    for (const fy of [0.55, 0.45, 0.65, 0.35, 0.75, 0.25, 0.85]) {
      for (const fx of [0.5, 0.06, 0.94, 0.2, 0.8, 0.35, 0.65]) {
        const x = Math.round(innerWidth * fx)
        const y = Math.round(innerHeight * fy)
        if (!around.every(([dx, dy]) => free(x + dx, y + dy))) continue
        const el = document.elementFromPoint(x, y)
        return { x, y, el: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` }
      }
    }
    return null
  })
}

/**
 * On a screen that rests: rest comes on, only cues move, the animal stands still and a tap wakes it
 * without a jump. With `deepCue`, the tap waits for deep rest, and the cue goes on from where it stood.
 */
async function restsAndWakes(page, where, rigScope, deepCue = null) {
  const loop = rigScope ? await pickRigLoop(page, rigScope) : null
  if (rigScope) check(!!loop, `${where}: dyret har et uendeligt loop at følge (${loop})`)
  const t0 = Date.now()
  const on = await restWithin(page, REST + 4000)
  check(on, `${where}: hvilen kommer af sig selv (${Date.now() - t0} ms)`)
  if (!on) return
  await page.waitForTimeout(150)
  const l = await loops(page)
  check(l.loose.length === 0 && (l.paused > 0 || !rigScope), `${where}: under hvilen kører kun cues (${l.paused} loops står stille, ${l.cuesRunning} cues kører${l.loose.length ? `; kører stadig: ${[...new Set(l.loose)].slice(0, 6).join(', ')}` : ''})`)
  check(l.cuesPaused.length === 0, `${where}: ingen cue står stille (${l.cuesPaused.slice(0, 4).join(', ') || 'ingen'})`)
  check(l.finitePaused.length === 0, `${where}: ingen endelig animation er sat på pause (${l.finitePaused.slice(0, 4).join(', ') || 'ingen'})`)
  let b = null
  if (loop) {
    const a = await rigLoop(page)
    await page.waitForTimeout(900)
    b = await rigLoop(page)
    check(a.state === 'paused' && b.t === a.t, `${where}: dyrets ${loop} står stille (currentTime ${Math.round(a.t)} → ${Math.round(b.t)} ms, ${a.state})`)
  }
  const stood = deepCue ? await turnsDeep(page, where, deepCue) : null
  const spot = await quietSpot(page)
  if (!spot) {
    check(false, `${where}: fandt et sted at trykke, der ikke rammer noget`)
    return
  }
  const before = JSON.stringify(await route(page))
  await page.touchscreen.tap(spot.x, spot.y)
  const c = loop ? await rigLoop(page) : null
  const cue = stood?.settled ? await cueLook(page, deepCue) : stood ? await cueNow(page) : null
  const awake = !(await resting(page))
  check(awake, `${where}: et tryk (på ${spot.el}) vækker straks`)
  if (loop) {
    await page.waitForTimeout(400)
    const d = await rigLoop(page)
    check(c.state === 'running' && Math.abs(c.t - b.t) < 250, `${where}: dyret fortsætter fra samme sted uden hop (${Math.round(b.t)} → ${Math.round(c.t)} ms)`)
    check(d.t > c.t + 150, `${where}: dyret bevæger sig igen (${Math.round(c.t)} → ${Math.round(d.t)} ms)`)
  }
  if (stood?.settled) await settledGoesOn(page, where, deepCue, cue)
  else if (stood) await cueGoesOn(page, where, stood, cue)
  await page.waitForTimeout(200)
  const after = JSON.stringify(await route(page))
  const sheet = await page.evaluate(() => document.querySelector('.tv-sheet-root')?.outerHTML.slice(0, 160) ?? null)
  check(after === before && !sheet, `${where}: trykket gjorde ikke andet end at vække (${before}${after !== before ? ` → ${after}` : ''}${sheet ? `; ${sheet}` : ''})`)
}

/** The sky's clouds stand still. */
async function stillSky(page, where) {
  const sky = await page.evaluate(() => {
    const el = document.querySelector('.tv-sky__clouds')
    return el ? el.getAnimations().length : null
  })
  if (sky !== null) check(sky === 0, `${where}: himlens skyer står stille (${sky} animationer)`)
  return sky !== null
}

/** On the map: a mouse that only hovers does not wake it, a finger held still may rest, and dragging it and letting go wake it. */
async function pointerWakes(page) {
  const spot = await quietSpot(page)
  if (!spot) return check(false, 'kortet: fandt et sted at trække, der ikke rammer noget')
  const before = JSON.stringify(await route(page))
  const restAndThen = async (what, act, wakes) => {
    const on = await restWithin(page, REST + 4000)
    await act()
    await page.waitForTimeout(wakes ? 0 : 600)
    const awake = !(await resting(page))
    check(on && awake === wakes, `kortet: ${what} ${wakes ? 'vækker' : 'vækker ikke'} (hvile ${on}, vågen ${awake})`)
  }
  await restAndThen('en mus, der kun svæver,', () => page.mouse.move(spot.x, spot.y, { steps: 2 }), false)
  await page.mouse.down()
  await restAndThen('en finger, der holdes stille og så trækker,', () => page.mouse.move(spot.x + 12, spot.y + 4, { steps: 2 }), true)
  await restAndThen('en finger, der slipper,', () => page.mouse.up(), true)
  await page.waitForTimeout(200)
  const after = JSON.stringify(await route(page))
  check(after === before, `kortet: musen og trækket gjorde ikke andet end at vække (${before}${after !== before ? ` → ${after}` : ''})`)
}

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

/** What needs the player now: a task, a demo film, the intro's tap, teaching or the end of the round. */
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

async function answered(page) {
  await page.waitForFunction(() => {
    const r = document.querySelector('.tv-round')
    return !r || r.getAttribute('data-beat') !== 'asking' || document.querySelector('[data-ceremony]')
  }, null, { timeout: 10000, polling: 50 })
}

/** Starts a round at a stone from its card on the map. */
async function fromStone(page, stone) {
  await tap(page, `[data-stone="${stone}"]`)
  await page.waitForSelector('[data-sheet-play]')
  await page.waitForTimeout(700)
  await tap(page, '[data-sheet-play]')
  await page.waitForSelector('[data-play]', { timeout: 15000 })
}

/**
 * A round at Plusengen's first stone, opened the way a grown-up opens a region (its tasks have the
 * lightbulb): a demo, rest while a task waits for its answer, the lightbulb during the rest, the
 * pause and teaching, then on to the end.
 */
async function round(page) {
  await page.evaluate(async () => {
    const { useProfile } = await import('/src/state/useProfile.ts')
    await useProfile.getState().update((doc) => ({ ...doc, unlocked: { ...doc.unlocked, regions: [...doc.unlocked.regions, 'w0-plus10'] } }))
    window.__restLog.length = 0
  })
  await page.waitForSelector('[data-stone="w0-plus10-l1"]:not([data-state="locked"])', { timeout: 10000 })
  await fromStone(page, 'w0-plus10-l1')
  let demoChecked = false
  let askChecked = false
  let bulbChecked = false
  let pauseChecked = false
  let teachChecked = false
  let firsts = 0
  for (let guard = 0; guard < 120; guard++) {
    const n = await nextThing(page)
    if (n.what === 'ceremony') break
    if (n.what === 'start') {
      await tap(page, '[data-play-start]')
      continue
    }
    if (n.what === 'demo') {
      if (!demoChecked) {
        demoChecked = true
        check(!(await restedDuring(page, REST + 1200)), 'opgaven: ingen hvile mens demo-filmen kører')
      } else await page.waitForTimeout(700)
      await page.mouse.click(10, 300)
      await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 }).catch(() => undefined)
      continue
    }
    if (n.what === 'confirm') {
      if (!teachChecked) {
        teachChecked = true
        check(!(await restedDuring(page, REST + 1200)), 'opgaven: ingen hvile mens strategien vises (teaching)')
      }
      await tap(page, '[data-confirm]')
      await page.waitForSelector('[data-teaching]', { state: 'detached', timeout: 8000 })
      continue
    }
    const t = await drive(page, 'currentTask')
    const first = !n.golden && !t.retryOf
    if (first) firsts++
    if (!askChecked && first) {
      askChecked = true
      await restsAndWakes(page, 'opgaven (asking)', '.tv-round .tv-buddy')
      await stillSky(page, 'opgaven')
    }
    if (!bulbChecked && first && (await page.$('[data-bulb]'))) {
      bulbChecked = true
      // no touch from now on: rest at 1.5 s, the lightbulb at 10 s, and it pulses during the rest
      const on = await restWithin(page, REST + 4000)
      const lit = await page
        .waitForFunction(() => document.querySelector('.tv-round__bulb.is-on'), null, { timeout: 16000, polling: 100 })
        .then(() => true, () => false)
      await page.waitForTimeout(300)
      const bulb = await page.evaluate(() => {
        const el = document.querySelector('.tv-round__bulb.is-on')
        const anims = el ? el.getAnimations().filter((a) => a.effect.getComputedTiming().iterations === Infinity) : []
        const t1 = anims[0]?.currentTime ?? null
        return { rest: document.documentElement.hasAttribute('data-rest'), states: anims.map((a) => a.playState), t1 }
      })
      await page.waitForTimeout(400)
      const t2 = await page.evaluate(() => document.querySelector('.tv-round__bulb.is-on')?.getAnimations()[0]?.currentTime ?? null)
      check(
        on && lit && bulb.rest && bulb.states.length > 0 && bulb.states.every((s) => s === 'running') && t2 > bulb.t1,
        `opgaven: pæren pulserer efter 10 s, også under hvilen (hvile ${bulb.rest}, pære ${lit}, ${bulb.states.join(',') || 'ingen animation'}, ${Math.round(bulb.t1 ?? 0)} → ${Math.round(t2 ?? 0)} ms)`,
      )
      // DEEP into the rest the lightbulb stands still too, and a key (which, unlike a touch on the
      // task, leaves the lightbulb on) lets it pulse on from there
      const stood = await turnsDeep(page, 'opgaven', '.tv-round__bulb.is-on')
      if (stood) {
        await page.keyboard.press('Shift')
        const c = await cueNow(page)
        check(!(await resting(page)), 'opgaven: en tast vækker den dybe hvile')
        await cueGoesOn(page, 'opgaven: pæren', stood, c)
      } else check(false, 'opgaven: pæren blev fulgt ind i den dybe hvile og ud igen')
    }
    if (!pauseChecked && askChecked && first && firsts >= 2) {
      pauseChecked = true
      await tap(page, '.tv-topbar [data-clip="s.ui.close"]')
      await page.waitForSelector('[data-pause]')
      check(!(await restedDuring(page, REST + 1200)), 'opgaven: ingen hvile i pausen')
      await tap(page, '[data-pause] [data-resume]')
      await page.waitForSelector('[data-pause]', { state: 'detached', timeout: 8000 })
      continue
    }
    // one wrong first try, after the rest checks, to see teaching
    const wrong = first && askChecked && !teachChecked && (bulbChecked || firsts >= 4) ? await drive(page, 'wrongFor', t) : null
    await drive(page, 'answer', wrong ?? t.answer)
    await answered(page)
  }
  check(demoChecked, 'opgaven: en demo-film blev vist og tjekket')
  check(askChecked, 'opgaven: hvilen blev tjekket i asking')
  check(bulbChecked, 'opgaven: pæren blev tjekket under hvilen')
  check(teachChecked, 'opgaven: teaching blev tjekket')
  check(pauseChecked, 'opgaven: pausen blev tjekket')
  const log = await page.evaluate(() => window.__restLog)
  const wrongRest = log.filter((e) => e.on && e.where !== 'round:asking').map((e) => e.where)
  check(log.some((e) => e.on) && wrongRest.length === 0, `opgaven: hvilen kom kun i asking (${log.filter((e) => e.on).length} gange${wrongRest.length ? `; også i ${wrongRest.join(', ')}` : ''})`)
}

/** Tællelundens prøve, answered straight through (its end moves on by itself): rest only while asking. */
async function quickRound(page) {
  await page.evaluate(() => {
    window.__restLog.length = 0
  })
  await fromStone(page, 'w0-tal10-trial')
  for (let guard = 0; guard < 120; guard++) {
    const n = await nextThing(page)
    if (n.what === 'ceremony') break
    if (n.what === 'start') await tap(page, '[data-play-start]')
    else if (n.what === 'demo') {
      await page.waitForTimeout(700)
      await page.mouse.click(10, 300)
      await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 }).catch(() => undefined)
    } else if (n.what === 'confirm') {
      await tap(page, '[data-confirm]')
      await page.waitForSelector('[data-teaching]', { state: 'detached', timeout: 8000 })
    } else {
      // every other task waits past the rest time before its answer
      if (guard % 2 === 0) await restWithin(page, REST + 3000)
      const t = await drive(page, 'currentTask')
      await drive(page, 'answer', t.answer)
      await answered(page)
    }
  }
  const log = await page.evaluate(() => window.__restLog)
  const wrongRest = log.filter((e) => e.on && e.where !== 'round:asking').map((e) => e.where)
  check(log.some((e) => e.on) && wrongRest.length === 0, `prøven: hvilen kom kun i asking (${log.filter((e) => e.on).length} gange${wrongRest.length ? `; også i ${wrongRest.join(', ')}` : ''})`)
}

/** The end of the round: the round moves on by itself, the ceremonies never rest, and the screens that move on by themselves still do. */
async function ceremonies(page) {
  await page.evaluate(() => {
    window.__restLog.length = 0
  })
  const reached = await page.waitForSelector('[data-ceremony]', { timeout: 15000 }).then(() => true, () => false)
  check(reached && (await route(page)).id === 'ceremonies', 'turens slut går selv videre til ceremonierne')
  const kinds = []
  let auto = 0
  for (let guard = 0; guard < 40; guard++) {
    const s = await page.evaluate(() => {
      const root = document.querySelector('[data-ceremony]')
      if (!root) return null
      return {
        index: Number(root.getAttribute('data-ceremony')),
        kind: [...root.classList].find((c) => c.startsWith('is-'))?.slice(3) ?? '?',
        end: !!root.querySelector('[data-cer-end]'),
        egg: !!root.querySelector('[data-egg]'),
        pick: !!root.querySelector('[data-cer-pick]'),
        name: !!root.querySelector('[data-name-animal]'),
        tryOn: !!root.querySelector('[data-try-on]'),
      }
    })
    if (!s) break
    kinds.push(s.kind)
    if (s.end) {
      check(!(await restedDuring(page, REST + 1200)), 'ceremonierne: ingen hvile på slutskærmen')
      break
    }
    if (s.kind === 'summary') {
      check(!(await restedDuring(page, REST + 1200)), 'ceremonierne: ingen hvile på "Det lærte du"')
      await tap(page, '[data-cer-next]')
    } else if (s.egg) {
      for (let i = 0; i < 3; i++) {
        await tap(page, '[data-egg]')
        await page.waitForTimeout(250)
      }
      await page.waitForSelector('[data-name-animal]', { timeout: 8000 })
      await tap(page, '[data-name-option]')
      await tap(page, '[data-cer-next]')
    } else if (s.pick) {
      await tap(page, '[data-pick]')
    } else if (s.name) {
      await tap(page, '[data-name-option]')
      await tap(page, '[data-cer-next]')
    } else if (s.tryOn) {
      check(!(await restedDuring(page, REST + 1200)), `ceremonierne: ingen hvile på ${s.kind} med "Prøv den på"`)
      await tap(page, '[data-cer-next]')
    } else {
      // a screen that moves on by itself: no touch until it has
      const moved = await page
        .waitForFunction((i) => Number(document.querySelector('[data-ceremony]')?.getAttribute('data-ceremony')) !== i, s.index, { timeout: 25000, polling: 100 })
        .then(() => true, () => false)
      check(moved, `ceremonierne: ${s.kind} går selv videre uden tryk`)
      if (moved) auto++
      continue
    }
    await page.waitForFunction((i) => Number(document.querySelector('[data-ceremony]')?.getAttribute('data-ceremony')) !== i, s.index, { timeout: 10000, polling: 60 }).catch(() => undefined)
  }
  const rested = await page.evaluate(() => window.__restLog.filter((e) => e.on).map((e) => e.where))
  check(rested.length === 0, `ceremonierne hviler aldrig (${kinds.join(' → ')}${rested.length ? `; hvile på ${rested.join(', ')}` : ''})`)
  console.log(`     ${auto} skærm(e) gik selv videre`)
  autoScreens += auto
  await tap(page, '[data-cer-map]')
  await page.waitForSelector('[data-map-path]', { timeout: 10000 })
}

async function run(browser) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, hasTouch: true })
  // every change of data-rest, with where the app was
  await ctx.addInitScript(() => {
    window.__restLog = []
    const where = () => {
      if (document.querySelector('[data-ceremony]')) return 'ceremony'
      const r = document.querySelector('.tv-round')
      if (r) return `round:${r.getAttribute('data-beat')}${document.querySelector('[data-pause]') ? '+pause' : ''}${document.querySelector('[data-demo-film]') ? '+demo' : ''}`
      if (document.querySelector('[data-map-path]')) return 'map'
      return 'other'
    }
    // on the document (always there, even before <html> is parsed), for <html>'s attribute
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.target !== document.documentElement) continue
        window.__restLog.push({ on: document.documentElement.hasAttribute('data-rest'), value: document.documentElement.getAttribute('data-rest'), where: where(), t: Math.round(performance.now()) })
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-rest'] })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  // ── the map ──
  await newChild(page)
  await page.waitForTimeout(400)
  await restsAndWakes(page, 'kortet', '.tv-pathbuddy', '.tv-stone__halo')
  check(await page.evaluate(() => [...document.querySelectorAll('.tv-backdrop *')].some((el) => el.getAnimations().length > 0)), 'kortet: scenens loops er med i tjekket')
  await pointerWakes(page)

  // ── two rounds, their ceremonies, back on the map ──
  await round(page)
  await ceremonies(page)
  check(await restWithin(page, REST + 4000), 'kortet: hviler igen efter turen')
  await quickRound(page)
  await ceremonies(page)
  check(autoScreens > 0, `ceremonierne går stadig selv videre (${autoScreens} skærm(e) uden tryk)`)

  // ── Dyrehaven ──
  await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().go({ id: 'animals' }))
  await page.waitForSelector('.zoo-cell', { timeout: 15000 })
  // the buddy waves hello for 2.2 s and then stands at ease: follow the loop of the at-ease pose
  await page.waitForTimeout(2800)
  await restsAndWakes(page, 'Dyrehaven', '.zoo-cell')
  check(await stillSky(page, 'Dyrehaven'), 'Dyrehaven: himlen er tjekket')

  // ── "Vælg spiller" ──
  await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().root({ id: 'profiles' }))
  await page.waitForSelector('.tv-picker [data-count]', { timeout: 15000 })
  await restsAndWakes(page, '"Vælg spiller"', null)
  check(await stillSky(page, '"Vælg spiller"'), '"Vælg spiller": himlen er tjekket')

  // ── rest=0 turns it off ──
  await page.goto(`${BASE}?e2e=1&voice=fast&rest=0`, { waitUntil: 'networkidle' })
  await page.waitForFunction(async () => (await import('/src/state/useSession.ts')).useSession.getState().phase === 'ready', null, { timeout: 30000 })
  await page.evaluate(async () => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useNav } = await import('/src/app/nav.ts')
    const s = useSession.getState()
    await s.selectProfile(s.profiles[0].id)
    useNav.getState().root({ id: 'map' })
  })
  await page.waitForSelector('[data-map-path]', { timeout: 30000 })
  check(!(await restWithin(page, REST + 2000)), 'rest=0: kortet hviler ikke')
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
