// The zoo with 60 animals at 4× CPU throttle (SPEC §15.2: the album ≥ 50 fps; QA2 P3-16), on the
// production build. A child is onboarded with the finger; the grown-ups save a copy from the
// dashboard, the file gets 60 animals, and "Erstat …s data" brings it back in — the parents' own
// way. Back on the child's side the zoo is scrolled with touch gestures. Writes
// artifacts/perf/zoo-<vp>.json.
//   npm run build && flock /tmp/tv2-chromium.lock node scripts/perf/zoo.mjs
//   VP=ipad DIST=<copy fetched from the live site> flock … node scripts/perf/zoo.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../browser.mjs'
import { onboard, serve, solveGate, startFrames, stats, tapEl, toMap, wait } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const DIST = process.env.DIST ?? `${ROOT}dist`
const OUT = `${ROOT}artifacts/perf/`
mkdirSync(OUT, { recursive: true })
const PORT = Number(process.env.PORT ?? 4372)
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const IPAD = process.env.VP === 'ipad'
const VIEWPORT = IPAD ? { width: 1180, height: 820 } : { width: 393, height: 852 }
const TAG = IPAD ? 'ipad' : 'phone'
const N = Number(process.env.ANIMALS ?? 60)

const SPECIES = ['rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'lamb', 'fox', 'hamster', 'unicorn', 'panda', 'squirrel', 'owl']
const BREEDS = { rabbit: ['upright', 'lop', 'lionhead'], cat: ['domestic', 'longhair', 'mainecoon'], horse: ['shetland', 'fjord', 'arabian'], unicorn: ['foal', 'wavy', 'starhorn'] }
const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'gold', 'rainbow']

const server = await serve(DIST, PORT)
const browser = await launch()
const result = { viewport: VIEWPORT, throttle: THROTTLE, animals: N }
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: !IPAD, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  const cdp = await context.newCDPSession(page)

  await onboard(page, server.url, '0')
  await toMap(page)

  // the grown-ups' copy of the child, with 60 animals, back over the child
  await page.locator('.tv-map .tv-topbar [data-clip="s.ui.adult"]').click()
  await solveGate(page)
  await page.waitForSelector('.tv-dash')
  await page.getByRole('button', { name: 'Indstillinger', exact: true }).click()
  const save = page.getByRole('button', { name: 'Gem en kopi' })
  await save.waitFor({ timeout: 20_000 })
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), save.click()])
  const exported = `${OUT}zoo-export.json`
  await download.saveAs(exported)
  const file = JSON.parse(readFileSync(exported, 'utf8'))
  const doc = file.profiles[0].doc
  const first = doc.animals[0]
  const now = Date.now()
  for (let i = doc.animals.length; i < N; i++) {
    const species = SPECIES[i % SPECIES.length]
    const breeds = BREEDS[species] ?? ['std']
    const stage = 1 + (i % 3)
    doc.animals.push({
      ...first,
      uid: `perf-${i}`,
      species,
      breed: breeds[Math.floor(i / SPECIES.length) % breeds.length],
      colorway: COLORS[(i * 5) % COLORS.length],
      name: `Ven ${i}`,
      friendship: 1 + (i % 7),
      stage,
      star: false,
      shown: stage,
      outfit: {},
      foundAt: now - (N - i) * 60_000,
      source: 'egg',
    })
  }
  writeFileSync(`${OUT}zoo-export-${N}.json`, JSON.stringify(file))
  await page.locator('.tv-dash input[type="file"]').setInputFiles(`${OUT}zoo-export-${N}.json`)
  await page.getByRole('button', { name: /^Erstat .* data$/ }).click()
  await page.getByText('er erstattet med filens', { exact: false }).waitFor({ timeout: 15_000 })

  // back to the child's side with the arrow, then the zoo
  await page.locator('.tv-dash .tv-topbar [data-clip="s.ui.back"]').click()
  await page.waitForSelector('.tv-dock', { timeout: 20_000 })
  await wait(800)
  await tapEl(page, page.locator('.tv-dock__item').nth(1))
  await page.waitForSelector('[data-zoo] [data-uid]', { timeout: 30_000 })
  await wait(3000)
  result.cells = await page.evaluate(() => document.querySelectorAll('[data-zoo] [data-uid]').length)
  if (result.cells < N) throw new Error(`Dyrehaven viser ${result.cells} af ${N} dyr efter "Erstat"`)
  await wait(4000) // the pictures from the blob URLs
  await page.screenshot({ path: `${OUT}zoo-${TAG}.png` })
  result.animatedCells = await page.evaluate(() => document.querySelectorAll('[data-zoo] [data-uid][data-animated]').length)
  result.svgElements = await page.evaluate(() => document.querySelectorAll('svg *').length)
  result.images = await page.evaluate(() => document.querySelectorAll('[data-zoo] img').length)
  const box = await page.locator('.zoo__scroll').boundingBox()

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await startFrames(page)
  await wait(3000)
  const t0 = await page.evaluate(() => performance.now())
  const x = box.x + box.width / 2
  for (let r = 0; r < 3; r++) {
    await cdp.send('Input.synthesizeScrollGesture', { x, y: box.y + box.height * 0.75, yDistance: -Math.round(box.height * 1.6), speed: 1400, gestureSourceType: 'touch' })
    await wait(600)
  }
  for (let r = 0; r < 3; r++) {
    await cdp.send('Input.synthesizeScrollGesture', { x, y: box.y + box.height * 0.25, yDistance: Math.round(box.height * 1.6), speed: 1400, gestureSourceType: 'touch' })
    await wait(600)
  }
  const t1 = await page.evaluate(() => performance.now())
  await wait(1500)
  const raw = await page.evaluate(() => ({ frames: window.__frames, long: window.__long }))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  const scroll = raw.frames.filter(([t]) => t >= t0 && t <= t1)
  const span = scroll.length > 1 ? scroll[scroll.length - 1][0] - scroll[0][0] : 0
  Object.assign(result, {
    idle: stats(raw.frames.filter(([t]) => t < t0).map(([, d]) => d).slice(1)),
    scroll: stats(scroll.map(([, d]) => d)),
    scrollFps: span ? +((1000 * (scroll.length - 1)) / span).toFixed(1) : null,
    longTasks: { n: raw.long.length, ...(stats(raw.long.map(([, d]) => d)) ?? {}) },
    errors,
  })
  writeFileSync(`${OUT}zoo-${TAG}.json`, JSON.stringify({ ...result, raw }, null, 1))
  console.log(JSON.stringify(result, null, 1))
  await context.close()
} finally {
  await browser.close()
  server.close()
}
