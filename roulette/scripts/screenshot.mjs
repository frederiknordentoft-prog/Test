// Dev-time visual check: loads the app headlessly, drives the debug panel,
// and saves screenshots to shots/. Usage: node scripts/screenshot.mjs [url] [numbers...]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:5173'
const numbers = process.argv.slice(3).map(Number)
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const consoleMessages = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleMessages.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => consoleMessages.push(`pageerror: ${e.message}`))

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'shots/initial.png' })

for (const n of numbers) {
  await page.fill('.debug-panel input', String(n))
  await page.click('.debug-panel button')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `shots/align-${n}.png` })
  const info = await page.textContent('.debug-panel .info')
  console.log(`align ${n}: ${info}`)
}

console.log(consoleMessages.length ? `console issues:\n${consoleMessages.join('\n')}` : 'console clean')
await browser.close()
