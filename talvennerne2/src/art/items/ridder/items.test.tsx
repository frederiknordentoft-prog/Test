// Kunst-lints og hash-regression for Ridder-sættet (ridderhjelm, heltemaske, ordenskæde, rustning,
// ridderkappe og skjold) – samlet her, så de fælles testfiler ikke skal røres (samme mønster som
// kongelig/items.test.tsx). Geometri-lints (øjnene fri, sikker zone, hull, butikskortenes fyld) kører i
// kontaktarkene. Arterne findes med en glob, så nye arter automatisk kommer med i budget- og
// markup-tjekkene; hash-regressionen holder sig til de tolv tegnede arter, så snapshottet er stabilt.
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
import { owl } from '../../species/owl'
import { panda } from '../../species/panda'
import { puppy } from '../../species/puppy'
import { rabbit } from '../../species/rabbit'
import { squirrel } from '../../species/squirrel'
import { unicorn } from '../../species/unicorn'
import { ridderBack } from './ridder-back'
import { ridderBody } from './ridder-body'
import { ridderFace } from './ridder-face'
import { ridderHand } from './ridder-hand'
import { ridderHead } from './ridder-head'
import { ridderNeck } from './ridder-neck'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 300_000 })

const MINE: readonly ItemDef[] = [ridderHead, ridderFace, ridderNeck, ridderBody, ridderBack, ridderHand]
const SPECIES_FILES = import.meta.glob<{ default: SpeciesDef }>(['../../species/*.tsx', '!../../species/*.test.tsx'], { eager: true })
const ALL_SPECIES: readonly SpeciesDef[] = Object.values(SPECIES_FILES).map((m) => m.default)
const ITEM_FILES = import.meta.glob<{ default: ItemDef }>(['../*/*.tsx', '!../*/*.test.tsx'], { eager: true })
const ALL_ITEMS: readonly ItemDef[] = Object.values(ITEM_FILES).map((m) => m.default)
const HASHED: readonly SpeciesDef[] = [rabbit, cat, puppy, hedgehog, horse, lamb, fox, hamster, unicorn, panda, squirrel, owl]

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

  it('hjelmen har huller til ører og horn; rustningen har tre grundformer og ærmer; kappe og skjold rækker ud', () => {
    expect(ridderHead.fit.earMode).toBe('through')
    expect(ridderHead.art.rim).toBeTruthy()
    expect(ridderHead.hornHole).toBeTruthy()
    expect(Object.keys(ridderBody.art.bodyShapes ?? {}).sort()).toEqual(['pear', 'round', 'tall'])
    expect(ridderBody.art.sleeve && ridderBody.art.sleeveUp).toBeTruthy()
    expect(ridderBack.art.back).toBeTruthy()
    // Kappen og skjoldet rækker med vilje ud over silhuetten (lintet holder dem i den sikre zone).
    expect(MINE.filter((it) => it.reach).map((it) => it.id).sort()).toEqual(['ridder-back', 'ridder-hand'])
  })

  it('masken har åbne øjenhuller (evenodd) og intet glas', () => {
    const m = render({ species: rabbit, outfit: wear(ridderFace) })
    const item = m.slice(m.indexOf('data-item="ridder-face"'))
    expect(item).toMatch(/fill-rule="evenodd"/)
    expect(item).not.toMatch(/opacity="0\./)
  })

  it('mestringskilden: sølvmedaljer efter 2, 5, 9, 14, 20 og 27', () => {
    const counts = Object.fromEntries(MINE.map((it) => [it.slot, it.source.kind === 'medal' && it.source.tier === 'silver' ? it.source.count : null]))
    expect(counts).toEqual({ head: 2, hand: 5, body: 9, back: 14, neck: 20, face: 27 })
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

  it('ørerne og hornet tegnes efter hjelmen (hjelmen ligger over ørernes rod)', () => {
    for (const b of def.breeds) {
      const m = render({ species: def, breed: b.id, outfit: wear(ridderHead) })
      const at = m.indexOf('data-item="ridder-head"')
      expect(at, `${def.id}/${b.id}`).toBeGreaterThan(0)
      const ears = m.indexOf('a-ear-l')
      if (ears < 0) continue
      // Ører bag hovedet (vædderen, lammet) tegnes før hovedet og dermed før hjelmen: ingen huller.
      if ((b.ears ?? def.ears)?.behind) {
        expect(ears, `${def.id}/${b.id}`).toBeLessThan(at)
        expect(m, `${def.id}/${b.id}`).not.toMatch(/data-layer="rim"/)
      } else expect(ears, `${def.id}/${b.id}`).toBeGreaterThan(at)
    }
  })

  it('skjoldet sidder i højre pote i alle humør, og rustningen klippes til kroppen', () => {
    for (const mood of MOODS) {
      expect(render({ species: def, mood, outfit: wear(ridderHand) }), mood).toMatch(/data-item="ridder-hand" data-slot="hand"/)
      expect(render({ species: def, mood, outfit: wear(ridderBody) })).toMatch(/data-item="ridder-body"[^>]*clip-path="url\(#/)
    }
    // a species that occupies the back itself (the owl's wings) wears no back item
    if (!def.occupies?.includes('back')) {
      expect(render({ species: def, outfit: wear(ridderBack) })).toMatch(/data-item="ridder-back" data-slot="back" data-layer="back"/)
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
