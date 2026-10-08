// Click-through of the first start on the dev server, from an empty device: the grown-ups' intro,
// the sound check (one wrong tap, then the cat), onboarding (name, egg, three taps, a suggested name,
// the grade) into the first round; then a second child, the picker, the gate (a wrong sum, then the
// right one), "+ Ny spiller" behind the gate, deleting a child, and the sound check's "Tænd for
// lyden" card. Then a family with one child (review P1-1): the dashboard's "Ny spiller" and "Skift
// spiller", the picker with that one child, a sibling through the onboarding, and the switch on the
// map. Only drawn starters are offered, and each egg shows the friend that hatches (P1-2, P2-9).
// Phone (393 x 852) and iPad (820 x 1180). Fails on console errors and on any storage key outside
// the talvennerne2. namespace.
//
// First, 3. klasse with "Vis Pip hvad du kan" on the dev server with ?worlds=all (Stjernefjeldet
// built): Pip's line under the grades, the explanation, the ladder in the task views with friendly
// words after every answer (only neutral ones after a miss), a miss through the strategy, "Det er
// nok", the thanks, and the first round where the ladder put the child (SPEC A24, review app-w3-r1
// P2-4) — three ways: a miss on the way up (P = L5: Hundredemarken), a miss and a step down (P = L4:
// Minusbækken in Engdalen) and all of it (P = L14: Tabeltoppen). Then the map behind it shows that
// world with that stone next, also after a reload and beside a sibling. Also "Spring over", a reload
// in the middle of the ladder (the map, never a hanging screen), 3. klasse before Stjernefjeldet is
// built (as before: Engdalen) and 2. klasse with it built (as before). Pictures: artifacts/place3/.
//   BASE=http://127.0.0.1:4313/ flock /tmp/tv2-chromium.lock node src/ui/screens/child/onboarding/e2e.mjs
// PLACE3_ONLY=1 runs only the 3. klasse part.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:4313/'
const URL_ = `${BASE}?e2e=1&voice=fast`
/** Every world built (dev servers only), so Stjernefjeldet's placement is offered. */
const URL_ALL = `${URL_}&worlds=all`
const OUT = fileURLToPath(new URL('../../../../../artifacts/scr/', import.meta.url))
const REVIEW = process.env.REVIEW ?? `${OUT}review/`
mkdirSync(REVIEW, { recursive: true })
const PLACE3 = process.env.PLACE3_OUT ?? fileURLToPath(new URL('../../../../../artifacts/place3/', import.meta.url))
mkdirSync(PLACE3, { recursive: true })

const fails = []
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) fails.push(what)
}

async function until(page, fn, arg, timeout = 15_000) {
  const end = Date.now() + timeout
  for (;;) {
    const v = await page.evaluate(fn, arg)
    if (v) return v
    if (Date.now() > end) throw new Error(`timeout: ${fn.toString().slice(0, 90)}`)
    await page.waitForTimeout(100)
  }
}

const route = (page) => page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().route)
const voiceLog = (page) => page.evaluate(() => window.__voiceLog ?? [])
const storageKeys = (page) =>
  page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])
const shot = (page, name) => page.screenshot({ path: `${REVIEW}${name}.png` })
/** Let screen transitions and springs settle before a picture. */
const settle = (page, ms = 700) => page.waitForTimeout(ms)
/** The starters the eggs offer (the drawn ones) and every drawn species, as the app sees them. */
const starters = (page) =>
  page.evaluate(async () => ({
    offered: (await import('/src/ui/screens/child/onboarding/flow.ts')).offeredStarters(),
    drawn: (await import('/src/art/species/registry.ts')).AVAILABLE_SPECIES,
  }))
/** Answer the grown-ups' sum on the keypad. */
async function solveGate(page) {
  await page.waitForSelector('.tv-gate')
  await settle(page, 500)
  const [x, y] = (await page.locator('.tv-gate').getAttribute('data-gate')).split('x').map(Number)
  for (const d of String(x * y)) await page.locator(`.tv-gate [data-key="${d}"]`).click()
  await page.locator('.tv-gate [data-key="ok"]').click()
}

async function newPage(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return { context, page, errors }
}

/** Every visible button on the current screen (and an open sheet) is at least 60 x 60 px. */
async function tapTargets(page, tag, where) {
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.tv-screen:not([data-leaving]) button, .tv-sheet button')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      if (r.width < 59.5 || r.height < 59.5) out.push(`${el.className.split(' ')[0] || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return out
  })
  check(small.length === 0, `${tag}: trykmål ≥ 60 px (${where})${small.length ? `: ${small.join(', ')}` : ''}`)
}

