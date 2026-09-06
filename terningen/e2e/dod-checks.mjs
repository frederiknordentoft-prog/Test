/**
 * DoD-gennemgang af Terningen i en rigtig browser (Chromium via Playwright).
 * Forudsætter en kørende dev-server (npm run dev) — eller sæt TERNINGEN_URL.
 *
 *   npx playwright install chromium   # én gang
 *   npm run e2e                       # 1920×1080
 *   node e2e/dod-checks.mjs 1366 768  # anden opløsning
 *
 * Skærmbilleder gemmes i e2e/shots/.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const [,, W='1920', H='1080'] = process.argv
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.TERNINGEN_URL ?? 'http://localhost:5173/'
const tag = `${W}x${H}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: +W, height: +H } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()) })
const results = []
const check = (name, ok, info='') => { results.push({ name, ok, info }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (info ? '  — ' + info : '')) }
const hash = () => page.url().split('#')[1] ?? ''
const counter = async () => (await page.locator('.beat-counter').textContent()).trim()
const openFaces = async () => page.locator('.face[data-open="true"]').count()
const gearRates = async () => page.evaluate(() => document.querySelectorAll('.gear-spin').length ? [...document.querySelector('.clockwork').getAnimations({subtree:true})].filter(a=>a.animationName==='gear-spin').map(a=>+a.playbackRate.toFixed(3)) : [])
const shot = async (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` })
const overflowCheck = async (label) => {
  const r = await page.evaluate(() => {
    const out = { docOverflowX: document.documentElement.scrollWidth > window.innerWidth, docOverflowY: document.documentElement.scrollHeight > window.innerHeight }
    const card = document.querySelector('.panel-card')
    if (card) { out.panelScroll = card.scrollHeight > card.clientHeight + 1; const b = card.getBoundingClientRect(); out.panelInView = b.top >= 0 && b.bottom <= window.innerHeight && b.right <= window.innerWidth }
    const ctrl = document.querySelector('.controls').getBoundingClientRect(); out.controlsInView = ctrl.left >= 0 && ctrl.right <= window.innerWidth
    // text overflow inside the panel: any child wider than the card
    if (card) { out.textOverflow = [...card.querySelectorAll('*')].some(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'auto') }
    const hl = document.querySelector('.headline'); const hb = hl.getBoundingClientRect(); out.headlineOverflow = hb.right > window.innerWidth || hb.left < 0
    return out
  })
  check(`layout ${label}`, !r.docOverflowX && !r.docOverflowY && !r.panelScroll && r.panelInView !== false && r.controlsInView && !r.textOverflow && !r.headlineOverflow, JSON.stringify(r))
}

// (6) deep-link reload → same state
await page.goto(BASE + '#beat=4&open=teknologi&bottleneck=governance', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('deep-link: hash preserved', hash() === 'beat=4&open=teknologi&bottleneck=governance', hash())
check('deep-link: teknologi open', await page.locator('.face[data-component="teknologi"][data-open="true"]').count() === 1)
check('deep-link: governance bottleneck', await page.locator('.face[data-component="governance"][data-bottleneck="true"]').count() === 1)
check('deep-link: panel title', (await page.locator('#panel-title').textContent()) === 'Teknologi og data')
check('deep-link: counter 5 / 9', (await counter()) === '5 / 9', await counter())
check('deep-link: gears braked immediately', (await gearRates()).every(r => r === 0), JSON.stringify(await gearRates()))
await page.waitForTimeout(1200)
await shot('deeplink-teknologi-governance')
await overflowCheck('deep-link teknologi')

// invalid deep-link → beat 0, no crash
await page.goto(BASE + '#beat=42&open=zzz&bottleneck=%E0%A4', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('invalid deep-link → beat 0', (await counter()) === '1 / 9' && hash() === 'beat=0', `${await counter()} ${hash()}`)
await page.goto(BASE + '#beat=abc', { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('invalid beat → beat 0', (await counter()) === '1 / 9' && hash() === 'beat=0', `${await counter()} ${hash()}`)
await page.evaluate(() => { location.hash = '#beat=6&bottleneck=kunde' })
await page.waitForTimeout(200)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('true reload keeps deep-link (canonical hash)', hash() === 'beat=6&open=governance&bottleneck=kunde' && (await counter()) === '7 / 9' && await page.locator('.face[data-component="governance"][data-open="true"]').count() === 1 && await page.locator('.face[data-component="kunde"][data-bottleneck="true"]').count() === 1, `${hash()} ${await counter()}`)
check('true reload: gears braked at once', (await gearRates()).every(r => r === 0), JSON.stringify(await gearRates()))
const cubeTransition = await page.evaluate(() => getComputedStyle(document.querySelector('.cube')).transform)
await page.waitForTimeout(700)
const cubeTransition2 = await page.evaluate(() => getComputedStyle(document.querySelector('.cube')).transform)
check('true reload: no entrance rotation (state shown directly)', cubeTransition === cubeTransition2)

// (1) assembled → explode → clockwork visible and rotating
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('start: headline visible', await page.locator('.headline[data-visible="true"]').count() === 1)
await overflowCheck('assembled')
await page.getByRole('button', { name: 'Eksplodér' }).click()
await page.waitForTimeout(1000)
check('explode: hash beat=1', hash() === 'beat=1', hash())
check('explode: headline hidden', await page.locator('.headline[data-visible="false"]').count() === 1)
const r1 = await gearRates()
check('explode: gears animating (rate 1)', r1.length >= 5 && r1.every(r => r === 1), JSON.stringify(r1))
const angles1 = await page.evaluate(() => [...document.querySelectorAll('.gear-spin')].map(el => getComputedStyle(el).transform))
await page.waitForTimeout(500)
const angles2 = await page.evaluate(() => [...document.querySelectorAll('.gear-spin')].map(el => getComputedStyle(el).transform))
check('explode: gears actually rotate', angles1.every((a, i) => a !== angles2[i]))
// gear speed ratio: neighbours opposite direction
const dirs = await page.evaluate(() => [...document.querySelectorAll('.gear-spin')].map(el => getComputedStyle(el).animationDirection + ' ' + getComputedStyle(el).animationDuration))
check('explode: gear directions/durations set', dirs.length >= 5, dirs.join(' | '))
// FPS
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(n / 2) }; requestAnimationFrame(tick) }))
check('explode: rAF fps (headless, informative)', fps >= 45, `${fps.toFixed(1)} fps`)
await overflowCheck('exploded')

// (2) click a face → opens, others dim
await page.locator('.face[data-component="kunde"]').click()
await page.waitForTimeout(1000)
check('open kunde: hash', hash() === 'beat=2&open=kunde', hash())
check('open kunde: exactly one open', (await openFaces()) === 1)
check('open kunde: others dimmed', await page.locator('.face[data-dim="true"]').count() === 5 && await page.locator('.clockwork[data-dim="true"]').count() === 1)
const swing = await page.evaluate(() => getComputedStyle(document.querySelector('.face[data-component="kunde"]')).getPropertyValue('--swing').trim())
check('open kunde: swing applied', swing === '52deg', swing)
check('open kunde: scene shifted', await page.locator('.scene[data-shifted="true"]').count() === 1)
const panelBox1 = await page.locator('.panel-card').boundingBox()
await overflowCheck('open kunde')

// (3) click another face → first closes cleanly, layout stable
await page.locator('.face[data-component="mennesker"]').click()
await page.waitForTimeout(1000)
check('switch: only mennesker open', (await openFaces()) === 1 && await page.locator('.face[data-component="mennesker"][data-open="true"]').count() === 1)
const panelBox2 = await page.locator('.panel-card').boundingBox()
check('switch: panel x/width stable (no layout jump)', Math.abs(panelBox1.x - panelBox2.x) < 1 && Math.abs(panelBox1.width - panelBox2.width) < 1, `${panelBox1.x}/${panelBox1.width} → ${panelBox2.x}/${panelBox2.width}`)
const sceneShift1 = await page.evaluate(() => getComputedStyle(document.querySelector('.scene')).transform)

// rapid clicks mid-animation
await page.locator('.face[data-component="kunde"]').click()
await page.waitForTimeout(120)
await page.getByRole('button', { name: 'Teknologi og data', exact: true }).click()
await page.waitForTimeout(60)
await page.getByRole('button', { name: 'Build / Buy / Own', exact: true }).click()
await page.waitForTimeout(1100)
check('rapid clicks: single open (buildbuyown)', (await openFaces()) === 1 && hash() === 'beat=5&open=buildbuyown', hash())
const sceneShift2 = await page.evaluate(() => getComputedStyle(document.querySelector('.scene')).transform)
check('rapid clicks: scene shift unchanged', sceneShift1 === sceneShift2)
await shot('open-buildbuyown')
await overflowCheck('open buildbuyown')
await page.getByRole('button', { name: 'Teknologi og data', exact: true }).click()
await page.waitForTimeout(1100)
await shot('open-teknologi')
await overflowCheck('open teknologi')

// (4) bottleneck → gears brake to standstill over ~1.2s, amber
await page.keyboard.press('b')
await page.waitForTimeout(300)
const mid = await gearRates()
check('bottleneck: decelerating (0 < rate < 1 at 300ms)', mid.every(r => r > 0 && r < 1), JSON.stringify(mid))
await page.waitForTimeout(1200)
const stopped = await gearRates()
check('bottleneck: stopped (rate 0)', stopped.every(r => r === 0), JSON.stringify(stopped))
check('bottleneck: hash', hash() === 'beat=4&open=teknologi&bottleneck=teknologi', hash())
check('bottleneck: tag shown', await page.locator('.face[data-component="teknologi"] .bottleneck-tag').count() === 1)
check('bottleneck: only one', await page.locator('.face[data-bottleneck="true"], .clockwork[data-bottleneck="true"]').count() === 1)
await shot('bottleneck-teknologi')
// bottleneck on another component while one is open → replaces
await page.locator('.face[data-component="mennesker"]').click({ button: 'right' })
await page.waitForTimeout(200)
check('bottleneck: replaced by right-click (still one)', await page.locator('.face[data-bottleneck="true"]').count() === 1 && await page.locator('.face[data-component="mennesker"][data-bottleneck="true"]').count() === 1)
check('bottleneck: teknologi still open', await page.locator('.face[data-component="teknologi"][data-open="true"]').count() === 1)
// remove → gears resume
await page.locator('.face[data-component="mennesker"]').click({ button: 'right' })
await page.waitForTimeout(1300)
const resumed = await gearRates()
check('bottleneck removed: gears resume (rate 1)', resumed.every(r => r === 1), JSON.stringify(resumed))

// Esc with nothing open → no-op
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check('esc: closes open component → beat 1', hash() === 'beat=1' && (await openFaces()) === 0, hash())
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
check('esc with nothing open: no-op', hash() === 'beat=1', hash())

// (5) arrow keys through the whole story and back, clamped
await page.keyboard.press('Home')
await page.waitForTimeout(100)
const seq = []
for (let i = 0; i < 11; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40); seq.push(await counter()) }
check('arrows forward clamp at 9', seq.join(',') === '2 / 9,3 / 9,4 / 9,5 / 9,6 / 9,7 / 9,8 / 9,9 / 9,9 / 9,9 / 9,9 / 9', seq.join(','))
check('end state: core open', hash() === 'beat=8&open=arbejdsgange', hash())
await page.waitForTimeout(1000)
await shot('beat8-core')
await overflowCheck('beat 8 core')
const back = []
for (let i = 0; i < 11; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(40); back.push(await counter()) }
check('arrows back clamp at 1', back.join(',') === '8 / 9,7 / 9,6 / 9,5 / 9,4 / 9,3 / 9,2 / 9,1 / 9,1 / 9,1 / 9,1 / 9', back.join(','))
check('home state: assembled', hash() === 'beat=0' && await page.locator('.cube[data-stage="assembled"]').count() === 1, hash())
await page.keyboard.press(' ')
await page.waitForTimeout(100)
check('space advances', (await counter()) === '2 / 9')
// each beat: open the right component; check top/bottom/left/back too
for (const [b, id] of [[2,'kunde'],[3,'mennesker'],[4,'teknologi'],[5,'buildbuyown'],[6,'governance'],[7,'maaling'],[8,'arbejdsgange']]) {
  await page.evaluate((b) => { location.hash = `#beat=${b}` }, b)
  await page.waitForTimeout(1100)
  const openEl = id === 'arbejdsgange' ? await page.locator('.clockwork[data-open="true"]').count() : await page.locator(`.face[data-component="${id}"][data-open="true"]`).count()
  check(`beat ${b}: ${id} open via hashchange`, openEl === 1 && hash() === `beat=${b}&open=${id}`, hash())
  await shot(`beat${b}-${id}`)
  await overflowCheck(`beat ${b} ${id}`)
}

// hashchange with bottleneck on the core
await page.evaluate(() => { location.hash = '#beat=1&bottleneck=arbejdsgange' })
await page.waitForTimeout(1500)
check('core bottleneck via hash', await page.locator('.clockwork[data-bottleneck="true"]').count() === 1 && (await gearRates()).every(r => r === 0))
await shot('core-bottleneck')

// reduced motion mid-session
await ctx.close()
const ctx2 = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: 'reduce' })
const p2 = await ctx2.newPage()
p2.on('pageerror', e => errors.push('pageerror(rm): ' + e.message))
await p2.goto(BASE + '#beat=1', { waitUntil: 'networkidle' })
await p2.waitForTimeout(300)
const rmAnims = await p2.evaluate(() => document.querySelector('.clockwork').getAnimations({subtree:true}).filter(a=>a.animationName==='gear-spin').length)
check('reduced motion: no gear animations', rmAnims === 0, String(rmAnims))
await p2.locator('.face[data-component="kunde"]').click()
await p2.waitForTimeout(200)
check('reduced motion: content still accessible (panel opens)', (await p2.locator('#panel-title').textContent()) === 'Kunde og værdi')
await p2.keyboard.press('b')
await p2.waitForTimeout(200)
check('reduced motion: bottleneck works', await p2.locator('.face[data-component="kunde"][data-bottleneck="true"]').count() === 1)
await p2.screenshot({ path: `${OUT}/${tag}-reduced-motion.png` })
// switch reduced motion off mid-session while braked → animations appear but stay stopped
await p2.emulateMedia({ reducedMotion: 'no-preference' })
await p2.waitForTimeout(400)
const afterToggle = await p2.evaluate(() => document.querySelector('.clockwork').getAnimations({subtree:true}).filter(a=>a.animationName==='gear-spin').map(a=>a.playbackRate))
check('reduced motion off mid-session while braked: gears stay stopped', afterToggle.length >= 5 && afterToggle.every(r => r === 0), JSON.stringify(afterToggle))
await p2.keyboard.press('b')
await p2.waitForTimeout(1300)
const afterRelease = await p2.evaluate(() => document.querySelector('.clockwork').getAnimations({subtree:true}).filter(a=>a.animationName==='gear-spin').map(a=>a.playbackRate))
check('reduced motion off: release → gears run', afterRelease.every(r => r === 1), JSON.stringify(afterRelease))
await p2.emulateMedia({ reducedMotion: 'reduce' })
await p2.waitForTimeout(300)
const afterOn = await p2.evaluate(() => document.querySelector('.clockwork').getAnimations({subtree:true}).filter(a=>a.animationName==='gear-spin').length)
check('reduced motion on mid-session: animations removed', afterOn === 0, String(afterOn))

// keyboard focus navigation to faces
await p2.emulateMedia({ reducedMotion: 'no-preference' })
await p2.keyboard.press('Escape')
await p2.waitForTimeout(100)
await p2.locator('.face[data-component="kunde"]').focus()
await p2.keyboard.press('Enter')
await p2.waitForTimeout(200)
check('keyboard: Enter on focused face opens it', await p2.locator('.face[data-component="kunde"][data-open="true"]').count() === 1)
await p2.keyboard.press('Tab')
await p2.waitForTimeout(80)
const afterTab = await p2.evaluate(() => document.activeElement?.getAttribute('data-component'))
await p2.keyboard.press(' ')
await p2.waitForTimeout(250)
check('keyboard: Space on next focused face toggles (no beat advance)', afterTab === 'mennesker' && (await p2.locator('.face[data-open="true"]').count()) === 1 && p2.url().includes('open=mennesker'), `focus after Tab: ${afterTab}; hash: ${p2.url().split('#')[1]}`)
await p2.keyboard.press('Escape'); await p2.waitForTimeout(100)
await p2.mouse.click(60, Math.round(+H / 2)) // klik på tom baggrund
let tabs = 0
while (tabs < 12 && !(await p2.evaluate(() => document.activeElement?.classList.contains('face') || document.activeElement?.classList.contains('clockwork')))) { await p2.keyboard.press('Tab'); tabs++ }
const focusedFace = await p2.evaluate(() => document.activeElement?.getAttribute('data-component') ?? document.activeElement?.className)
const ringVisible = await p2.evaluate(() => { const el = document.activeElement; const target = el.classList.contains('face') ? el.querySelector('.face-front') : el.querySelector('.core-plate'); return el.matches(':focus-visible') && getComputedStyle(target).boxShadow.includes('242, 223, 160') })
check('keyboard: Tab reaches a face/clockwork with visible focus ring', ringVisible, `${tabs} tabs → ${focusedFace}`)
await p2.waitForTimeout(150)
await p2.screenshot({ path: `${OUT}/${tag}-focus-ring.png` })
// browser zoom 125% / 150% (deviceScaleFactor emulation)
for (const zoom of [1.25, 1.5]) {
  const c = await browser.newContext({ viewport: { width: Math.round(+W / zoom), height: Math.round(+H / zoom) }, deviceScaleFactor: zoom })
  const p = await c.newPage()
  await p.goto(BASE + '#beat=7', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const r = await p.evaluate(() => { const card = document.querySelector('.panel-card'); const b = card.getBoundingClientRect(); const ctrl = document.querySelector('.controls').getBoundingClientRect(); return { docX: document.documentElement.scrollWidth > innerWidth, panelScroll: card.scrollHeight > card.clientHeight + 1, panelIn: b.top >= 0 && b.bottom <= innerHeight, ctrlIn: ctrl.right <= innerWidth && ctrl.left >= 0, ctrlH: ctrl.height, overlap: b.bottom > ctrl.top } })
  const tiny = Math.round(+H / zoom) < 560 // 1366×768 @150 % = 911×512 CSS px: panelet må scrolle, men ikke overlappe
  check(`zoom ${zoom*100}%: layout ok`, !r.docX && (tiny || !r.panelScroll) && r.panelIn && r.ctrlIn && !r.overlap, JSON.stringify(r))
  await p.screenshot({ path: `${OUT}/${tag}-zoom${zoom*100}.png` })
  await c.close()
}
await ctx2.close()
await browser.close()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed at ${tag}`)
console.log('ERRORS:', errors.length ? errors : 'none')
process.exit(failed.length || errors.length ? 1 : 0)
