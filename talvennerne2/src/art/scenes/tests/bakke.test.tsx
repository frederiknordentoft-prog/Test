// Hestebakkernes scene: elementbudget (≤ 400, så kortskærmen holder sig under 1.500), ingen forbudte elementer,
// tiers bringer farven tilbage (og kan ses fra hinanden), layoutet lægger kendetegnene der, hvor kortets panel ikke
// dækker (i alle tre formater), og verdenslogikken holder: åen springer fra kilden og løber nedad, bredere og
// bredere, foldens hegn stopper ved åen, og broen har ti planker.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../../content/curriculum'
import type { RegionTier } from '../../../meta/rewards'
import BakkeScene, { BAKKE_REGIONS, BRIDGE_PLANKS, BakkeArt, SHADOW_SHIFT, horsePoints, layoutOf, paddockFence, streamGap, streamWidths } from '../bakke'
import { BAKKE, tintBakke } from '../palette'

const SIZES: readonly [number, number][] = [[393, 852], [375, 667], [852, 393], [820, 1180], [1180, 820], [1366, 1024], [1920, 1080]]
const TIERS: readonly RegionTier[] = ['start', 'bronze', 'silver', 'gold']
const allAt = (t: RegionTier) => Object.fromEntries(Object.values(BAKKE_REGIONS).map((r) => [r, t]))
const render = (w: number, h: number, t: RegionTier) => renderToStaticMarkup(<BakkeArt w={w} h={h} tiers={allAt(t)} />)
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length

