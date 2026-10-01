// Plays whole rounds in the task harness the way a child would, with real pointer input on the
// screen (dev only). Needs the dev server on port 4316:
//   npx vite --port 4316 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/dev/tasks/play.mjs
// Round 1 (?view=round, the engine's fixture skills, a fresh profile): demo films, right answers,
// one mistake with the strategy and the confirm button, pause → "Spil videre", pause → "Til kortet"
// and resume from the saved snapshot, the "Tryk for at fortsætte" overlay after the app was away,
// the golden egg caught, and the end of the round. Round 2 (?view=kind&golden=1): the egg skipped.
// Fails on any console error or page error. Exit code 0 when everything held.
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.TASKS_URL ?? 'http://127.0.0.1:4316/tasks.html'
const VIEWPORT = { width: 393, height: 852 }
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
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
  await page.waitForTimeout(40)
}

const harness = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__harness)))
const state = (page) => page.evaluate(() => window.__drive.roundState())
const task = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__drive.currentTask())))
const said = async (page, text) => (await harness(page)).log.some((l) => l.includes(text))

/** Answers through the screen: taps cards, keys, points on the line; drags go through __drive. */
async function answer(page, t, value) {
  const area = '.tv-round__answer'
  const esc = (v) => String(v).replaceAll('"', '\\"')
  switch (t.kind) {
    case 'choice':
    case 'trueFalse':
      await tap(page, `${area} [data-option="${esc(value)}"]`)
      return
    case 'keypad': {
      for (const d of String(value / t.entryScale)) await tap(page, `${area} [data-key="${d}"]`)
      await tap(page, `${area} [data-check]`)
      return
    }
    case 'multiSelect': {
      for (const v of String(value).split('|')) await tap(page, `${area} [data-option="${esc(v)}"]`)
      await tap(page, `${area} [data-check]`)
      return
    }
    case 'numberline': {
      const p = await page.evaluate((v) => {
        const s = document.querySelector('.tv-round__answer .tv-nline__surface')
        const t = window.__drive.currentTask()
        const line = t.prompt.scene === 'line' ? t.prompt : null
        const [min, max] = line ? [line.min, line.max] : t.range
        const r = s.getBoundingClientRect()
        const pad = Number(s.dataset.linePad ?? 24)
        return { x: r.left + pad + ((v - min) / (max - min)) * (r.width - 2 * pad), y: r.top + r.height * 0.7 }
      }, Number(value))
      await page.mouse.click(p.x, p.y)
      await page.waitForTimeout(60)
      await tap(page, `${area} [data-check]`)
      return
    }
    default:
      await page.evaluate((v) => window.__drive.answer(v), value)
  }
}

/** Waits for the next thing the player has to do something about. */
async function next(page, timeout = 20000) {
  const handle = await page.waitForFunction(
    () => {
      const exit = document.querySelector('[data-exit]')
      if (exit) return { what: 'exit', exit: exit.getAttribute('data-exit') }
      if (document.querySelector('[data-demo-film]')) return { what: 'demo' }
      const r = document.querySelector('.tv-round[data-beat="asking"]')
      if (r) return { what: 'ask', golden: r.classList.contains('is-golden') }
      return null
    },
    null,
    { timeout, polling: 50 },
  )
  return handle.jsonValue()
}

