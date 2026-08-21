/**
 * Plays a whole round the way a child would — clicking the real buttons — then
 * hatches the egg and checks the creature turns up in the album. Deliberately
 * gets one question wrong to prove the task comes back inside the same round.
 *
 * Run: npm run build && npx vite preview --port 4173 & node scripts/playthrough.mjs
 */
import { launch } from './browser.mjs'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const SHOTS = 'screenshots'
mkdirSync(SHOTS, { recursive: true })

const log = (...a) => console.log('·', ...a)
const fail = (msg) => {
  console.error('✗', msg)
  process.exitCode = 1
  throw new Error(msg)
}

const state = (page) => page.evaluate(() => window.__round.getState())
const profile = (page) => page.evaluate(() => window.__profile.getState().save)

/** Answer the task currently on screen. `wrong` picks a deliberate mistake. */
async function answer(page, wrong = false) {
  const s = await state(page)
  const task = s.status === 'golden' ? s.goldenTask : s.current
  if (!task) fail('no task on screen')
  const target = wrong
    ? (task.options.find((o) => o !== task.answer) ?? task.answer + 1)
    : task.answer

  switch (task.kind) {
    case 'choice':
    case 'pair':
      await page.getByRole('button', { name: String(target), exact: true }).first().click()
      break

    case 'keypad':
      for (const digit of String(Math.max(0, target))) {
        await page.getByRole('button', { name: digit, exact: true }).first().click()
      }
      await page.getByRole('button', { name: 'Svar' }).click()
      break

    case 'count': {
      const fruit = page.getByRole('button', { name: 'Læg i kurven' })
      for (let i = 0; i < Math.max(0, target); i++) await fruit.first().click()
      await page.getByRole('button', { name: 'Færdig' }).click()
      break
    }

    case 'numberline': {
      const track = page.getByRole('slider')
      const box = await track.boundingBox()
      const [min, max] = task.range
      const ratio = (target - min) / (max - min)
      await page.mouse.click(box.x + box.width * ratio, box.y + box.height * 0.55)
      await page.getByRole('button', { name: 'Sæt her' }).click()
      break
    }

    default:
      fail(`unknown task kind ${task.kind}`)
  }
  return { task, given: target }
}

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await context.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${BASE}/?e2e=1`, { waitUntil: 'networkidle' })

// --- first run -------------------------------------------------------------
await page.getByLabel('Dit navn').fill('Alma')
await page.getByRole('button', { name: '🐸' }).click()
await page.screenshot({ path: `${SHOTS}/1-velkommen.png` })
await page.getByRole('button', { name: 'Kom i gang' }).click()

await page.getByRole('button', { name: /^Tælleskoven — /, }).waitFor()
await page.screenshot({ path: `${SHOTS}/2-kort.png` })
log('welcome → map')

// locked islands must actually be locked on a fresh save
const locked = await page.getByRole('button', { name: 'Minusmosen — låst' }).isDisabled()
if (!locked) fail('a later island was open on a brand new save')

// --- one round -------------------------------------------------------------
await page.getByRole('button', { name: /^Tælleskoven — / }).click()
await page.getByRole('button', { name: 'Kurven', exact: true }).click()
await page.waitForFunction(() => window.__round.getState().status === 'playing')
await page.screenshot({ path: `${SHOTS}/3-opgave.png` })
log('round started')

// deliberately wrong once — the same fact must come back inside this round
const before = await state(page)
const missed = await answer(page, true)
await page.waitForFunction(() => window.__round.getState().lastResult !== null)
const shown = await state(page)
if (shown.lastResult.correct) fail('a wrong answer was accepted as correct')
await page.screenshot({ path: `${SHOTS}/4-forkert.png` })
await page.waitForFunction(() => window.__round.getState().lastResult === null)
const after = await state(page)
if (!after.queue.some((t) => t.factId === missed.task.factId) && after.current?.factId !== missed.task.factId) {
  fail('the missed fact was not put back into the round')
}
log('wrong answer handled and re-queued')

// now play it out
let guard = 0
while ((await state(page)).status !== 'finished') {
  if (guard++ > 60) fail('round never finished')
  const s = await state(page)
  if (s.status === 'golden') log('golden egg appeared')
  await answer(page)
  await page.waitForFunction(() => window.__round.getState().lastResult !== null)
  await page.waitForFunction(() => window.__round.getState().lastResult === null, null, { timeout: 5000 })
}
const done = await state(page)
if (done.answered !== done.total) fail(`finished with ${done.answered}/${done.total} cleared`)
log(`round finished — ${done.answered}/${done.total} cleared, best streak ${done.bestStreak}`)

// --- reward ----------------------------------------------------------------
await page.screenshot({ path: `${SHOTS}/5-resultat.png` })
await page.getByRole('button', { name: 'Åbn ægget' }).click()
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Slå på ægget' }).click()
await page.getByRole('button', { name: /^Behold/ }).waitFor({ timeout: 5000 })
await page.screenshot({ path: `${SHOTS}/6-klaekket.png` })
const suggestion = page.locator('button', { hasText: /^[A-ZÆØÅ][a-zæøå-]+$/ }).first()
await suggestion.click()
await page.getByRole('button', { name: /^Behold/ }).click()
log('egg hatched and creature kept')

// --- it stuck --------------------------------------------------------------
await page.getByRole('button', { name: 'Album' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/7-album.png` })
const saved = await profile(page)
if (saved.creatures.length !== 1) fail(`expected 1 creature in the album, got ${saved.creatures.length}`)
if (saved.totalRounds !== 1) fail(`expected 1 completed round, got ${saved.totalRounds}`)
if (Object.keys(saved.facts).length === 0) fail('no fact progress was recorded')
log(`saved: ${saved.creatures[0].name}, ${Object.keys(saved.facts).length} facts practised`)

