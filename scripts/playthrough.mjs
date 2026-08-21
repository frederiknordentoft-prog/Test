/**
 * Plays the game the way a child would — clicking the real buttons — and checks
 * the things that are easy to break and impossible to see in a type check: that a
 * mistake stops the round until the child taps the right answer, that a paused
 * round comes back whole, and that every input kind actually accepts a correct
 * answer.
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
const currentTask = (s) => (s.status === 'golden' ? s.goldenTask : s.current)

async function answer(page, wrong = false) {
  const s = await state(page)
  const task = currentTask(s)
  if (!task) fail('no task on screen')
  const target = wrong ? (task.options.find((o) => o !== task.answer) ?? task.answer + 1) : task.answer

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
      const slider = page.getByRole('slider')
      const line = page.locator('[data-numberline-track]')
      const [min, max] = task.range
      // measure the line itself — the same geometry the app maps a tap onto
      await line.waitFor()
      const box = await line.boundingBox()
      await page.mouse.click(
        box.x + box.width * ((target - min) / (max - min)),
        box.y + box.height * 0.6,
      )
      const placed = await slider.getAttribute('aria-valuenow')
      if (Number(placed) !== target) {
        const diag = await page.evaluate(() => {
          const r = window.__round.getState()
          return { locked: r.lastResult !== null, status: r.status, kind: (r.current ?? {}).kind }
        })
        fail(`number line ignored the tap: wanted ${target}, marker says ${placed} — ${JSON.stringify(diag)}`)
      }
      await page.getByRole('button', { name: 'Sæt her' }).click()
      break
    }
    default:
      fail(`unknown task kind ${task.kind}`)
  }
  return { task, given: target }
}

/** Wait out the feedback. A mistake now stops the round until the child taps the answer. */
async function settle(page, { expectTeaching = false } = {}) {
  await page.waitForFunction(() => window.__round.getState().lastResult !== null)
  const s = await state(page)
  if (s.lastResult.correct) {
    if (expectTeaching) fail('expected a wrong answer, got a correct one')
    await page.waitForFunction(() => window.__round.getState().lastResult === null, null, { timeout: 6000 })
    return s
  }

  const tapAnswer = page.getByRole('button', { name: /^Tryk på \d+$/ })
  await tapAnswer.waitFor({ timeout: 5000 })

  // and it must not move on by itself while the method is up
  const before = await state(page)
  await page.waitForTimeout(2500)
  const after = await state(page)
  if (after.lastResult === null || after.current?.id !== before.current?.id) {
    fail('the round moved on by itself after a mistake instead of waiting for the child')
  }

  await tapAnswer.click()
  await page.waitForFunction(() => window.__round.getState().lastResult === null, null, { timeout: 6000 })
  return s
}