/** Every visible button matching `selector` is at least 60 x 60 px. */
async function targetsIn(page, tag, where, selector) {
  const small = await page.evaluate((sel) => {
    const out = []
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      if (r.width < 59.5 || r.height < 59.5) out.push(`${el.className.split(' ')[0] || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return out
  }, selector)
  check(small.length === 0, `${tag}: trykmål ≥ 60 px (${where})${small.length ? `: ${small.join(', ')}` : ''}`)
}

const active = (page) => page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile?.name ?? null)

/** The whole first start, from the empty device into the first round. */
async function firstStart(page, tag, opts = {}) {
  await page.goto(URL_)
  await page.waitForSelector('.tv-intro', { timeout: 30_000 })
  await settle(page)
  await shot(page, `${tag}-1-intro`)
  await tapTargets(page, tag, 'intro')
  check((await route(page)).id === 'parentIntro', `${tag}: tom enhed starter på forældre-intro`)
  check((await page.locator('.tv-intro__card').count()) === 3, `${tag}: intro har tre kort`)

  await page.locator('.tv-intro [data-next]').click()
  await page.waitForSelector('.tv-sound[data-phase="listen"] .tv-sound__card')
  await settle(page)
  check((await voiceLog(page)).includes('s.sound.tapCat'), `${tag}: Pip siger "Tryk på katten"`)
  check((await page.locator('.tv-sound').getByText('Tryk på katten', { exact: false }).count()) === 0, `${tag}: instruktionen står ikke som tekst`)
  await shot(page, `${tag}-2-sound`)
  await tapTargets(page, tag, 'lydtjek')

  // one wrong tap: the cards are dealt again and Pip asks once more
  const other = page.locator('.tv-sound__card:not([data-species="cat"])')
  await other.click()
  await until(page, () => (window.__voiceLog ?? []).includes('s.sound.listen'))
  check((await page.locator('.tv-sound').getAttribute('data-phase')) === 'listen', `${tag}: et forkert tryk giver et nyt forsøg`)
  await page.locator('.tv-sound__card[data-species="cat"]').click()
  await page.waitForSelector('.tv-sound[data-phase="passed"]')
  const boot = await page.evaluate(() => JSON.parse(localStorage.getItem('talvennerne2.boot') ?? '{}'))
  check(boot.device?.audioVerified === true, `${tag}: katten giver audioVerified = true`)
  await settle(page, 400)
  await page.locator('.tv-sound [data-next]').click()

  // onboarding: the name
  await page.waitForSelector('.tv-onb[data-step="name"]')
  check((await route(page)).id === 'onboarding', `${tag}: lydtjek fører til onboarding`)
  check((await voiceLog(page)).includes('s.onb.hello'), `${tag}: Pip siger hej`)
  await page.locator('[data-name-input]').fill('Ida')
  await settle(page, 300)
  await shot(page, `${tag}-3-name`)
  await tapTargets(page, tag, 'navn')
  await page.locator('.tv-onb [data-next]').click()

  // the egg: only drawn starters, each baby in the breed and colour it hatches with
  await page.waitForSelector('.tv-onb[data-step="egg"] .tv-eggbtn')
  const { offered, drawn } = await starters(page)
  const eggs = await page.locator('.tv-eggbtn').evaluateAll((els) => els.map((e) => e.getAttribute('data-species')))
  check(eggs.join() === offered.join() && eggs.every((s) => drawn.includes(s)) && eggs.includes('cat'), `${tag}: kun tegnede startdyr i æggene (${eggs.join(', ')})`)
  await settle(page, 900)
  await shot(page, `${tag}-4-eggs`)
  await tapTargets(page, tag, 'æg')
  const catEgg = await page.locator('.tv-eggbtn[data-species="cat"]').evaluate((e) => ({ breed: e.getAttribute('data-breed'), colorway: e.getAttribute('data-colorway') }))
  await page.locator('.tv-eggbtn[data-species="cat"]').click()
  await page.waitForSelector('.tv-hatchbtn[data-hatch="0"]')
  check(!(await page.evaluate(async () => (await import('/src/state/useSession.ts')).useSession.getState().profiles.length)), `${tag}: intet barn før ægget knækker`)
  for (let i = 0; i < 3; i++) {
    await page.locator('.tv-hatchbtn').click()
    await page.waitForTimeout(250)
  }
  await page.waitForSelector('.tv-hatchbtn[data-hatch="done"]')
  await settle(page, 1100)
  await shot(page, `${tag}-5-hatched`)
  await tapTargets(page, tag, 'klækket')
  const kid = await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile)
  check(kid?.name === 'Ida' && kid.animals[0]?.species === 'cat' && kid.buddyUid === kid.animals[0]?.uid, `${tag}: barnet oprettes ved klækningen med katten som ven`)
  check(
    kid?.animals[0]?.breed === catEgg.breed && kid?.animals[0]?.colorway === catEgg.colorway,
    `${tag}: ægget viste den kat, der kom ud (${catEgg.breed} ${catEgg.colorway} → ${kid?.animals[0]?.breed} ${kid?.animals[0]?.colorway})`,
  )
  await page.locator('.tv-onb [data-next]').click()

  // the friend's name: six suggestions read aloud
  await page.waitForSelector('.tv-onb[data-step="friend"] .tv-name[data-name]')
  check((await page.locator('.tv-name[data-name]').count()) === 6, `${tag}: seks navneforslag`)
  await until(page, () => (window.__voiceLog ?? []).filter((c) => c.startsWith('name.animal.')).length >= 6)
  check(true, `${tag}: forslagene læses op`)
  let chosen
  if (opts.write) {
    // "Skriv selv": the system keyboard, at most 14 characters
    await page.locator('[data-write]').click()
    await page.waitForSelector('[data-friend-input]')
    await settle(page, 500)
    await page.locator('[data-friend-input]').fill(opts.write)
    await page.locator('.tv-onb__write button[type="submit"]').click()
    await page.waitForSelector('.tv-name--custom.is-selected')
    chosen = await page.locator('.tv-name--custom').getAttribute('data-name')
    check(chosen === opts.write.slice(0, 14).trim(), `${tag}: et skrevet navn bliver valgt (${chosen})`)
  } else {
    const second = page.locator('.tv-name[data-name]').nth(1)
    chosen = await second.getAttribute('data-name')
    await second.click()
  }
  await settle(page, 400)
  await shot(page, `${tag}-6-friend`)
  await tapTargets(page, tag, 'vennens navn')
  await page.locator('.tv-onb [data-next]').click()

  // the grade, then the first round
  await page.waitForSelector('.tv-onb[data-step="grade"] .tv-grade')
  await page.locator('.tv-grade[data-grade="1"]').click()
  await settle(page, 300)
  check(await page.locator('.tv-onb [data-grade-start]').isVisible(), `${tag}: klassetrinnet står med "Alle starter i Engdalen."`)
  await until(page, () => (window.__voiceLog ?? []).includes('s.onb.grade.start'))
  check(true, `${tag}: Pip siger, at alle starter i Engdalen`)
  await shot(page, `${tag}-7-grade`)
  await tapTargets(page, tag, 'klassetrin')
  await page.locator('.tv-onb [data-next]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round')
  const nav = await page.evaluate(async () => {
    const s = (await import('/src/app/nav.ts')).useNav.getState()
    return { route: s.route, stack: s.stack }
  })
  check(nav.route.node === 'w0-tal10-l1' && nav.stack.length === 1 && nav.stack[0].id === 'map', `${tag}: første tur i Engdalen oven på kortet`)
  const stored = await page.evaluate(async () => {
    const { listProfiles } = await import('/src/data/repo/profiles.ts')
    return (await listProfiles()).map((p) => ({ name: p.name, grade: p.grade, animal: p.animals[0]?.name, species: p.animals[0]?.species, regions: p.unlocked.regions }))
  })
  check(stored.length === 1 && stored[0].grade === 1 && stored[0].animal === chosen && stored[0].species === 'cat', `${tag}: profilen er gemt med klassetrin og vennens navn (${chosen})`)
  check(stored[0]?.regions.length === 4, `${tag}: 1. klasse åbner resten af Engdalen (${stored[0]?.regions.join(', ')})`)
}

/**
 * A family with one child (review P1-1): the app goes straight to the map, the grown-ups' area has
 * "Ny spiller" and "Skift spiller", the picker shows the one child and "+ Ny spiller" behind the
 * gate, a sibling comes through the onboarding (the egg shows the friend that hatches), and with two
 * children the map has the child's letter to switch, without the gate.
 */
async function oneChildThenSibling(tag, viewport) {
  const { page, context, errors } = await newPage(browser, viewport)
  await page.goto(URL_)
  await page.waitForSelector('.tv-intro', { timeout: 30_000 })
  await page.evaluate(async () => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useMeta } = await import('/src/state/useMeta.ts')
    const { useProfile } = await import('/src/state/useProfile.ts')
    useSession.getState().setAudioVerified(true)
    await useSession.getState().createProfile({ name: 'Ida', grade: 0 })
    useMeta.getState().chooseStarter('cat')
    await useProfile.getState().flush()
  })
  await page.goto(URL_)
  await page.waitForSelector('.tv-map [data-map-path]', { timeout: 30_000 })
  await settle(page, 900)
  check((await route(page)).id === 'map', `${tag}: ét barn går direkte til kortet`)
  check((await page.locator('.tv-map [data-switch-player]').count()) === 0, `${tag}: med ét barn er der intet skift på kortet`)

  // the grown-ups' area with one child: "Skift spiller" and "Ny spiller"
  await page.locator('.tv-map .tv-topbar [data-clip="s.ui.adult"]').click()
  await solveGate(page)
  await page.waitForSelector('.tv-dash [data-new-player]')
  await settle(page)
  check(
    (await page.locator('.tv-dash [data-switch-player]').isVisible()) && (await page.locator('.tv-dash [data-new-player]').isVisible()),
    `${tag}: dashboardet har "Skift spiller" og "Ny spiller" med ét barn`,
  )
  await targetsIn(page, tag, 'dashboardets top', '.tv-dash__head button')
  await shot(page, `${tag}-20-dash-one`)

  // "Ny spiller" opens the onboarding; its back arrow returns to the dashboard with Ida
  await page.locator('.tv-dash [data-new-player]').click()
  await page.waitForSelector('.tv-onb[data-step="name"]')
  check((await route(page)).id === 'onboarding', `${tag}: "Ny spiller" åbner onboarding`)
  await settle(page)
  await page.locator('.tv-onb .tv-topbar [data-clip="s.ui.back"]').click()
  await page.waitForSelector('.tv-dash [data-switch-player]')
  await settle(page)
  check((await route(page)).id === 'parent' && (await active(page)) === 'Ida', `${tag}: tilbage fra onboarding giver dashboardet med Ida`)

  // "Skift spiller": the picker, with the one child and "+ Ny spiller"
  await page.locator('.tv-dash [data-switch-player]').click()
  await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
  await settle(page, 900)
  check((await route(page)).id === 'profiles', `${tag}: "Skift spiller" viser vælgeren`)
  check(
    (await page.locator('.tv-pcard[data-profile]').count()) === 1 && (await page.locator('[data-add-player]').count()) === 1,
    `${tag}: vælgeren viser det ene barn og "+ Ny spiller"`,
  )
  check((await active(page)) === null, `${tag}: ingen spiller er indlæst i vælgeren`)
  await tapTargets(page, tag, 'vælger med ét barn')
  await shot(page, `${tag}-21-picker-one`)

  // "+ Ny spiller" behind the gate: a sibling through the onboarding
  await page.locator('[data-add-player]').click()
  await solveGate(page)
  await page.waitForSelector('.tv-onb[data-step="name"]')
  await settle(page)
  await page.locator('[data-name-input]').fill('Bo')
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="egg"] .tv-eggbtn')
  await settle(page, 900)
  await shot(page, `${tag}-22-eggs`)
  const egg = page.locator('.tv-eggbtn').first()
  const look = await egg.evaluate((e) => ({ species: e.getAttribute('data-species'), breed: e.getAttribute('data-breed'), colorway: e.getAttribute('data-colorway') }))
  await egg.click()
  await page.waitForSelector('.tv-hatchbtn[data-hatch="0"]')
  for (let i = 0; i < 3; i++) {
    await page.locator('.tv-hatchbtn').click()
    await page.waitForTimeout(250)
  }
  await page.waitForSelector('.tv-hatchbtn[data-hatch="done"]')
  await settle(page, 1100)
  const bo = await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile)
  check(
    bo?.name === 'Bo' && bo.animals[0]?.species === look.species && bo.animals[0]?.breed === look.breed && bo.animals[0]?.colorway === look.colorway,
    `${tag}: Bos ${look.species} kommer ud i den race og farve, ægget viste (${look.breed} ${look.colorway})`,
  )
  check((await page.locator('.tv-hatch .tv-critter').count()) === 0, `${tag}: ingen pladsholder i ægget`)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="friend"] .tv-name[data-name]')
  await settle(page, 400)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="grade"] .tv-grade')
  await page.locator('.tv-grade[data-grade="2"]').click()
  await settle(page, 400)
  await shot(page, `${tag}-23-grade`)
  await page.locator('.tv-onb [data-next]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round', undefined, 20_000)
  check(true, `${tag}: Bo kommer gennem onboarding til sin første tur`)

  // two children: a new start shows the picker, and Ida's map has her letter to switch, without the gate
  await page.goto(URL_)
  await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
  await settle(page, 900)
  check((await page.locator('.tv-pcard[data-profile]').count()) === 2, `${tag}: to børn giver vælgeren ved start`)
  await page.locator('.tv-pcard[aria-label="Ida"]').click()
  await page.waitForSelector('.tv-map [data-switch-player]')
  await settle(page, 900)
  check((await active(page)) === 'Ida', `${tag}: Ida spiller`)
  await targetsIn(page, tag, 'kortets topbjælke med skift', '.tv-map .tv-topbar button')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(overflow <= 1, `${tag}: ingen vandret rulning på kortet med skift (${overflow} px)`)
  await shot(page, `${tag}-24-map-switch`)
  await page.locator('.tv-map [data-switch-player]').click()
  await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
  await settle(page, 700)
  check((await route(page)).id === 'profiles' && (await page.locator('.tv-gate').count()) === 0, `${tag}: skift fra kortet uden voksen-port`)
  check((await active(page)) === null, `${tag}: Ida er gemt og lagt væk ved skiftet`)
  check((await voiceLog(page)).includes('s.profiles.title'), `${tag}: skiftet siger "Hvem skal spille?"`)
  await page.locator('.tv-pcard[aria-label="Ida"]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'map')
  check((await active(page)) === 'Ida', `${tag}: tilbage på kortet med Ida`)

  const keys = await storageKeys(page)
  check(keys.every((k) => k.startsWith('talvennerne2.')), `${tag}: kun talvennerne2.-nøgler (${keys.join(', ')})`)
  check(errors.length === 0, `${tag}: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  await context.close()
}

// ── 3. klasse: "Vis Pip hvad du kan" (SPEC §8) ───────────────────────────────

const placeShot = (page, name) => page.screenshot({ path: `${PLACE3}${name}.png` })
/** The ladder's state as the screen has it (onboarding/placement/store.ts). */
const ladder = (page) =>
  page.evaluate(async () => {
    const s = (await import('/src/ui/screens/child/onboarding/placement/store.ts')).usePlacement.getState()
    return { status: s.status, task: s.task, asked: s.session?.run.asked ?? 0, done: s.session?.run.done ?? false, stone: s.stone }
  })
/** The loaded child, and the stone the map itself suggests in the child's home world. */
const childNow = (page) =>
  page.evaluate(async () => {
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { homeWorld, mapModel } = await import('/src/ui/screens/child/map/model.ts')
    const { answersBetween } = await import('/src/data/repo/answers.ts')
    const p = useProfile.getState().profile
    const world = homeWorld(p)
    const keys = Object.values(p.keys)
    const log = await answersBetween(p.id, 0)
    return {
      id: p.id, grade: p.grade, placement: p.placement, world, next: mapModel(p, world).next, worlds: p.unlocked.worlds,
      seeded: keys.filter((k) => k.seeded).length, aboveBox2: keys.filter((k) => k.box > 2).length,
      log: log.map((a) => a.mode), perler: p.economy.perler, xp: p.economy.xp, rewards: p.rewardLog.length,
    }
  })
const clipTextIn = (page, id) => page.evaluate(async (c) => (await import('/src/speech/catalog.ts')).clipText(c), id)

/** From an empty device (sound already checked) to the grade step, with `grade` tapped. */
async function toGrade(page, url, name, grade) {
  await page.goto(url)
  await page.waitForSelector('.tv-intro', { timeout: 30_000 })
  await page.evaluate(() =>
    localStorage.setItem('talvennerne2.boot', JSON.stringify({ v: 1, profileIds: [], lastProfileId: null, device: { followSilentSwitch: false, audioVerified: true, calm: false } })),
  )
  await page.reload()
  await page.waitForSelector('.tv-intro')
  await page.locator('.tv-intro [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="name"]')
  await page.locator('[data-name-input]').fill(name)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="egg"] .tv-eggbtn')
  await settle(page, 500)
  await page.locator('.tv-eggbtn').first().click()
  await page.waitForSelector('.tv-hatchbtn[data-hatch="0"]')
  for (let i = 0; i < 3; i++) {
    await page.locator('.tv-hatchbtn').click()
    await page.waitForTimeout(250)
  }
  await page.waitForSelector('.tv-hatchbtn[data-hatch="done"]')
  await settle(page, 900)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="friend"] .tv-name[data-name]')
  await settle(page, 300)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="grade"] .tv-grade')
  await settle(page, 300)
  await page.locator(`.tv-grade[data-grade="${grade}"]`).click()
  await settle(page, 500)
}

