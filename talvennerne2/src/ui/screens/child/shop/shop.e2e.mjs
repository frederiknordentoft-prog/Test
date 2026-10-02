// Plays the wardrobe and the shop in Chromium the way a child would (dev only). A child at level 2
// with the Hverdag hat opens the wardrobe from the dock: the hat is pointed at (the first time), one
// tap puts it on. Only drawn things are offered (review P1-3): the shop and "Det kan du få" hold
// drawn things only, and a thing the child owns without a drawing stays hers. In the shop she meets
// the warm "later" when the perler do not reach and pins the Fest hat as her wish, then buys it with
// the clear yes, tries it on ("Prøv den på" opens its tab and points at it), buys a new colour and a
// lantern. Then the page is reloaded: perler, things, colours, decor and the outfit are all still
// there. Phone and iPad screenshots go to artifacts/shop/. Fails on any console error or page error,
// and checks that calm mode stops the pointing loops.
//
//   npx vite --port 4317 --strictPort --host 127.0.0.1 &
//   flock /tmp/tv2-chromium.lock node src/ui/screens/child/shop/shop.e2e.mjs
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../scripts/browser.mjs'

const BASE = process.env.SHOP_URL ?? 'http://127.0.0.1:4317/'
const QUERY = '?e2e=1&voice=fast'
const OUT = fileURLToPath(new URL('../../../../../artifacts/shop/', import.meta.url))
const PHONE = { width: 393, height: 852 }
const IPAD = { width: 820, height: 1180 }
const checks = []
const errors = []

