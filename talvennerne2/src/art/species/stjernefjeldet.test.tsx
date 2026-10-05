// Stjernefjeldets arter (pegasus og drage; pingvin og isbjørn i egne blokke nederst): samme kunst-lints og hash-regression
// som de første arter (src/art/art-lint.test.tsx, regression.test.tsx, clips.test.ts og de andre verdeners
// artstests), samlet her, så de fælles testfiler ikke skal røres. Geometri-lints (sikker zone, pasform, bobler og
// huller) kører i kontaktarkene.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SPECIES_BY_ID } from '../../content/catalog'
import { clips } from '../../speech/clips/names/catalog'
import { festHead } from '../items/fest/fest-head'
import { hverdagBack } from '../items/hverdag/hverdag-back'
import { hverdagBody } from '../items/hverdag/hverdag-body'
import { hverdagHead } from '../items/hverdag/hverdag-head'
import { SAFE, anchorsFinite, computeAnchors } from '../rig/anchors'
import { colorClip, speciesClip } from '../rig/clips'
import { Rig, magicOf, resolveColorway, resolvePalette } from '../rig/Rig'
import type { RigProps } from '../rig/Rig'
import { MOODS, NATURAL_COLORWAYS, STAGES, breedsOf } from '../rig/types'
import type { BreedId, ColorwayId, ItemDef, Outfit, SpeciesDef } from '../rig/types'
import { dragon } from './dragon'
import { pegasus } from './pegasus'
import { penguin } from './penguin'
import { polarbear } from './polarbear'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 180_000 })

const SPECIES: readonly SpeciesDef[] = [pegasus, dragon]
const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]
const BUDGET = { animal: 90, item: 25 }
const FORBIDDEN = /<(filter|mask|foreignObject|image|text)[\s>/]/i
const colorsOf = (def: SpeciesDef, breed: BreedId): ColorwayId[] => [...NATURAL_COLORWAYS, ...magicOf(def, breed)]
const render = (p: Partial<RigProps> & { species: SpeciesDef }) => renderToStaticMarkup(<Rig {...p} />)
/** Antal SVG-elementer under rod-svg'en. */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
/** Signaturens klasse pr. art. */
const SIGNATURE_CLASS = { pegasus: 'a-flap', dragon: 'a-smoke' } as const