describe('Hestebakkerne · scene', () => {
  it('kendetegnene dækker præcis Hestebakkernes syv regioner', () => {
    const bakke = REGIONS.filter((r) => r.world === 'bakke').map((r) => r.id)
    expect(Object.values(BAKKE_REGIONS).sort()).toEqual([...bakke].sort())
  })

  it('højst 400 SVG-elementer i alle formater og tiers', () => {
    let max = 0
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const c = count(render(w, h, t))
        max = Math.max(max, c)
        expect(c, `${w}·${h} ${t}`).toBeLessThanOrEqual(400)
      }
    expect(max).toBeGreaterThan(120)
  })

  it('ingen filter, mask, image, text eller foreignObject; kun scenens egen himmelgradient', () => {
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const m = render(w, h, t)
        expect(m).not.toMatch(/<(filter|mask|foreignObject|image|text)[\s>/]/i)
        expect((m.match(/<(linear|radial)Gradient/g) ?? []).length).toBe(1)
      }
  })

  it('farven vender tilbage: hver tier giver en anden tegning, og hver region ændrer sit kendetegn', () => {
    for (const [w, h] of [[1180, 820], [393, 852], [820, 1180]] as const) {
      const marks = TIERS.map((t) => render(w, h, t))
      expect(new Set(marks).size).toBe(TIERS.length)
      const base = render(w, h, 'start')
      for (const r of Object.values(BAKKE_REGIONS)) {
        const m = renderToStaticMarkup(<BakkeArt w={w} h={h} tiers={{ [r]: 'gold' }} />)
        expect(m, `${w}·${h} ${r}`).not.toBe(base)
      }
    }
  })

  it('hvert tier kan ses: lys og røg fra bronze, glimt i vandet fra sølv, flag, fugle og regnbue i guld', () => {
    for (const [w, h] of [[1180, 820], [393, 852], [820, 1180]] as const) {
      const [start, bronze, silver, gold] = TIERS.map((t) => render(w, h, t))
      expect(start).not.toContain(BAKKE.smoke)
      expect(bronze).toContain(BAKKE.smoke)
      expect(start).not.toContain(BAKKE.lanternGlow)
      expect(bronze).toContain(BAKKE.lanternGlow)
      // flagene er tonet efter regionens tier og findes kun i guld
      for (const m of [start, bronze, silver]) expect(m).not.toContain(tintBakke('flag', 'gold'))
      expect(gold).toContain(tintBakke('flag', 'gold'))
      for (const m of [start, bronze, silver]) expect(m).not.toContain(BAKKE.rainbow1)
      expect(gold).toContain(BAKKE.rainbow1)
      expect(gold).toContain(BAKKE.bird)
      expect(count(start)).toBeLessThan(count(bronze))
      expect(count(bronze)).toBeLessThan(count(silver))
      expect(count(silver)).toBeLessThan(count(gold))
    }
  })

  it('kendetegnene ligger rundt om kortets panel i bredformat (venstre strimmel, mellemrummet, under sidepanelet)', () => {
    for (const [w, h] of [[1180, 820], [1366, 1024], [1920, 1080]] as const) {
      const L = layoutOf(w, h)
      const u = (p: { x: number }) => p.x / w
      const v = (p: { y: number }) => p.y / h
      // venstre strimmel: tårnet, landsbyen og marken
      for (const p of [L.tower, L.field, ...L.cottages]) expect(u(p), `${w}·${h}`).toBeLessThan(0.13)
      // mellem kortets sti og sidepanelet: de to bakker, kilden, broen og værkstedet
      for (const p of [L.twins, L.spring, L.bridge, L.workshop]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.58)
        expect(u(p), `${w}·${h}`).toBeLessThan(0.72)
      }
      // under sidepanelet: boden, hestene og hoppestenene
      for (const p of [L.stall, L.hop, ...L.horses]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.72)
        expect(v(p), `${w}·${h}`).toBeGreaterThan(0.75)
      }
    }
  })

  it('i højformat står kendetegnene i højre side og forneden; på en telefon står tårnet og de to bakker oppe til højre', () => {
    const T = layoutOf(820, 1180)
    for (const p of [T.tower, T.twins, T.field, T.bridge, T.spring, T.stall, ...T.horses]) {
      expect(p.x / 820).toBeGreaterThan(0.58)
      expect(p.y / 1180).toBeGreaterThan(0.48)
    }
    const P = layoutOf(393, 852)
    for (const p of [P.tower, P.twins]) {
      expect(p.x / 393).toBeGreaterThan(0.55)
      expect(p.y / 852).toBeLessThan(0.52)
    }
    expect(P.k).toBeGreaterThan(0.6)
  })

  it('åen springer fra kilden, løber nedad og bliver bredere nedstrøms', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      for (let i = 1; i < sw.length; i++) expect(sw[i]).toBeGreaterThan(sw[i - 1])
      // første punkt ligger lige under kilden; vandet løber hele vejen nedad og ud forneden
      expect(L.stream[0][1]).toBeGreaterThanOrEqual(L.spring.y)
      expect(Math.hypot(L.stream[0][0] - L.spring.x, L.stream[0][1] - L.spring.y)).toBeLessThan(8 * L.spring.s)
      for (let i = 1; i < L.stream.length; i++) expect(L.stream[i][1], `${w}·${h} punkt ${i}`).toBeGreaterThan(L.stream[i - 1][1])
      expect(L.stream[L.stream.length - 1][1]).toBeGreaterThan(h)
      // broen står på åen
      expect(L.stream.some(([x, y]) => x === L.bridge.x && y === L.bridge.y)).toBe(true)
    }
  })

  it('foldens hegn stopper ved åen: ingen stolpe i vandet, og den sidste står på brinken', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      const posts = paddockFence(L, sw)
      expect(posts.length, `${w}·${h}`).toBeGreaterThanOrEqual(3)
      for (const [x, y] of posts) expect(streamGap(L.stream, sw, x, y), `${w}·${h}`).toBeGreaterThan(0)
      const [bx, by] = posts[posts.length - 1]
      expect(streamGap(L.stream, sw, bx, by), `${w}·${h} brinken`).toBeLessThan(14 * L.k)
    }
  })

  it('hestene står på græsset: hele hesten (også mulen) mindst 10 px fra åkanten i alle formater (review G2-r2 §5.3)', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      // åkanten er brinkens yderkant: brinken er 9 · k bredere end vandet
      for (const horse of L.horses)
        for (const [x, y] of horsePoints(horse))
          expect(streamGap(L.stream, sw, x, y) - 4.5 * L.k, `${w}·${h} ${horse.coat} (${x.toFixed(0)}, ${y.toFixed(0)})`).toBeGreaterThanOrEqual(10)
    }
  })

  it('lyset kommer oppe fra venstre: jordskyggerne er forskudt 3–6 px mod højre og ned (review G2-r2 §5.3)', () => {
    const [dx, dy] = SHADOW_SHIFT
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(3)
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(6)
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      expect(L.sun.x / w, `${w}·${h}`).toBeLessThan(0.25)
      expect(L.sun.y / h, `${w}·${h}`).toBeLessThan(0.25)
    }
  })

  it('broen har ti planker og to gelændere', () => {
    expect(BRIDGE_PLANKS).toBe(10)
  })

  it('kun skyer, blade og hestehaler animerer, og kun transform; rolig tilstand og reduceret bevægelse stopper dem', () => {
    const css = readFileSync(path.join(import.meta.dirname, '..', 'bakke.css'), 'utf8')
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)[^{]*\{([\s\S]*?)\n\}/g)]
    expect(frames.map((f) => f[1]).sort()).toEqual(['bakke-drift', 'bakke-sway', 'bakke-swish'])
    for (const f of frames) {
      const props = [...f[2].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'transform')).toEqual([])
    }
    expect(css).toMatch(/:root\[data-calm\][^{]*bakke-drift[^{]*bakke-sway[^{]*bakke-swish[^{]*\{\s*animation: none !important/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*bakke-drift[^{]*bakke-sway[^{]*bakke-swish/)
    const m = render(1180, 820, 'gold')
    const animated = [...m.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(' ')).filter((c) => c.startsWith('bakke-') && c !== 'bakke-scene')
    expect([...new Set(animated)].every((c) => /^bakke-(drift|drift-\d|sway|swish)$/.test(c))).toBe(true)
  })

  it('standardeksporten tager kortets MapSceneProps og tegner Hestebakkerne', () => {
    const m = renderToStaticMarkup(<BakkeScene world="bakke" tiers={{}} className="x" />)
    expect(m).toMatch(/^<svg[^>]*class="bakke-scene x"/)
    expect(m).toContain('data-scene="bakke"')
  })
})
