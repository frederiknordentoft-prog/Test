// Stjernefjeldets scene: elementbudget (≤ 400, så kortskærmen holder sig under 1.500), ingen forbudte elementer,
// tiers bringer farven tilbage (og kan ses fra hinanden), layoutet lægger kendetegnene der, hvor kortets panel ikke
// dækker (i alle tre formater), og verdenslogikken holder: gletsjeren flyder ned ad fjeldet, bækken springer ud af
// gletsjerens tunge og løber nedad under Trecifret bros største bue og ud i issøen, bredere og bredere, broerne har
// gelændere og reb, stien forbinder kendetegnene i kortets rækkefølge, og solen står til venstre i alle formater.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../../content/curriculum'
import type { RegionTier } from '../../../meta/rewards'
import FjeldScene, {
  BRIDGE_ARCHES, CAKE_PIECES, CLEFT_STEP, CLEFT_STEPS, CLOCK_TICKS, FJELD_REGIONS, FjeldArt, GARDEN_GRID, MARKS, PLANK_BAYS, PLANKS,
  SHADOW_SHIFT, STAR_GRID, archFoot, layoutOf, stopOf, streamWidths, trailLegs,
} from '../fjeld'
import { FJELD, tintFjeld } from '../palette'

const SIZES: readonly [number, number][] = [[393, 852], [375, 667], [852, 393], [820, 1180], [1180, 820], [1366, 1024], [1920, 1080]]
const TIERS: readonly RegionTier[] = ['start', 'bronze', 'silver', 'gold']
const allAt = (t: RegionTier) => Object.fromEntries(Object.values(FJELD_REGIONS).map((r) => [r, t]))
const render = (w: number, h: number, t: RegionTier) => renderToStaticMarkup(<FjeldArt w={w} h={h} tiers={allAt(t)} />)
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length

