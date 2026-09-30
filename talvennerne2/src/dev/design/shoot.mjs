// Renders the design harness to PNG for review (dev only). Needs the dev server:
//   npx vite --port 4315 --strictPort &
//   flock /tmp/tv2-chromium.lock node src/dev/design/shoot.mjs [filter…]
// Writes artifacts/design/*.png (gitignored) and prints an audit per shell screen: horizontal
// overflow and interactive elements smaller than 60 × 60 px.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.DESIGN_URL ?? 'http://127.0.0.1:4315/design.html'
const OUT = fileURLToPath(new URL('../../../artifacts/design/', import.meta.url))
const filters = process.argv.slice(2)

const VIEWPORTS = [
  { id: 'se-p', w: 375, h: 667, safe: 'se' },
  { id: 'se-l', w: 667, h: 375, safe: 'se' },
  { id: 'x-p', w: 393, h: 852, safe: 'x' },
  { id: 'x-l', w: 852, h: 393, safe: 'x' },
  { id: 'ipad-p', w: 820, h: 1180, safe: 'ipad' },
  { id: 'ipad-l', w: 1180, h: 820, safe: 'ipad' },
]
const CATALOG = ['tokens', 'components', 'components/sheet', 'icons', 'materials']
const SHELL = ['shell/hub', 'shell/task', 'shell/wrong', 'shell/sheet']

const jobs = []
for (const route of CATALOG) {
  for (const w of [393, 820]) jobs.push({ name: `${route.replace('/', '-')}-${w}`, route, w, h: w < 500 ? 852 : 1180, full: route !== 'components/sheet' })
}
for (const route of SHELL) {
  for (const v of VIEWPORTS) jobs.push({ name: `${route.replace('/', '-')}-${v.id}`, route, w: v.w, h: v.h, safe: v.safe, full: false, audit: true })
}

const selected = filters.length ? jobs.filter((j) => filters.some((f) => j.name.includes(f))) : jobs
mkdirSync(OUT, { recursive: true })
const browser = await launch()
try {
  for (const job of selected) {
    const ctx = await browser.newContext({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 2, hasTouch: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const q = new URLSearchParams({ shot: '1', ...(job.safe ? { safe: job.safe } : {}) })
    await page.goto(`${BASE}?${q}#${job.route}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;animation-delay:0s!important;caret-color:transparent!important}' })
    await page.waitForTimeout(600)
    const file = `${OUT}${job.name}.png`
    await page.screenshot({ path: file, fullPage: job.full })
    let note = ''
    if (job.audit) {
      const a = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1
        const small = [...document.querySelectorAll('button, a, [role="button"]')]
          .filter((el) => !el.closest('.h-nav'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 59.5 || r.height < 59.5))
          .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.className}:${Math.round(r.width)}x${Math.round(r.height)}`)
        const offscreen = [...document.querySelectorAll('button')]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)).length
        return { over, small, offscreen }
      })
      note = `${a.over ? ' OVERFLOW' : ''}${a.offscreen ? ` offscreen:${a.offscreen}` : ''}${a.small.length ? ` small:${a.small.join(',')}` : ''}`
    }
    console.log(`${job.name}.png${note}${errors.length ? ` ERRORS: ${errors.join(' | ')}` : ''}`)
    await ctx.close()
  }
} finally {
  await browser.close()
}
