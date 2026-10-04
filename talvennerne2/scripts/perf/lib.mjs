// Shared by the performance measurements (SPEC §15.2, QA2 P3-16): the build served under
// /Test/talvennerne2/ like GitHub Pages, the first start with the finger, and frame statistics.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Serve a build (dist/ or a copy fetched from the live site) under /Test/talvennerne2/. */
export async function serve(dist, port) {
  const root = mkdtempSync(join(tmpdir(), 'tv2-perf-'))
  mkdirSync(join(root, 'Test'))
  symlinkSync(resolve(dist), join(root, 'Test', 'talvennerne2'))
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' })
  await wait(800)
  return { url: `http://127.0.0.1:${port}/Test/talvennerne2/?e2e=1&voice=fast`, close: () => server.kill() }
}

export function stats(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))]
  return {
    n: s.length,
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    p99: +q(0.99).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
    over20: +((100 * s.filter((x) => x > 20).length) / s.length).toFixed(1),
    over33: +((100 * s.filter((x) => x > 33.4).length) / s.length).toFixed(1),
  }
}

export async function tapEl(page, loc) {
  const box = await loc.boundingBox()
  if (!box) return false
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  return true
}

/** From an empty device into the first round: intro, sound check, name, egg, friend's name, grade. */
export async function onboard(page, url, grade = '0') {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.tv-intro [data-next]', { timeout: 30_000 })
  await wait(600)
  await page.locator('.tv-intro [data-next]').click()
  await page.waitForSelector('.tv-sound[data-phase="listen"] .tv-sound__card')
  await wait(500)
  await page.locator('.tv-sound__card[data-species="cat"]').click()
  await page.waitForSelector('.tv-sound[data-phase="passed"]')
  await wait(400)
  await page.locator('.tv-sound [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="name"]')
  await page.locator('[data-name-input]').fill('Ida')
  await wait(300)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="egg"] .tv-eggbtn')
  await wait(900)
  await page.locator('.tv-eggbtn[data-species="cat"]').click()
  await page.waitForSelector('.tv-hatchbtn[data-hatch="0"]')
  for (let i = 0; i < 3; i++) {
    await page.locator('.tv-hatchbtn').click()
    await wait(250)
  }
  await page.waitForSelector('.tv-hatchbtn[data-hatch="done"]')
  await wait(1100)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="friend"] .tv-name[data-name]')
  await page.locator('.tv-name[data-name]').nth(1).click()
  await wait(400)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-onb[data-step="grade"] .tv-grade')
  await page.locator(`.tv-grade[data-grade="${grade}"]`).click()
  await wait(300)
  await page.locator('.tv-onb [data-next]').click()
  await page.waitForSelector('.tv-round', { timeout: 30_000 })
}

/** Out of the round with ✕ and "Til kortet". */
export async function toMap(page) {
  await page.locator('.tv-topbar [data-clip="s.ui.close"]').first().click()
  await page.waitForSelector('[data-pause] [data-leave]')
  await wait(400)
  await page.locator('[data-pause] [data-leave]').click()
  await page.waitForSelector('.tv-map', { timeout: 20_000 })
  await wait(800)
}

/** Answer the grown-ups' sum on the keypad. */
export async function solveGate(page) {
  await page.waitForSelector('.tv-gate')
  await wait(500)
  const [x, y] = (await page.locator('.tv-gate').getAttribute('data-gate')).split('x').map(Number)
  for (const d of String(x * y)) await page.locator(`.tv-gate [data-key="${d}"]`).click()
  await page.locator('.tv-gate [data-key="ok"]').click()
}

/** Every animation frame's time and every long task, from now on (read back from window). */
export function startFrames(page) {
  return page.evaluate(() => {
    window.__frames = []
    window.__long = []
    window.__marks = []
    let last = performance.now()
    const loop = (t) => {
      window.__frames.push([t, t - last])
      last = t
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration])
    }).observe({ type: 'longtask' })
  })
}
