// Kunst-lints og hash-regression for Kongelig-sættet (diadem, monokel, perlekæde, festdragt,
// kongekåbe og scepter) – samlet her, så de fælles testfiler ikke skal røres (samme mønster som
// opdager/items.test.tsx). Geometri-lints (øjnene fri, sikker zone, hull, butikskortenes fyld) kører i
// kontaktarkene. Arterne findes med en glob, så nye arter automatisk kommer med i budget- og
// markup-tjekkene; hash-regressionen holder sig til de ni tegnede arter, så snapshottet er stabilt.
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ITEM_BY_ID } from '../../../content/catalog'
import { clips } from '../../../speech/clips/names/catalog'
import { modelAnchors } from '../../rig/anchors'
import { itemClip } from '../../rig/clips'
import { MAX_OVERRIDE_SHARE, overrideShare } from '../../rig/fit'
import { FABRIC } from '../../rig/palette'
import { Rig } from '../../rig/Rig'
import type { RigProps } from '../../rig/Rig'
import { MOODS, STAGES } from '../../rig/types'
import type { ItemDef, Outfit, SpeciesDef } from '../../rig/types'
import { cat } from '../../species/cat'
import { fox } from '../../species/fox'
import { hamster } from '../../species/hamster'
import { hedgehog } from '../../species/hedgehog'
import { horse } from '../../species/horse'
import { lamb } from '../../species/lamb'
import { puppy } from '../../species/puppy'
import { rabbit } from '../../species/rabbit'
import { unicorn } from '../../species/unicorn'
import { kongeligBack } from './kongelig-back'
import { kongeligBody } from './kongelig-body'
import { kongeligFace } from './kongelig-face'
import { kongeligHand } from './kongelig-hand'
import { kongeligHead } from './kongelig-head'
import { kongeligNeck } from './kongelig-neck'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 300_000 })

const MINE: readonly ItemDef[] = [kongeligHead, kongeligFace, kongeligNeck, kongeligBody, kongeligBack, kongeligHand]
const SPECIES_FILES = import.meta.glob<{ default: SpeciesDef }>(['../../species/*.tsx', '!../../species/*.test.tsx'], { eager: true })
const ALL_SPECIES: readonly SpeciesDef[] = Object.values(SPECIES_FILES).map((m) => m.default)
const ITEM_FILES = import.meta.glob<{ default: ItemDef }>(['../*/*.tsx', '!../*/*.test.tsx'], { eager: true })
const ALL_ITEMS: readonly ItemDef[] = Object.values(ITEM_FILES).map((m) => m.default)
const HASHED: readonly SpeciesDef[] = [rabbit, cat, puppy, hedgehog, horse, unicorn, lamb, fox, hamster]

const BUDGET = 25
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i
const FABRIC_HEX = new Set<string>(Object.values(FABRIC))
const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const wear = (it: ItemDef, cw: 0 | 1 | 2 = 0) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit
const outfit = (items: readonly ItemDef[], cw: 0 | 1 | 2 = 0) => Object.fromEntries(items.map((it) => [it.slot, { item: it, colorway: cw }])) as Outfit

describe('kontrakten for genstandene', () => {
  it('alle seks findes som filer i registeret, og sættet er helt', () => {
    for (const it of MINE) expect(ALL_ITEMS, it.id).toContain(it)
    expect(MINE.map((it) => it.slot).sort()).toEqual(['back', 'body', 'face', 'hand', 'head', 'neck'])
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: id, slot, navneklip og kilde som i kataloget', (_id, it) => {
    expect(it.id).toBe(`${it.set}-${it.slot}`)
    expect(it.nameClip).toBe(itemClip(it.id))
    expect(clips[it.nameClip], it.nameClip).toBe(ITEM_BY_ID[it.id].name)
    expect(it.source).toEqual(ITEM_BY_ID[it.id].source)
    expect(it.slot).toBe(ITEM_BY_ID[it.id].slot)
    expect(it.set).toBe(ITEM_BY_ID[it.id].set)
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: tre farvesæt fra stofpaletten, tydeligt forskellige, og en ikonboks', (_id, it) => {
    expect(it.colorways).toHaveLength(3)
    for (const cw of it.colorways) for (const hex of [cw.main, cw.trim, cw.accent]) expect(FABRIC_HEX.has(hex), `${it.id} ${cw.id} ${hex}`).toBe(true)
    // Hovedfarven er forskellig i alle tre (tydeligt forskellige farvesæt).
    expect(new Set(it.colorways.map((cw) => cw.main)).size).toBe(3)
    expect(new Set(it.colorways.map((cw) => cw.id)).size).toBe(3)
    expect(it.icon?.box).toHaveLength(4)
  })

  it('pasformen: ingen overskrivninger, og højst 10 % af alle (genstand, art)-par har en', () => {
    for (const it of MINE) expect(it.fit.overrides, it.id).toBeUndefined()
    const wearers = ALL_SPECIES.flatMap((d) => d.breeds.map((b) => ({ id: d.id, family: d.family, anchors: modelAnchors(d, b.id) })))
    expect(overrideShare(ALL_ITEMS, wearers)).toBeLessThanOrEqual(MAX_OVERRIDE_SHARE)
  })

  it('diademet har huller til ører og horn; dragten har tre grundformer og ærmer; kåbe og scepter rækker ud', () => {
    expect(kongeligHead.fit.earMode).toBe('through')
    expect(kongeligHead.art.rim).toBeTruthy()
    expect(kongeligHead.hornHole).toBeTruthy()
    expect(Object.keys(kongeligBody.art.bodyShapes ?? {}).sort()).toEqual(['pear', 'round', 'tall'])
    expect(kongeligBody.art.sleeve && kongeligBody.art.sleeveUp).toBeTruthy()
    expect(kongeligBack.art.back).toBeTruthy()
    // Kåben og scepteret rækker med vilje ud over silhuetten (lintet holder dem i den sikre zone).
    expect(MINE.filter((it) => it.reach).map((it) => it.id).sort()).toEqual(['kongelig-back', 'kongelig-hand'])
  })

  it('monoklens glas er klart (højst 20 % tone) på dyret', () => {
    const m = render({ species: rabbit, outfit: wear(kongeligFace) })
    const item = m.slice(m.indexOf('data-item="kongelig-face"'))
    const tints = [...item.matchAll(/opacity="([\d.]+)"/g)].map((x) => Number(x[1]))
    expect(Math.min(...tints)).toBeLessThanOrEqual(0.2)
  })
})

