// Click-through of the first start on the dev server, from an empty device: the grown-ups' intro,
// the sound check (one wrong tap, then the cat), onboarding (name, egg, three taps, a suggested name,
// the grade) into the first round; then a second child, the picker, the gate (a wrong sum, then the
// right one), "+ Ny spiller" behind the gate, deleting a child, and the sound check's "Tænd for
// lyden" card. Phone (393 x 852) and iPad (820 x 1180). Fails on console errors and on any storage
// key outside the talvennerne2. namespace.
//   BASE=http://127.0.0.1:4313/ flock /tmp/tv2-chromium.lock node src/ui/screens/child/onboarding/e2e.mjs
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:4313/'
const URL_ = `${BASE}?e2e=1&voice=fast`
const OUT = fileURLToPath(new URL('../../../../../artifacts/scr/', import.meta.url))
const REVIEW = process.env.REVIEW ?? `${OUT}review/`
mkdirSync(REVIEW, { recursive: true })

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

/** The whole first start, from the empty device into the first round. */
async function firstStart(page, tag) {
  await page.goto(URL_)
  await page.waitForSelector('.tv-intro', { timeout: 30_000 })
  await settle(page)
  await shot(page, `${tag}-1-intro`)
  check((await route(page)).id === 'parentIntro', `${tag}: tom enhed starter på forældre-intro`)
  check((await page.locator('.tv-intro__card').count()) === 3, `${tag}: intro har tre kort`)

  await page.locator('.tv-intro [data-next]').click()
  await page.waitForSelector('.tv-sound[data-phase="listen"] .tv-sound__card')
  await settle(page)
  check((await voiceLog(page)).includes('s.sound.tapCat'), `${tag}: Pip siger "Tryk på katten"`)
  check((await page.locator('.tv-sound').getByText('Tryk på katten', { exact: false }).count()) === 0, `${tag}: instruktionen står ikke som tekst`)
  await shot(page, `${tag}-2-sound`)

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
  await page.locator('.tv-onb [data-next]').click()

  // the egg
  await page.waitForSelector('.tv-onb[data-step="egg"] .tv-eggbtn')
  check((await page.locator('.tv-eggbtn').count()) === 4, `${tag}: fire æg`)
  await settle(page, 900)
  await shot(page, `${tag}-4-eggs`)
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
  const kid = await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile)
  check(kid?.name === 'Ida' && kid.animals[0]?.species === 'cat' && kid.buddyUid === kid.animals[0]?.uid, `${tag}: barnet oprettes ved klækningen med katten som ven`)
  await page.locator('.tv-onb [data-next]').click()

  // the friend's name: six suggestions read aloud
  await page.waitForSelector('.tv-onb[data-step="friend"] .tv-name[data-name]')
  check((await page.locator('.tv-name[data-name]').count()) === 6, `${tag}: seks navneforslag`)
  await until(page, () => (window.__voiceLog ?? []).filter((c) => c.startsWith('name.animal.')).length >= 6)
  check(true, `${tag}: forslagene læses op`)
  const second = page.locator('.tv-name[data-name]').nth(1)
  const chosen = await second.getAttribute('data-name')
  await second.click()
  await settle(page, 400)
  await shot(page, `${tag}-6-friend`)
  await page.locator('.tv-onb [data-next]').click()

  // the grade, then the first round
  await page.waitForSelector('.tv-onb[data-step="grade"] .tv-grade')
  await page.locator('.tv-grade[data-grade="1"]').click()
  await settle(page, 300)
  await shot(page, `${tag}-7-grade`)
  await page.locator('.tv-onb [data-next]').click()
  await until(page, async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'round')
  const nav = await page.evaluate(async () => {
    const s = (await import('/src/app/nav.ts')).useNav.getState()
    return { route: s.route, stack: s.stack }
  })
  check(nav.route.node === 'w0-tal10-l1' && nav.stack.length === 1 && nav.stack[0].id === 'map', `${tag}: første tur i Engdalen oven på kortet`)
  const stored = await page.evaluate(async () => {
    const { listProfiles } = await import('/src/data/repo/profiles.ts')
    return (await listProfiles()).map((p) => ({ name: p.name, grade: p.grade, animal: p.animals[0]?.name, species: p.animals[0]?.species }))
  })
  check(stored.length === 1 && stored[0].grade === 1 && stored[0].animal === chosen && stored[0].species === 'cat', `${tag}: profilen er gemt med klassetrin og vennens navn (${chosen})`)
}

const browser = await launch()
try {
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

    // the grown-ups' button: a wrong sum gives a new one, the right one opens the dashboard
    await page.locator('.tv-topbar [data-clip="s.ui.adult"]').click()
    await page.waitForSelector('.tv-gate')
    await settle(page, 600)
    const sum1 = await page.locator('.tv-gate').getAttribute('data-gate')
    check(/^1[2-9]x[6-9]$/.test(sum1), `phone: porten spørger ${sum1}`)
    check((await page.locator('.tv-gate .tv-eq__op--dot').textContent()) === '·', 'phone: gangetegnet er en prik')
    await shot(page, 'phone-9-gate')
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

  // ── iPad ──
  {
    const { page, context, errors } = await newPage(browser, { width: 820, height: 1180 })
    await firstStart(page, 'ipad')
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
} catch (err) {
  fails.push(String(err?.stack ?? err))
  console.error(err)
} finally {
  await browser.close()
}

console.log(fails.length ? `\n${fails.length} fejl` : '\nalt grønt')
process.exit(fails.length ? 1 : 0)
