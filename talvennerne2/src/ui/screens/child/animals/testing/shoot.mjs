// Dyrehaven and the books in Chromium with the demo child Ida (testing/demo.ts): screenshots, the DOM
// budget (SVG elements on the screen, animated rigs), console errors, and the hatch and golden pick
// played through. Start the dev server first (npx vite --port 4315 --strictPort), then:
//   flock /tmp/tv2-chromium.lock node src/ui/screens/child/animals/testing/shoot.mjs
// Writes artifacts/zoo/<name>.png and prints one JSON line per measurement. SIZES=393x852 picks the
// windows, DPR=1 keeps the pictures small, PLAY=0 skips the hatch and the pick.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../../../../scripts/browser.mjs'

const BASE = process.env.BASE ?? 'http://localhost:4315/'
const OUT = fileURLToPath(new URL('../../../../../../artifacts/zoo/', import.meta.url))
const SIZES = (process.env.SIZES ?? '393x852,820x1180').split(',').map((s) => s.split('x').map(Number))
const PLAY = process.env.PLAY !== '0'
/** The pictures kept (SHOTS=all keeps every one, also the card and the hatch). */
const SHOTS = process.env.SHOTS ?? '393-dyrehaven,393-samlebogen,820-dyrehaven,820-trofaeer'
const shot = async (page, name) => {
  if (SHOTS === 'all' || SHOTS.split(',').includes(name)) await page.screenshot({ path: `${OUT}${name}.png` })
}

mkdirSync(OUT, { recursive: true })

/** SVG elements in the document (the <img> pictures hold theirs outside the DOM). */
const measure = (page, label) =>
  page.evaluate((label) => {
    const svg = document.querySelectorAll('svg, svg *').length
    const rigs = document.querySelectorAll('svg.rig').length
    const animated = document.querySelectorAll('svg.rig:not([data-static])').length
    const imgs = document.querySelectorAll('img.zoo-fig__img').length
    const cells = document.querySelectorAll('[data-uid]').length
    const small = [...document.querySelectorAll('.tv-screen:not([data-leaving]) button, .tv-sheet button')]
      .filter((b) => {
        const r = b.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.width < 60 || r.height < 60) && !b.closest('.tv-dock')
      })
      .map((b) => `${b.className.split(' ')[0]}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`)
    const overflow = document.documentElement.scrollWidth > window.innerWidth
    return { label, svg, rigs, animated, imgs, cells, small: [...new Set(small)].slice(0, 8), overflow }
  }, label)

const settle = (page, ms = 700) => page.waitForTimeout(ms)