/** The question on screen, typed on the keypad: right, or one too many. */
async function answerLadder(page, tag, right) {
  const before = await ladder(page)
  const t = before.task
  check(t?.kind === 'keypad', `${tag}: stigen spørger med tastaturet (${t?.skill} ${t?.factId})`)
  for (const d of String(right ? t.answer : t.answer + 1)) await page.locator(`.tv-round__answer [data-key="${d}"]`).click()
  await page.locator('.tv-round__answer [data-check]').click()
  await until(page, async (n) => (await import('/src/ui/screens/child/onboarding/placement/store.ts')).usePlacement.getState().session?.run.asked === n, before.asked + 1)
  return t
}

/** The question after `id` is on screen (its stage is keyed by the task) and has been read. */
const nextQuestion = (page, id) =>
  until(page, async (prev) => {
    const s = (await import('/src/ui/screens/child/onboarding/placement/store.ts')).usePlacement.getState()
    const beat = document.querySelector('.tv-place .tv-round__stage')?.getAttribute('data-beat')
    return !!s.task && s.task.id !== prev && beat === 'asking'
  }, id)

/**
 * How a child answers the ladder, and where the first round must start then (SPEC A24): P, the
 * stone, and its world. `answers` null: everything right.
 */
const PLANS = {
  // L5 right, right → L7 right, a miss → a step down to L6: right, then "Det er nok". P = L5
  mixed: { answers: [true, true, true, false, true], enough: true, P: 'L5', stone: 'w1-tal100-l1', world: 'bakke' },
  // L5 right, a miss → a step down to L4: right, right, and the ladder ends by itself. P = L4: minus inden for 10
  minus: { answers: [true, false, true, true], enough: false, P: 'L4', stone: 'w0-minus10-l1', world: 'eng' },
  // everything right: P = L14, and Tabeltoppen as before
  all: { answers: null, enough: false, P: 'L14', stone: 'w3-tabellen-l1', world: 'fjeld' },
}