async function playRound(page) {
  await page.goto(`${BASE}?view=round&shot=1&e2e=1&voice=fast&resume=0&safe=x`, { waitUntil: 'networkidle' })
  let correct = 0
  let demos = 0
  let mistake = null
  let paused = false
  let away = false
  let egg = false
  const seen = new Set()
  const kinds = new Set()
  for (let guard = 0; guard < 80; guard++) {
    const n = await next(page)
    if (n.what === 'exit') {
      if (n.exit === 'finished') break
      throw new Error(`uventet exit ${n.exit}`)
    }
    if (n.what === 'demo') {
      demos++
      // the first film plays to its end; later ones are tapped away like an impatient child
      if (demos === 1) await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 15000 })
      else {
        await page.waitForTimeout(900)
        await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2)
        await page.waitForSelector('[data-demo-film]', { state: 'detached', timeout: 4000 })
      }
      continue
    }
    const t = await task(page)
    if (n.golden) {
      const before = (await harness(page)).answers.length
      await answer(page, t, t.answer)
      await page.waitForFunction(() => window.__drive.roundState().goldenCaught, null, { timeout: 4000 })
      check(true, `guldægget (${t.kind}) blev fanget`)
      check((await harness(page)).answers.length === before + 1, 'det fangede guldæg er registreret som svar')
      await page.waitForTimeout(400)
      check(await said(page, 'Du fangede guldægget'), 'guldægget roses')
      egg = true
      continue
    }
    const first = !seen.has(t.id)
    seen.add(t.id)
    kinds.add(t.kind)

    // ── pause twice: "Spil videre", then "Til kortet" and resume from the saved round ──
    if (!paused && correct >= 3 && mistake) {
      paused = true
      const before = await state(page)
      await tap(page, '.tv-topbar [data-clip="s.ui.close"]')
      await page.waitForSelector('[data-pause]')
      check(true, 'krydset åbner pausen')
      await tap(page, '[data-pause] [data-resume]')
      await page.waitForSelector('[data-pause]', { state: 'detached' })
      await page.waitForSelector('.tv-round[data-beat="asking"]')
      check((await state(page)).current === before.current, '"Spil videre" fortsætter samme opgave')
      await tap(page, '.tv-topbar [data-clip="s.ui.close"]')
      await page.waitForSelector('[data-pause]')
      await tap(page, '[data-pause] [data-leave]')
      await page.waitForSelector('[data-exit="paused"]')
      check((await harness(page)).exits.includes('paused'), '"Til kortet" forlader turen som pause')
      await tap(page, '[data-dev-resume]')
      await page.waitForSelector('[data-exit]', { state: 'detached', timeout: 5000 })
      await page.waitForSelector('.tv-round[data-beat="asking"]', { timeout: 15000 })
      const after = await state(page)
      check(after.current === before.current && after.cleared === before.cleared && after.total === before.total,
        `turen genoptages samme sted (opgave ${after.current}, ${after.cleared}/${after.total} sten)`)
      continue
    }

    // ── the app was away: "Tryk for at fortsætte" ──
    if (!away && paused) {
      away = true
      const before = await state(page)
      await page.evaluate(() => {
        const set = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
        set('hidden')
        document.dispatchEvent(new Event('visibilitychange'))
        set('visible')
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForSelector('[data-continue]')
      await tap(page, '[data-continue]')
      await page.waitForSelector('[data-continue]', { state: 'detached' })
      check((await state(page)).current === before.current, '"Tryk for at fortsætte" vender tilbage til samme opgave')
    }

    // ── one mistake: struck answer, strategy, the confirm button with the right answer ──
    const wrong = !mistake && correct >= 1 && first ? await page.evaluate((x) => window.__drive.wrongFor(x), t) : null
    if (wrong !== null && wrong !== undefined) {
      mistake = t
      await answer(page, t, wrong)
      await page.waitForSelector('[data-teaching]', { timeout: 6000 })
      const h = await page.evaluate(() => ({
        hint: !!document.querySelector('[data-teaching] .tv-hint'),
        struck: !!document.querySelector('[data-teaching] .tv-teach__given .tv-strike'),
        confirm: document.querySelector('[data-confirm]')?.getAttribute('data-confirm'),
      }))
      check(h.hint && h.struck, `fejl i ${t.kind}: svaret streges ud og strategien vises`)
      check(h.confirm === String(t.answer), `bekræft-knappen viser det rigtige svar (${h.confirm})`)
      await page.waitForTimeout(500)
      check(await said(page, 'Tryk på') || await said(page, 'Tryk her'), 'bekræft-knappen læses op')
      await tap(page, '[data-confirm]')
      await page.waitForSelector('[data-teaching]', { state: 'detached', timeout: 6000 })
      continue
    }

    await answer(page, t, t.answer)
    await page.waitForSelector('.tv-round[data-beat="correct"], [data-exit]', { timeout: 6000 })
    correct++
  }
  const h = await harness(page)
  console.log(`     opgavetyper i turen: ${[...kinds].join(', ')}`)
  check(demos >= 1, `demo-film blev vist (${demos})`)
  check(!!mistake, 'en fejl blev spillet')
  check(paused, 'pause og genoptag blev spillet')
  check(away, '"Tryk for at fortsætte" blev spillet')
  check(egg, 'guldægget kom i turen')
  check(h.exits.join(',') === 'paused,finished', `turen sluttede (${h.exits.join(',')})`)
  check(h.log.some((l) => l.startsWith('finish:')), `profilen fik resultatet (${h.log.find((l) => l.startsWith('finish:'))})`)
  const wrongs = h.answers.filter((a) => !a.correct)
  check(wrongs.length === 1, `præcis én forkert besvarelse registreret (${wrongs.length} af ${h.answers.length})`)
  check(mistake && h.answers.some((a) => a.correct && a.mode === 'retry'), 'den fejlede opgave kom igen og blev løst')
  return correct
}

async function skipEgg(page) {
  await page.goto(`${BASE}?view=kind&ex=choice-8%2B5&shot=1&e2e=1&voice=fast&demo=0&golden=1&safe=x`, { waitUntil: 'networkidle' })
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.tv-round[data-beat="asking"]:not(.is-golden)', { timeout: 15000 })
    const t = await task(page)
    await answer(page, t, t.answer)
    await page.waitForSelector('.tv-round[data-beat="correct"]')
  }
  await page.waitForSelector('.tv-round.is-golden[data-beat="asking"]', { timeout: 10000 })
  check(true, 'guldægget kommer efter tre rigtige')
  await tap(page, '[data-skip-egg], .tv-topbar [data-clip="s.ui.skip"]')
  await page.waitForFunction(() => {
    const r = document.querySelector('.tv-round')
    return r && !r.classList.contains('is-golden') && r.getAttribute('data-beat') === 'asking'
  }, null, { timeout: 8000 })
  const s = await state(page)
  check(!s.goldenCaught && s.goldenUsed, 'guldægget kan springes over, og turen går videre')
  check(!(await harness(page)).answers.some((a) => a.mode === 'golden'), 'et sprunget guldæg registreres ikke')
}

const browser = await launch()
const t0 = Date.now()
try {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    const n = await playRound(page)
    console.log(`     ${n} rigtige svar i turen`)
    await skipEgg(page)
  } catch (err) {
    check(false, `spillet gik i stå: ${String(err).split('\n')[0]}`)
    const beat = await page.evaluate(() => document.querySelector('.tv-round')?.getAttribute('data-beat')).catch(() => null)
    console.log(`     skærm: beat=${beat}`)
    await page.screenshot({ path: 'artifacts/tasks/play-failure.png' }).catch(() => {})
  }
  const own = await page.evaluate(() => window.__harness?.errors ?? []).catch(() => [])
  check(errors.length === 0 && own.length === 0, `0 konsolfejl${errors.length ? `: ${errors.join(' | ').slice(0, 300)}` : ''}`)
  await ctx.close()
} finally {
  await browser.close()
}
const failed = checks.filter((c) => !c.ok).length
console.log(`${checks.length - failed}/${checks.length} tjek holdt · ${Math.round((Date.now() - t0) / 1000)} s`)
if (failed) process.exitCode = 1
