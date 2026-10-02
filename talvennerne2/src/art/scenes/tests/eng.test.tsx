// Engdalens scene: elementbudget (≤ 400, så kortskærmen holder sig under 1.500), ingen forbudte elementer,
// tiers bringer farven tilbage (og kan ses fra hinanden), layoutet holder kendetegnene og seværdighederne i
// kanterne i både høj- og bredformat, og verdenslogikken holder: bækken springer fra dammen og bliver bredere
// nedstrøms, og hegnet stopper ved bækken med en stolpe på hver bred.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../../content/curriculum'
import type { RegionTier } from '../../../meta/rewards'
import EngScene, { ENG_REGIONS, EngArt, brookGap, brookWidths, fenceRuns, layoutOf, trailWidths } from '../eng'
import { ENG, tint } from '../palette'

const SIZES: readonly [number, number][] = [[393, 852], [375, 667], [852, 393], [820, 1180], [1180, 820], [1366, 1024], [1920, 1080]]
const TIERS: readonly RegionTier[] = ['start', 'bronze', 'silver', 'gold']
const allAt = (t: RegionTier) => Object.fromEntries(Object.values(ENG_REGIONS).map((r) => [r, t]))
const render = (w: number, h: number, t: RegionTier) => renderToStaticMarkup(<EngArt w={w} h={h} tiers={allAt(t)} />)
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length