/** A question that says nothing about its rung (review app-w3-r1 P3-8): with 0 or 1, nothing left, or times 1. */
const trivialFact = (id) => /^(add:[01]\+|add:\d+\+[01]$|sub:\d+-[01]$|mul:1x)/.test(id) || /^sub:(\d+)-\1$/.test(id)

/** The map on screen: its world and its suggested next stone. */
const mapOnScreen = (page) =>
  page.evaluate(() => ({ world: document.querySelector('.tv-map')?.getAttribute('data-world'), next: document.querySelector('[data-stone][data-next]')?.getAttribute('data-stone') }))

/** The map after a reload or a switch: a stored round is resumed first, so ✕ → "Til kortet". Returns the round resumed, if any. */
async function mapThroughRound(page) {
  await until(page, async () => ['round', 'map'].includes((await import('/src/app/nav.ts')).useNav.getState().route.id), undefined, 30_000)
  const resumed = await route(page)
  if (resumed.id === 'round') {
    // after a reload the intro waits for one tap ("Fortsæt turen"), which wakes the sound
    await page.waitForSelector('.tv-play [data-play-start], .tv-round[data-status]:not(.tv-place)', { timeout: 30_000 })
    if ((await page.locator('.tv-play [data-play-start]').count()) > 0) await page.locator('.tv-play [data-play-start]').click()
    await page.waitForSelector('.tv-round[data-status]:not(.tv-place)', { timeout: 30_000 })
    await settle(page, 1000)
    await page.locator('.tv-round:not(.tv-place) .tv-topbar [data-clip="s.ui.close"]').click()
    await page.waitForSelector('[data-pause] [data-leave]')
    await page.locator('[data-pause] [data-leave]').click()
  }
  await page.waitForSelector('.tv-map [data-map-path]', { timeout: 30_000 })
  await settle(page, 1200)
  return resumed.id === 'round' ? resumed : null
}

/**
 * The whole 3. klasse onboarding with the ladder (dev, ?worlds=all): the grade line, the explanation,
 * the ladder answered by `plan` (a miss goes through the strategy), the thanks, and the first round
 * where the ladder put the child; then ✕ → "Til kortet", a reload and (`sibling`) a second child:
 * each time the map shows the child's world with that stone next.
 */
