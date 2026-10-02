// The app's icons, drawn from the rig (SPEC §11): the rabbit's head on the colours of the app's card.
// The SVG is the favicon and the manifest's scalable icon; Chromium renders the PNGs a home screen
// needs (iOS takes only apple-touch-icon PNGs, and rounds the corners itself).
//
//   node scripts/make-icons.mjs   → public/icon.svg, icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { launch } from './browser.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PUBLIC = join(ROOT, 'public')

const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let head
try {
  const { Rig } = await vite.ssrLoadModule('/src/art/rig/Rig.tsx')
  const rabbit = (await vite.ssrLoadModule('/src/art/species/rabbit.tsx')).default
  head = renderToStaticMarkup(createElement(Rig, { species: rabbit, breed: 'upright', stage: 1, colorway: 'c1', mood: 'happy', mode: 'static', crop: 'crown', seed: 1 }))
} finally {
  await vite.close()
}

/** The rig's <svg> placed at (x, y) in a box of `size`, with its own viewBox kept. */
function placed(svg, x, y, size) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox) throw new Error('the rig rendered no viewBox')
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}" overflow="visible">${inner}</svg>`
}

/** Full-bleed square (the platform rounds it); `scale` is the head's share of the side. */
function icon(scale) {
  const S = 512
  const size = Math.round(S * scale)
  const x = Math.round((S - size) / 2)
  const y = Math.round((S - size) / 2 + S * 0.03)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">`,
    '<defs><linearGradient id="tv2bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#6C4CF5"/><stop offset="1" stop-color="#7FD3FF"/></linearGradient></defs>',
    `<rect width="${S}" height="${S}" fill="url(#tv2bg)"/>`,
    `<circle cx="${S / 2}" cy="${S * 0.56}" r="${S * 0.36}" fill="#FFF8EC" opacity="0.22"/>`,
    placed(head, x, y, size),
    '</svg>',
  ].join('')
}

const regular = icon(0.8)
// a maskable icon keeps everything inside the middle 80 % circle
const maskable = icon(0.6)
writeFileSync(join(PUBLIC, 'icon.svg'), regular)

const browser = await launch()
try {
  const page = await browser.newPage()
  for (const [name, svg, px] of [['icon-180.png', regular, 180], ['icon-192.png', regular, 192], ['icon-512.png', regular, 512], ['icon-maskable-512.png', maskable, 512]]) {
    await page.setViewportSize({ width: px, height: px })
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`)
    await page.screenshot({ path: join(PUBLIC, name), clip: { x: 0, y: 0, width: px, height: px } })
    console.log(`wrote public/${name}`)
  }
} finally {
  await browser.close()
}
console.log('wrote public/icon.svg')
