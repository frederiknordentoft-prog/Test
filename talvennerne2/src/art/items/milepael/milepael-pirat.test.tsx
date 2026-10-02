// Kunst-lints og hash-regression for milepælene (8) og Pirat-sættet (6) – samlet her, så de fælles
// testfiler ikke skal røres (samme mønster som opdager/items.test.tsx). Geometri-lints (øjnene fri,
// sikker zone, hull, butikskortenes fyld) kører i kontaktarkene. Arterne findes med en glob, så nye arter
// automatisk kommer med; hash-regressionen dækker de seks tegnede arter.
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
import { hedgehog } from '../../species/hedgehog'
import { horse } from '../../species/horse'
import { puppy } from '../../species/puppy'
import { rabbit } from '../../species/rabbit'
import { unicorn } from '../../species/unicorn'
import { piratBack } from '../pirat/pirat-back'
import { piratBody } from '../pirat/pirat-body'
import { piratFace } from '../pirat/pirat-face'
import { piratHand } from '../pirat/pirat-hand'
import { piratHead } from '../pirat/pirat-head'
import { piratNeck } from '../pirat/pirat-neck'
import { milepaelFevinger } from './milepael-fevinger'
import { milepaelGlimmerbluse } from './milepael-glimmerbluse'
import { milepaelHjertebriller } from './milepael-hjertebriller'
import { milepaelKappe } from './milepael-kappe'
import { milepaelKrone } from './milepael-krone'
import { milepaelMedalje } from './milepael-medalje'
import { milepaelRegnbuehue } from './milepael-regnbuehue'
import { milepaelSlikkepind } from './milepael-slikkepind'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 300_000 })

const MILEPAELE: readonly ItemDef[] = [
  milepaelHjertebriller, milepaelRegnbuehue, milepaelKappe, milepaelMedalje,
  milepaelGlimmerbluse, milepaelSlikkepind, milepaelFevinger, milepaelKrone,
]
const PIRAT: readonly ItemDef[] = [piratHead, piratFace, piratNeck, piratBody, piratBack, piratHand]
const MINE: readonly ItemDef[] = [...MILEPAELE, ...PIRAT]
const SPECIES_FILES = import.meta.glob<{ default: SpeciesDef }>(['../../species/*.tsx', '!../../species/*.test.tsx'], { eager: true })
const ALL_SPECIES: readonly SpeciesDef[] = Object.values(SPECIES_FILES).map((m) => m.default)
const ITEM_FILES = import.meta.glob<{ default: ItemDef }>(['../*/*.tsx', '!../*/*.test.tsx'], { eager: true })
const ALL_ITEMS: readonly ItemDef[] = Object.values(ITEM_FILES).map((m) => m.default)
const HASHED: readonly SpeciesDef[] = [rabbit, cat, puppy, hedgehog, horse, unicorn]

const BUDGET = 25
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i
const FABRIC_HEX = new Set<string>(Object.values(FABRIC))
const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const wear = (it: ItemDef, cw: 0 | 1 | 2 = 0) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit
const outfit = (items: readonly ItemDef[], cw: 0 | 1 | 2 = 0) => Object.fromEntries(items.map((it) => [it.slot, { item: it, colorway: cw }])) as Outfit
/** Milepælene som to påklædninger (to hatte og to ryggenstande). */
const MILE_A = [milepaelKrone, milepaelHjertebriller, milepaelMedalje, milepaelGlimmerbluse, milepaelFevinger, milepaelSlikkepind]
const MILE_B = [milepaelRegnbuehue, milepaelHjertebriller, milepaelMedalje, milepaelGlimmerbluse, milepaelKappe, milepaelSlikkepind]