const browser = await launch()
const problems = []
try {
  for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DPR ?? 2) })
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()}`))
    await page.goto(`${BASE}?e2e=1&voice=fast`)
    await page.waitForSelector('.tv-shell', { timeout: 60_000 })
    await page.evaluate(async () => {
      const { seedZooDemo } = await import('/src/ui/screens/child/animals/testing/demo.ts')
      const { useSession } = await import('/src/state/useSession.ts')
      const { useNav } = await import('/src/app/nav.ts')
      const ids = await seedZooDemo()
      await useSession.getState().refreshProfiles()
      await useSession.getState().selectProfile(ids.ida)
      useNav.getState().root({ id: 'animals' })
    })
    await page.waitForSelector('[data-zoo] [data-meadow]', { timeout: 60_000 })
    await page.waitForFunction(() => document.querySelectorAll('svg.rig:not([data-static])').length >= 3 && document.querySelectorAll('img.zoo-fig__img').length >= 8, null, { timeout: 60_000 })
    await settle(page, 1200)
    const zoo = await measure(page, `zoo-${width}`)
    console.log(JSON.stringify(zoo))
    if (zoo.svg > 1500) problems.push(`${zoo.label}: ${zoo.svg} SVG elements`)
    if (zoo.animated > 3) problems.push(`${zoo.label}: ${zoo.animated} animated rigs`)
    await shot(page, `${width}-dyrehaven`)

    // an animal's card (the cat Misse): open, measure, look
    await page.click('[data-uid^="friend-w0-plus10"]')
    await page.waitForSelector('[data-animal-card]', { timeout: 10_000 })
    await settle(page, 900)
    const card = await measure(page, `card-${width}`)
    console.log(JSON.stringify(card))
    if (card.svg > 1500) problems.push(`${card.label}: ${card.svg} SVG elements`)
    if (card.animated > 3) problems.push(`${card.label}: ${card.animated} animated rigs`)
    await shot(page, `${width}-dyrekort`)
    await page.click('[data-trick-chip="hop"]')
    await settle(page, 400)
    await page.keyboard.press('Escape')
    await settle(page, 500)

    // the books
    await page.evaluate(async () => {
      const { useNav } = await import('/src/app/nav.ts')
      useNav.getState().root({ id: 'books', book: 'collection' })
    })
    await page.waitForSelector('[data-book="collection"]', { timeout: 10_000 })
    await page.waitForFunction(() => document.querySelectorAll('img.zoo-fig__img').length >= 10, null, { timeout: 30_000 })
    await settle(page, 900)
    const books = await measure(page, `collection-${width}`)
    console.log(JSON.stringify(books))
    await shot(page, `${width}-samlebogen`)
    await page.click('[data-card="rabbit:lionhead:c1"]')
    await page.waitForSelector('[data-detail]', { timeout: 10_000 })
    await settle(page, 600)
    await page.keyboard.press('Escape')
    await settle(page, 400)

    for (const book of ['can', 'stamps', 'trophies']) {
      await page.evaluate(async (book) => {
        const { useNav } = await import('/src/app/nav.ts')
        useNav.getState().root({ id: 'books', book })
      }, book)
      await page.waitForSelector(`[data-book="${book}"]`, { timeout: 10_000 })
      await settle(page, 500)
      const m = await measure(page, `${book}-${width}`)
      console.log(JSON.stringify(m))
      if (book === 'trophies') await shot(page, `${width}-trofaeer`)
    }

    if (PLAY && width < 500) {
      // the golden pick and the hatch, played like a child would
      await page.evaluate(async () => {
        const { useNav } = await import('/src/app/nav.ts')
        useNav.getState().root({ id: 'animals' })
      })
      await page.waitForSelector('[data-choice="gold-eng"]', { timeout: 10_000 })
      await page.click('[data-magic-option="rabbit"]')
      await page.click('[data-choice-take]')
      await page.waitForSelector('[data-born="gold-rabbit"]', { timeout: 10_000 })
      await settle(page, 800)
      const born = await measure(page, `born-${width}`)
      console.log(JSON.stringify(born))
      if (born.animated > 3) problems.push(`${born.label}: ${born.animated} animated rigs`)
      await page.click('[data-name-option]:nth-child(2)')
      await page.click('[data-born-done]')
      await settle(page, 600)
      for (let i = 0; i < 3; i++) {
        await page.click('[data-egg]')
        await settle(page, 350)
      }
      await page.waitForSelector('[data-born^="egg-"]', { timeout: 10_000 })
      await settle(page, 900)
      await shot(page, `${width}-klaekning`)
      await page.click('[data-name-own]')
      await page.fill('[data-name-input]', 'Snebolden Bo')
      await page.click('[data-name-done]')
      await settle(page, 300)
      await page.click('[data-born-done]')
      await settle(page, 600)
      const after = await page.evaluate(async () => {
        const { useProfile } = await import('/src/state/useProfile.ts')
        const p = useProfile.getState().profile
        return { animals: p.animals.length, names: p.animals.slice(-2).map((a) => `${a.uid}:${a.name}`), egg: p.economy.eggsHatched }
      })
      console.log(JSON.stringify({ label: `played-${width}`, ...after }))
      if (after.animals !== 18) problems.push(`played: ${after.animals} animals, expected 18`)
      const end = await measure(page, `zoo-after-${width}`)
      console.log(JSON.stringify(end))
      if (end.animated > 3) problems.push(`${end.label}: ${end.animated} animated rigs`)
    }

    if (errors.length) problems.push(...errors.map((e) => `${width}: ${e}`))
    await page.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify({ problems }))
if (problems.length) process.exitCode = 1
