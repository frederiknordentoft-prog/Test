// Renders the task harness to PNG for review (dev only). Needs the dev server on port 4316:
//   npx vite --port 4316 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/dev/tasks/shoot.mjs [filter…]
// Writes artifacts/tasks/*.png (gitignored) and prints an audit per shot: horizontal or vertical
// overflow, buttons outside the screen, tap targets under 60 x 60 px and console errors.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.TASKS_URL ?? 'http://127.0.0.1:4316/tasks.html'
const OUT = fileURLToPath(new URL('../../../artifacts/tasks/', import.meta.url))
const filters = process.argv.slice(2)

const VP = {
  'se-p': { w: 375, h: 667, safe: 'se' },
  'se-l': { w: 667, h: 375, safe: 'se' },
  'x-p': { w: 393, h: 852, safe: 'x' },
  'x-l': { w: 852, h: 393, safe: 'x' },
  'ipad-p': { w: 820, h: 1180, safe: 'ipad' },
  'ipad-l': { w: 1180, h: 820, safe: 'ipad' },
}
const ALL = Object.keys(VP)

/** [example id, wrong answer state?] — every kind's first example, plus the strategy films. */
const KIND_SHOTS = [
  'choice-8+5', 'choice-unit', 'choice-shape', 'choice-clock', 'choice-weight', 'keypad-38+45', 'keypad-hear53', 'keypad-kr', 'count-7', 'count-14', 'pair-3',
  'line-37', 'line-after7', 'line-600', 'tf-balance', 'tf-half', 'sort-numbers', 'sort-lengths', 'multi-triangles', 'multi-heavier', 'fill-pattern',
  'fill-skip', 'fill-fraction', 'base-34', 'base-205',
  // wave 2 (kind2.mjs plays them with touch drags)
  'clock-half', 'clock-digital', 'pay-17', 'pay-75', 'pay-1250', 'share-12-3', 'share-20-4', 'parts-3/4', 'parts-1/2-rect', 'parts-2/3-bar', 'parts-1/4-square',
]
const TEACH_SHOTS = [
  'choice-8+5', 'keypad-38+45', 'keypad-hear53', 'keypad-52-37', 'count-7', 'line-37', 'sort-numbers', 'multi-heavier', 'fill-fraction', 'base-34', 'pair-3', 'tf-half',
  'clock-half', 'pay-fewest', 'share-12-3', 'parts-1/2-rect',
]

const jobs = []
for (const ex of KIND_SHOTS) for (const vp of ALL) jobs.push({ name: `ask-${ex}-${vp}`, vp, q: { view: 'kind', ex, demo: '0' }, state: 'ask' })
for (const ex of TEACH_SHOTS) for (const vp of ALL) jobs.push({ name: `teach-${ex}-${vp}`, vp, q: { view: 'kind', ex, demo: '0' }, state: 'teach' })
for (const ex of ['choice-8+5', 'keypad-38+45', 'count-7', 'pair-3', 'line-37', 'tf-balance', 'sort-numbers', 'multi-triangles', 'fill-pattern', 'base-34', 'clock-half', 'pay-17', 'share-12-3', 'parts-3/4']) {
  for (const vp of ['x-p', 'se-l', 'ipad-p']) jobs.push({ name: `demo-${ex}-${vp}`, vp, q: { view: 'kind', ex, demo: '1' }, state: 'demo' })
}
for (const vp of ALL) {
  jobs.push({ name: `correct-choice-${vp}`, vp, q: { view: 'kind', ex: 'choice-8+5', demo: '0' }, state: 'correct' })
  jobs.push({ name: `golden-${vp}`, vp, q: { view: 'kind', ex: 'choice-8+5', demo: '0', golden: '1' }, state: 'golden' })
  jobs.push({ name: `pause-${vp}`, vp, q: { view: 'kind', ex: 'keypad-38+45', demo: '0' }, state: 'pause' })
  jobs.push({ name: `bulb-${vp}`, vp, q: { view: 'kind', ex: 'keypad-38+45', demo: '0' }, state: 'bulb' })
  jobs.push({ name: `round-${vp}`, vp, q: { view: 'round', demo: '0', resume: '0' }, state: 'ask' })
  jobs.push({ name: `calm-${vp}`, vp, q: { view: 'kind', ex: 'count-7', demo: '0', calm: '1' }, state: 'ask' })
}
jobs.push({ name: 'gallery-hints', vp: 'ipad-l', q: { view: 'hints' }, state: 'gallery', full: true })
jobs.push({ name: 'gallery-scenes', vp: 'ipad-l', q: { view: 'scenes' }, state: 'gallery', full: true })