describe('kontrakten for genstandene', () => {
  it('alle fjorten findes som filer i registeret; milepælene og Pirat-sættet er hele', () => {
    for (const it of MINE) expect(ALL_ITEMS, it.id).toContain(it)
    expect(MILEPAELE.map((it) => it.id).sort()).toEqual(
      ['milepael-fevinger', 'milepael-glimmerbluse', 'milepael-hjertebriller', 'milepael-kappe', 'milepael-krone', 'milepael-medalje', 'milepael-regnbuehue', 'milepael-slikkepind'],
    )
    expect(PIRAT.map((it) => it.slot).sort()).toEqual(['back', 'body', 'face', 'hand', 'head', 'neck'])
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: id, slot, navneklip og kilde som i kataloget', (_id, it) => {
    expect(it.nameClip).toBe(itemClip(it.id))
    expect(clips[it.nameClip], it.nameClip).toBe(ITEM_BY_ID[it.id].name)
    expect(it.source).toEqual(ITEM_BY_ID[it.id].source)
    expect(it.slot).toBe(ITEM_BY_ID[it.id].slot)
    expect(it.set).toBe(ITEM_BY_ID[it.id].set)
  })

  it.each(MINE.map((it) => [it.id, it] as const))('%s: tre farvesæt fra stofpaletten, tydeligt forskellige, og en ikonboks', (_id, it) => {
    expect(it.colorways).toHaveLength(3)
    for (const cw of it.colorways)
      for (const hex of [cw.main, cw.trim, cw.accent, ...(cw.stripes ?? [])]) expect(FABRIC_HEX.has(hex), `${it.id} ${cw.id} ${hex}`).toBe(true)
    expect(new Set(it.colorways.map((cw) => [cw.main, cw.trim, cw.accent, ...(cw.stripes ?? [])].join())).size).toBe(3)
    expect(new Set(it.colorways.map((cw) => cw.id)).size).toBe(3)
    expect(it.icon?.box).toHaveLength(4)
  })

  it('pasformen: ingen overskrivninger, og højst 10 % af alle (genstand, art)-par har en', () => {
    for (const it of MINE) expect(it.fit.overrides, it.id).toBeUndefined()
    const wearers = ALL_SPECIES.flatMap((d) => d.breeds.map((b) => ({ id: d.id, family: d.family, anchors: modelAnchors(d, b.id) })))
    expect(overrideShare(ALL_ITEMS, wearers)).toBeLessThanOrEqual(MAX_OVERRIDE_SHARE)
  })

  it('regnbuehuen har fire flade striber (ingen gradient), og hatte har huller til ører og horn', () => {
    for (const cw of milepaelRegnbuehue.colorways) expect(cw.stripes, cw.id).toHaveLength(4)
    // Ingen gradient i huens tegning (riggens jordskygge ligger før den, og enhjørningen c1 har ingen regnbue).
    const m = render({ species: unicorn, outfit: wear(milepaelRegnbuehue) })
    const hat = m.slice(m.indexOf('data-item="milepael-regnbuehue"'))
    expect(hat).not.toMatch(/Gradient|fill="url\(#/)
    for (const hat of [milepaelRegnbuehue, milepaelKrone, piratHead]) {
      expect(hat.fit.earMode, hat.id).toBe('through')
      expect(hat.art.rim, hat.id).toBeTruthy()
      expect(hat.hornHole, hat.id).toBeTruthy()
    }
  })

  it('kropstøj har tre grundformer og ærmer i alle poser; kappe, vinger, slikkepind og kikkert rækker ud', () => {
    for (const it of [milepaelGlimmerbluse, piratBody]) {
      expect(Object.keys(it.art.bodyShapes ?? {}).sort(), it.id).toEqual(['pear', 'round', 'tall'])
      expect(it.art.sleeve && it.art.sleeveUp, it.id).toBeTruthy()
    }
    expect(MINE.filter((it) => it.reach).map((it) => it.id).sort()).toEqual(
      ['milepael-fevinger', 'milepael-kappe', 'milepael-slikkepind', 'pirat-back', 'pirat-hand'],
    )
    expect(piratBack.art.straps).toBeTruthy()
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

  it('ingen filter, mask, foreignObject, image eller text – også hele påklædninger og stjerneform', () => {
    for (const b of def.breeds)
      for (const stage of STAGES) {
        for (const it of MINE) expect(render({ species: def, breed: b.id, stage, outfit: wear(it, 2), star: true })).not.toMatch(FORBIDDEN)
        for (const mood of MOODS)
          for (const set of [PIRAT, MILE_A, MILE_B]) expect(render({ species: def, breed: b.id, stage, mood, outfit: outfit(set, 1) })).not.toMatch(FORBIDDEN)
      }
  })

  it('ørerne og hornet tegnes efter hattene (hullernes forkant ligger over ørernes rod)', () => {
    for (const b of def.breeds)
      for (const hat of [milepaelRegnbuehue, milepaelKrone, piratHead]) {
        const m = render({ species: def, breed: b.id, outfit: wear(hat) })
        const at = m.indexOf(`data-item="${hat.id}"`)
        expect(at, `${def.id}/${b.id} ${hat.id}`).toBeGreaterThan(0)
        const ears = m.indexOf('a-ear-l')
        if (ears < 0) continue
        // Hængeører bag hovedet (vædderen, review G1-r3 K1) tegnes før hovedet og dermed før hatten: hatten
        // dækker ørets rod, hovedets kontur løber ubrudt over ørebasen, og der er ingen huller (ingen hulkant).
        if ((b.ears ?? def.ears)?.behind) {
          expect(ears, `${def.id}/${b.id} ${hat.id}`).toBeLessThan(at)
          expect(m, `${def.id}/${b.id} ${hat.id}`).not.toMatch(/data-layer="rim"/)
        } else expect(ears, `${def.id}/${b.id} ${hat.id}`).toBeGreaterThan(at)
      }
  })

  it('håndgenstande sidder i højre pote i alle humør, og kropstøj klippes til kroppen', () => {
    for (const mood of MOODS) {
      for (const it of [milepaelSlikkepind, piratHand]) expect(render({ species: def, mood, outfit: wear(it) }), `${it.id} ${mood}`).toMatch(new RegExp(`data-item="${it.id}" data-slot="hand"`))
      for (const it of [milepaelGlimmerbluse, piratBody]) expect(render({ species: def, mood, outfit: wear(it) })).toMatch(new RegExp(`data-item="${it.id}"[^>]*clip-path="url\\(#`))
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
