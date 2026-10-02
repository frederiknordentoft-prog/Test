// Hestebakkernes tre arter (lam, ræv og hamster): samme kunst-lints og hash-regression som de første arter
// (src/art/art-lint.test.tsx, regression.test.tsx, clips.test.ts og engdalen.test.tsx), samlet her, så de fælles
// testfiler ikke skal røres. Geometri-lints (sikker zone, pasform, bobler) kører i kontaktarkene.
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SPECIES_BY_ID } from '../../content/catalog'
import { clips } from '../../speech/clips/names/catalog'
import { festHead } from '../items/fest/fest-head'
import { hverdagBody } from '../items/hverdag/hverdag-body'
import { hverdagHead } from '../items/hverdag/hverdag-head'
import { SAFE, anchorsFinite, computeAnchors } from '../rig/anchors'
import { colorClip, speciesClip } from '../rig/clips'
import { Rig, magicOf, resolveColorway, resolvePalette } from '../rig/Rig'
import type { RigProps } from '../rig/Rig'
import { MOODS, NATURAL_COLORWAYS, STAGES, breedsOf } from '../rig/types'
import type { BreedId, ColorwayId, ItemDef, Outfit, SpeciesDef } from '../rig/types'
import { fox } from './fox'
import { hamster } from './hamster'
import { lamb } from './lamb'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 180_000 })

const SPECIES: readonly SpeciesDef[] = [lamb, fox, hamster]
const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]
const BUDGET = { animal: 90, item: 25 }
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i
const colorsOf = (def: SpeciesDef, breed: BreedId): ColorwayId[] => [...NATURAL_COLORWAYS, ...magicOf(def, breed)]
const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)

