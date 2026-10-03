// Regnbueskovens scene: elementbudget (≤ 400, så kortskærmen holder sig under 1.500), ingen forbudte elementer,
// tiers bringer farven tilbage (og kan ses fra hinanden), layoutet lægger kendetegnene der, hvor kortets panel ikke
// dækker (i alle tre formater), og verdenslogikken holder: vandfaldet springer fra en kilde under bjerget og
// fodrer søen, åen løber fra søens udløb nedad under Hundredebroen og bliver bredere, mølleengens hegn stopper ved
// åen, broen har ti buer over vandet, og solen står til venstre i alle formater (lyset kommer fra én retning).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../../content/curriculum'
import type { RegionTier } from '../../../meta/rewards'
import SkovScene, {
  BRIDGE_ARCHES, CRYSTAL_GRID, GARDEN_FIGURES, MOUNTAIN_STEPS, RULER_POSTS, SKOV_REGIONS, SMALL_STONES, SkovArt,
  bridgeHalf, layoutOf, meadowFence, streamGap, streamWidths,
} from '../skov'
import { SKOV, tintSkov } from '../palette'

const SIZES: readonly [number, number][] = [[393, 852], [375, 667], [852, 393], [820, 1180], [1180, 820], [1366, 1024], [1920, 1080]]
const TIERS: readonly RegionTier[] = ['start', 'bronze', 'silver', 'gold']
const allAt = (t: RegionTier) => Object.fromEntries(Object.values(SKOV_REGIONS).map((r) => [r, t]))
const render = (w: number, h: number, t: RegionTier) => renderToStaticMarkup(<SkovArt w={w} h={h} tiers={allAt(t)} />)
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length