function check(ok, what) {
  checks.push({ ok: !!ok, what })
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${what}`)
}

async function shot(page, name) {
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: `${OUT}/${name}.png` })
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

async function tap(page, selector, settle = 120) {
  const { x, y } = await centre(page, selector)
  await page.mouse.click(x, y)
  await page.waitForTimeout(settle)
}

const profile = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/src/state/useProfile.ts')).useProfile.getState().profile)))
const route = (page) => page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().route)
const ready = (page) => page.waitForFunction(async () => (await import('/src/state/useSession.ts')).useSession.getState().phase === 'ready', null, { timeout: 60000 })

/** Every tap target on screen is at least 60 px both ways (thing cards at least 96). */
async function targets(page, selector) {
  return page.evaluate((sel) => {
    const small = []
    for (const el of document.querySelectorAll(sel)) {
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) continue
      if (b.width < 59.5 || b.height < 59.5) small.push(`${el.className.toString().slice(0, 40)} ${Math.round(b.width)}×${Math.round(b.height)}`)
    }
    return small
  }, selector)
}

/** Nothing on the screen reaches past its edges (cards, tiles, buttons). */
async function overflow(page) {
  return page.evaluate(() => {
    const w = window.innerWidth
    return [...document.querySelectorAll('.tv-screen:not([data-leaving]) button, .tv-store-card, .tv-wr-card')]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && (b.left < -0.5 || b.right > w + 0.5)).length
  })
}

async function newChild(page) {
  await page.goto(`${BASE}${QUERY}`, { waitUntil: 'networkidle' })
  await ready(page)
  await page.evaluate(async () => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useMeta } = await import('/src/state/useMeta.ts')
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { useNav } = await import('/src/app/nav.ts')
    await useSession.getState().createProfile({ name: 'Ada', grade: 0 })
    useMeta.getState().chooseStarter('rabbit')
    // level 2 brings the Hverdag hat (SPEC §8); a few rounds brought perler and a chest thing
    const now = Date.now()
    useProfile.getState().update((p) => ({
      ...p,
      economy: { ...p.economy, perler: 500, level: 2, xp: 160 },
      inventory: { 'hverdag-head': { at: now, colors: [0] }, 'opdager-hand': { at: now, colors: [0] } },
    }))
    await useProfile.getState().flush()
    useNav.getState().root({ id: 'map' })
  })
  await page.waitForTimeout(600)
}

const browser = await launch()
const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 })
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

try {
  await newChild(page)

  // ── The wardrobe from the dock: the first time, the hat is pointed at ──
  await tap(page, '.tv-dock__item[aria-label="Garderobe"]', 900)
  check((await route(page)).id === 'wardrobe', 'docken åbner garderoben')
  check(await page.$('[data-slot="head"][aria-selected="true"]'), 'hovedfanen er åben')
  check(await page.$('[data-item="hverdag-head"][data-guide]'), 'Hverdag-huen er fremhævet første gang')
  check(await page.$('.tv-wr-hand'), 'en hånd viser, hvor man trykker')
  check((await targets(page, '.tv-wr-tab, .tv-wr-animal, .tv-wr-color, .tv-wr-card, .tv-wr-off, .tv-topbar .tv-ibtn')).length === 0, 'alle trykmål i garderoben er mindst 60 px')
  check((await overflow(page)) === 0, 'garderoben holder sig inden for skærmen')
  const cardSize = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.tv-wr-card')].map((e) => e.getBoundingClientRect().width)))
  check(cardSize >= 96, `tingkortene er mindst 96 px (${Math.round(cardSize)})`)
  await shot(page, 'wardrobe-phone')
  await tap(page, '[data-item="hverdag-head"]', 500)
  let p = await profile(page)
  check(p.animals[0].outfit.head?.item === 'hverdag-head', 'et tryk tager huen på med det samme')
  check(!(await page.$('.tv-wr-hand')), 'hånden forsvinder, når huen er på')
  check(await page.$('[data-colors="hverdag-head"] [data-color="0"][data-owned]'), 'farvebjælken viser den ejede farve')
  check(!(await page.$('[data-colors="hverdag-head"] [data-color="1"][data-owned]')), 'de andre farver er i butikken')

  // a thing the child owns without a drawing stays hers; a drawn thing she does not have explains how to get it
  await tap(page, '[data-slot="hand"]', 300)
  check(await page.$('[data-item="opdager-hand"][data-owned]'), 'lupen fra kisten kan vælges')
  const drawnIds = await page.evaluate(async () => (await import('/src/art/items/registry.ts')).AVAILABLE_ITEMS)
  const offered = await page.$$eval('[data-how]', (els) => els.map((e) => e.getAttribute('data-item')))
  check(offered.every((id) => drawnIds.includes(id)), `"Det kan du få" viser kun tegnede ting (${offered.join(', ') || 'ingen'})`)
  await tap(page, '[data-slot="body"]', 300)
  await tap(page, '[data-item="hverdag-body"]', 700)
  const howText = await page.evaluate(() => document.querySelector('[data-how-sheet] .tv-wr-how__say')?.textContent ?? '')
  check(howText === 'Den får du på niveau 4.', `"Sådan får du den" for den stribede trøje: ${howText}`)
  check((await profile(page)).animals[0].outfit.body === undefined, 'en ting barnet ikke har, kommer ikke på')
  await tap(page, '[data-wish="hverdag-body"]', 400)
  check((await profile(page)).economy.wish === 'hverdag-body', 'en niveau-ting kan ønskes fra garderoben')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ── The shop: only drawn things, the warm "later", the wish, then a clear yes ──
  await tap(page, '.tv-dock__item[aria-label="Butik"]', 900)
  check((await route(page)).id === 'shop', 'docken åbner butikken')
  check(await page.$('.tv-topbar [data-perler="500"]'), 'perlerne står øverst')
  const forSale = await page.$$eval('[data-buy]', (els) => els.map((e) => e.getAttribute('data-buy')))
  check(forSale.length > 0 && forSale.every((id) => drawnIds.includes(id)), `butikken sælger kun tegnede ting (${forSale.join(', ')})`)
  check(await page.$('[data-wish="hverdag-body"] [role="meter"]'), 'ønsket fra garderoben står i butikken med en bjælke')
  await tap(page, '[data-wish-open]', 700)
  check(await page.$('[data-sheet="how"]') && !(await page.$('[data-buy-yes]')), 'en optjent ting har ingen pris: arket siger, hvordan man får den')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // not enough perler: a warm "later" and the wish instead
  await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().update((q) => ({ ...q, economy: { ...q.economy, perler: 95 } })))
  await page.waitForTimeout(300)
  await tap(page, '[data-buy="fest-head"]', 700)
  check(await page.$('[data-sheet="later"]') && !(await page.$('[data-buy-yes]')), 'uden perler nok er der intet ja, men en venlig besked')
  await shot(page, 'shop-phone')
  await tap(page, '[data-wish-set]', 500)
  check((await profile(page)).economy.wish === 'fest-head', 'Festhatten er nu ønsket')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  check(await page.$('[data-wish="fest-head"] [role="meter"]'), 'ønsket vises med en bjælke uden tal')
  check((await profile(page)).economy.perler === 95, 'perlerne er uændrede efter "senere"')
  // enough perler again: the shop asks first, and the yes buys it
  await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().update((q) => ({ ...q, economy: { ...q.economy, perler: 500 } })))
  await page.waitForTimeout(300)
  await tap(page, '[data-buy="fest-head"]', 700)
  check(await page.$('[data-sheet="ask"]'), 'butikken spørger først')
  check((await profile(page)).economy.perler === 500, 'intet er købt før ja')
  check((await targets(page, '.tv-store-sheet .tv-btn, .tv-store-sheet .tv-ibtn, .tv-store-sheet__cost')).length === 0, 'arkets knapper er mindst 60 px')
  await tap(page, '[data-buy-yes]', 600)
  let p2 = await profile(page)
  check(p2.economy.perler === 380 && p2.inventory['fest-head'] && p2.economy.wish === null, 'Festhatten koster 120 perler, er barnets, og ønsket er opfyldt')
  check(await page.$('[data-sheet="done"]'), '"Den er din nu!"')
  await tap(page, '[data-go]', 900)
  const r = await route(page)
  check(r.id === 'wardrobe' && r.item === 'fest-head', '"Prøv den på" åbner garderoben med hatten')
  check(await page.$('[data-slot="head"][aria-selected="true"]') && (await page.$('[data-item="fest-head"][data-guide]')), 'hatten er fremhævet under sin fane')
  await tap(page, '[data-item="fest-head"]', 500)
  check((await profile(page)).animals[0].outfit.head?.item === 'fest-head', 'hatten kommer på')
  await page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().back())
  await page.waitForTimeout(700)

  // a new colour and decor
  check((await overflow(page)) === 0, 'tøjhylden holder sig inden for skærmen')
  await tap(page, '[data-shelf="colors"]', 400)
  check((await overflow(page)) === 0, 'farvehylden holder sig inden for skærmen')
  const recolor = await page.$$eval('[data-recolor]', (els) => els.map((e) => e.getAttribute('data-recolor')))
  check(recolor.every((id) => drawnIds.includes(id)), `nye farver kun til tegnede ting (${recolor.join(', ')})`)
  await tap(page, '[data-recolor="hverdag-head"] [data-color="1"]', 700)
  await tap(page, '[data-buy-yes]', 600)
  check((await profile(page)).inventory['hverdag-head'].colors.join() === '0,1', 'en ny farve er købt')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await tap(page, '[data-shelf="decor"]', 400)
  check((await overflow(page)) === 0, 'pynthylden holder sig inden for skærmen')
  await tap(page, '[data-decor="pynt-lygte"]', 700)
  await tap(page, '[data-buy-yes]', 600)
  p2 = await profile(page)
  check(p2.decor['pynt-lygte'] && p2.economy.perler === 380 - 25 - 40, 'lygten koster 40 perler og står i Dyrehaven')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await tap(page, '[data-shelf="clothes"]', 400)

  // ── Reload: everything is still there ──
  await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().flush())
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  await page.waitForTimeout(800)
  p = await profile(page)
  check(p && p.economy.perler === 315, 'perlerne er bevaret efter genindlæsning')
  check(p.inventory['fest-head']?.colors.join() === '0' && p.inventory['hverdag-head']?.colors.join() === '0,1', 'tøj og farver er bevaret')
  check(p.decor['pynt-lygte'], 'pynten er bevaret')
  check(p.inventory['opdager-hand'], 'tingen uden tegning er stadig barnets')
  check(p.animals[0].outfit.head?.item === 'fest-head', 'dyret har stadig hatten på')
  await tap(page, '.tv-dock__item[aria-label="Garderobe"]', 900)
  check(await page.$('[data-item="fest-head"][data-on]'), 'garderoben viser hatten på dyret')
  check(!(await page.$('[data-guide]')), 'ingen fremhævning efter første gang')
  // the new colour goes on from the colour bar, and survives a reload too
  await tap(page, '[data-item="hverdag-head"]', 400)
  await tap(page, '[data-colors="hverdag-head"] [data-color="1"]', 400)
  check((await profile(page)).animals[0].outfit.head?.color === 1, 'den nye farve kommer på fra farvebjælken')
  await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().flush())
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  await page.waitForTimeout(600)
  check((await profile(page)).animals[0].outfit.head?.color === 1, 'farven er bevaret efter genindlæsning')

  // ── Calm mode: the pointing stands still ──
  await page.evaluate(async () => {
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { useNav } = await import('/src/app/nav.ts')
    useProfile.getState().setSettings({ calm: true })
    useProfile.getState().update((q) => ({ ...q, inventory: { ...q.inventory, 'hverdag-neck': { at: Date.now(), colors: [0] } } }))
    useNav.getState().root({ id: 'wardrobe', item: 'hverdag-neck' })
  })
  await page.waitForTimeout(900)
  const calm = await page.evaluate(() => {
    const card = document.querySelector('[data-item="hverdag-neck"][data-guide]')
    const hand = document.querySelector('.tv-wr-hand')
    return {
      calm: document.documentElement.hasAttribute('data-calm'),
      ring: card ? getComputedStyle(card, '::after').animationName : null,
      hand: hand ? getComputedStyle(hand).animationName : null,
    }
  })
  check(calm.calm && calm.ring === 'none' && calm.hand === 'none', `rolig tilstand: ringen og hånden står stille (${JSON.stringify(calm)})`)
  await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().setSettings({ calm: false }))

  // ── iPad ──
  const ipad = await context.newPage()
  ipad.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console (iPad): ${m.text()}`)
  })
  ipad.on('pageerror', (e) => errors.push(`pageerror (iPad): ${e.message}`))
  await ipad.setViewportSize(IPAD)
  await ipad.goto(`${BASE}${QUERY}`, { waitUntil: 'networkidle' })
  await ready(ipad)
  await ipad.waitForTimeout(600)
  await ipad.evaluate(async () => {
    const { useProfile } = await import('/src/state/useProfile.ts')
    const { useNav } = await import('/src/app/nav.ts')
    useProfile.getState().update((q) => ({ ...q, economy: { ...q.economy, perler: 342 } }))
    useNav.getState().root({ id: 'wardrobe', item: 'hverdag-neck' })
  })
  await ipad.waitForTimeout(1200)
  check((await targets(ipad, '.tv-wr-tab, .tv-wr-color, .tv-wr-card, .tv-wr-off')).length === 0, 'iPad: trykmål mindst 60 px')
  await shot(ipad, 'wardrobe-ipad')
  await ipad.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().root({ id: 'shop' }))
  await ipad.waitForTimeout(900)
  await tap(ipad, '[data-buy="fest-head"]', 800)
  await shot(ipad, 'shop-ipad')
  const wide = await ipad.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check(!wide && (await overflow(ipad)) === 0, 'iPad: intet vandret overløb')
  await ipad.close()
} catch (err) {
  check(false, `undtagelse: ${err.message}`)
}

check(errors.length === 0, `0 konsolfejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
await browser.close()
const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} tjek bestået`)
process.exit(failed.length ? 1 : 0)
