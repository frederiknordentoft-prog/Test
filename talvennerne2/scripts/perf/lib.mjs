// Shared by the performance measurements (SPEC §15.2, QA2 P3-16): the build served under
// /Test/talvennerne2/ like GitHub Pages, the first start with the finger, and frame statistics.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Serve a build (dist/ or a copy fetched from the live site) under /Test/talvennerne2/, and a second
 * one to compare with (`distB`) under /TestB/talvennerne2/ on the same server.
 */
export async function serve(dist, port, distB = null) {
  const root = mkdtempSync(join(tmpdir(), 'tv2-perf-'))
  mkdirSync(join(root, 'Test'))
  symlinkSync(resolve(dist), join(root, 'Test', 'talvennerne2'))
  if (distB) {
    mkdirSync(join(root, 'TestB'))
    symlinkSync(resolve(distB), join(root, 'TestB', 'talvennerne2'))
  }
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' })
  await wait(800)
  // The port must serve these very files. Something else on it (a dev server left running) would
  // be measured instead, silently: React in development mode, and A and B from the same source.
  for (const [dir, path] of [[dist, 'Test'], ...(distB ? [[distB, 'TestB']] : [])]) {
    const served = await fetch(`http://127.0.0.1:${port}/${path}/talvennerne2/index.html`).then((r) => r.text(), () => '')
    if (served !== readFileSync(join(resolve(dir), 'index.html'), 'utf8')) {
      server.kill()
      throw new Error(`port ${port} serverer ikke ${dir} (kører der en anden server?)`)
    }
  }
  const q = '?e2e=1&voice=fast'
  return {
    url: `http://127.0.0.1:${port}/Test/talvennerne2/${q}`,
    urlB: distB ? `http://127.0.0.1:${port}/TestB/talvennerne2/${q}` : null,
    close: () => server.kill(),
  }
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

/**
 * Every animation frame's time, every long task and every long animation frame (LoAF: its blocking
 * time and, per script, who invoked it, from where, how long it ran and how much of that was forced
 * style and layout), every tap's handler time (Event Timing), from now on, plus the round's beats (each change of `data-beat` on .tv-round:
 * asking → correct, wrong → teaching …), so the phases of an answer can be told apart. Read back
 * from window.
 */
export function startFrames(page) {
  return page.evaluate(() => {
    window.__frames = []
    window.__long = []
    window.__marks = []
    window.__loaf = []
    window.__beats = []
    window.__events = []
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
    if (PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          window.__loaf.push({
            t: e.startTime,
            d: e.duration,
            block: e.blockingDuration,
            // the frame's rendering: rAF callbacks from renderStart, style and layout from styleAndLayoutStart
            render: e.renderStart,
            style: e.styleAndLayoutStart,
            scripts: e.scripts.map((s) => ({
              t: s.startTime,
              d: s.duration,
              invoker: s.invoker,
              type: s.invokerType,
              src: s.sourceURL,
              fn: s.sourceFunctionName,
              forced: s.forcedStyleAndLayoutDuration,
            })),
          })
        }
      }).observe({ type: 'long-animation-frame' })
    }
    // every tap (Event Timing, from 16 ms): the handlers' time, with React's render, and the time to the next paint
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.name === 'click' || e.name === 'pointerdown') window.__events.push([e.startTime, e.name, e.processingEnd - e.processingStart, e.duration])
        }
      }).observe({ type: 'event', durationThreshold: 16 })
    } catch {
      // no Event Timing
    }
    new MutationObserver((list) => {
      const t = performance.now()
      for (const m of list) {
        if (m.target.classList?.contains('tv-round')) window.__beats.push([t, m.oldValue, m.target.getAttribute('data-beat')])
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-beat'], attributeOldValue: true })
  })
}

/**
 * The grown-ups' copy of the child, changed by `edit(file)`, back over the child: "Gem en kopi" on
 * the dashboard, then "Erstat …s data" with the changed file — the parents' own way. Starts on the
 * map, ends on the child's side again. Returns the size of the stored document in bytes.
 */
export async function replaceChild(page, out, edit) {
  await page.locator('.tv-map .tv-topbar [data-clip="s.ui.adult"]').click()
  await solveGate(page)
  await page.waitForSelector('.tv-dash')
  await page.getByRole('button', { name: 'Indstillinger', exact: true }).click()
  const save = page.getByRole('button', { name: 'Gem en kopi' })
  await save.waitFor({ timeout: 20_000 })
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), save.click()])
  const exported = `${out}.json`
  await download.saveAs(exported)
  const file = JSON.parse(readFileSync(exported, 'utf8'))
  edit(file)
  const changed = `${out}-changed.json`
  writeFileSync(changed, JSON.stringify(file))
  await page.locator('.tv-dash input[type="file"]').setInputFiles(changed)
  await page.getByRole('button', { name: /^Erstat .* data$/ }).click()
  await page.getByText('er erstattet med filens', { exact: false }).waitFor({ timeout: 15_000 })
  // back to the child's side with the arrow
  await page.locator('.tv-dash .tv-topbar [data-clip="s.ui.back"]').click()
  await page.waitForSelector('.tv-dock', { timeout: 20_000 })
  await wait(800)
  return JSON.stringify(file.profiles[0].doc).length
}