async function thirdGrade(tag, viewport, plan = PLANS.mixed, opts = {}) {
  const { page, context, errors } = await newPage(browser, viewport)
  await toGrade(page, URL_ALL, 'Asta', 3)
  await until(page, () => document.querySelector('[data-grade-start]')?.getAttribute('data-grade-start') === 's.place.grade')
  const gradeLine = await clipTextIn(page, 's.place.grade')
  check((await page.locator('[data-grade-start]').innerText()).trim() === gradeLine, `${tag}: under klassetrinnene står "${gradeLine}"`)
  check((await page.locator('.tv-onb').getByText('Alle starter i Engdalen').count()) === 0, `${tag}: ikke "Alle starter i Engdalen" for 3. kl.`)
  await until(page, () => (window.__voiceLog ?? []).includes('s.place.grade'))
  check(!(await voiceLog(page)).slice(-3).includes('s.onb.grade.start'), `${tag}: Pip siger den nye linje efter "Tredje klasse"`)
  await placeShot(page, `${tag}-1-grade`)
  await tapTargets(page, tag, 'klassetrin (3. kl.)')

  // the explanation: not a test, stop when you like; start or skip, two equal buttons
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-place[data-place="intro"] [data-place-start]')
  await until(page, () => (window.__voiceLog ?? []).includes('s.place.intro.stop'))
  check((await voiceLog(page)).includes('s.place.intro'), `${tag}: Pip forklarer, at det ikke er en prøve`)
  const [a, b] = await Promise.all(['[data-place-start]', '[data-place-skip]'].map((s) => page.locator(s).boundingBox()))
  check(Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, `${tag}: "Vis Pip, hvad du kan" og "Spring over" er lige store`)
  await settle(page, 600)
  await placeShot(page, `${tag}-2-intro`)
  await tapTargets(page, tag, 'forklaringen')
  const bank = await childNow(page)
  check(bank.grade === 0, `${tag}: intet skrevet, før stigen starter`)

  // the ladder: the round's task views, Pip, "Det er nok"; no stone path, no stars, no praise
  await page.locator('[data-place-start]').click()
  await page.waitForSelector('.tv-place[data-place="ladder"] .tv-round__stage')
  await until(page, () => document.querySelector('.tv-place .tv-round__stage')?.getAttribute('data-beat') === 'asking')
  const first = (await ladder(page)).task
  check(first?.skill === 'addTo20', `${tag}: stigen starter ved L5 (${first?.skill})`)
  check((await childNow(page)).grade === 3, `${tag}: klassetrinnet er skrevet, da stigen startede`)
  check((await page.locator('.tv-place [data-enough]').isVisible()) && (await page.locator('.tv-place .tv-stones').count()) === 0, `${tag}: "Det er nok" og ingen stensti`)
  await settle(page, 400)
  await placeShot(page, `${tag}-3-question`)
  await tapTargets(page, tag, 'stigen')
  // "Hør igen" reads the question again (and the later questions are still read and asked)
  const before = (await voiceLog(page)).length
  await page.locator('.tv-place .tv-topbar [data-clip="s.ui.replay"]').click()
  await until(page, (n) => (window.__voiceLog ?? []).length > n, before)
  check(true, `${tag}: "Hør igen" læser spørgsmålet igen`)
  const heard = (await voiceLog(page)).length

  // the answers: a miss goes through the strategy and the big button with the right answer (SPEC
  // §3.5), never logged; the words after it are neutral (review P3-9)
  const asked = []
  const afterMiss = []
  let followed = 0
  for (let i = 0; plan.answers === null || i < plan.answers.length; i++) {
    const right = plan.answers === null || plan.answers[i]
    const t = await answerLadder(page, tag, right)
    asked.push(t)
    if (i === 0 && right) {
      await until(page, () => (window.__voiceLog ?? []).some((c) => c.startsWith('s.place.next.')))
      await settle(page, 250)
      await placeShot(page, `${tag}-4-thanks`)
    }
    if (!right) {
      await page.waitForSelector('[data-teaching] [data-confirm]', { timeout: 10_000 })
      await settle(page, 500)
      await placeShot(page, `${tag}-5-miss`)
      const said = (await voiceLog(page)).length
      await page.locator('[data-teaching] [data-confirm]').click({ force: true })
      if ((await ladder(page)).done) break
      await nextQuestion(page, t.id)
      afterMiss.push(...(await voiceLog(page)).slice(said).filter((c) => c.startsWith('s.place.next.')))
      const next = (await ladder(page)).task
      if (plan === PLANS.mixed) check(next?.skill === 'subTo20', `${tag}: efter en fejl i springfasen går stigen et trin ned (L6, ${next?.skill})`)
      if (plan === PLANS.minus) check(next?.skill === 'subTo10', `${tag}: efter en fejl i springfasen går stigen et trin ned (L4, ${next?.skill})`)
    } else {
      if ((await ladder(page)).done) break
      await nextQuestion(page, t.id)
    }
    followed++
  }
  const said = (await voiceLog(page)).slice(heard)
  const words = said.filter((c) => c.startsWith('s.place.next.'))
  check(words.length >= followed, `${tag}: venlige ord efter hvert svar (${words.join(', ')})`)
  if (plan.answers?.includes(false)) {
    check(afterMiss.length > 0 && afterMiss.every((c) => c === 's.place.next.2'), `${tag}: efter en fejl kun neutrale ord, "Tak! Her er den næste." (${afterMiss.join(', ')})`)
  }
  check(!said.some((c) => c.startsWith('s.round.praise.') || c === 's.round.combo.five' || c === 's.round.done'), `${tag}: ingen ros, ingen "rigtigt"`)
  check((await page.locator('.tv-fx, .tv-perfect').count()) === 0, `${tag}: ingen stjerner eller konfetti`)
  const trivial = asked.filter((t) => trivialFact(t.factId)).map((t) => t.factId)
  check(trivial.length === 0, `${tag}: ingen spørgsmål med 0 eller 1 (${asked.map((t) => t.factId).join(', ')})`)

  // "Det er nok" (or the last rung): what was shown counts
  if (plan.enough) await page.locator('.tv-place [data-enough]').click()
  await page.waitForSelector('.tv-place[data-place="outro"]')
  await until(page, async () => (await import('/src/ui/screens/child/onboarding/placement/store.ts')).usePlacement.getState().status === 'over')
  await until(page, () => (window.__voiceLog ?? []).includes('s.place.done'))
  check(await page.locator('.tv-place [data-next]').isEnabled(), `${tag}: "Spil" efter tak`)
  const kid = await childNow(page)
  check(kid.placement.done && kid.placement.highest === plan.P, `${tag}: indplaceringen er gemt med P = ${plan.P} (${JSON.stringify(kid.placement)})`)
  check(kid.seeded > 0 && kid.aboveBox2 === 0, `${tag}: ${kid.seeded} nøgler i boks 2 som seeded, ingen over`)
  check(kid.log.length === asked.length && kid.log.every((m) => m === 'placement'), `${tag}: ${asked.length} svar logget som placement, bekræftelsen ikke (${kid.log.join(', ')})`)
  check(
    kid.perler === bank.perler && kid.xp === bank.xp && kid.rewards === bank.rewards,
    `${tag}: stigen giver ingen perler, ingen XP og ingen belønninger (${bank.perler}/${bank.xp}/${bank.rewards} → ${kid.perler}/${kid.xp}/${kid.rewards})`,
  )
  await settle(page, 600)
  await placeShot(page, `${tag}-6-thanks`)
  await tapTargets(page, tag, 'tak')

  // "Spil": the first round, where the ladder put the child: the map's own next stone in that world
  await page.locator('.tv-place [data-next]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round', undefined, 20_000)
  const nav = await page.evaluate(async () => {
    const s = (await import('/src/app/nav.ts')).useNav.getState()
    return { route: s.route, stack: s.stack }
  })
  const now = await childNow(page)
  check(nav.route.node === plan.stone && now.world === plan.world && now.next === plan.stone, `${tag}: første tur på ${plan.stone} i ${plan.world}, kortets næste sten (${nav.route.node} i ${now.world}, næste ${now.next})`)
  check(nav.stack.length === 1 && nav.stack[0].id === 'map', `${tag}: turen ligger oven på kortet`)
  await page.waitForSelector('.tv-round[data-status]:not(.tv-place)', { timeout: 20_000 })
  await settle(page, 1200)
  await placeShot(page, `${tag}-7-round`)

  // ✕ → "Til kortet": the map of that world, with the stone as its next one
  await page.locator('.tv-round:not(.tv-place) .tv-topbar [data-clip="s.ui.close"]').click()
  await page.waitForSelector('[data-pause] [data-leave]')
  await page.locator('[data-pause] [data-leave]').click()
  await page.waitForSelector('.tv-map [data-map-path]')
  await settle(page, 1200)
  const map = await mapOnScreen(page)
  check(map.world === plan.world && map.next === plan.stone, `${tag}: kortet viser ${map.world} med ${map.next} som næste sten`)
  await placeShot(page, `${tag}-8-map`)

  // a reload: the stored round goes on on the same stone, and ✕ → "Til kortet" shows the same world
  await page.reload()
  const resumed = await mapThroughRound(page)
  check(resumed?.node === plan.stone && resumed?.resume === true, `${tag}: genindlæst fortsætter turen på ${plan.stone} (${JSON.stringify(resumed)})`)
  const reloaded = await mapOnScreen(page)
  check(reloaded.world === plan.world && reloaded.next === plan.stone, `${tag}: efter genindlæsning viser kortet ${reloaded.world} med ${reloaded.next} som næste sten`)

  if (opts.sibling) {
    // a sibling in 3. klasse who skipped the ladder: each child's map follows its own start
    await page.evaluate(async () => {
      const { useSession } = await import('/src/state/useSession.ts')
      const { useMeta } = await import('/src/state/useMeta.ts')
      const { useProfile } = await import('/src/state/useProfile.ts')
      await useSession.getState().createProfile({ name: 'Bo', grade: 3 })
      useMeta.getState().chooseStarter('rabbit')
      await useProfile.getState().flush()
    })
    await page.goto(URL_ALL)
    await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
    await settle(page, 900)
    await page.locator('.tv-pcard[aria-label="Bo"]').click()
    await mapThroughRound(page)
    const bo = await childNow(page)
    const boMap = await mapOnScreen(page)
    check(!bo.placement.done && boMap.world === bo.world && boMap.next === bo.next && bo.world !== plan.world, `${tag}: søskendet Bo (uden stige) ser sit eget kort: ${boMap.world}, ${boMap.next}`)
    await page.locator('.tv-map [data-switch-player]').click()
    await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
    await settle(page, 700)
    await page.locator('.tv-pcard[aria-label="Asta"]').click()
    await mapThroughRound(page)
    const back = await mapOnScreen(page)
    check(back.world === plan.world && back.next === plan.stone, `${tag}: tilbage hos Asta: ${back.world} med ${back.next} som næste sten`)
    await placeShot(page, `${tag}-9-sibling`)
  }

  const keys = await storageKeys(page)
  check(keys.every((k) => k.startsWith('talvennerne2.')), `${tag}: kun talvennerne2.-nøgler (${keys.join(', ')})`)
  check(errors.length === 0, `${tag}: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  await context.close()
}

/** "Spring over" at once, and a reload in the middle of the ladder (the map, as skipped). */
async function thirdGradeSkipAndReload(tag, viewport) {
  {
    const { page, context, errors } = await newPage(browser, viewport)
    await toGrade(page, URL_ALL, 'Bo', 3)
    await until(page, () => document.querySelector('[data-grade-start]')?.getAttribute('data-grade-start') === 's.place.grade')
    await page.locator('.tv-onb [data-next]').click()
    await page.waitForSelector('[data-place-skip]')
    await settle(page, 400)
    await page.locator('[data-place-skip]').click()
    await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round', undefined, 20_000)
    const node = (await route(page)).node
    const kid = await childNow(page)
    check(node === kid.next && node !== 'w0-tal10-l1', `${tag}: "Spring over" giver første tur på kortets næste sten (${node})`)
    check(kid.grade === 3 && !kid.placement.done && kid.seeded === 0 && kid.log.length === 0, `${tag}: "Spring over" skriver kun klassetrinnet`)
    check(errors.length === 0, `${tag}: 0 konsolfejl (spring over)${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }
  {
    const { page, context, errors } = await newPage(browser, viewport)
    await toGrade(page, URL_ALL, 'Cille', 3)
    await until(page, () => document.querySelector('[data-grade-start]')?.getAttribute('data-grade-start') === 's.place.grade')
    await page.locator('.tv-onb [data-next]').click()
    await page.waitForSelector('[data-place-start]')
    await page.locator('[data-place-start]').click()
    await page.waitForSelector('.tv-place[data-place="ladder"] .tv-round__stage')
    await until(page, () => document.querySelector('.tv-place .tv-round__stage')?.getAttribute('data-beat') === 'asking')
    await answerLadder(page, tag, true)
    await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().flush())
    await page.reload()
    await page.waitForSelector('.tv-map [data-map-path]', { timeout: 30_000 })
    await settle(page, 1200)
    const kid = await childNow(page)
    check((await route(page)).id === 'map', `${tag}: genindlæst midt i stigen lander barnet på kortet`)
    check(kid.grade === 3 && !kid.placement.done && kid.seeded === 0, `${tag}: stigen tæller som sprunget over (klassetrin 3, intet seedet)`)
    const map = await page.evaluate(() => document.querySelector('[data-stone][data-next]')?.getAttribute('data-stone'))
    check(map === kid.next, `${tag}: kortet foreslår ${map}`)
    await placeShot(page, `${tag}-9-reload`)
    check(errors.length === 0, `${tag}: 0 konsolfejl (genindlæsning)${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }
}

/** No ladder: as before, "Alle starter i Engdalen." and the first round in Tællelunden. */
async function noLadder(tag, viewport, url, grade) {
  const { page, context, errors } = await newPage(browser, viewport)
  await toGrade(page, url, 'Dan', grade)
  await until(page, () => (window.__voiceLog ?? []).includes('s.onb.grade.start'))
  check(
    (await page.locator('[data-grade-start]').getAttribute('data-grade-start')) === '' && (await page.locator('.tv-onb').getByText('Alle starter i Engdalen.').count()) === 1,
    `${tag}: "Alle starter i Engdalen." under klassetrinnene`,
  )
  check((await page.locator('.tv-onb [data-next]').innerText()).includes('Spil'), `${tag}: knappen er "Spil" som før`)
  await placeShot(page, `${tag}-grade`)
  await page.locator('.tv-onb [data-next]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round', undefined, 20_000)
  check((await route(page)).node === 'w0-tal10-l1', `${tag}: første tur i Tællelunden`)
  const kid = await childNow(page)
  check(kid.grade === grade && !kid.placement.done && kid.seeded === 0, `${tag}: ingen indplacering`)
  check(errors.length === 0, `${tag}: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  await context.close()
}

/** After Stjernefjeldet's release: 3. klasse gets the ladder's intro without ?worlds=all too. */
async function ladderReleased(tag, viewport, url) {
  const { page, context, errors } = await newPage(browser, viewport)
  await toGrade(page, url, 'Dan', 3)
  await page.locator('.tv-onb [data-next]').click()
  const intro = await page.waitForSelector('[data-place-skip]', { timeout: 20_000 }).then(() => true, () => false)
  check(intro, `${tag}: 3. kl. får "Vis Pip hvad du kan" uden ?worlds=all, fordi Stjernefjeldet er frigivet`)
  await placeShot(page, `${tag}-intro`)
  check(errors.length === 0, `${tag}: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  await context.close()
}

/** Is Stjernefjeldet released in the build under test (RELEASED_WORLDS in src/meta/built.ts)? */
async function fjeldReleased() {
  const { page, context } = await newPage(browser, { width: 393, height: 852 })
  await page.goto(URL_)
  const released = await page.evaluate(async () => (await import('/src/meta/built.ts')).RELEASED_WORLDS.has('fjeld'))
  await context.close()
  return released
}

const browser = await launch()
try {
  // ── 3. klasse with the ladder (dev, ?worlds=all), and the grades and builds without it ──
  await thirdGrade('place3-phone', { width: 393, height: 852 }, PLANS.mixed)
  await thirdGrade('place3-small', { width: 375, height: 667 }, PLANS.minus, { sibling: true })
  await thirdGrade('place3-ipad', { width: 820, height: 1180 }, PLANS.all)
  await thirdGradeSkipAndReload('place3-phone', { width: 393, height: 852 })
  // before the release a 3. klasse onboarding has no ladder without ?worlds=all; after it, it has
  if (await fjeldReleased()) await ladderReleased('place3-released', { width: 393, height: 852 }, URL_)
  else await noLadder('place3-before-release', { width: 393, height: 852 }, URL_, 3)
  await noLadder('place3-grade2-built', { width: 393, height: 852 }, URL_ALL, 2)
  if (process.env.PLACE3_ONLY) throw new Error('PLACE3_ONLY: resten springes over')

  // ── Phone ──
  {
    const { page, context, errors } = await newPage(browser, { width: 393, height: 852 })
    await firstStart(page, 'phone')

    // a second child, then a new start: the picker
    await page.evaluate(async () => {
      const { useSession } = await import('/src/state/useSession.ts')
      const { useMeta } = await import('/src/state/useMeta.ts')
      const { useProfile } = await import('/src/state/useProfile.ts')
      await useSession.getState().createProfile({ name: 'Bo', grade: 0 })
      useMeta.getState().chooseStarter('rabbit')
      await useProfile.getState().flush()
    })
    await page.goto(URL_)
    await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
    await settle(page, 900)
    check((await route(page)).id === 'profiles', 'phone: to børn giver profilvælgeren ved start')
    check((await page.locator('.tv-pcard[data-profile]').count()) === 2, 'phone: to profilkort')
    check((await page.locator('.tv-pcard__buddy img').count()) === 2, 'phone: kortene viser vennen som statisk billede')
    await shot(page, 'phone-8-picker')
    await tapTargets(page, 'phone', 'profilvælger')

    // the grown-ups' button: a wrong sum gives a new one, the right one opens the dashboard
    await page.locator('.tv-topbar [data-clip="s.ui.adult"]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 600)
    const sum1 = await page.locator('.tv-gate').getAttribute('data-gate')
    check(/^1[2-9]x[6-9]$/.test(sum1), `phone: porten spørger ${sum1}`)
    check((await page.locator('.tv-gate .tv-eq__op--dot').textContent()) === '·', 'phone: gangetegnet er en prik')
    await shot(page, 'phone-9-gate')
    await tapTargets(page, 'phone', 'voksen-port')
    await page.locator('.tv-gate [data-key="1"]').click()
    await page.locator('.tv-gate [data-key="ok"]').click()
    await settle(page, 300)
    const sum2 = await page.locator('.tv-gate').getAttribute('data-gate')
    check(sum2 !== sum1, 'phone: forkert svar giver et nyt stykke')
    const [a, b] = sum2.split('x').map(Number)
    for (const d of String(a * b)) await page.locator(`.tv-gate [data-key="${d}"]`).click()
    await page.locator('.tv-gate [data-key="ok"]').click()
    await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'parent')
    check(true, 'phone: rigtigt svar åbner forældre-dashboardet')
    await page.waitForSelector('.tv-dash')
    await page.locator('.tv-dash .tv-topbar [data-clip="s.ui.back"]').click()
    await page.waitForSelector('.tv-picker')
    await settle(page)

    // "+ Ny spiller" sits behind the gate; closing the gate does nothing
    await page.locator('[data-add-player]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 500)
    await page.locator('.tv-sheet [data-clip="s.ui.close"]').click()
    await settle(page, 500)
    check((await route(page)).id === 'profiles', 'phone: luk porten, og intet sker')
    await page.locator('[data-add-player]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 500)
    {
      const [x, y] = (await page.locator('.tv-gate').getAttribute('data-gate')).split('x').map(Number)
      for (const d of String(x * y)) await page.keyboard.press(d)
      await page.keyboard.press('Enter')
    }
    await page.waitForSelector('.tv-onb[data-step="name"]')
    check((await route(page)).id === 'onboarding', 'phone: + Ny spiller åbner onboarding efter porten (og tastaturet virker)')
    await settle(page)
    await page.locator('.tv-onb .tv-topbar [data-clip="s.ui.back"]').click()
    await page.waitForSelector('.tv-picker')
    await settle(page)

    // delete: the gate, delete mode, the confirmation
    await page.locator('.tv-topbar [data-delete]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 500)
    {
      const [x, y] = (await page.locator('.tv-gate').getAttribute('data-gate')).split('x').map(Number)
      for (const d of String(x * y)) await page.locator(`.tv-gate [data-key="${d}"]`).click()
      await page.locator('.tv-gate [data-key="ok"]').click()
    }
    await page.waitForSelector('.tv-picker[data-deleting]')
    await settle(page, 600)
    await page.locator('.tv-pcard[aria-label="Bo"]').click()
    await page.waitForSelector('[data-confirm-delete]')
    await settle(page, 600)
    await shot(page, 'phone-10-delete')
    await page.locator('[data-confirm-delete]').click()
    await until(page, async () => (await import('/src/state/useSession.ts')).useSession.getState().profiles.length === 1)
    check(true, 'phone: Bo er slettet efter bekræftelsen')
    await settle(page)
    await page.locator('.tv-pcard[aria-label="Ida"]').click()
    await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'map')
    check((await voiceLog(page)).length > 0, 'phone: tryk på Ida vælger hende og går til kortet')

    const keys = await storageKeys(page)
    check(keys.every((k) => k.startsWith('talvennerne2.')), `phone: kun talvennerne2.-nøgler (${keys.join(', ')})`)
    check(errors.length === 0, `phone: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // ── The sound check's "Tænd for lyden" card (phone) ──
  {
    const { page, context, errors } = await newPage(browser, { width: 393, height: 852 })
    await page.goto(URL_)
    await page.waitForSelector('.tv-intro')
    await page.locator('.tv-intro [data-next]').click()
    await page.waitForSelector('.tv-sound[data-phase="listen"] .tv-sound__card')
    for (let i = 0; i < 2; i++) {
      await page.waitForSelector('.tv-sound[data-phase="listen"] .tv-sound__card:not([data-species="cat"])')
      await page.locator('.tv-sound__card:not([data-species="cat"])').click()
      await page.waitForTimeout(900)
    }
    await page.waitForSelector('.tv-sound[data-phase="failed"] .tv-sound__off')
    await settle(page)
    await shot(page, 'phone-11-sound-off')
    const boot = await page.evaluate(() => JSON.parse(localStorage.getItem('talvennerne2.boot') ?? '{}'))
    check(boot.device?.audioVerified === false, 'lydtjek: to forkerte giver "Tænd for lyden" og audioVerified = false')
    await page.locator('.tv-sound [data-next]').click()
    await page.waitForSelector('.tv-onb[data-step="name"]')
    check(true, 'lydtjek: videre til onboarding uden lyd')
    check(errors.length === 0, `lydtjek: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // ── A small phone and a phone held sideways: the same flow must fit and work ──
  for (const [tag, viewport] of [['small', { width: 375, height: 667 }], ['land', { width: 852, height: 393 }]]) {
    const { page, context, errors } = await newPage(browser, viewport)
    await firstStart(page, tag)
    await page.evaluate(async () => {
      const { useSession } = await import('/src/state/useSession.ts')
      const { useMeta } = await import('/src/state/useMeta.ts')
      const { useProfile } = await import('/src/state/useProfile.ts')
      for (const [name, species] of [['Bo', 'rabbit'], ['Cille', 'horse'], ['Dan', 'puppy'], ['Eik', 'cat'], ['Fie', 'rabbit']]) {
        await useSession.getState().createProfile({ name, grade: 0 })
        useMeta.getState().chooseStarter(species)
        await useProfile.getState().flush()
      }
    })
    await page.goto(URL_)
    await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
    await settle(page, 900)
    check((await page.locator('.tv-pcard[data-profile]').count()) === 6, `${tag}: seks profilkort`)
    check((await page.locator('[data-add-player]').count()) === 0, `${tag}: ingen "Ny spiller" ved seks`)
    await shot(page, `${tag}-8-picker`)
    await tapTargets(page, tag, 'profilvælger')
    await page.locator('.tv-topbar [data-clip="s.ui.adult"]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 700)
    await shot(page, `${tag}-9-gate`)
    await tapTargets(page, tag, 'voksen-port')
    check(errors.length === 0, `${tag}: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // ── The gentle help on the egg step (a fake clock), reduced motion, and a later sound check ──
  {
    const { page, context, errors } = await newPage(browser, { width: 393, height: 852 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.install()
    await page.goto(URL_)
    await page.waitForSelector('.tv-intro')
    await page.evaluate(() => localStorage.setItem('talvennerne2.boot', JSON.stringify({ v: 1, profileIds: [], lastProfileId: null, device: { followSilentSwitch: false, audioVerified: true, calm: false } })))
    await page.reload()
    await page.waitForSelector('.tv-intro')
    await page.locator('.tv-intro [data-next]').click()
    await page.waitForSelector('.tv-onb[data-step="name"]')
    check(true, 'hjælp: en kontrolleret enhed springer lydtjekket over')
    await page.locator('.tv-onb [data-next]').click()
    await page.waitForSelector('.tv-eggs')
    const still = await page.evaluate(() => getComputedStyle(document.querySelector('.tv-eggbtn__egg')).animationName)
    check(still === 'none', `hjælp: æggene vugger ikke med reduceret bevægelse (${still})`)
    check((await page.locator('.tv-eggs.is-help').count()) === 0, 'hjælp: ingen hjælp før tid')
    await page.clock.fastForward(61_000)
    await page.waitForSelector('.tv-eggs.is-help')
    check((await voiceLog(page)).includes('s.onb.egg.helpPick'), 'hjælp: efter 60 s siger Pip "Tryk på et af æggene"')
    check((await page.locator('.tv-onb').getByText(/\d+ s|sekund/).count()) === 0, 'hjælp: ingen nedtælling')
    const helpEggs = await page.locator('.tv-eggbtn').evaluateAll((els) => els.map((e) => e.getAttribute('data-species')))
    const { drawn: drawnNow } = await starters(page)
    check(helpEggs.every((sp) => drawnNow.includes(sp)), `hjælp: æggene byder kun på tegnede dyr (${helpEggs.join(', ')})`)
    const lastEgg = helpEggs[helpEggs.length - 1]
    await page.locator(`.tv-eggbtn[data-species="${lastEgg}"]`).click()
    await page.waitForSelector('.tv-hatchbtn[data-hatch="0"]')
    await page.locator('.tv-hatchbtn').click()
    await page.clock.fastForward(61_000)
    await page.waitForSelector('.tv-onb__hand')
    check((await voiceLog(page)).includes('s.onb.egg.help'), 'hjælp: et valgt æg får hånden og "Tryk på ægget"')
    await page.locator('.tv-hatchbtn').click()
    await page.locator('.tv-hatchbtn').click()
    await page.clock.fastForward(1_000)
    await page.waitForSelector('.tv-hatchbtn[data-hatch="done"]')
    check((await page.locator('.tv-hatch .tv-critter').count()) === 0, `hjælp: ${lastEgg} klækkes som sig selv, aldrig som pladsholderen`)
    await page.waitForTimeout(700)
    await shot(page, `phone-12-${lastEgg}`)

    // the gate without a hook (as a plain handler like the map's grown-ups' button would call it)
    await page.evaluate(async () => {
      const { openAdultGate } = await import('/src/ui/overlays/AdultGate.tsx')
      window.__gatePassed = 0
      openAdultGate(() => window.__gatePassed++)
      openAdultGate(() => window.__gatePassed++)
    })
    await page.waitForSelector('.tv-sheet .tv-gate')
    check((await page.locator('.tv-gate').count()) === 1, 'port: openAdultGate åbner én port, også ved dobbelttryk')
    {
      const [x, y] = (await page.locator('.tv-gate').getAttribute('data-gate')).split('x').map(Number)
      for (const d of String(x * y)) await page.locator(`.tv-gate [data-key="${d}"]`).click()
      await page.locator('.tv-gate [data-key="ok"]').click()
    }
    await page.clock.fastForward(1_000)
    await until(page, () => window.__gatePassed === 1 && !document.querySelector('[data-adult-gate]'))
    check(true, 'port: openAdultGate kalder onPass én gang og fjerner sig selv')

    // the sound check from elsewhere (profiles exist): "Næste" goes back
    await page.evaluate(async () => {
      const { useNav } = await import('/src/app/nav.ts')
      useNav.getState().root({ id: 'map' })
      useNav.getState().go({ id: 'soundCheck' })
    })
    await page.waitForSelector('.tv-sound .tv-sound__card[data-species="cat"]')
    await page.locator('.tv-sound__card[data-species="cat"]').click()
    await page.waitForSelector('.tv-sound[data-phase="passed"] [data-next]')
    await page.locator('.tv-sound [data-next]').click()
    await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'map')
    check(true, 'lydtjek: med profiler går "Næste" tilbage')
    check(errors.length === 0, `hjælp: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // ── iPad ──
  {
    const { page, context, errors } = await newPage(browser, { width: 820, height: 1180 })
    await firstStart(page, 'ipad', { write: 'Fru Snusegrisen' })
    await page.evaluate(async () => {
      const { useSession } = await import('/src/state/useSession.ts')
      const { useMeta } = await import('/src/state/useMeta.ts')
      const { useProfile } = await import('/src/state/useProfile.ts')
      for (const [name, species] of [['Bo', 'rabbit'], ['Cille', 'horse'], ['Dan', 'puppy']]) {
        await useSession.getState().createProfile({ name, grade: 0 })
        useMeta.getState().chooseStarter(species)
        await useProfile.getState().flush()
      }
    })
    await page.goto(URL_)
    await page.waitForSelector('.tv-picker .tv-pcard[data-profile]')
    await settle(page, 900)
    check((await page.locator('.tv-pcard[data-profile]').count()) === 4, 'ipad: fire profilkort')
    await shot(page, 'ipad-8-picker')
    check(errors.length === 0, `ipad: 0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
    await context.close()
  }

  // ── One child, then a sibling (phone and iPad) ──
  await oneChildThenSibling('phone-one', { width: 393, height: 852 })
  await oneChildThenSibling('ipad-one', { width: 820, height: 1180 })
} catch (err) {
  if (String(err?.message).startsWith('PLACE3_ONLY')) console.log(err.message)
  else {
    fails.push(String(err?.stack ?? err))
    console.error(err)
  }
} finally {
  await browser.close()
}

console.log(fails.length ? `\n${fails.length} fejl` : '\nalt grønt')
process.exit(fails.length ? 1 : 0)