describe.each(SPECIES.map((def) => [def.id, def] as const))('Hestebakkerne · %s', (_id, def) => {
  const combos: Partial<RigProps>[] = []
  for (const b of def.breeds)
    for (const stage of STAGES)
      for (const colorway of colorsOf(def, b.id))
        for (const mood of MOODS) combos.push({ breed: b.id, stage, colorway, mood })

  it('kontrakten: én race (std), katalogets krop, farvenavne og klip', () => {
    const meta = SPECIES_BY_ID[def.id as 'lamb']
    expect(def.breeds.map((b) => b.id)).toEqual([...breedsOf(def.id)])
    expect(def.body).toBe(meta.body)
    expect(def.nameClip).toBe(speciesClip(def.id))
    expect(clips[def.nameClip]).toBe(meta.name)
    NATURAL_COLORWAYS.forEach((c, i) => {
      expect(def.colorways[c].name, `${def.id} ${c}`).toBe(meta.colors[i])
      expect(clips[colorClip(def.id, c)], colorClip(def.id, c)).toBe(meta.colors[i])
    })
    for (const m of magicOf(def, 'std')) expect(clips[colorClip(def.id, m)], colorClip(def.id, m)).toBe(resolveColorway(def, m).name)
    expect(magicOf(def, 'std')).toEqual(['gold', 'rainbow'])
    expect(def.signature).toBeTruthy()
  })

  it('ankrene er endelige og ligger i den sikre zone i alle stadier', () => {
    for (const s of STAGES) {
      const w = computeAnchors(def, 'std', s)
      expect(anchorsFinite(w)).toBe(true)
      for (const v of Object.values(w))
        if (typeof v === 'object') {
          expect(v.x).toBeGreaterThanOrEqual(SAFE.x0)
          expect(v.x).toBeLessThanOrEqual(SAFE.x1)
          expect(v.y).toBeGreaterThanOrEqual(SAFE.y0)
          expect(v.y).toBeLessThanOrEqual(SAFE.y1)
        }
    }
  })

  it('ingen filter, mask, foreignObject, image eller text – statisk og animeret', () => {
    for (const p of combos)
      for (const mode of ['static', 'animated'] as const) expect(render({ species: def, ...p, mode }), JSON.stringify(p)).not.toMatch(FORBIDDEN)
    for (const it of ITEMS)
      for (const stage of STAGES) expect(render({ species: def, stage, outfit: { [it.slot]: { item: it } } as Outfit, star: true })).not.toMatch(FORBIDDEN)
  })

  it(`elementbudget: ≤ ${BUDGET.animal} pr. dyr i alle kombinationer (også stjerneform og lille detaljeniveau)`, () => {
    let max = 0
    for (const p of combos)
      for (const star of [false, true])
        for (const size of [undefined, 48]) {
          const c = count(render({ species: def, ...p, star, size, mode: 'animated' }))
          max = Math.max(max, c)
          expect(c, JSON.stringify({ ...p, star, size })).toBeLessThanOrEqual(BUDGET.animal)
        }
    expect(max).toBeGreaterThan(40)
  })

  it(`elementbudget: ≤ ${BUDGET.item} pr. genstand i alle humør (inkl. ærmer på løftede arme og hulkant)`, () => {
    for (const stage of STAGES)
      for (const mood of MOODS) {
        const bare = count(render({ species: def, stage, mood, mode: 'animated' }))
        for (const it of ITEMS) {
          const worn = count(render({ species: def, stage, mood, mode: 'animated', outfit: { [it.slot]: { item: it } } as Outfit }))
          expect(worn - bare, `${def.id} ${it.id} stadie ${stage} ${mood}`).toBeLessThanOrEqual(BUDGET.item)
        }
      }
  })

  it('løftede arme får ærmer, når trøjen er på', () => {
    for (const mood of ['cheer', 'wave', 'think', 'oops', ...(def.id === 'fox' ? (['happy'] as const) : [])] as const) {
      const m = render({ species: def, mood, outfit: { body: { item: hverdagBody } } })
      expect(m, `${def.id} ${mood}`).toMatch(/data-layer="sleeve-[LR]"/)
    }
  })

  it('én konturfarve for hele figuren: ører og pels/pigge arver figurens kontur', () => {
    for (const c of colorsOf(def, 'std')) {
      const p = resolvePalette(def, 'std', c)
      expect(p.earOutline, `${def.id} ${c}`).toBe(p.outline)
      expect(p.maneOutline, `${def.id} ${c}`).toBe(p.outline)
    }
  })

  it('kropstøj klippes til kroppen og streger konturen igen', () => {
    const m = render({ species: def, outfit: { body: { item: hverdagBody } } })
    expect(m).toMatch(/data-item="hverdag-body"[^>]*clip-path="url\(#/)
    expect(m).toMatch(/<g data-item="hverdag-body"[\s\S]*?stroke-linejoin="round"/)
  })

  it('hatte: ørerne går op gennem hullerne og tegnes over hatten; lammets vandrette ører sidder bag hovedet under hatten (ingen huller)', () => {
    const m = render({ species: def, outfit: { head: { item: hverdagHead } } })
    const hat = m.indexOf('data-item="hverdag-head"')
    expect(hat).toBeGreaterThan(0)
    const behind = def.ears?.behind
    if (behind) {
      expect(m.indexOf('a-ear-l'), def.id).toBeLessThan(hat)
      expect(m, def.id).not.toMatch(/data-layer="rim"/)
    } else {
      expect(m.indexOf('a-ear-l'), def.id).toBeGreaterThan(hat)
      expect(m, def.id).toMatch(/data-item="hverdag-head" data-slot="head" data-layer="rim"/)
    }
  })

  it('signaturen sidder i sin egen pivot (kun i animeret tilstand)', () => {
    const cls = { fox: 'a-toss', lamb: 'a-curl', hamster: 'a-puff' }[def.id as 'fox']
    expect(render({ species: def, mode: 'animated' })).toContain(`class="${cls}"`)
    expect(render({ species: def, mode: 'static' })).not.toContain(`class="${cls}"`)
  })

  it('artens kendetegn står i alle naturlige farver (rævens sokker og halespids, lammets klove, hamsterens lyse kindposer)', () => {
    for (const c of NATURAL_COLORWAYS) {
      const p = resolvePalette(def, 'std', c)
      const m = render({ species: def, colorway: c, mode: 'static' })
      const want = def.id === 'fox' ? [p.pattern, p.belly] : def.id === 'lamb' ? [p.hoof!] : [p.belly, p.inner]
      for (const color of want) expect(m, `${def.id} ${c} ${color}`).toContain(`fill="${color}"`)
      if (def.id === 'fox') expect(p.pattern, `${def.id} ${c}: sokkerne skiller sig fra pelsen`).not.toBe(p.fur)
    }
  })

  // Hash-regression (SPEC §11 pipeline pkt. 6). Ændres tegningen med vilje, opdateres snapshottet med
  // `npx vitest run -u src/art/species/engdalen.test.tsx` – og kontaktarkene gennemses igen.
  it('hash-regression pr. (art, race, stadie, farve) og stjerneform', () => {
    const out: Record<string, string> = {}
    for (const stage of STAGES)
      for (const c of colorsOf(def, 'std')) out[`${def.id}/std/${stage}/${c}`] = hash(render({ species: def, stage, colorway: c, mode: 'static' }))
    for (const stage of STAGES) out[`${def.id}/std/${stage}/c1★`] = hash(render({ species: def, stage, star: true, mode: 'static' }))
    expect(out).toMatchSnapshot()
  })

  it('hash-regression pr. genstands-fit (3 stadier · 3 farvesæt)', () => {
    const out: Record<string, string> = {}
    for (const it of ITEMS)
      for (const stage of STAGES)
        for (const cw of [0, 1, 2] as const)
          out[`${it.id}/${def.id}/${stage}/${cw}`] = hash(render({ species: def, stage, mode: 'static', outfit: { [it.slot]: { item: it, colorway: cw } } as Outfit }))
    expect(out).toMatchSnapshot()
  })
})