describe.each(ALL_SPECIES.map((d) => [d.id, d] as const))('renderet markup · %s', (_id, def) => {
  it(`elementbudget: ≤ ${BUDGET} pr. genstand i alle racer, stadier og humør (også stroplag, ærmer og hulkant)`, () => {
    for (const b of def.breeds)
      for (const stage of STAGES)
        for (const mood of MOODS) {
          const bare = count(render({ species: def, breed: b.id, stage, mood, mode: 'animated' }))
          for (const it of MINE) {
            const worn = count(render({ species: def, breed: b.id, stage, mood, mode: 'animated', outfit: wear(it) }))
            expect(worn - bare, `${def.id}/${b.id} ${it.id} stadie ${stage} ${mood}`).toBeLessThanOrEqual(BUDGET)
          }
        }
  })

  it('ingen filter, mask, foreignObject, image eller text – også hele sættet og stjerneform', () => {
    for (const b of def.breeds)
      for (const stage of STAGES) {
        for (const it of MINE) expect(render({ species: def, breed: b.id, stage, outfit: wear(it, 2), star: true })).not.toMatch(FORBIDDEN)
        for (const mood of MOODS) expect(render({ species: def, breed: b.id, stage, mood, outfit: outfit(MINE, 1) })).not.toMatch(FORBIDDEN)
      }
  })

  it('ørerne og hornet tegnes efter diademet (diademet ligger over ørernes rod)', () => {
    for (const b of def.breeds) {
      const m = render({ species: def, breed: b.id, outfit: wear(kongeligHead) })
      const at = m.indexOf('data-item="kongelig-head"')
      expect(at, `${def.id}/${b.id}`).toBeGreaterThan(0)
      const ears = m.indexOf('a-ear-l')
      if (ears < 0) continue
      // Ører bag hovedet (vædderen, lammet) tegnes før hovedet og dermed før diademet: ingen huller.
      if ((b.ears ?? def.ears)?.behind) {
        expect(ears, `${def.id}/${b.id}`).toBeLessThan(at)
        expect(m, `${def.id}/${b.id}`).not.toMatch(/data-layer="rim"/)
      } else expect(ears, `${def.id}/${b.id}`).toBeGreaterThan(at)
    }
  })

  it('scepteret sidder i højre pote i alle humør, og dragten klippes til kroppen', () => {
    for (const mood of MOODS) {
      expect(render({ species: def, mood, outfit: wear(kongeligHand) }), mood).toMatch(/data-item="kongelig-hand" data-slot="hand"/)
      expect(render({ species: def, mood, outfit: wear(kongeligBody) })).toMatch(/data-item="kongelig-body"[^>]*clip-path="url\(#/)
    }
    // a species that occupies the back itself (the owl's wings) wears no back item
    if (!def.occupies?.includes('back')) {
      expect(render({ species: def, outfit: wear(kongeligBack) })).toMatch(/data-item="kongelig-back" data-slot="back" data-layer="back"/)
    }
  })
})

describe.each(HASHED.map((d) => [d.id, d] as const))('hash-regression · %s', (_id, def) => {
  it('pr. genstand · stadie · farvesæt (racerne på skift) og pr. genstand · humør', () => {
    const out: Record<string, string> = {}
    for (const it of MINE) {
      for (const stage of STAGES)
        for (const cw of [0, 1, 2] as const) {
          const breed = def.breeds[cw % def.breeds.length].id
          out[`${it.id}/${breed}/${stage}/${cw}`] = hash(render({ species: def, breed, stage, mode: 'static', outfit: wear(it, cw) }))
        }
      for (const mood of MOODS) out[`${it.id}/${mood}`] = hash(render({ species: def, mood, mode: 'static', outfit: wear(it) }))
    }
    expect(Object.keys(out).length).toBeGreaterThanOrEqual(MINE.length * (1 + MOODS.length))
    expect(out).toMatchSnapshot()
  })
})
