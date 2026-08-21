// Renders the app icon to PNG with the preinstalled Chromium — no image library,
// no design files. Run: node scripts/make-icons.mjs
import { launch } from './browser.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const icon = (pad) => `
<html><body style="margin:0">
<div style="width:512px;height:512px;display:grid;place-items:center;
     background:linear-gradient(135deg,#6d28d9,#f9a8d4)">
  <svg width="${512 - pad * 2}" height="${512 - pad * 2}" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="hsl(48,100%,78%)"/>
        <stop offset="100%" stop-color="hsl(28,90%,58%)"/>
      </linearGradient>
    </defs>
    <ellipse cx="30" cy="20" rx="7" ry="10" fill="#fde68a" transform="rotate(-20 30 20)"/>
    <ellipse cx="70" cy="20" rx="7" ry="10" fill="#fde68a" transform="rotate(20 70 20)"/>
    <path d="M 50 18 C 76 18 84 44 84 58 C 84 78 69 90 50 90 C 31 90 16 78 16 58 C 16 44 24 18 50 18 Z" fill="url(#s)"/>
    <ellipse cx="37" cy="52" rx="9" ry="9" fill="#fff"/>
    <ellipse cx="63" cy="52" rx="9" ry="9" fill="#fff"/>
    <circle cx="38" cy="53" r="4.5" fill="#1b1233"/>
    <circle cx="64" cy="53" r="4.5" fill="#1b1233"/>
    <path d="M 41 70 q 9 8 18 0" stroke="#1b1233" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="50" y="14" font-family="-apple-system,sans-serif" font-size="15" font-weight="900"
          fill="#fff" text-anchor="middle">+ −</text>
  </svg>
</div></body></html>`

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
mkdirSync('public', { recursive: true })

for (const [file, size, pad] of [
  ['public/icon-512.png', 512, 40],
  ['public/icon-192.png', 192, 40],
  ['public/icon-180.png', 180, 40],
  ['public/icon-maskable-512.png', 512, 96], // safe zone for Android's mask
]) {
  await page.setContent(icon(pad))
  await page.setViewportSize({ width: 512, height: 512 })
  const shot = await page.locator('div').screenshot()
  if (size === 512) writeFileSync(file, shot)
  else {
    await page.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${shot.toString('base64')}"
      style="width:${size}px;height:${size}px;display:block"></body></html>`)
    await page.setViewportSize({ width: size, height: size })
    writeFileSync(file, await page.locator('img').screenshot())
  }
  console.log('wrote', file)
}

// SVG favicon for browsers that prefer it
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#6d28d9"/>
<ellipse cx="30" cy="26" rx="7" ry="10" fill="#fde68a" transform="rotate(-20 30 26)"/>
<ellipse cx="70" cy="26" rx="7" ry="10" fill="#fde68a" transform="rotate(20 70 26)"/>
<path d="M 50 24 C 74 24 82 46 82 58 C 82 76 68 88 50 88 C 32 88 18 76 18 58 C 18 46 26 24 50 24 Z" fill="#fbbf24"/>
<circle cx="39" cy="54" r="8" fill="#fff"/><circle cx="61" cy="54" r="8" fill="#fff"/>
<circle cx="40" cy="55" r="4" fill="#1b1233"/><circle cx="62" cy="55" r="4" fill="#1b1233"/>
<path d="M 42 70 q 8 7 16 0" stroke="#1b1233" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`)
console.log('wrote public/icon.svg')

await browser.close()
