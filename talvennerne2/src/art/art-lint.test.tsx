// Kunst-lints (SPEC §11 pipeline pkt. 4): statiske scanninger af kilden og af renderet markup for
// alle arter, racer, stadier, farver og humør. Geometri-lints (sikker zone, pasform, butikskort via
// getBBox) kører i Chromium via scripts/sheets.mjs.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { festHead } from './items/fest/fest-head'
import { hverdagBody } from './items/hverdag/hverdag-body'
import { hverdagHead } from './items/hverdag/hverdag-head'
import { Rig, magicOf } from './rig/Rig'
import type { RigProps } from './rig/Rig'
import { derivePalette } from './rig/palette'
import { MOODS, NATURAL_COLORWAYS, STAGES } from './rig/types'
import type { BreedId, ColorwayId, ItemDef, Outfit, SpeciesDef } from './rig/types'
import { cat } from './species/cat'
import { horse } from './species/horse'
import { rabbit } from './species/rabbit'
import { unicorn } from './species/unicorn'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 120_000 })

const ART = path.resolve(import.meta.dirname)
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__snapshots__' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)],
  )
const sources = walk(ART).filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
const rel = (f: string) => path.relative(ART, f)
const read = (f: string) => readFileSync(f, 'utf8')

export const ALL_SPECIES: readonly SpeciesDef[] = [rabbit, cat, horse, unicorn]
const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]
const colorsOf = (def: SpeciesDef, breed: BreedId): ColorwayId[] => [...NATURAL_COLORWAYS, ...magicOf(def, breed)]
const BUDGET = { animal: 90, item: 25 }
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i

const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1

describe('kildescanninger', () => {
  it('har kilder at scanne', () => {
    expect(sources.map(rel)).toContain(path.join('rig', 'Rig.tsx'))
    expect(sources.map(rel)).toContain(path.join('species', 'shared', 'equine.tsx'))
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

  it('ingen emoji (\\p{Extended_Pictographic}) og ingen gange-/divisionstegn', () => {
    const bad = sources.filter((f) => /\p{Extended_Pictographic}|[\u00D7\u00F7]/u.test(read(f))).map(rel)
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

describe.each(ALL_SPECIES.map((def) => [def.id, def] as const))('renderet markup · %s', (_id, def) => {
  const combos: Partial<RigProps>[] = []
  for (const b of def.breeds)
    for (const stage of STAGES)
      for (const colorway of colorsOf(def, b.id))
        for (const mood of MOODS) combos.push({ breed: b.id, stage, colorway, mood })

  it('ingen filter, mask, foreignObject, image eller text – statisk og animeret', () => {
    for (const p of combos)
      for (const mode of ['static', 'animated'] as const) expect(render({ species: def, ...p, mode }), JSON.stringify(p)).not.toMatch(FORBIDDEN)
    for (const it of ITEMS)
      for (const stage of STAGES)
        expect(render({ species: def, stage, outfit: { [it.slot]: { item: it } } as Outfit, star: true })).not.toMatch(FORBIDDEN)
  })

  it(`elementbudget: ≤ ${BUDGET.animal} pr. dyr i alle kombinationer (også stjerneform og lille detaljeniveau)`, () => {
    let max = 0
    for (const p of combos)
      for (const star of [false, true]) {
        const c = count(render({ species: def, ...p, star, mode: 'animated' }))
        max = Math.max(max, c)
        expect(c, JSON.stringify({ ...p, star })).toBeLessThanOrEqual(BUDGET.animal)
      }
    expect(max).toBeGreaterThan(40)
  })

  it(`elementbudget: ≤ ${BUDGET.item} pr. genstand i alle humør (inkl. ærmer på løftede arme og hulkant)`, () => {
    for (const b of def.breeds)
      for (const stage of STAGES)
        for (const mood of MOODS) {
          const bare = count(render({ species: def, breed: b.id, stage, mood, mode: 'animated' }))
          for (const it of ITEMS) {
            const worn = count(render({ species: def, breed: b.id, stage, mood, mode: 'animated', outfit: { [it.slot]: { item: it } } as Outfit }))
            expect(worn - bare, `${def.id}/${b.id} ${it.id} stadie ${stage} ${mood}`).toBeLessThanOrEqual(BUDGET.item)
          }
        }
  })

  it('løftede arme får ærmer, når trøjen er på', () => {
    for (const mood of ['cheer', 'wave', 'think', 'oops'] as const) {
      const m = render({ species: def, mood, outfit: { body: { item: hverdagBody } } })
      expect(m, `${def.id} ${mood}`).toMatch(/data-layer="sleeve-[LR]"/)
    }
  })

  it('én konturfarve for hele figuren: ører og manke arver figurens kontur', () => {
    for (const b of def.breeds)
      for (const c of colorsOf(def, b.id)) {
        const p = derivePalette(c in def.colorways ? def.colorways[c as 'c1'] : { id: c, name: c, fur: '#FFFFFF' })
        expect(p.earOutline, `${def.id} ${c}`).toBe(p.outline)
        expect(p.maneOutline, `${def.id} ${c}`).toBe(p.outline)
      }
  })

  it('kropstøj klippes til kroppen og streger konturen igen', () => {
    const m = render({ species: def, outfit: { body: { item: hverdagBody } } })
    expect(m).toMatch(/data-item="hverdag-body"[^>]*clip-path="url\(#/)
    expect(m).toMatch(/<g data-item="hverdag-body"[\s\S]*?stroke-linejoin="round"/)
  })

  it('ørerne tegnes over hatten (hængeører bag hovedet, så hovedets kontur løber ubrudt over ørebasen)', () => {
    for (const b of def.breeds) {
      const m = render({ species: def, breed: b.id, outfit: { head: { item: hverdagHead } } })
      const hat = m.indexOf('data-item="hverdag-head"')
      expect(hat).toBeGreaterThan(0)
      const ears = m.indexOf('a-ear-l')
      const behind = (b.ears ?? def.ears)?.behind
      if (behind) expect(ears, `${def.id}/${b.id}`).toBeLessThan(hat)
      else expect(ears, `${def.id}/${b.id}`).toBeGreaterThan(hat)
    }
  })
})