describe('Regnbueskoven · scene', () => {
  it('kendetegnene dækker præcis Regnbueskovens otte regioner', () => {
    const skov = REGIONS.filter((r) => r.world === 'skov').map((r) => r.id)
    expect(Object.values(SKOV_REGIONS).sort()).toEqual([...skov].sort())
  })

  it('højst 400 SVG-elementer i alle formater og tiers', () => {
    let max = 0
    for (const [w, h] of SIZES)
      for (const t of TIERS) {
        const c = count(render(w, h, t))
        max = Math.max(max, c)
        expect(c, `${w}·${h} ${t}`).toBeLessThanOrEqual(400)
      }
    expect(max).toBeGreaterThan(150)
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
      for (const r of Object.values(SKOV_REGIONS)) {
        const m = renderToStaticMarkup(<SkovArt w={w} h={h} tiers={{ [r]: 'gold' }} />)
        expect(m, `${w}·${h} ${r}`).not.toBe(base)
      }
    }
  })

  it('start er pastel, aldrig grå: kendetegnenes farver beholder deres tone med mindst halvdelen af kromen', () => {
    for (const c of ['rock', 'moss', 'water', 'roof', 'awning', 'crystalA', 'hedge', 'crownLilac'] as const) {
      const hex = tintSkov(c, 'start')
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      expect(Math.max(r, g, b) - Math.min(r, g, b), c).toBeGreaterThan(12)
    }
  })

  it('hvert tier kan ses: lys og røg fra bronze, sommerfugle fra sølv, vimpler og regnbue i guld', () => {
    for (const [w, h] of [[1180, 820], [393, 852], [820, 1180]] as const) {
      const [start, bronze, silver, gold] = TIERS.map((t) => render(w, h, t))
      expect(start).not.toContain(SKOV.smoke)
      expect(bronze).toContain(SKOV.smoke)
      expect(start).not.toContain(SKOV.lanternGlow)
      expect(bronze).toContain(SKOV.lanternGlow)
      // sommerfuglene over søen kommer med sølv (tonet efter Vekselvandets tier)
      for (const m of [start, bronze]) expect(m).not.toContain(tintSkov('butterfly', 'silver'))
      expect(silver).toContain(tintSkov('butterfly', 'silver'))
      // vimplerne er tonet efter regionens tier og findes kun i guld
      for (const m of [start, bronze, silver]) expect(m).not.toContain(tintSkov('flag2', 'gold'))
      expect(gold).toContain(tintSkov('flag2', 'gold'))
      for (const m of [start, bronze, silver]) expect(m).not.toContain(SKOV.rainbow5)
      expect(gold).toContain(SKOV.rainbow5)
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
      // venstre strimmel: tårnet, grotten med pandaen og gården
      for (const p of [L.tower, L.cave, L.panda, L.farm]) expect(u(p), `${w}·${h}`).toBeLessThan(0.13)
      // mellem kortets sti og sidepanelet: bjerget, vandfaldet og uglens træ
      for (const p of [L.mountain, L.owl, { x: L.fall.x }]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.58)
        expect(u(p), `${w}·${h}`).toBeLessThan(0.72)
      }
      // under sidepanelet: søen, møllen, broen, pælene og egernene
      for (const p of [L.lake, L.mill, L.bridge, L.posts, L.squirrels]) {
        expect(u(p), `${w}·${h}`).toBeGreaterThan(0.71)
        expect(v(p), `${w}·${h}`).toBeGreaterThan(0.72)
      }
      // forneden til venstre for dokken: Figurhaven
      expect(u(L.garden)).toBeLessThan(0.3)
      expect(v(L.garden)).toBeGreaterThan(0.86)
    }
  })

  it('i højformat står kendetegnene i højre side og forneden; på en telefon står bjerget og uret i båndet over kortet', () => {
    const T = layoutOf(820, 1180)
    for (const p of [T.tower, T.mountain, T.lake, T.mill, T.bridge, T.cave, T.panda, { x: T.fall.x, y: T.fall.top }]) {
      expect(p.x / 820).toBeGreaterThan(0.56)
      expect(p.y / 1180).toBeGreaterThan(0.5)
    }
    for (const p of [T.farm, T.squirrels]) {
      expect(p.x / 820).toBeLessThan(0.2)
      expect(p.y / 1180).toBeGreaterThan(0.86)
    }
    for (const p of [T.owl, T.posts, T.garden]) expect(p.y / 1180).toBeGreaterThan(0.86)
    const P = layoutOf(393, 852)
    // urskiven og bjergets øverste trin i båndet mellem regionens overskrift og kortets panel
    const clock = P.tower.y - 112 * P.tower.s
    expect(clock / 852).toBeGreaterThan(0.5)
    expect(clock / 852).toBeLessThan(0.6)
    expect(P.tower.x / 393).toBeGreaterThan(0.8)
    const summit = P.mountain.y - 128 * P.mountain.s
    expect(summit / 852).toBeGreaterThan(0.45)
    expect(summit / 852).toBeLessThan(0.58)
    expect(P.k).toBeGreaterThan(0.6)
  })

  it('lyset kommer fra én retning: solen står oppe til venstre i alle formater', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      expect(L.sun.x / w, `${w}·${h}`).toBeLessThan(0.25)
      expect(L.sun.y / h, `${w}·${h}`).toBeLessThan(0.25)
    }
  })

  it('vandfaldet springer fra en kilde under bjergets fod og falder ned i søen', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      // kilden ligger lige under bjergets fod og inden for bjergets bredde
      expect(L.fall.top, `${w}·${h}`).toBeGreaterThanOrEqual(L.mountain.y)
      expect(L.fall.top - L.mountain.y).toBeLessThan(20 * L.k)
      expect(Math.abs(L.fall.x - L.mountain.x)).toBeLessThan(84 * L.mountain.s)
      // vandet falder nedad og lander inde i søen
      expect(L.fall.bottom).toBeGreaterThan(L.fall.top + 40 * L.k)
      expect(Math.abs(L.fall.x - L.lake.x)).toBeLessThan(L.lake.rx)
      expect(L.fall.bottom).toBeGreaterThan(L.lake.y - L.lake.ry)
      expect(L.fall.bottom).toBeLessThan(L.lake.y + L.lake.ry)
    }
  })

  it('åen løber fra søens udløb nedad under Hundredebroen og ud af billedet, bredere og bredere', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      for (let i = 1; i < sw.length; i++) expect(sw[i]).toBeGreaterThan(sw[i - 1])
      // første punkt ligger på søens nederste bred
      const [x0, y0] = L.stream[0]
      const e = ((x0 - L.lake.x) / L.lake.rx) ** 2 + ((y0 - L.lake.y) / L.lake.ry) ** 2
      expect(e, `${w}·${h}`).toBeGreaterThan(0.7)
      expect(e, `${w}·${h}`).toBeLessThan(1.05)
      expect(y0).toBeGreaterThan(L.lake.y)
      for (let i = 1; i < L.stream.length; i++) expect(L.stream[i][1], `${w}·${h} punkt ${i}`).toBeGreaterThan(L.stream[i - 1][1])
      expect(L.stream[L.stream.length - 1][1]).toBeGreaterThan(h)
      // broen står på åen og spænder over hele vandet
      const at = L.stream.findIndex(([x, y]) => x === L.bridge.x && y === L.bridge.y)
      expect(at).toBeGreaterThan(0)
      expect(2 * bridgeHalf(L) * L.bridge.s).toBeGreaterThan(sw[at])
    }
  })

  it('mølleengens hegn stopper ved åen: ingen stolpe i vandet, og den sidste står på brinken', () => {
    for (const [w, h] of SIZES) {
      const L = layoutOf(w, h)
      const sw = streamWidths(L)
      const posts = meadowFence(L, sw)
      expect(posts.length, `${w}·${h}`).toBeGreaterThanOrEqual(3)
      for (const [x, y] of posts) expect(streamGap(L.stream, sw, x, y), `${w}·${h}`).toBeGreaterThan(0)
      const [bx, by] = posts[posts.length - 1]
      expect(streamGap(L.stream, sw, bx, by), `${w}·${h} brinken`).toBeLessThan(14 * L.k)
    }
  })

  it('kendetegnenes matematik: tre trin, ti små sten og én stor, ti buer, 3 · 4 krystaller, stigende pæle og fire figurer', () => {
    expect(MOUNTAIN_STEPS).toBe(3)
    expect(SMALL_STONES).toBe(10)
    expect(BRIDGE_ARCHES).toBe(10)
    expect(CRYSTAL_GRID.rows * CRYSTAL_GRID.cols).toBe(12)
    expect(CRYSTAL_GRID.rows).toBe(3)
    for (let i = 1; i < RULER_POSTS.length; i++) expect(RULER_POSTS[i]).toBeGreaterThan(RULER_POSTS[i - 1])
    expect([...GARDEN_FIGURES]).toEqual(['kugle', 'terning', 'kegle', 'cylinder'])
  })

  it('kun skyer, blade, lysstråler og egernhaler animerer, kun med transform og opacity; rolig tilstand og reduceret bevægelse stopper dem', () => {
    const css = readFileSync(path.join(import.meta.dirname, '..', 'skov.css'), 'utf8')
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)[^{]*\{([\s\S]*?)\n\}/g)]
    expect(frames.map((f) => f[1]).sort()).toEqual(['skov-drift', 'skov-shimmer', 'skov-sway', 'skov-tail'])
    for (const f of frames) {
      const props = [...f[2].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== (f[1] === 'skov-shimmer' ? 'opacity' : 'transform'))).toEqual([])
    }
    expect(css).toMatch(/:root\[data-calm\][^{]*skov-drift[^{]*skov-sway[^{]*skov-tail[^{]*skov-shimmer[^{]*\{\s*animation: none !important/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*skov-drift[^{]*skov-sway[^{]*skov-tail[^{]*skov-shimmer/)
    const m = render(1180, 820, 'gold')
    const animated = [...m.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(' ')).filter((c) => c.startsWith('skov-') && c !== 'skov-scene')
    expect([...new Set(animated)].every((c) => /^skov-(drift|drift-\d|sway|tail|shimmer)$/.test(c))).toBe(true)
  })

  it('standardeksporten tager kortets MapSceneProps og tegner Regnbueskoven', () => {
    const m = renderToStaticMarkup(<SkovScene world="skov" tiers={{}} className="x" />)
    expect(m).toMatch(/^<svg[^>]*class="skov-scene x"/)
    expect(m).toContain('data-scene="skov"')
  })
})