const selected = filters.length ? jobs.filter((j) => filters.some((f) => j.name.includes(f))) : jobs
mkdirSync(OUT, { recursive: true })

const FREEZE = '*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}'

async function beat(page, name, timeout = 10000) {
  await page.waitForSelector(`.tv-round[data-beat="${name}"]`, { timeout })
}

const browser = await launch()
let failed = 0
try {
  for (const job of selected) {
    const v = VP[job.vp]
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, hasTouch: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const q = new URLSearchParams({ shot: '1', safe: v.safe, e2e: '1', voice: 'fast', ...job.q })
    try {
      await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      if (job.state === 'gallery') {
        await page.waitForTimeout(2600)
      } else if (job.state === 'demo') {
        await page.waitForSelector('[data-demo-film]', { timeout: 8000 })
        await page.waitForTimeout(1750)
      } else {
        await beat(page, 'asking')
        const ex = job.q.ex
        if (job.state === 'teach') {
          await page.evaluate(async (id) => {
            const { EXAMPLES } = await import('/src/dev/tasks/examples.ts')
            const all = Object.values(EXAMPLES).flat()
            const e = all.find((x) => x.id === id)
            await window.__drive.answer(e.wrong)
          }, ex)
          await beat(page, 'teaching')
          await page.waitForTimeout(3600)
        } else if (job.state === 'correct') {
          await page.evaluate(async () => window.__drive.answer(window.__drive.currentTask().answer))
          await page.waitForTimeout(260)
        } else if (job.state === 'golden') {
          for (let i = 0; i < 3; i++) {
            await page.evaluate(async () => window.__drive.answer(window.__drive.currentTask().answer))
            await page.waitForTimeout(i < 2 ? 1300 : 200)
            if (i < 2) await beat(page, 'asking')
          }
          await page.waitForSelector('.tv-round.is-golden[data-beat="asking"]', { timeout: 8000 })
          await page.waitForTimeout(400)
        } else if (job.state === 'pause') {
          await page.click('.tv-topbar [data-clip="s.ui.close"]')
          await page.waitForSelector('[data-pause]')
          await page.waitForTimeout(500)
        } else if (job.state === 'bulb') {
          await page.click('[data-bulb]')
          await page.waitForSelector('[data-scaffold]')
          await page.waitForTimeout(700)
        } else {
          await page.waitForTimeout(700)
        }
      }
      await page.addStyleTag({ content: FREEZE })
      await page.waitForTimeout(80)
      await page.screenshot({ path: `${OUT}${job.name.replaceAll('/', '_')}.png`, fullPage: !!job.full })
      const a = await page.evaluate(() => {
        const doc = document.documentElement
        const over = doc.scrollWidth > innerWidth + 1 || doc.scrollHeight > innerHeight + 1
        const targets = [...document.querySelectorAll('button, [role="button"], [role="slider"]')]
          .filter((el) => !el.closest('.dv-bar, .tv-demo__scene, .dv-gallery'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden')
        const small = targets
          .filter(({ r }) => r.width < 59.5 || r.height < 59.5)
          .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.className.toString().split(' ')[0]}:${Math.round(r.width)}x${Math.round(r.height)}`)
        const off = targets.filter(({ r }) => r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1).length
        return { over, small: [...new Set(small)], off }
      })
      const note = `${a.over ? ' OVERFLOW' : ''}${a.off ? ` offscreen:${a.off}` : ''}${a.small.length ? ` small:${a.small.join(',')}` : ''}`
      console.log(`${job.name}.png${note}${errors.length ? ` ERRORS: ${errors.join(' | ').slice(0, 400)}` : ''}`)
      if (errors.length) failed++
    } catch (err) {
      failed++
      console.log(`${job.name}: FEJL ${String(err).split('\n')[0]}${errors.length ? ` ERRORS: ${errors.join(' | ').slice(0, 400)}` : ''}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
if (failed) process.exitCode = 1