describe('Engdalen · scene', () => {
  it('kendetegnene dækker præcis Engdalens seks regioner', () => {
    const eng = REGIONS.filter((r) => r.world === 'eng').map((r) => r.id)
    expect(Object.values(ENG_REGIONS).sort()).toEqual([...eng].sort())
  })

  it('højst 400 SVG-elementer i alle formater og tiers', () => {
    let max = 0
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const c = count(render(w, h, t))
        max = Math.max(max, c)
        expect(c, `${w}·${h} ${t}`).toBeLessThanOrEqual(400)
      }
    expect(max).toBeGreaterThan(80)
  })

  it('ingen filter, mask, image, text eller foreignObject; kun scenens egen himmelgradient', () => {
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const m = render(w, h, t)
        expect(m).not.toMatch(/<(filter|mask|foreignObject|image|text)[\s>/]/i)
        expect((m.match(/<(linear|radial)Gradient/g) ?? []).length).toBe(1)
      }
  })

  it('farven vender tilbage: hver tier giver en anden tegning, og guld er mere end start', () => {
    const marks = TIERS.map((t) => render(1180, 820, t))
    expect(new Set(marks).size).toBe(TIERS.length)
    expect(count(marks[3])).toBeGreaterThan(count(marks[0]))
    // En region ad gangen ændrer tegningen (hver region har sit kendetegn).
    const base = render(1180, 820, 'start')
    for (const r of Object.values(ENG_REGIONS)) {
      const m = renderToStaticMarkup(<EngArt w={1180} h={820} tiers={{ [r]: 'gold' }} />)
      expect(m, r).not.toBe(base)
    }
  })

  it('kendetegnene ligger i kanterne, så midten (kortets sti) får ro', () => {
    for (const [w, h] of [[1180, 820], [1366, 1024], [393, 852], [820, 1180]] as const) {
      const L = layoutOf(w, h)
      const xs = [L.house, L.den, L.garden, ...L.trees, ...L.meadow.slice(0, 1)].map((p) => p.x / w)
      // Bredformat: kortets sti står i midten (ca. 13–59 % af bredden); højformat: kendetegnene i siderne/forneden.
      if (L.wide) for (const u of xs) expect(u < 0.14 || u > 0.55, `${w}·${h} ${u.toFixed(2)}`).toBe(true)
      expect(L.k).toBeGreaterThan(0.5)
    }
  })

  it('seværdighederne (dam, ænder, trædesten, skilt) ligger uden for kortets rute i bredformat', () => {
    for (const [w, h] of [[1180, 820], [1366, 1024], [1920, 1080]] as const) {
      const L = layoutOf(w, h)
      for (const p of [L.pond, L.ducks, L.stones, L.sign]) expect(p.x / w, `${w}·${h}`).toBeGreaterThan(0.55)
    }
  })

  it('bækken springer fra dammens vandfald og bliver bredere nedstrøms', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const bw = brookWidths(L)
      for (let i = 1; i < bw.length; i++) expect(bw[i]).toBeGreaterThan(bw[i - 1])
      // første punkt er vandfaldets fod lige under dammen; bækken løber ud forneden
      expect(L.brook[0][1]).toBeGreaterThan(L.pond.y)
      expect(L.brook[0][1] - L.pond.y).toBeLessThan(60 * L.pond.s)
      expect(Math.abs(L.brook[0][0] - L.pond.x)).toBeLessThan(20 * L.pond.s)
      expect(L.brook[L.brook.length - 1][1]).toBeGreaterThan(h)
    }
  })

  it('hegnet stopper ved bækken: ingen stolpe i vandet og en stolpe på hver bred', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const bw = brookWidths(L)
      const runs = fenceRuns(L, trailWidths(L), bw)
      expect(runs.length, `${w}·${h}`).toBe(2)
      for (const [x, y] of runs.flat()) expect(brookGap(L.brook, bw, x, y), `${w}·${h}`).toBeGreaterThan(0)
      expect(runs[0].length).toBeGreaterThanOrEqual(3)
      const bank = runs[0][runs[0].length - 1]
      const other = runs[1][0]
      expect(brookGap(L.brook, bw, bank[0], bank[1]), `${w}·${h} denne bred`).toBeLessThan(14 * L.k)
      expect(brookGap(L.brook, bw, other[0], other[1]), `${w}·${h} anden bred`).toBeLessThan(14 * L.k)
    }
  })

  it('hvert tier kan ses: røg og sommerfugle fra bronze, mere for hvert trin, regnbue i guld', () => {
    const [start, bronze, silver, gold] = TIERS.map((t) => render(1180, 820, t))
    expect(start).not.toContain(ENG.smoke)
    expect(bronze).toContain(ENG.smoke)
    // sommerfuglene er tonet efter regionens tier (den orange farve bruges kun til dem)
    expect(start).not.toContain(tint('butterfly', 'start'))
    expect(bronze).toContain(tint('butterfly', 'bronze'))
    for (const m of [start, bronze, silver]) expect(m).not.toContain(ENG.rainbow1)
    expect(gold).toContain(ENG.rainbow1)
    expect(count(start)).toBeLessThan(count(bronze))
    expect(count(bronze)).toBeLessThan(count(silver))
    expect(count(silver)).toBeLessThan(count(gold))
  })

  it('kun skyer og blade animerer, og kun transform; rolig tilstand og reduceret bevægelse stopper dem', () => {
    const css = readFileSync(path.join(import.meta.dirname, '..', 'eng.css'), 'utf8')
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)[^{]*\{([\s\S]*?)\n\}/g)]
    expect(frames.map((f) => f[1]).sort()).toEqual(['eng-drift', 'eng-sway'])
    for (const f of frames) {
      const props = [...f[2].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'transform')).toEqual([])
    }
    expect(css).toMatch(/:root\[data-calm\][^{]*eng-drift[^{]*eng-sway[^{]*\{\s*animation: none !important/)
    expect(css).toMatch(/prefers-reduced-motion: reduce/)
    const m = render(1180, 820, 'gold')
    const animated = [...m.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(' ')).filter((c) => c.startsWith('eng-') && c !== 'eng-scene')
    expect([...new Set(animated)].every((c) => /^eng-(drift|drift-\d|sway)$/.test(c))).toBe(true)
  })

  it('standardeksporten tager kortets MapSceneProps og tegner Engdalen', () => {
    const m = renderToStaticMarkup(<EngScene world="eng" tiers={{}} className="x" />)
    expect(m).toMatch(/^<svg[^>]*class="eng-scene x"/)
    expect(m).toContain('data-scene="eng"')
  })
})