describe.each(SPECIES.map((def) => [def.id, def] as const))('Stjernefjeldet · %s', (_id, def) => {
  const combos: Partial<RigProps>[] = []
  for (const b of def.breeds)
    for (const stage of STAGES)
      for (const colorway of colorsOf(def, b.id))
        for (const mood of MOODS) combos.push({ breed: b.id, stage, colorway, mood })

  it('kontrakten: én race (std), katalogets krop, occupies, farvenavne og klip', () => {
    const meta = SPECIES_BY_ID[def.id as 'pegasus']
    expect(def.breeds.map((b) => b.id)).toEqual([...breedsOf(def.id)])
    expect(def.body).toBe(meta.body)
    expect([...(def.occupies ?? [])]).toEqual([...(meta.occupies ?? [])])
    expect(def.occupies).toContain('back')
    expect(def.nameClip).toBe(speciesClip(def.id))
    expect(clips[def.nameClip]).toBe(meta.name)
    NATURAL_COLORWAYS.forEach((c, i) => {
      expect(def.colorways[c].name, `${def.id} ${c}`).toBe(meta.colors[i])
      expect(clips[colorClip(def.id, c)], colorClip(def.id, c)).toBe(meta.colors[i])
    })
    for (const m of magicOf(def, 'std')) expect(clips[colorClip(def.id, m)], colorClip(def.id, m)).toBe(resolveColorway(def, m).name)
    expect(magicOf(def, 'std')).toEqual(['gold', 'rainbow'])
    expect(def.signature).toBe(def.id === 'pegasus' ? 'wing-flap' : 'smoke-puff')
    expect(def.family).toBe(def.id === 'pegasus' ? 'equine' : 'reptile')
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

  it('løftede ben får ærmer, når trøjen er på (også glad, hvor benene løftes ud til siden)', () => {
    for (const mood of ['happy', 'cheer', 'wave', 'think', 'oops'] as const) {
      const m = render({ species: def, mood, outfit: { body: { item: hverdagBody } } })
      expect(m, `${def.id} ${mood}`).toMatch(/data-layer="sleeve-[LR]"/)
    }
  })

  it('én konturfarve for hele figuren: ører, manke og hale arver figurens kontur', () => {
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

  it('hatte: pegasussens ører går op gennem hullerne over hatten; dragens finner sidder bag hovedet under hatten (ingen huller)', () => {
    const m = render({ species: def, outfit: { head: { item: hverdagHead } } })
    const hat = m.indexOf('data-item="hverdag-head"')
    expect(hat).toBeGreaterThan(0)
    if (def.ears?.behind) {
      expect(m.indexOf('a-ear-l'), def.id).toBeLessThan(hat)
      expect(m, def.id).not.toMatch(/data-layer="rim"/)
    } else {
      expect(m.indexOf('a-ear-l'), def.id).toBeGreaterThan(hat)
      expect(m, def.id).toMatch(/data-item="hverdag-head" data-slot="head" data-layer="rim"/)
    }
  })

  it('ryg-slottet: de egne vinger optager det (ingen ryggenstand), og vingerne tegnes i riggens vingelag', () => {
    const m = render({ species: def, outfit: { back: { item: hverdagBack } } })
    expect(m).not.toContain('data-item="hverdag-back"')
    expect(render({ species: def, mode: 'animated' })).toContain('class="a-wings"')
    expect(render({ species: def, mode: 'static' })).not.toContain('class="a-wings"')
  })

  it('signaturen sidder i sin egen gruppe (kun i animeret tilstand)', () => {
    const cls = SIGNATURE_CLASS[def.id as 'pegasus']
    expect(render({ species: def, mode: 'animated' })).toContain(`class="${cls}"`)
    expect(render({ species: def, mode: 'static' })).not.toContain(`class="${cls}"`)
  })

  it('artens kendetegn står i alle naturlige farver (pegasussens manke og fjer, dragens horn, mave og flyvehud)', () => {
    for (const c of NATURAL_COLORWAYS) {
      const p = resolvePalette(def, 'std', c)
      const m = render({ species: def, colorway: c, mode: 'static' })
      const want = def.id === 'pegasus' ? [p.mane, p.mane2!] : [p.horn!, p.belly, p.pattern]
      for (const color of want) expect(m, `${def.id} ${c} ${color}`).toContain(`fill="${color}"`)
      if (def.id === 'dragon') expect(p.pattern, `${def.id} ${c}: flyvehuden skiller sig fra pelsen`).not.toBe(p.fur)
      if (def.id === 'pegasus') expect(p.mane, `${def.id} ${c}: manken skiller sig fra pelsen`).not.toBe(p.fur)
    }
  })

  // Hash-regression (SPEC §11 pipeline pkt. 6). Ændres tegningen med vilje, opdateres snapshottet med
  // `npx vitest run -u src/art/species/stjernefjeldet.test.tsx` – og kontaktarkene gennemses igen.
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

describe('Stjernefjeldet · røgpusten', () => {
  it('er en lille sky, der er usynlig i hvileposen (opacity 0) og slet ikke tegnes i statiske billeder', () => {
    const m = render({ species: dragon, mode: 'animated' })
    expect(m).toMatch(/<g class="a-smoke" opacity="0">/)
    expect(render({ species: dragon, mode: 'static' })).not.toContain('a-smoke')
    expect(render({ species: dragon, mode: 'animated', silhouette: true })).not.toContain('a-smoke')
  })
})

// ---------------------------------------------------------------------------------------------
// Pingvin og isbjørn (ART3b): samme kontrakt, lints og hash-regression som pegasus og drage, men uden egne vinger
// (begge bærer en ryggenstand), pingvinen uden ører og isbjørnen med små ører bag hovedet.

/** Signaturens klasse pr. art (pingvinens klap er hele potens klasse `a-paw` i hvile, se rig.css). */
const SIGNATURE_CLASS_B = { penguin: 'a-paw a-paw-l', polarbear: 'a-sniff' } as const

describe.each(([penguin, polarbear] as const).map((def) => [def.id, def] as const))('Stjernefjeldet · %s', (_id, def) => {
  const combos: Partial<RigProps>[] = []
  for (const b of def.breeds)
    for (const stage of STAGES)
      for (const colorway of colorsOf(def, b.id))
        for (const mood of MOODS) combos.push({ breed: b.id, stage, colorway, mood })

  it('kontrakten: én race (std), katalogets krop, intet optaget slot, farvenavne og klip', () => {
    const meta = SPECIES_BY_ID[def.id as 'penguin']
    expect(def.breeds.map((b) => b.id)).toEqual([...breedsOf(def.id)])
    expect(def.body).toBe(meta.body)
    expect([...(def.occupies ?? [])]).toEqual([...(meta.occupies ?? [])])
    expect(def.occupies ?? []).toEqual([])
    expect(def.nameClip).toBe(speciesClip(def.id))
    expect(clips[def.nameClip]).toBe(meta.name)
    NATURAL_COLORWAYS.forEach((c, i) => {
      expect(def.colorways[c].name, `${def.id} ${c}`).toBe(meta.colors[i])
      expect(clips[colorClip(def.id, c)], colorClip(def.id, c)).toBe(meta.colors[i])
    })
    for (const m of magicOf(def, 'std')) expect(clips[colorClip(def.id, m)], colorClip(def.id, m)).toBe(resolveColorway(def, m).name)
    expect(magicOf(def, 'std')).toEqual(['gold', 'rainbow'])
    expect(def.signature).toBe(def.id === 'penguin' ? 'wing-clap' : 'sniff')
    expect(def.family).toBe(def.id === 'penguin' ? 'bird' : 'bear')
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
    for (const it of [...ITEMS, hverdagBack])
      for (const stage of STAGES) expect(render({ species: def, stage, outfit: { [it.slot]: { item: it } } as Outfit, star: true })).not.toMatch(FORBIDDEN)
  })

  it(`elementbudget: ≤ ${BUDGET.animal} pr. dyr i alle kombinationer (også stjerneform og lille detaljeniveau)`, () => {
    let max = 0
    for (const p of combos)
      for (const star of [false, true])
        for (const size of [undefined, 48])
          for (const mode of ['animated', 'static'] as const) {
            const c = count(render({ species: def, ...p, star, size, mode }))
            max = Math.max(max, c)
            expect(c, JSON.stringify({ ...p, star, size, mode })).toBeLessThanOrEqual(BUDGET.animal)
          }
    expect(max).toBeGreaterThan(40)
  })

  it(`elementbudget: ≤ ${BUDGET.item} pr. genstand i alle humør (inkl. ærmer på løftede arme og stropper)`, () => {
    for (const stage of STAGES)
      for (const mood of MOODS) {
        const bare = count(render({ species: def, stage, mood, mode: 'animated' }))
        for (const it of [...ITEMS, hverdagBack]) {
          const worn = count(render({ species: def, stage, mood, mode: 'animated', outfit: { [it.slot]: { item: it } } as Outfit }))
          expect(worn - bare, `${def.id} ${it.id} stadie ${stage} ${mood}`).toBeLessThanOrEqual(BUDGET.item)
        }
      }
  })

  it('løftede luffer og forben får ærmer, når trøjen er på', () => {
    for (const mood of ['cheer', 'wave', 'think', 'oops', ...(def.id === 'polarbear' ? (['happy'] as const) : [])] as const) {
      const m = render({ species: def, mood, outfit: { body: { item: hverdagBody } } })
      expect(m, `${def.id} ${mood}`).toMatch(/data-layer="sleeve-[LR]"/)
    }
  })

  it('én konturfarve for hele figuren: ører og pels arver figurens kontur', () => {
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

  it('hatte: pingvinen har ingen ører (ingen huller), og isbjørnens små ører sidder bag hovedet under hatten', () => {
    for (const hat of [hverdagHead, festHead]) {
      const m = render({ species: def, outfit: { head: { item: hat } } })
      const at = m.indexOf(`data-item="${hat.id}"`)
      expect(at, `${def.id} ${hat.id}`).toBeGreaterThan(0)
      expect(m, def.id).not.toMatch(/data-layer="rim"/)
      if (def.id === 'penguin') expect(m).not.toContain('a-ear')
      else expect(m.indexOf('a-ear-l'), def.id).toBeLessThan(at)
    }
  })

  it('ryg-slottet er frit: begge bærer en rygsæk (ingen egne vinger)', () => {
    expect(render({ species: def, outfit: { back: { item: hverdagBack } } })).toContain('data-item="hverdag-back"')
    expect(render({ species: def, mode: 'animated' })).not.toContain('class="a-wings"')
  })

  it('signaturen sidder i sin egen gruppe (kun i animeret tilstand) og har en regel i rig.css med kun transform', () => {
    const cls = SIGNATURE_CLASS_B[def.id as 'penguin']
    const m = render({ species: def, mode: 'animated' })
    expect(m).toContain(`class="${cls}"`)
    expect(m).toContain(`data-species="${def.id}"`)
    expect(render({ species: def, mode: 'static' })).not.toContain(`class="${cls}"`)
    const css = readFileSync(new URL('../rig/rig.css', import.meta.url), 'utf8')
    const frames = def.id === 'penguin' ? ['rig-clap'] : ['rig-sniff', 'rig-sniff-head']
    for (const name of frames) {
      const body = css.slice(css.indexOf(`@keyframes ${name} {`), css.indexOf('\n}', css.indexOf(`@keyframes ${name} {`)))
      expect(body, name).toMatch(/0%[^{]*\{ transform: [^}]*\}/)
      const props = [...body.matchAll(/([a-z-]+):/g)].map((x) => x[1])
      expect(props.length, name).toBeGreaterThan(3)
      for (const prop of props) expect(['transform', 'opacity'], `${name}: ${prop}`).toContain(prop)
    }
    // Kun i hvile: reglen er bundet til humøret idle (og arten), så søvn og de andre humør er i ro.
    expect(css).toMatch(def.id === 'penguin' ? /\.rig\[data-mood='idle'\]\[data-species='penguin'\] \.a-paw \{/ : /\.rig\[data-mood='idle'\] \.a-sniff \{/)
  })

  it('artens kendetegn står i alle naturlige farver (pingvinens maske, næb og fødder; isbjørnens næse, kløer og ører)', () => {
    for (const c of NATURAL_COLORWAYS) {
      const p = resolvePalette(def, 'std', c)
      const m = render({ species: def, colorway: c, mode: 'static' })
      const want = def.id === 'penguin' ? [p.belly, p.nose, p.inner] : [p.nose, p.pattern, p.inner]
      for (const color of want) expect(m, `${def.id} ${c} ${color}`).toContain(`fill="${color}"`)
      if (def.id === 'penguin') expect(p.belly, `${def.id} ${c}: fronten skiller sig fra ryggen`).not.toBe(p.fur)
    }
    // Kejserens ørepletter og klippepingvinens fjerbryn i accentfarven.
    if (def.id === 'penguin')
      for (const c of ['c2', 'c3'] as const) expect(render({ species: def, colorway: c, mode: 'static' })).toContain(`fill="${resolvePalette(def, 'std', c).pattern}"`)
  })

  it('isbjørnens seks lyse farver er tydeligt forskellige (ingen to pelse inden for en lille afstand)', () => {
    if (def.id !== 'polarbear') return
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const furs = NATURAL_COLORWAYS.map((c) => rgb(resolvePalette(def, 'std', c).fur))
    for (let i = 0; i < furs.length; i++)
      for (let j = i + 1; j < furs.length; j++) {
        const d = Math.hypot(...furs[i].map((v, k) => v - furs[j][k]))
        expect(d, `${NATURAL_COLORWAYS[i]} mod ${NATURAL_COLORWAYS[j]}`).toBeGreaterThan(18)
      }
  })

  // Hash-regression (SPEC §11 pipeline pkt. 6). Ændres tegningen med vilje, opdateres snapshottet med
  // `npx vitest run -u src/art/species/stjernefjeldet.test.tsx` – og kontaktarkene gennemses igen.
  it('hash-regression pr. (art, race, stadie, farve) og stjerneform', () => {
    const out: Record<string, string> = {}
    for (const stage of STAGES)
      for (const c of colorsOf(def, 'std')) out[`${def.id}/std/${stage}/${c}`] = hash(render({ species: def, stage, colorway: c, mode: 'static' }))
    for (const stage of STAGES) out[`${def.id}/std/${stage}/c1★`] = hash(render({ species: def, stage, star: true, mode: 'static' }))
    expect(out).toMatchSnapshot()
  })

  it('hash-regression pr. genstands-fit (3 stadier · 3 farvesæt)', () => {
    const out: Record<string, string> = {}
    for (const it of [...ITEMS, hverdagBack])
      for (const stage of STAGES)
        for (const cw of [0, 1, 2] as const)
          out[`${it.id}/${def.id}/${stage}/${cw}`] = hash(render({ species: def, stage, mode: 'static', outfit: { [it.slot]: { item: it, colorway: cw } } as Outfit }))
    expect(out).toMatchSnapshot()
  })
})
