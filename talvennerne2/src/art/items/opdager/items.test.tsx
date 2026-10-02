// Kunst-lints og hash-regression for Hverdags sidste fire genstande (hals, hånd, ansigt, ryg) og hele
// Opdager-sættet – samlet her, så de fælles testfiler (art-lint, regression, clips, fit) ikke skal
// røres. Geometri-lints (øjnene fri, sikker zone, hull, butikskortenes fyld) kører i kontaktarkene.
// Arterne findes med en glob, så nye arter (hvalp, pindsvin, …) automatisk kommer med i budget- og
// markup-tjekkene; hash-regressionen holder sig til de fire første arter, så snapshottet er stabilt.
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ITEM_BY_ID } from '../../../content/catalog'
import { clips } from '../../../speech/clips/names/catalog'
import { itemClip } from '../../rig/clips'
import { MAX_OVERRIDE_SHARE, overrideShare } from '../../rig/fit'
import { modelAnchors } from '../../rig/anchors'
import { FABRIC } from '../../rig/palette'
import { Rig } from '../../rig/Rig'
import type { RigProps } from '../../rig/Rig'
import { MOODS, STAGES } from '../../rig/types'
import type { ItemDef, Outfit, SpeciesDef } from '../../rig/types'
import { cat } from '../../species/cat'
import { horse } from '../../species/horse'
import { rabbit } from '../../species/rabbit'
import { unicorn } from '../../species/unicorn'
import { hverdagBack } from '../hverdag/hverdag-back'
import { hverdagFace } from '../hverdag/hverdag-face'
import { hverdagHand } from '../hverdag/hverdag-hand'
import { hverdagNeck } from '../hverdag/hverdag-neck'
import { opdagerBack } from './opdager-back'
import { opdagerBody } from './opdager-body'
import { opdagerFace } from './opdager-face'
import { opdagerHand } from './opdager-hand'
import { opdagerHead } from './opdager-head'
import { opdagerNeck } from './opdager-neck'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 300_000 })

const MINE: readonly ItemDef[] = [
  hverdagNeck, hverdagHand, hverdagFace, hverdagBack,
  opdagerHead, opdagerHand, opdagerFace, opdagerNeck, opdagerBody, opdagerBack,
]
const SPECIES_FILES = import.meta.glob<{ default: SpeciesDef }>(['../../species/*.tsx', '!../../species/*.test.tsx'], { eager: true })
const ALL_SPECIES: readonly SpeciesDef[] = Object.values(SPECIES_FILES).map((m) => m.default)
const ITEM_FILES = import.meta.glob<{ default: ItemDef }>(['../*/*.tsx', '!../*/*.test.tsx'], { eager: true })
const ALL_ITEMS: readonly ItemDef[] = Object.values(ITEM_FILES).map((m) => m.default)
const HASHED: readonly SpeciesDef[] = [rabbit, cat, horse, unicorn]

const BUDGET = 25
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i
const FABRIC_HEX = new Set<string>(Object.values(FABRIC))
const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const wear = (it: ItemDef, cw: 0 | 1 | 2 = 0) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit
const set = (items: readonly ItemDef[], cw: 0 | 1 | 2 = 0) => Object.fromEntries(items.map((it) => [it.slot, { item: it, colorway: cw }])) as Outfit
const OPDAGER = MINE.filter((it) => it.set === 'opdager')
const HVERDAG = ALL_ITEMS.filter((it) => it.set === 'hverdag')

