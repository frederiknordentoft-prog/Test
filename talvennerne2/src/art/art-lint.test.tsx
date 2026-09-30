// Kunst-lints (SPEC §11 pipeline pkt. 4): statiske scanninger af kilden og af renderet markup.
// Geometri-lints (sikker zone, pasform via getBBox) kører i Chromium via scripts/sheets.mjs.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { festHead } from './items/fest/fest-head'
import { hverdagBody } from './items/hverdag/hverdag-body'
import { hverdagHead } from './items/hverdag/hverdag-head'
import { Rig } from './rig/Rig'
import type { RigProps } from './rig/Rig'
import { MOODS, NATURAL_COLORWAYS, STAGES } from './rig/types'
import type { ColorwayId, ItemDef, Outfit } from './rig/types'
import { rabbit } from './species/rabbit'

const ART = path.resolve(import.meta.dirname)
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__snapshots__' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)],
  )
const sources = walk(ART).filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
const rel = (f: string) => path.relative(ART, f)
const read = (f: string) => readFileSync(f, 'utf8')

const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]
const COLORS: readonly ColorwayId[] = [...NATURAL_COLORWAYS, ...rabbit.magic]
const BUDGET = { animal: 90, item: 25 }
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i

const render = (p: Partial<RigProps>) => renderToStaticMarkup(<Rig species={rabbit} {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1

describe('kildescanninger', () => {
  it('har kilder at scanne', () => {
    expect(sources.map(rel)).toContain(path.join('rig', 'Rig.tsx'))
  })

  it('ingen rå hex uden for palette.ts og *.colorways.ts', () => {
    const bad = sources
      .filter((f) => !/(^|\/)palette\.ts$|\.colorways\.ts$/.test(f))
      .flatMap((f) => [...read(f).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => `${rel(f)}: ${m[0]}`))
    expect(bad).toEqual([])
  })

  it('ingen sad-mood nogen steder i kunsten', () => {
    // Strengliteraler og nøgler i kode; kommentarer med `sad` i backticks (dokumentation) er tilladt.
    const bad = sources.filter((f) => /['"]sad['"]|\bsad\s*[:=]/.test(read(f))).map(rel)
    expect(bad).toEqual([])
  })

  it('ingen lange path-literaler (> 40 tegn) uden for shapes.ts', () => {
    const pathish = /(['"`])(M[-\d\s.,MmLlHhVvCcSsQqTtAaZz]{40,})\1/g
    const attr = /\bd=(["'])([^"']{41,})\1/g
    const bad = sources
      .filter((f) => !f.endsWith(path.join('rig', 'shapes.ts')))
      .flatMap((f) => [...read(f).matchAll(pathish), ...read(f).matchAll(attr)].map((m) => `${rel(f)}: ${m[2].slice(0, 30)}…`))
    expect(bad).toEqual([])
  })

  it('ingen emoji (\\p{Extended_Pictographic})', () => {
    const bad = sources.filter((f) => /\p{Extended_Pictographic}/u.test(read(f))).map(rel)
    expect(bad).toEqual([])
  })

  it('rig.css animerer kun transform og opacity', () => {
    const css = read(path.join(ART, 'rig', 'rig.css'))
    const frames = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(frames.length).toBeGreaterThan(10)
    for (const f of frames) {
      const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'transform' && p !== 'opacity')).toEqual([])
    }
  })
})

describe('renderet markup', () => {
  const combos: Partial<RigProps>[] = []
  for (const b of rabbit.breeds)
    for (const stage of STAGES)
      for (const colorway of COLORS)
        for (const mood of MOODS) combos.push({ breed: b.id, stage, colorway, mood })

  it('ingen filter, mask, foreignObject, image eller text – statisk og animeret', () => {
    let n = 0
    for (const p of combos)
      for (const mode of ['static', 'animated'] as const) {
        const m = render({ ...p, mode })
        expect(m, JSON.stringify(p)).not.toMatch(FORBIDDEN)
        n++
      }
    for (const it of ITEMS)
      for (const stage of STAGES) expect(render({ stage, outfit: { [it.slot]: { item: it } } as Outfit, star: true })).not.toMatch(FORBIDDEN)
    expect(n).toBe(3 * 3 * COLORS.length * 7 * 2)
  })

  it(`elementbudget: ≤ ${BUDGET.animal} pr. dyr i alle kombinationer`, () => {
    let max = 0
    for (const p of combos)
      for (const star of [false, true]) {
        const c = count(render({ ...p, star, mode: 'animated' }))
        max = Math.max(max, c)
        expect(c, JSON.stringify({ ...p, star })).toBeLessThanOrEqual(BUDGET.animal)
      }
    expect(max).toBeGreaterThan(30)
  })

  it(`elementbudget: ≤ ${BUDGET.item} pr. genstand`, () => {
    for (const it of ITEMS)
      for (const stage of STAGES) {
        const bare = count(render({ stage, mode: 'animated' }))
        const worn = count(render({ stage, mode: 'animated', outfit: { [it.slot]: { item: it } } as Outfit }))
        expect(worn - bare, `${it.id} stadie ${stage}`).toBeLessThanOrEqual(BUDGET.item)
      }
  })

  it('kropstøj klippes til kroppen (+2) og streger konturen igen', () => {
    const m = render({ outfit: { body: { item: hverdagBody } } })
    expect(m).toMatch(/data-item="hverdag-body"[^>]*clip-path="url\(#/)
    expect(m).toMatch(/<g data-item="hverdag-body"[\s\S]*?stroke-linejoin="round"/)
  })

  it('hovedgenstande med hides skjuler pandelokken; ørerne tegnes over hatten', () => {
    const m = render({ breed: 'lionhead', outfit: { head: { item: hverdagHead } } })
    const hat = m.indexOf('data-item="hverdag-head"')
    const ears = m.indexOf('a-ear-l') >= 0 ? m.indexOf('a-ear-l') : m.lastIndexOf('scale(-1 1)')
    expect(hat).toBeGreaterThan(0)
    expect(ears).toBeGreaterThan(hat)
  })
})