describe('Stjernefjeldet · scene', () => {
  it('kendetegnene dækker præcis Stjernefjeldets syv regioner i kortets rækkefølge', () => {
    const fjeld = REGIONS.filter((r) => r.world === 'fjeld').map((r) => r.id)
    expect(MARKS.map((m) => FJELD_REGIONS[m])).toEqual(fjeld)
  })

  it('højst 400 SVG-elementer i alle formater og tiers', () => {
    let max = 0
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const c = count(render(w, h, t))
        max = Math.max(max, c)
        expect(c, `${w}·${h} ${t}`).toBeLessThanOrEqual(400)
      }
    expect(max).toBeGreaterThan(200)
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
      for (const r of Object.values(FJELD_REGIONS)) {
        const m = renderToStaticMarkup(<FjeldArt w={w} h={h} tiers={{ [r]: 'gold' }} />)
        expect(m, `${w}·${h} ${r}`).not.toBe(base)
      }
    }
  })

  it('start er pastel, aldrig grå: kendetegnenes farver beholder deres tone med mindst halvdelen af kromen', () => {
    for (const c of ['rock', 'ice', 'water', 'roof', 'awning', 'starGold', 'hedge', 'fir', 'nearHill'] as const) {
      const hex = tintFjeld(c, 'start')
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      expect(Math.max(r, g, b) - Math.min(r, g, b), c).toBeGreaterThan(12)
    }
  })

  it('hvert tier kan ses: lys og røg fra bronze, glimtende stjerner fra sølv, vimpler og nordlys i guld', () => {
    for (const [w, h] of [[1180, 820], [393, 852], [820, 1180]] as const) {
      const [start, bronze, silver, gold] = TIERS.map((t) => render(w, h, t))
      // røgen fra bageriet og dragens røgsky kommer med bronze, ligesom lygterne
      expect(start).not.toContain(FJELD.smoke)
      expect(bronze).toContain(FJELD.smoke)
      expect(start).not.toContain(FJELD.lanternGlow)
      expect(bronze).toContain(FJELD.lanternGlow)
      // stjernerne på himlen glimter fra sølv
      for (const m of [start, bronze]) expect(m).not.toContain('fjeld-twinkle')
      expect(silver).toContain('fjeld-twinkle')
      // vimplerne er tonet efter regionens tier og findes kun i guld; nordlyset kun, når hele verdenen er guld
      for (const m of [start, bronze, silver]) expect(m).not.toContain(tintFjeld('flag2', 'gold'))
      expect(gold).toContain(tintFjeld('flag2', 'gold'))
      for (const m of [start, bronze, silver]) expect(m).not.toContain(FJELD.aurora3)
      expect(gold).toContain(FJELD.aurora3)
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
      // venstre strimmel: tårnet, dragen og kløften; forneden til venstre for dokken: markedet og haven
      for (const p of [L.tower, L.dragon, L.cleft, L.market]) expect(u(p), `${w}·${h}`).toBeLessThan(0.13)
      expect(u(L.garden)).toBeLessThan(0.28)
      for (const p of [L.market, L.garden]) expect(v(p), `${w}·${h}`).toBeGreaterThan(0.86)
      // mellem kortets sti og sidepanelet: Tabeltoppen, pegasus og Trecifret bro
      for (const p of [L.summit, L.bridge, L.pegasus]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.58)
        expect(u(p), `${w}·${h}`).toBeLessThan(0.72)
      }
      // hele stenbroen (også enernes lille bue i højre ende) står mellem kortets sti og sidepanelet
      expect((L.bridge.x + 82 * L.bridge.s) / w, `${w}·${h}`).toBeLessThan(0.72)
      expect((L.bridge.x - 32 * L.bridge.s) / w, `${w}·${h}`).toBeGreaterThan(0.58)
      // under sidepanelet: issøen med pingvinerne og bageriet
      for (const p of [L.lake, L.penguins, L.bakery]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.72)
        expect(v(p), `${w}·${h}`).toBeGreaterThan(0.82)
      }
    }
  })

  it('i højformat står kendetegnene i højre side og forneden; på en telefon står uret i båndet over kortet', () => {
    const T = layoutOf(820, 1180)
    for (const p of [T.summit, T.bridge, T.tower, T.cleft, T.lake, T.bakery]) {
      expect(p.x / 820).toBeGreaterThan(0.56)
      expect(p.y / 1180).toBeGreaterThan(0.56)
    }
    // Tabeltoppens flag står under sidepanelet
    expect((T.summit.y - 70 * T.summit.s) / 1180).toBeGreaterThan(0.56)
    for (const p of [T.market, T.garden]) expect(p.y / 1180).toBeGreaterThan(0.9)
    const P = layoutOf(393, 852)
    const clock = P.tower.y - 132 * P.tower.s
    expect(clock / 852).toBeGreaterThan(0.5)
    expect(clock / 852).toBeLessThan(0.6)
    expect(P.tower.x / 393).toBeGreaterThan(0.8)
    expect(P.summit.y / 852).toBeGreaterThan(0.38)
    expect(P.summit.y / 852).toBeLessThan(0.5)
    expect(P.k).toBeGreaterThan(0.6)
  })

  it('lyset kommer fra én retning: solen står oppe til venstre i alle formater, og jordskyggerne falder 3–6 px mod højre og ned', () => {
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

  it('Tabeltoppen er den højeste top, og gletsjeren flyder nedad fra lige under den', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      for (const p of [...L.massif, ...L.far, ...L.far2]) expect(p.y, `${w}·${h}`).toBeGreaterThan(L.top.y)
      expect(L.summit.x).toBe(L.top.x)
      const g = L.glacier.spine
      expect(g[0][1]).toBeGreaterThan(L.top.y)
      expect(Math.abs(g[0][0] - L.top.x)).toBeLessThan(L.top.hw * 0.3)
      for (let i = 1; i < g.length; i++) expect(g[i][1], `${w}·${h}`).toBeGreaterThan(g[i - 1][1])
      for (let i = 1; i < L.glacier.widths.length; i++) expect(L.glacier.widths[i]).toBeGreaterThanOrEqual(L.glacier.widths[i - 1])
    }
  })

  it('bækken springer ud af gletsjerens tunge, løber nedad under broens store bue og ud i issøen, bredere og bredere', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      for (let i = 1; i < sw.length; i++) expect(sw[i]).toBeGreaterThan(sw[i - 1])
      expect(L.stream[0]).toEqual(L.glacier.spine[L.glacier.spine.length - 1])
      for (let i = 1; i < L.stream.length; i++) expect(L.stream[i][1], `${w}·${h} punkt ${i}`).toBeGreaterThan(L.stream[i - 1][1])
      // vandet løber under den store bue (hundrederne), og buen er bred nok til bækken
      const foot = archFoot(L.bridge)
      expect(L.stream.some(([x, y]) => x === foot[0] && y === foot[1]), `${w}·${h}`).toBe(true)
      const big = BRIDGE_ARCHES[0]
      const at = L.stream.findIndex(([x, y]) => x === foot[0] && y === foot[1])
      expect((big.x1 - big.x0) * L.bridge.s).toBeGreaterThan(sw[at])
      // det sidste punkt ligger på issøens bred; søen er flad (isen følger terrænet)
      const [xe, ye] = L.stream[L.stream.length - 1]
      const e = ((xe - L.lake.x) / L.lake.rx) ** 2 + ((ye - L.lake.y) / L.lake.ry) ** 2
      expect(e, `${w}·${h}`).toBeLessThan(1.1)
      expect(e, `${w}·${h}`).toBeGreaterThan(0.4)
      expect(L.lake.ry).toBeLessThan(L.lake.rx / 3)
    }
  })

  it('stien går fra Tabeltoppen forbi kendetegnene i kortets rækkefølge', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const legs = trailLegs(L)
      expect(legs).toHaveLength(MARKS.length - 1)
      legs.forEach((leg, i) => {
        expect(leg[0]).toEqual(stopOf(L, MARKS[i]))
        expect(leg[leg.length - 1]).toEqual(stopOf(L, MARKS[i + 1]))
      })
      expect(L.midLegs).toBeGreaterThan(0)
      expect(L.midLegs).toBeLessThan(legs.length)
    }
  })

  it('kendetegnenes matematik: 3 · 4 stjerner, tre buer (hundreder, tiere, enere), tolv streger, lige store trin og fag, 3 · 4 bede og fire lige store stykker', () => {
    expect(STAR_GRID.rows * STAR_GRID.cols).toBe(12)
    expect(STAR_GRID.rows).toBe(3)
    expect(BRIDGE_ARCHES).toHaveLength(3)
    for (let i = 1; i < BRIDGE_ARCHES.length; i++) {
      const [a, b] = [BRIDGE_ARCHES[i - 1], BRIDGE_ARCHES[i]]
      expect(b.x1 - b.x0).toBeLessThan(a.x1 - a.x0)
      expect(b.bottom - b.top).toBeLessThan(a.bottom - a.top)
      expect(b.x0).toBeGreaterThan(a.x1)
    }
    expect(CLOCK_TICKS).toBe(12)
    expect(CLEFT_STEPS).toBeGreaterThanOrEqual(3)
    expect(CLEFT_STEP).toBeGreaterThan(0)
    expect(PLANKS % PLANK_BAYS).toBe(0)
    expect(PLANK_BAYS).toBeGreaterThan(1)
    expect(GARDEN_GRID).toEqual({ rows: 3, cols: 4 })
    expect(CAKE_PIECES % 2).toBe(0)
  })

  it('broerne har gelændere: stenbroen to rækværk med stolper, hængebroen bærereb og hængere', () => {
    const m = render(1180, 820, 'start')
    // stenbroens to rækværk (bag og foran dækket) og hængebroens reb er tegnet i rebets og træets farver
    expect(m).toContain(tintFjeld('woodDark', 'start'))
    expect(m).toContain(tintFjeld('stoneDark', 'start'))
    expect(m).toContain(tintFjeld('rope', 'start'))
  })

  it('kun skyer, stjerner, røg, vinger og hale animerer, kun med transform og opacity; rolig tilstand og reduceret bevægelse stopper dem', () => {
    const css = readFileSync(path.join(import.meta.dirname, '..', 'fjeld.css'), 'utf8')
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)[^{]*\{([\s\S]*?)\n\}/g)]
    expect(frames.map((f) => f[1]).sort()).toEqual(['fjeld-drift', 'fjeld-flap', 'fjeld-puff', 'fjeld-tail', 'fjeld-twinkle'])
    for (const f of frames) {
      const props = [...f[2].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'opacity' && p !== 'transform')).toEqual([])
    }
    expect(css).toMatch(/:root\[data-calm\][^{]*fjeld-drift[^{]*fjeld-twinkle[^{]*fjeld-puff[^{]*fjeld-flap[^{]*fjeld-tail[^{]*\{\s*animation: none !important/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*fjeld-drift[^{]*fjeld-twinkle[^{]*fjeld-puff[^{]*fjeld-flap[^{]*fjeld-tail/)
    const m = render(1180, 820, 'gold')
    const animated = [...m.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(' ')).filter((c) => c.startsWith('fjeld-') && c !== 'fjeld-scene')
    expect([...new Set(animated)].every((c) => /^fjeld-(drift|drift-\d|twinkle|twinkle-\d|puff|flap|tail)$/.test(c))).toBe(true)
  })

  it('standardeksporten tager kortets MapSceneProps og tegner Stjernefjeldet', () => {
    const m = renderToStaticMarkup(<FjeldScene world="fjeld" tiers={{}} className="x" />)
    expect(m).toMatch(/^<svg[^>]*class="fjeld-scene x"/)
    expect(m).toContain('data-scene="fjeld"')
  })
})