// progress must survive a reload — this is the whole point of the storage layer
await page.reload({ waitUntil: 'networkidle' })
const reloaded = await profile(page)
if (reloaded.creatures.length !== 1) fail('the collection did not survive a reload')
log('progress survived a reload')

// the second island must be open now that a round is done... after 4 of them
await page.getByRole('button', { name: /^Plusengen — / }).waitFor()

// --- iPad ------------------------------------------------------------------
await page.setViewportSize({ width: 1180, height: 820 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/8-ipad-kort.png` })
await page.getByRole('button', { name: /^Tælleskoven — / }).click()
await page.getByRole('button', { name: 'Hvor mange?', exact: true }).click()
await page.waitForFunction(() => window.__round.getState().status === 'playing')
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/9-ipad-opgave.png` })
log('iPad landscape rendered')

// --- every input kind, on the islands that use them ----------------------
// Unlock the map so the later inputs can actually be exercised; keypad, drag
// and the number line are where a touch bug would hide.
await page.evaluate(() => {
  const profile = window.__profile.getState()
  const levels = {}
  for (const island of window.__islands) for (const level of island.levels) levels[level.id] = 1
  profile.replaceSave({ ...profile.save, levels })
})
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })

for (const [islandName, levelName, expectKind] of [
  ['Plusengen', 'Skriv selv', 'keypad'],
  ['Tiervennernes hule', 'Find makkeren', 'pair'],
  ['Dobbeltbjerget', 'Alle dobbelte', 'numberline'],
]) {
  await page.getByRole('button', { name: new RegExp(`^${islandName} — `) }).click()
  await page.getByRole('button', { name: levelName, exact: true }).click()
  await page.waitForFunction(() => window.__round.getState().status === 'playing')

  let sawKind = false
  let steps = 0
  while ((await state(page)).status !== 'finished') {
    if (steps++ > 60) fail(`${levelName} never finished`)
    const s = await state(page)
    const kind = (s.status === 'golden' ? s.goldenTask : s.current).kind
    if (kind === expectKind) {
      sawKind = true
      if (steps <= 3) {
        await page.waitForTimeout(500)
        await page.screenshot({ path: `${SHOTS}/kind-${expectKind}.png` })
      }
    }
    await answer(page)
    await page.waitForFunction(() => window.__round.getState().lastResult !== null)
    const after = await state(page)
    if (!after.lastResult.correct) fail(`${expectKind}: a correct answer was rejected on ${JSON.stringify(after.lastResult)}`)
    await page.waitForFunction(() => window.__round.getState().lastResult === null, null, { timeout: 5000 })
  }
  if (!sawKind) fail(`${levelName} never presented a ${expectKind} task`)
  log(`${expectKind} works — ${levelName} played through`)

  await page.getByRole('button', { name: 'Åbn ægget' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Slå på ægget' }).click()
  await page.getByRole('button', { name: /^Behold/ }).click()
}

// --- the grown-up panel --------------------------------------------------
await page.getByRole('button', { name: 'For voksne' }).click()
const sum = await page.locator('p.text-5xl').textContent()
const [a, b] = sum.split('×').map((n) => Number(n.trim()))
await page.getByLabel('Svar').fill(String(a * b))
await page.getByText('Fremgang', { exact: true }).waitFor({ timeout: 4000 })
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/10-foraeldre.png`, fullPage: false })
log('parent panel opens behind its gate')

if (errors.length) {
  console.error('✗ console errors:', errors.slice(0, 8))
  process.exitCode = 1
} else {
  console.log('\n✓ playthrough clean — no console errors')
}

await browser.close()