async function playOut(page, { screenshotKind, shotName } = {}) {
  let sawKind = false
  let steps = 0
  while ((await state(page)).status !== 'finished') {
    if (steps++ > 70) fail('round never finished')
    const s = await state(page)
    if (currentTask(s).kind === screenshotKind && !sawKind) {
      sawKind = true
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/${shotName ?? `kind-${screenshotKind}`}.png` })
    }
    await answer(page)
    const settled = await settle(page)
    if (!settled.lastResult.correct) fail('a correct answer was rejected')
  }
  return sawKind
}

async function hatch(page, { again = false } = {}) {
  await page.getByRole('button', { name: 'Åbn ægget' }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Slå på ægget' }).click()
  await page.getByRole('button', { name: /^Behold/ }).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: /^Behold/ }).click()
  await page.getByRole('button', { name: again ? /En tur mere/ : 'Til kortet' }).click()
}

const browser = await launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await context.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${BASE}/?e2e=1`, { waitUntil: 'networkidle' })

// --- first run ------------------------------------------------------------
await page.getByRole('button', { name: 'Vælg 🐸' }).click()
await page.getByLabel('Dit navn').fill('Alma')
await page.screenshot({ path: `${SHOTS}/1-velkommen.png` })
await page.getByRole('button', { name: 'Kom i gang' }).click()

await page.getByRole('button', { name: /^Tælleskoven — / }).waitFor()
await page.screenshot({ path: `${SHOTS}/2-kort.png` })
log('welcome → map')

if (!(await page.getByRole('button', { name: 'Minusmosen — låst' }).isDisabled())) {
  fail('a later island was open on a brand new save')
}

// --- one tap to a round ---------------------------------------------------
await page.getByRole('button', { name: /Spil videre/ }).click()
await page.waitForFunction(() => window.__round.getState().status === 'playing')
log('"Spil videre" starts a round without going through the map')
await page.screenshot({ path: `${SHOTS}/3-opgave.png` })

// --- a mistake has to teach, and has to wait ------------------------------
const missed = await answer(page, true)
await page.getByRole('button', { name: /^Tryk på \d+$/ }).waitFor({ timeout: 5000 })
await page.screenshot({ path: `${SHOTS}/4-forkert.png` })
await settle(page, { expectTeaching: true })
const afterMiss = await state(page)
if (!afterMiss.queue.some((t) => t.factId === missed.task.factId) && afterMiss.current?.factId !== missed.task.factId) {
  fail('the missed fact was not put back into the round')
}
log('a mistake shows the method and waits for the child to tap the answer')

// --- pause and come back --------------------------------------------------
// clear a few first, so the test proves actual progress survives
for (let i = 0; i < 3; i++) {
  await answer(page)
  await settle(page)
}
const beforePause = await state(page)
if (beforePause.answered < 3) fail('expected some progress before pausing')
await page.getByRole('button', { name: 'Hold pause' }).click()
await page.getByRole('button', { name: 'Hold pause' }).nth(1).click()
const resumeCard = page.getByRole('button', { name: /Fortsæt turen/ })
await resumeCard.waitFor({ timeout: 4000 })
await page.screenshot({ path: `${SHOTS}/5-pause.png` })
await resumeCard.click()
await page.waitForFunction(() => window.__round.getState().status === 'playing')
const afterResume = await state(page)
if (afterResume.answered !== beforePause.answered) fail(`resume lost progress: ${afterResume.answered} vs ${beforePause.answered}`)
if (afterResume.total !== beforePause.total) fail('resume changed the length of the round')
if (!afterResume.current) fail('resume came back without a task')
// pausing mid-golden deliberately moves on past the task that summoned the egg,
// so only a plain pause has to come back to the very same task
if (beforePause.status === 'playing' && beforePause.lastResult === null) {
  if (afterResume.current.id !== beforePause.current?.id) fail('resuming did not bring back the same task')
  if (afterResume.queue.length !== beforePause.queue.length) fail('resume lost part of the queue')
}
log(`paused and resumed — ${afterResume.answered}/${afterResume.total} kept`)

await playOut(page)
const done = await state(page)
if (done.answered !== done.total) fail(`finished with ${done.answered}/${done.total} cleared`)
log(`round finished — ${done.answered}/${done.total} cleared, best streak ${done.bestStreak}`)

// --- reward, and straight into the next round -----------------------------
await page.screenshot({ path: `${SHOTS}/6-resultat.png` })
await page.getByRole('button', { name: 'Åbn ægget' }).click()
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Slå på ægget' }).click()
await page.getByRole('button', { name: /^Behold/ }).waitFor({ timeout: 5000 })
await page.screenshot({ path: `${SHOTS}/7-klaekket.png` })
await page.getByRole('button', { name: /^Behold/ }).click()
await page.getByRole('button', { name: /En tur mere/ }).waitFor({ timeout: 4000 })
await page.getByRole('button', { name: /En tur mere/ }).click()
await page.waitForFunction(() => window.__round.getState().status === 'playing')
log('"En tur mere" goes straight into the next round')

await page.getByRole('button', { name: 'Hold pause' }).click()
await page.getByRole('button', { name: 'Hold pause' }).nth(1).click()
await page.getByRole('button', { name: /Fortsæt turen/ }).waitFor()

// --- it stuck -------------------------------------------------------------
await page.getByRole('button', { name: 'Album' }).click()
await page.waitForTimeout(300)
const saved = await profile(page)
if (saved.creatures.length !== 1) fail(`expected 1 creature, got ${saved.creatures.length}`)
if (saved.totalRounds !== 1) fail(`expected 1 completed round, got ${saved.totalRounds}`)

// the buddy comes along on the next round
await page.getByRole('button', { name: /^Tag .* med på tur$/ }).first().click()
await page.waitForTimeout(200)
const withBuddy = await profile(page)
if (!withBuddy.buddyUid) fail('picking a creature in the album did not set the buddy')
await page.screenshot({ path: `${SHOTS}/8-album.png` })
log(`saved: ${saved.creatures[0].name}; buddy chosen`)

await page.reload({ waitUntil: 'networkidle' })
const reloaded = await profile(page)
if (reloaded.creatures.length !== 1) fail('the collection did not survive a reload')
if (!reloaded.pausedRound) fail('the paused round did not survive a reload')
log('collection and paused round survived a reload')

// --- every input kind, on the islands that use them -----------------------
await page.evaluate(() => {
  const profile = window.__profile.getState()
  const levels = {}
  for (const island of window.__islands) for (const level of island.levels) levels[level.id] = 1
  profile.replaceSave({ ...profile.save, levels, pausedRound: null })
})
await page.reload({ waitUntil: 'networkidle' })

for (const [islandName, levelName, expectKind] of [
  ['Plusengen', 'Skriv selv', 'keypad'],
  ['Tiervennernes hule', 'Find makkeren', 'pair'],
  ['Dobbeltbjerget', 'Alle dobbelte', 'numberline'],
]) {
  await page.getByRole('button', { name: new RegExp(`^${islandName} — `) }).click()
  await page.getByRole('button', { name: levelName, exact: true }).click()
  await page.waitForFunction(() => window.__round.getState().status === 'playing')
  if (!(await playOut(page, { screenshotKind: expectKind }))) fail(`${levelName} never presented a ${expectKind} task`)
  log(`${expectKind} works — ${levelName} played through`)
  await hatch(page)
}

// --- the grown-up panel ---------------------------------------------------
await page.getByRole('button', { name: 'For voksne' }).click()
const sum = await page.locator('p.text-5xl').textContent()
const [a, b] = sum.split('×').map((n) => Number(n.trim()))
await page.getByLabel('Svar').fill(String(a * b))
await page.getByText('Niveau', { exact: true }).waitFor({ timeout: 4000 })
await page.getByRole('button', { name: '2. klasse' }).click()
await page.waitForTimeout(200)
const opened = await profile(page)
if (!opened.unlockedIslands.includes('hav')) fail('the grade picker did not open the later islands')
await page.screenshot({ path: `${SHOTS}/9-foraeldre.png` })
log('parent panel opens islands by school year')

// --- orientations ---------------------------------------------------------
await page.getByRole('button', { name: 'Tilbage' }).click()
for (const [w, h, name] of [[844, 390, '10-iphone-landskab'], [1180, 820, '11-ipad-landskab']]) {
  await page.setViewportSize({ width: w, height: h })
  // after the first pass the map offers to resume instead of to start something new
  const resume = page.getByRole('button', { name: /Fortsæt turen/ })
  await ((await resume.count()) > 0 ? resume : page.getByRole('button', { name: /Spil videre/ })).click()
  await page.waitForFunction(() => window.__round.getState().status === 'playing')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2)
  if (overflow) fail(`${name}: the screen overflows and cannot scroll`)
  await page.getByRole('button', { name: 'Hold pause' }).click()
  await page.getByRole('button', { name: 'Hold pause' }).nth(1).click()
  log(`${name} fits without overflow`)
}

if (errors.length) {
  console.error('✗ console errors:', errors.slice(0, 8))
  process.exitCode = 1
} else {
  console.log('\n✓ playthrough clean — no console errors')
}

await browser.close()
