// Screenshots of the parent dashboard with the demo household (src/parent/testing/demo.ts).
// Start the dev server first (npx vite --port 4311 --strictPort), then:
//   flock /tmp/tv2-chromium.lock node src/parent/testing/shoot.mjs [tab …]
// Writes artifacts/dash/<width>-<tab>.png. FULL=1 grows the window to the whole tab, DPR=1 keeps it small,
// SIZES=393x852 picks the windows, OPEN='<selector>' clicks every match first (e.g. 'summary'),
// CHILD=bo|cille shows another demo child.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.BASE ?? 'http://localhost:4311/'
const OUT = fileURLToPath(new URL('../../../artifacts/dash/', import.meta.url))
const TABS = process.argv.slice(2).length ? process.argv.slice(2) : ['overview', 'curriculum', 'skills', 'tables', 'misconceptions', 'rewards', 'settings']
const SIZES = (process.env.SIZES ?? '820x1180,393x852').split(',').map((s) => s.split('x').map(Number))
const CHILD = process.env.CHILD ?? 'ada'
const SUFFIX = `${CHILD === 'ada' ? '' : `-${CHILD}`}${process.env.FULL ? '-full' : ''}`
const LABEL = { overview: 'Overblik', curriculum: 'Pensumkort', skills: 'Færdigheder', tables: 'Tabeller', misconceptions: 'Misforståelser', rewards: 'Belønninger', settings: 'Indstillinger' }

mkdirSync(OUT, { recursive: true })
const browser = await launch()
try {
  for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DPR ?? 2) })
    page.on('pageerror', (e) => console.error('pageerror', e.message))
    page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
    await page.goto(BASE)
    await page.waitForSelector('.tv-shell', { timeout: 30_000 })
    await page.evaluate(async (child) => {
      const { seedDemo } = await import('/src/parent/testing/demo.ts')
      const { useSession } = await import('/src/state/useSession.ts')
      const { useNav } = await import('/src/app/nav.ts')
      const ids = await seedDemo()
      await useSession.getState().refreshProfiles()
      await useSession.getState().selectProfile(ids[child])
      useNav.getState().go({ id: 'parent' })
    }, CHILD)
    await page.waitForSelector('.tv-dash .tv-dstats', { timeout: 30_000 })
    for (const tab of TABS) {
      await page.getByRole('button', { name: LABEL[tab], exact: true }).click()
      await page.waitForTimeout(400)
      if (process.env.OPEN) for (const el of await page.locator(process.env.OPEN).all()) await el.click()
      let size = { width, height }
      if (process.env.FULL) {
        const extra = await page.evaluate(() => {
          const b = document.querySelector('.tv-dash__body')
          return b ? b.scrollHeight - b.clientHeight : 0
        })
        size = { width, height: height + extra }
        await page.setViewportSize(size)
        await page.waitForTimeout(250)
      }
      await page.screenshot({ path: `${OUT}${width}-${tab}${SUFFIX}.png` })
      if (process.env.FULL) await page.setViewportSize({ width, height })
      console.log(`${width}-${tab}${SUFFIX}.png`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}