describe('kontrakten for genstandene', () => {
  it('alle ti findes som filer i registeret, og begge sæt er hele', () => {
    for (const it of MINE) expect(ALL_ITEMS, it.id).toContain(it)
    expect(OPDAGER.map((it) => it.slot).sort()).toEqual(['back', 'body', 'face', 'hand', 'head', 'neck'])
    expect(HVERDAG.map((it) => it.slot).sort()).toEqual(['back', 'body', 'face', 'hand', 'head', 'neck'])
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: id, slot, navneklip og kilde som i kataloget', (_id, it) => {
    expect(it.id).toBe(`${it.set}-${it.slot}`)
    expect(it.nameClip).toBe(itemClip(it.id))
    expect(clips[it.nameClip], it.nameClip).toBe(ITEM_BY_ID[it.id].name)
    expect(it.source).toEqual(ITEM_BY_ID[it.id].source)
    expect(it.slot).toBe(ITEM_BY_ID[it.id].slot)
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: tre farvesæt fra stofpaletten, tydeligt forskellige, og en ikonboks', (_id, it) => {
    expect(it.colorways).toHaveLength(3)
    for (const cw of it.colorways) for (const hex of [cw.main, cw.trim, cw.accent]) expect(FABRIC_HEX.has(hex), `${it.id} ${cw.id} ${hex}`).toBe(true)
    expect(new Set(it.colorways.map((cw) => cw.main)).size).toBe(3)
    expect(new Set(it.colorways.map((cw) => cw.id)).size).toBe(3)
    expect(it.icon?.box).toHaveLength(4)
    const [, , w, h] = it.icon!.box
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  it('pasformen: ingen overskrivninger, og højst 10 % af alle (genstand, art)-par har en', () => {
    for (const it of MINE) expect(it.fit.overrides, it.id).toBeUndefined()
    const wearers = ALL_SPECIES.flatMap((d) => d.breeds.map((b) => ({ id: d.id, family: d.family, anchors: modelAnchors(d, b.id) })))
    expect(overrideShare(ALL_ITEMS, wearers)).toBeLessThanOrEqual(MAX_OVERRIDE_SHARE)
  })

  it('kropstøj har tre grundformer; hatten har huller til ører og horn; ryggenstande har stropper', () => {
    expect(Object.keys(opdagerBody.art.bodyShapes ?? {}).sort()).toEqual(['pear', 'round', 'tall'])
    expect(opdagerBody.art.sleeveUp).toBeTruthy()
    expect(opdagerHead.fit.earMode).toBe('through')
    expect(opdagerHead.art.rim).toBeTruthy()
    expect(opdagerHead.hornHole).toBeTruthy()
    expect(hverdagBack.art.straps).toBeTruthy()
    expect(opdagerBack.art.straps).toBeTruthy()
    // Ballon, lup og net rækker med vilje ud over silhuetten (lintet holder dem i den sikre zone).
    expect([hverdagHand, opdagerHand, opdagerBack].every((it) => it.reach)).toBe(true)
    expect(MINE.filter((it) => it.reach).map((it) => it.id).sort()).toEqual(['hverdag-hand', 'opdager-back', 'opdager-hand'])
  })
})

describe.each(ALL_SPECIES.map((d) => [d.id, d] as const))('renderet markup · %s', (_id, def) => {
  it(`elementbudget: ≤ ${BUDGET} pr. genstand i alle racer, stadier og humør (også stroplag, ærmegab og hulkant)`, () => {
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

  it('ingen filter, mask, foreignObject, image eller text – også hele sæt og stjerneform', () => {
    for (const b of def.breeds)
      for (const stage of STAGES) {
        for (const it of MINE) expect(render({ species: def, breed: b.id, stage, outfit: wear(it, 2), star: true })).not.toMatch(FORBIDDEN)
        for (const mood of MOODS) {
          expect(render({ species: def, breed: b.id, stage, mood, outfit: set(OPDAGER, 1) })).not.toMatch(FORBIDDEN)
          expect(render({ species: def, breed: b.id, stage, mood, outfit: set(HVERDAG, 2) })).not.toMatch(FORBIDDEN)
        }
      }
  })

  it('ørerne og hornet tegnes over opdagerhatten, og hullernes forkant over ørernes rod', () => {
    for (const b of def.breeds) {
      const m = render({ species: def, breed: b.id, outfit: wear(opdagerHead) })
      const hat = m.indexOf('data-item="opdager-head"')
      expect(hat).toBeGreaterThan(0)
      const ears = m.indexOf('a-ear-l')
      if (ears < 0) continue
      // Hængeører bag hovedet (vædderen, review G1-r3 K1) tegnes før hovedet og dermed før hatten: hatten
      // dækker ørets rod, hovedets kontur løber ubrudt over ørebasen, og der er ingen huller (ingen hulkant).
      if ((b.ears ?? def.ears)?.behind) {
        expect(ears, `${def.id}/${b.id}`).toBeLessThan(hat)
        expect(m, `${def.id}/${b.id}`).not.toMatch(/data-layer="rim"/)
      } else expect(ears, `${def.id}/${b.id}`).toBeGreaterThan(hat)
    }
  })

  it('håndgenstande sidder i højre pote i alle humør, og vesten klippes til kroppen', () => {
    for (const mood of MOODS) {
      for (const it of [hverdagHand, opdagerHand]) expect(render({ species: def, mood, outfit: wear(it) }), `${it.id} ${mood}`).toMatch(new RegExp(`data-item="${it.id}" data-slot="hand"`))
      const vest = render({ species: def, mood, outfit: wear(opdagerBody) })
      expect(vest).toMatch(/data-item="opdager-body"[^>]*clip-path="url\(#/)
    }
    // Stropperne ligger i stroplaget (under poterne). En art, der selv optager ryggen (uglens vinger),
    // bærer ingen ryggenstand.
    if (!def.occupies?.includes('back')) {
      expect(render({ species: def, outfit: wear(hverdagBack) })).toMatch(/data-item="hverdag-back" data-slot="back" data-layer="straps"/)
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
    expect(Object.keys(out)).toHaveLength(MINE.length * (9 + MOODS.length))
    expect(out).toMatchSnapshot()
  })
})
