// Kontaktark (kun `vite build --mode sheets`; aldrig i produktions-buildet).
// Ruter via ?sheet=<rute>&id=<art>: species, moods, closeup, sizes, fit, filmstrip (pr. art) samt
// silhouettes, lineup og fitmatrix (alle arter). scripts/sheets.mjs gemmer pr.-art-ark som
// <rute>-<art>.png.
import { Fragment, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { festHead } from '../art/items/fest/fest-head'
import { hverdagBody } from '../art/items/hverdag/hverdag-body'
import { hverdagHead } from '../art/items/hverdag/hverdag-head'
import { ItemIcon } from '../art/rig/ItemIcon'
import { Icon } from '../ui/design/Icon'
import { MAGIC } from '../art/rig/palette'
import { Rig, magicOf, resolveColorway } from '../art/rig/Rig'
import type { RigProps } from '../art/rig/Rig'
import EngScene, { ENG_REGIONS } from '../art/scenes/eng'
import BakkeScene, { BAKKE_REGIONS } from '../art/scenes/bakke'
import type { RegionTier } from '../meta/rewards'
import type { MapSceneProps } from '../ui/screens/child/map/Backdrop'
import { MOODS, NATURAL_COLORWAYS, SPECIES_IDS, STAGES } from '../art/rig/types'
import type { BreedId, ColorwayId, ItemDef, Mood, Outfit, SpeciesDef, Stage } from '../art/rig/types'
import { mannequins } from './mannequin'
import { runLints } from './lints'
import type { RigCrop } from '../art/rig/Rig'
import { SET_IDS } from '../art/rig/types'
import type { SetId, Slot } from '../art/rig/types'

export const ROUTES = ['species', 'moods', 'closeup', 'sizes', 'silhouettes', 'fit', 'fitmatrix', 'filmstrip', 'lineup', 'scene', 'holes'] as const
export type Route = (typeof ROUTES)[number]
/** Ruter, der tegnes pr. art (?id=<art>). */
export const PER_SPECIES: readonly Route[] = ['species', 'moods', 'closeup', 'sizes', 'fit', 'filmstrip']

// Arterne findes som filer i src/art/species (samme glob som registry.ts, men ivrig: kun i dev).
const MODULES = import.meta.glob<{ default: SpeciesDef }>(['../art/species/*.tsx', '!../art/species/*.test.tsx'], { eager: true })
export const SPECIES: SpeciesDef[] = SPECIES_IDS.flatMap((id) => {
  const m = MODULES[`../art/species/${id}.tsx`]
  return m ? [m.default] : []
})
const speciesById = (id: string | null) => SPECIES.find((s) => s.id === id) ?? SPECIES[0]

// Genstandene findes som filer i src/art/items (samme glob som registry.ts, men ivrig: kun i dev), i
// katalogets rækkefølge: sæt for sæt (milepæle til sidst), og i hvert sæt slot for slot.
const ITEM_MODULES = import.meta.glob<{ default: ItemDef }>(['../art/items/*/*.tsx', '!../art/items/*/*.test.tsx'], { eager: true })
const SLOT_ORDER: readonly Slot[] = ['head', 'face', 'neck', 'body', 'back', 'hand']
const setRank = (set: SetId) => ((SET_IDS as readonly string[]).includes(set) ? (SET_IDS as readonly string[]).indexOf(set) : SET_IDS.length)
const ITEMS: readonly ItemDef[] = Object.values(ITEM_MODULES)
  .map((m) => m.default)
  .sort((a, b) => setRank(a.set) - setRank(b.set) || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.id.localeCompare(b.id))
/** Hele sæt på én gang (alle sættets slots), fx hverdag og opdager. */
const SETS = [...new Set(ITEMS.map((it) => it.set))].map((set) => ({ set, items: ITEMS.filter((it) => it.set === set) }))
const setOutfit = (items: readonly ItemDef[], cw: 0 | 1 | 2 = 0): Outfit =>
  Object.fromEntries(items.map((it) => [it.slot, { item: it, colorway: cw }])) as Outfit
/**
 * Hele sæt som påklædninger med ét stykke pr. slot: Hverdag, Opdager og Pirat giver én hver, og
 * milepælene (to hatte og to ryggenstande) giver to, hvor de øvrige slots går igen.
 */
const FULL_SETS = SETS.flatMap(({ set, items }) => {
  const bySlot = SLOT_ORDER.map((slot) => items.filter((it) => it.slot === slot))
  const n = Math.max(...bySlot.map((l) => l.length))
  return Array.from({ length: n }, (_, i) => ({ set: n > 1 ? `${set} ${i + 1}` : set, items: bySlot.flatMap((l) => (l.length ? [l[i] ?? l[0]] : [])) }))
}).filter((x) => x.items.length === SLOT_ORDER.length)
/** Butikskortet på dyret beskæres efter slot: hoved og ansigt om hovedet, hals og krop fra mund til hofte, ryg og hånd i hele bredden (ballon og net rækker ud). */
const CARD_CROP: Record<Slot, RigCrop> = { head: 'head', face: 'head', neck: 'torso', body: 'torso', back: 'wide', hand: 'wide' }

const MOOD_DA: Record<Mood, string> = {
  idle: 'idle · hvile',
  happy: 'happy · glad',
  cheer: 'cheer · jubel',
  think: 'think · tænker',
  oops: 'oops · ups',
  sleep: 'sleep · sover',
  wave: 'wave · vinker',
}
const STAGE_DA: Record<Stage, string> = { 1: '1 · baby', 2: '2 · ung', 3: '3 · stor' }

/** Cyklus pr. humør (sekunder) til filmstrimlen. */
const CYCLE: Record<Mood, number> = { idle: 3.2, happy: 1.6, cheer: 1, think: 3, oops: 2.4, sleep: 3.6, wave: 1.8 }

const colorsOf = (def: SpeciesDef, breed: BreedId): ColorwayId[] => [...NATURAL_COLORWAYS, ...magicOf(def, breed)]
const colorName = (def: SpeciesDef, c: ColorwayId) => (c in MAGIC && !(c in def.colorways) ? MAGIC[c as 'gold'].name : resolveColorway(def, c).name)

// ---------------------------------------------------------------------------------------------

function Page({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="sh-page">
      <h1 className="sh-h1">{title}</h1>
      <p className="sh-sub">{sub}</p>
      {children}
    </main>
  )
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="sh-section">
      <h2 className="sh-h2">{title}</h2>
      {children}
      {note && <p className="sh-note">{note}</p>}
    </section>
  )
}

function Cell({ children, cap, lint = 'safe', label, className = '', style }: { children: ReactNode; cap?: ReactNode; lint?: string; label?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`sh-cell ${className}`} data-lint={lint} data-label={label} style={style}>
      {children}
      {cap && <div className="sh-cap">{cap}</div>}
    </div>
  )
}

function Grid({ cols, head, rows, colW }: { cols: readonly ReactNode[]; head?: string; rows: { head: ReactNode; cells: ReactNode[] }[]; colW: number }) {
  return (
    <div className="sh-grid" style={{ gridTemplateColumns: `86px repeat(${cols.length}, ${colW}px)` }}>
      <div className="sh-rowhead">{head}</div>
      {cols.map((c, i) => (
        <div key={i} className="sh-head">
          {c}
        </div>
      ))}
      {rows.map((r, i) => (
        <Fragment key={i}>
          <div className="sh-rowhead">{r.head}</div>
          {r.cells}
        </Fragment>
      ))}
    </div>
  )
}

const titleOf = (def: SpeciesDef) => `${def.name} · ${def.id}`

// ---------------------------------------------------------------------------------------------
// species: race · stadie · farve (idle), stjerneform og humør

function SpeciesSheet({ def }: { def: SpeciesDef }) {
  const R = (p: Partial<RigProps> & { size: number }) => <Rig species={def} mode="static" {...p} />
  const first = def.breeds[0].id
  const moodColors: Record<Stage, ColorwayId> = { 1: 'c2', 2: 'c1', 3: 'c4' }
  return (
    <Page title={titleOf(def)} sub="Race · stadie · farve (idle) med stjerneformen nederst pr. race, og alle humør i de 3 stadier.">
      {def.breeds.map((b) => {
        const colors = colorsOf(def, b.id)
        const rows: { stage: Stage; star?: boolean; head: string }[] = [
          { stage: 1, head: STAGE_DA[1] },
          { stage: 2, head: STAGE_DA[2] },
          { stage: 3, head: STAGE_DA[3] },
          { stage: 3, star: true, head: '3 · stjerne' },
        ]
        return (
          <Section key={b.id} title={`${b.id} · ${b.name}`}>
            <Grid
              colW={112}
              cols={colors.map((c) => `${c} · ${colorName(def, c)}`)}
              rows={rows.map((r) => ({
                head: r.head,
                cells: colors.map((c) => (
                  <Cell key={c} label={`${def.id} ${b.id} ${r.stage}${r.star ? '★' : ''} ${c}`}>
                    <R breed={b.id} stage={r.stage} colorway={c} star={r.star} size={100} />
                  </Cell>
                )),
              }))}
            />
          </Section>
        )
      })}
      <Section title={`${first} · humør · stadier`}>
        <Grid
          colW={112}
          cols={MOODS.map((m) => MOOD_DA[m])}
          rows={STAGES.map((s) => ({
            head: `${STAGE_DA[s]} · ${moodColors[s]}`,
            cells: MOODS.map((m) => (
              <Cell key={m} label={`${def.id} ${first} ${s} ${moodColors[s]} ${m}`}>
                <R breed={first} stage={s} colorway={moodColors[s]} mood={m} size={100} />
              </Cell>
            )),
          }))}
        />
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// moods: store humør-billeder (én race pr. række) og øjne der følger et punkt

function MoodsSheet({ def }: { def: SpeciesDef }) {
  const rows: { stage: Stage; c: ColorwayId; b: BreedId }[] = [0, 1, 2].map((i) => ({
    b: def.breeds[i % def.breeds.length].id,
    stage: ([2, 1, 3] as const)[i],
    c: (['c1', 'c6', 'c3'] as const)[i],
  }))
  const dirs: { name: string; at: { x: number; y: number } }[] = [
    { name: 'op-venstre', at: { x: 10, y: 20 } }, { name: 'op', at: { x: 100, y: -40 } }, { name: 'op-højre', at: { x: 190, y: 20 } },
    { name: 'venstre', at: { x: -60, y: 106 } }, { name: 'midt', at: { x: 100, y: 106 } }, { name: 'højre', at: { x: 260, y: 106 } },
    { name: 'ned-venstre', at: { x: 10, y: 230 } }, { name: 'ned', at: { x: 100, y: 300 } }, { name: 'ned-højre', at: { x: 190, y: 230 } },
  ]
  const first = def.breeds[0].id
  return (
    <Page title={`${def.name} · humør`} sub="Alle 7 humør (nøgleposer; animationen svinger om dem). Der findes ingen sad; blink og ørevip kører altid i animeret tilstand.">
      <Grid
        colW={176}
        cols={MOODS.map((m) => MOOD_DA[m])}
        rows={rows.map((r) => ({
          head: `${r.b} · ${STAGE_DA[r.stage]} · ${r.c}`,
          cells: MOODS.map((m) => (
            <Cell key={m} label={`moods ${def.id} ${r.b} ${r.stage} ${r.c} ${m}`}>
              <Rig species={def} mode="static" breed={r.b} stage={r.stage} colorway={r.c} mood={m} size={160} />
            </Cell>
          )),
        }))}
      />
      <Section title={`tankebobler og Zzz · alle racer og stadier (mindst 8 enheder fri af hoved, ører og manke)`}>
        <div className="sh-row">
          {def.breeds.flatMap((b) =>
            STAGES.flatMap((st) =>
              (['think', 'sleep'] as const).map((m) => (
                <Cell key={`${b.id}${st}${m}`} cap={`${b.id} · ${st} · ${MOOD_DA[m]}`} label={`fx ${def.id} ${b.id} ${st} ${m}`}>
                  <Rig species={def} mode="static" breed={b.id} stage={st} colorway={st === 2 ? 'c5' : 'c2'} mood={m} size={104} />
                </Cell>
              )),
            ),
          )}
        </div>
      </Section>
      <Section title="øjne der følger et punkt (buddyen følger fingeren) · statisk og animeret">
        <div className="sh-row">
          {dirs.map((d, i) => (
            <Cell key={i} cap={`${d.name} · statisk`} label={`blik statisk ${i}`}>
              <Rig species={def} mode="static" breed={first} stage={2} colorway="c3" lookAt={d.at} size={104} crop="head" />
            </Cell>
          ))}
        </div>
        <div className="sh-row" style={{ marginTop: 10 }}>
          {dirs.map((d, i) => (
            <Cell key={i} cap={`${d.name} · animeret`} label={`blik animeret ${i}`} lint="">
              <Rig species={def} breed={first} stage={1} colorway="c6" lookAt={d.at} size={104} crop="head" freezeAt={0} />
            </Cell>
          ))}
        </div>
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// closeup: store renders til detaljer og finish

function CloseupSheet({ def }: { def: SpeciesDef }) {
  const R = (p: Partial<RigProps> & { size: number }) => <Rig species={def} mode="static" {...p} />
  const [b1, b2, b3] = [0, 1, 2].map((i) => def.breeds[Math.min(i, def.breeds.length - 1)].id)
  const special = magicOf(def, b1).includes('starwhite') ? 'starwhite' : 'gold'
  return (
    <Page title={`${def.name} · nærbillede`} sub="Store renders til vurdering af kontur, cel-skygge, øjne og finish – alle racer.">
      <div className="sh-row">
        <Cell cap={`${b1} · 2 · c1 · idle`} label="closeup 1">
          <R breed={b1} stage={2} colorway="c1" size={420} />
        </Cell>
        <Cell cap={`${b2} · 1 · c5 · happy`} label="closeup 2" className="sh-sky">
          <R breed={b2} stage={1} colorway="c5" mood="happy" size={420} />
        </Cell>
        <Cell cap={`${b3} · 3 · c3 · hue + trøje`} label="closeup 3" lint="safe fit">
          <R breed={b3} stage={3} colorway="c3" size={420} outfit={{ head: { item: hverdagHead }, body: { item: hverdagBody } }} />
        </Cell>
      </div>
      <div className="sh-row" style={{ marginTop: 14 }}>
        <Cell cap={`${b1} · 3 · ${special} · stjerneform`} label="closeup 4">
          <R breed={b1} stage={3} colorway={special} star size={300} />
        </Cell>
        <Cell cap={`${b2} · 2 · rainbow · cheer`} label="closeup 5">
          <R breed={b2} stage={2} colorway="rainbow" mood="cheer" size={300} />
        </Cell>
        <Cell cap={`${b3} · 2 · c4 · festhat`} label="closeup 6" lint="safe fit">
          <R breed={b3} stage={2} colorway="c4" size={300} outfit={{ head: { item: festHead, colorway: 1 } }} />
        </Cell>
        <Cell cap={`${b1} · 1 · c2 · oops`} label="closeup 7">
          <R breed={b1} stage={1} colorway="c2" mood="oops" size={300} />
        </Cell>
      </div>
      {/* Hele sæt i nærbillede (hvilende og med løftet pote): håndgenstandene følger poten. To sæt pr. række. */}
      {Array.from({ length: Math.ceil(FULL_SETS.length / 2) }, (_, r) => (
        <div key={r} className="sh-row" style={{ marginTop: 14 }}>
          {FULL_SETS.slice(2 * r, 2 * r + 2).flatMap(({ set, items }, ii) => {
            const i = 2 * r + ii
            return (['idle', i % 2 ? 'cheer' : 'wave'] as const).map((m, j) => {
              const b = [b2, b3][(i + j) % 2]
              const st = (j ? 2 : 3) as Stage
              const c = (['c5', 'c2', 'c6', 'c4'] as const)[(2 * i + j) % 4]
              return (
                <Cell key={`${set}${m}`} cap={`${b} · ${st} · ${c} · ${set} · ${m}`} label={`closeup ${set} ${m}`} lint="safe fit">
                  <R breed={b} stage={st} colorway={c} mood={m} size={300} outfit={setOutfit(items, ((i + j) % 3) as 0 | 1 | 2)} />
                </Cell>
              )
            })
          })}
        </div>
      ))}
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// sizes: 48 / 96 / 256 px + butikskort 64 px

/** Dyrets farve på butikskortene "på dyret" pr. genstandens farvesæt. */
const CARD_COLORS = ['c1', 'c3', 'c6'] as const

/**
 * Butikskortet for et slot, arten selv fylder (uglens vinger på ryggen, SPEC §7.1; review G2-r1 B11): dyret
 * kan ikke bære genstanden, så kortet viser genstanden alene ved siden af dyret med låse-ikonet fra §7.1 – som
 * garderobens låste slot – og ligner aldrig et tilbud på ingenting. Lint'en kræver genstanden og låsen.
 */
function LockedCard({ def, item, cw, breed, label }: { def: SpeciesDef; item: ItemDef; cw: 0 | 1 | 2; breed: BreedId; label: string }) {
  const at = (s: CSSProperties): CSSProperties => ({ position: 'absolute', lineHeight: 0, ...s })
  return (
    <div className="sh-card" data-card="locked" data-label={label} style={{ position: 'relative' }}>
      <span style={at({ left: -9, bottom: -3 })}>
        <Rig species={def} mode="static" breed={breed} stage={2} colorway={CARD_COLORS[cw]} size={50} crop="bust" />
      </span>
      <span style={at({ right: 0, bottom: 2 })}>
        <ItemIcon item={item} colorway={cw} size={40} />
      </span>
      <span
        data-lock=""
        style={at({ right: 2, top: 2, width: 20, height: 20, borderRadius: 10, background: 'white', color: 'rgb(94 84 120)', display: 'grid', placeItems: 'center', boxShadow: '0 1px 3px rgba(43, 33, 68, 0.3)' })}
      >
        <Icon name="lock" size={14} strokeWidth={2.4} />
      </span>
    </div>
  )
}

function SizesSheet({ def }: { def: SpeciesDef }) {
  const R = (p: Partial<RigProps> & { size: number }) => <Rig species={def} mode="static" {...p} />
  const br = (i: number) => def.breeds[i % def.breeds.length].id
  const small: { b: BreedId; s: Stage; c: ColorwayId; m?: Mood }[] = [
    { b: br(0), s: 1, c: 'c1' }, { b: br(1), s: 2, c: 'c2' }, { b: br(2), s: 3, c: 'c3' }, { b: br(0), s: 2, c: 'c4' },
    { b: br(1), s: 1, c: 'c5' }, { b: br(2), s: 2, c: 'c6' }, { b: br(0), s: 3, c: 'gold' }, { b: br(1), s: 2, c: 'rainbow' },
    { b: br(2), s: 2, c: 'c3', m: 'happy' }, { b: br(0), s: 2, c: 'c1', m: 'sleep' },
  ]
  return (
    <Page title={`${def.name} · størrelser`} sub="Genkendelighed ved 48 px (lille detaljeniveau: tykkere kontur, tæt beskåret), 96 og 256 px, og butikskort ved 64 px (CSS-px; arket er taget i 2·).">
      <Section title="48 px">
        <div className="sh-row">
          {small.map((x, i) => (
            <Cell key={i} label={`48 ${i}`}>
              <R breed={x.b} stage={x.s} colorway={x.c} mood={x.m} size={48} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="96 px">
        <div className="sh-row">
          {small.slice(0, 8).map((x, i) => (
            <Cell key={i} label={`96 ${i}`}>
              <R breed={x.b} stage={x.s} colorway={x.c} mood={x.m} size={96} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="256 px">
        <div className="sh-row">
          {([1, 2, 3] as Stage[]).map((s) => (
            <Cell key={s} label={`256 ${s}`}>
              <R breed={br(s - 1)} stage={s} colorway={(['c5', 'c1', 'c3'] as const)[s - 1]} size={256} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="butikskort · 64 px · genstanden alene (ét sæt pr. række)">
        {SETS.map(({ set, items }) => (
          <div key={set} className="sh-row" style={{ marginBottom: 12 }}>
            {items.flatMap((it) =>
              ([0, 1, 2] as const).map((cw) => (
                <div key={`${it.id}${cw}`} className="sh-card" data-card="item" data-label={`kort ${it.id} ${cw}`}>
                  <ItemIcon item={it} colorway={cw} size={62} />
                </div>
              )),
            )}
          </div>
        ))}
      </Section>
      <Section title={`butikskort · 64 px · på ${def.name.toLowerCase()} (beskåret efter slot; et slot, arten selv fylder, viser genstanden med en lås)`}>
        {SETS.map(({ set, items }, si) => (
          <div key={set} className="sh-row" style={{ marginBottom: 12 }}>
            {items.flatMap((it) =>
              ([0, 1, 2] as const).map((cw) =>
                def.occupies?.includes(it.slot) ? (
                  <LockedCard key={`${it.id}${cw}`} def={def} item={it} cw={cw} breed={br(cw)} label={`kort ${def.id} ${it.id} ${cw}`} />
                ) : (
                  <div key={`${it.id}${cw}`} className="sh-card" data-card="worn" data-label={`kort ${def.id} ${it.id} ${cw}`}>
                    <R
                      breed={br(cw)}
                      stage={2}
                      colorway={CARD_COLORS[cw]}
                      size={64}
                      crop={CARD_CROP[it.slot]}
                      outfit={{ [it.slot]: { item: it, colorway: cw } } as Outfit}
                    />
                  </div>
                ),
              ),
            )}
            {si === SETS.length - 1 && (
              <>
                <div className="sh-card sh-gold" data-label={`kort ${def.id} guld`}>
                  <R breed={br(0)} stage={2} colorway="gold" size={64} crop="bust" />
                </div>
                <div className="sh-card sh-gold" data-label={`kort ${def.id} regnbue`}>
                  <R breed={br(1)} stage={1} colorway="rainbow" size={64} crop="bust" />
                </div>
              </>
            )}
          </div>
        ))}
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// silhouettes: alle arter og racer i sort, uden navne, i fast "tilfældig" rækkefølge

function SilhouettesSheet() {
  const all: { def: SpeciesDef; b: BreedId; s: Stage }[] = []
  for (const def of SPECIES) for (const b of def.breeds) for (const s of [2, 1, 3] as Stage[]) all.push({ def, b: b.id, s })
  // Deterministisk bland (så arket ikke ændrer sig mellem kørsler).
  const order = all.map((x, i) => ({ x, k: Math.sin(i * 12.9898 + 4.1) * 43758.5453 })).sort((p, q) => (p.k % 1) - (q.k % 1))
  return (
    <Page title="Silhuetter" sub="Sort fyld, uden navne (blind silhuettest). Nummereret, ikke navngivet.">
      <div className="sh-grid" style={{ gridTemplateColumns: 'repeat(9, 140px)' }}>
        {order.map(({ x }, i) => (
          <Cell key={i} cap={`#${i + 1}`} label={`silhuet ${i + 1}`} className="sh-bare">
            <Rig species={x.def} breed={x.b} stage={x.s} mode="static" silhouette size={124} />
          </Cell>
        ))}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// holes: alle arter, racer, stadier, farver og humør på magenta. Lint'en rasteriserer hver figur og
// fejler ved lukket baggrund inden for yderkonturen (review G1-r3, forbedring 1). Alle farver i hvile,
// alle humør i c1 og c4 (mønster) – og vædderen i alle 8 farver · 7 humør · 3 stadier (K1-beviset).

/**
 * Arter, hvis lommer er lukket, og hvordan de lintes (andre arter vises, men lintes ikke endnu):
 * 'strict' = intet lukket område overhovedet, 'thin' = ingen sømme, sprækker eller lukkede områder fra
 * 1,5 enh² (review G1-r4, R1). En lomme, der kun hænger sammen med baggrunden gennem en sprække under 1
 * enhed, er lukket. Kendte lommer (lints.ts, KNOWN_POCKETS) fejler ikke, men står i lint-rapporten.
 */
const HOLES_LINTED: Partial<Record<string, 'strict' | 'thin'>> = {
  rabbit: 'strict', cat: 'thin', horse: 'thin', unicorn: 'thin', puppy: 'thin', hedgehog: 'thin',
  // Bølge 2 (review G2-r1 §1.4): lommerne mellem løftet pote eller vinge og kind eller krop er fyldt.
  lamb: 'thin', fox: 'thin', hamster: 'thin', panda: 'thin', squirrel: 'thin', owl: 'thin',
}

function HolesSheet() {
  const cells: { def: SpeciesDef; b: BreedId; s: Stage; c: ColorwayId; m: Mood }[] = []
  for (const def of SPECIES)
    for (const b of def.breeds)
      for (const s of STAGES) {
        const colors = [...NATURAL_COLORWAYS, ...magicOf(def, b.id)] as ColorwayId[]
        const all = def.id === 'rabbit' && b.id === 'lop'
        for (const c of colors) cells.push({ def, b: b.id, s, c, m: 'idle' })
        for (const c of all ? colors : (['c1', 'c4'] as const)) for (const m of MOODS) if (m !== 'idle') cells.push({ def, b: b.id, s, c, m })
      }
  return (
    <Page title="Huller og sømme" sub="Alle arter, racer, stadier og farver i hvile, alle humør i c1 og c4, vædderen i alle 8 farver · 7 humør · 3 stadier – på magenta. Kaninen må intet lukket område have; de andre arter ingen sømme, sprækker eller lukkede områder (en lomme bag en sprække under 1 enhed er lukket). Kendte lommer står i lint-rapporten.">
      <div className="sh-grid" style={{ gridTemplateColumns: 'repeat(28, 64px)', gap: 4 }}>
        {cells.map((x, i) => (
          <div key={i} data-holes={HOLES_LINTED[x.def.id] ? `${x.def.id} ${x.b} ${x.s} ${x.c} ${x.m}` : undefined} data-holes-mode={HOLES_LINTED[x.def.id]} style={{ background: '#FF00FF', borderRadius: 6, lineHeight: 0 }}>
            <Rig species={x.def} breed={x.b} stage={x.s} colorway={x.c} mood={x.m} mode="static" size={64} lod="full" crop="full" />
          </div>
        ))}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// fit: genstande på én art i 3 stadier · 3 farvesæt (alle racer)

function FitSheet({ def }: { def: SpeciesDef }) {
  const outfits: { name: string; outfit: (cw: 0 | 1 | 2) => Outfit }[] = [
    ...ITEMS.map((it) => ({ name: `${it.id}${it.fit.earMode ? ` · ${it.fit.earMode}` : ''}`, outfit: (cw: 0 | 1 | 2) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit })),
    { name: 'hue + trøje', outfit: (cw) => ({ head: { item: hverdagHead, colorway: cw }, body: { item: hverdagBody, colorway: cw } }) },
    { name: 'festhat + trøje', outfit: (cw) => ({ head: { item: festHead, colorway: cw }, body: { item: hverdagBody, colorway: ((cw + 1) % 3) as 0 | 1 | 2 } }) },
    ...FULL_SETS.map(({ set, items }) => ({ name: `${set} · hele sættet`, outfit: (cw: 0 | 1 | 2) => setOutfit(items, cw) })),
  ]
  const cols: { s: Stage; cw: 0 | 1 | 2; c: ColorwayId; b: BreedId }[] = []
  for (const s of STAGES) for (const cw of [0, 1, 2] as const) cols.push({ s, cw, c: (['c1', 'c3', 'c6'] as const)[cw], b: def.breeds[cw % def.breeds.length].id })
  // Tøj i alle humør: ærmerne følger de løftede arme (jubel, vink, tænker, ups).
  const moodRows: { s: Stage; b: BreedId; c: ColorwayId; outfit: Outfit }[] = [
    { s: 1, b: def.breeds[1 % def.breeds.length].id, c: 'c2', outfit: { body: { item: hverdagBody, colorway: 1 }, head: { item: festHead } } },
    { s: 2, b: def.breeds[0].id, c: 'c1', outfit: { body: { item: hverdagBody }, head: { item: hverdagHead } } },
    { s: 3, b: def.breeds[2 % def.breeds.length].id, c: 'c4', outfit: { body: { item: hverdagBody, colorway: 2 } } },
    // Hele sæt i alle humør: håndgenstande følger poten, vestens ærmegab og rygsækkens stropper følger armene.
    // Stor bruger artens første race (langhårskattens hale går uden for den sikre zone i glad og vink på
    // stor – en artsfejl, der er meldt videre), babyerne racerne på skift.
    ...FULL_SETS.flatMap(({ items }, i) =>
      ([1, 3] as const).map((st, j) => ({
        s: st as Stage,
        b: def.breeds[j ? 0 : (i + 1) % def.breeds.length].id,
        c: (['c5', 'c3', 'c6', 'c2'] as const)[(2 * i + j) % 4],
        outfit: setOutfit(items, ((i + j) % 3) as 0 | 1 | 2),
      })),
    ),
  ]
  return (
    <Page title={`Pasform · ${def.name.toLowerCase()}`} sub="Genstandene i 3 stadier · genstandens 3 farvesæt (racerne på skift). Lints: øjne dækkes ikke, bbox inden for artens hull + 6, ≤ 25 elementer pr. genstand.">
      <Grid
        colW={118}
        cols={cols.map((x) => `st. ${x.s} · farve ${x.cw} · ${x.b}`)}
        rows={outfits.map((o) => ({
          head: o.name,
          cells: cols.map((x, i) => (
            <Cell key={i} lint="safe fit" label={`fit ${def.id} ${o.name} ${x.s} ${x.cw}`}>
              <Rig species={def} mode="static" breed={x.b} stage={x.s} colorway={x.c} outfit={o.outfit(x.cw)} size={104} />
            </Cell>
          )),
        }))}
      />
      <Section title="tøj i alle humør (ærmerne følger de løftede arme)">
        <Grid
          colW={118}
          cols={MOODS.map((m) => MOOD_DA[m])}
          rows={moodRows.map((r) => ({
            head: `${r.b} · ${STAGE_DA[r.s]}${Object.keys(r.outfit).length === SLOT_ORDER.length ? ` · ${Object.values(r.outfit)[0]?.item.set}` : ''}`,
            cells: MOODS.map((m) => (
              <Cell key={m} lint="safe fit" label={`fit ${def.id} humør ${m} ${r.s}`}>
                <Rig species={def} mode="static" breed={r.b} stage={r.s} colorway={r.c} mood={m} outfit={r.outfit} size={104} />
              </Cell>
            )),
          }))}
        />
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// fitmatrix: art · stadie · genstand (alle arter; racerne skifter pr. stadie)

function FitMatrixSheet() {
  const cols: { name: string; outfit: Outfit }[] = [
    { name: 'hue · through', outfit: { head: { item: hverdagHead } } },
    { name: 'festhat · under', outfit: { head: { item: festHead } } },
    { name: 'trøje', outfit: { body: { item: hverdagBody } } },
    { name: 'hue + trøje', outfit: { head: { item: hverdagHead, colorway: 1 }, body: { item: hverdagBody, colorway: 2 } } },
    { name: 'festhat + trøje', outfit: { head: { item: festHead, colorway: 2 }, body: { item: hverdagBody, colorway: 1 } } },
    ...ITEMS.filter((it) => it !== hverdagHead && it !== festHead && it !== hverdagBody).map((it) => ({ name: it.id, outfit: { [it.slot]: { item: it } } as Outfit })),
    ...FULL_SETS.map(({ set, items }, i) => ({ name: `${set} · sæt`, outfit: setOutfit(items, ((i + 1) % 3) as 0 | 1 | 2) })),
  ]
  const rows: { def: SpeciesDef; s: Stage; b: BreedId }[] = []
  for (const def of SPECIES) for (const s of STAGES) rows.push({ def, s, b: def.breeds[(s - 1) % def.breeds.length].id })
  return (
    <Page title="Pasformsmatrix" sub="Art · stadie · genstand. Racerne skifter pr. stadie, så alle racer er med. Lints som på fit-arket.">
      <Grid
        colW={112}
        cols={cols.map((c) => c.name)}
        rows={rows.map((r) => ({
          head: `${r.def.name} · ${r.b} · ${STAGE_DA[r.s]}`,
          cells: cols.map((c, i) => (
            <Cell key={i} lint="safe fit" label={`matrix ${r.def.id} ${r.b} ${r.s} ${c.name}`}>
              <Rig species={r.def} mode="static" breed={r.b} stage={r.s} colorway={(['c1', 'c3', 'c5', 'c2', 'c6'] as const)[i % 5]} outfit={c.outfit} size={100} />
            </Cell>
          )),
        }))}
      />
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// filmstrip: 8 frames pr. humør via negative animation-delay (frosset)

function FilmstripSheet({ def }: { def: SpeciesDef }) {
  const frames = Array.from({ length: 8 }, (_, i) => i)
  const first = def.breeds[0].id
  const rows: { head: string; mood: Mood; times: number[]; c: ColorwayId; s: Stage; b: BreedId }[] = MOODS.map((m, i) => ({
    head: MOOD_DA[m],
    mood: m,
    times: frames.map((k) => (k * CYCLE[m]) / 8),
    c: (['c1', 'c3', 'c5', 'c2', 'c6', 'c4', 'c3'] as const)[i],
    s: 2 as Stage,
    b: def.breeds[i % def.breeds.length].id,
  }))
  // Blink (periode 4,3 s ved seed 0) og ørevip tæt samplet, og signaturen (næse-vip, halekrølle,
  // manke-kast eller hornets glimt) hen over hændelsen.
  rows.push({ head: 'blink + ørevip', mood: 'idle', times: [4.02, 4.08, 4.12, 4.14, 4.17, 6.37, 6.45, 6.55], c: 'c3', s: 2, b: first })
  rows.push({ head: 'signatur', mood: 'idle', times: SIG_TIMES, c: 'c1', s: 2, b: first })
  const sigCrop = SIG_CROP[def.signature ?? 'nose-wiggle'] ?? 'full'
  return (
    <Page title={`${def.name} · filmstrimmel`} sub="8 frames pr. humør, samplet med animation-play-state: paused og negative animation-delay. Kun transform og opacity animeres.">
      <Grid
        colW={112}
        cols={frames.map((k) => `frame ${k + 1}`)}
        rows={rows.map((r) => ({
          head: `${r.head} · ${r.b}`,
          cells: r.times.map((t, i) => (
            <Cell key={i} lint="" cap={`${t.toFixed(2)} s`} label={`film ${r.head} ${i}`}>
              <Rig species={def} breed={r.b} stage={r.s} colorway={r.c} mood={r.mood} mode="animated" seed={0} freezeAt={t} size={96} />
            </Cell>
          )),
        }))}
      />
      <Section title={`signatur i nærbillede (${sigCrop === 'full' ? 'hele figuren' : 'hovedet'}): hændelsen 0,3–1,7 s, overshoot og pause`}>
        <div className="sh-row">
          {SIG_TIMES.map((t, i) => (
            <Cell key={i} lint="" cap={`${t.toFixed(2)} s`} label={`film signatur stor ${i}`}>
              <Rig species={def} breed={first} stage={2} colorway="c1" mood="idle" mode="animated" seed={0} freezeAt={t} size={150} crop={sigCrop} />
            </Cell>
          ))}
        </div>
      </Section>
    </Page>
  )
}

/** Signaturrækkens tider (s, ved seed 0): alle fire signaturer har hændelsen i 0,3–1,7 s. */
const SIG_TIMES = [0.2, 0.45, 0.7, 0.95, 1.2, 1.45, 1.8, 2.4]
/** Nærbilledets beskæring pr. signatur (næse og horn sidder i hovedet; hale og manke kræver hele figuren). */
const SIG_CROP: Partial<Record<NonNullable<SpeciesDef['signature']>, 'head' | 'full' | 'crown'>> = {
  'nose-wiggle': 'head',
  'tail-curl': 'full',
  'mane-toss': 'full',
  'horn-glint': 'crown',
}

// ---------------------------------------------------------------------------------------------
// lineup: alle arter og racer side om side (stadie 2), stadierne pr. art og kropsskabelonerne

function LineupSheet() {
  return (
    <Page title="Lineup" sub="Alle arter og racer side om side i stadie 2 (samme jordlinje), stadierne baby → ung → stor pr. art, og de tre kropsskabeloner som grå mannequiner.">
      <Section title="arter og racer · stadie 2 · c1">
        <div className="sh-row">
          {SPECIES.flatMap((def) =>
            def.breeds.map((b) => (
              <Cell key={`${def.id}${b.id}`} cap={`${def.id} · ${b.id}`} label={`lineup ${def.id} ${b.id}`}>
                <Rig species={def} breed={b.id} stage={2} colorway="c1" mode="static" size={150} />
              </Cell>
            )),
          )}
        </div>
      </Section>
      <Section title="stadier · baby → ung → stor">
        <div className="sh-row">
          {SPECIES.flatMap((def) =>
            STAGES.map((s) => (
              <Cell key={`${def.id}${s}`} cap={`${def.id} · ${STAGE_DA[s]}`} label={`lineup ${def.id} stadie ${s}`}>
                <Rig species={def} stage={s} colorway="c3" mode="static" size={150} />
              </Cell>
            )),
          )}
        </div>
      </Section>
      <Section title="kropsskabeloner">
        <div className="sh-row">
          {mannequins.map((m) => (
            <Cell key={m.id + m.body} cap={`skabelon · ${m.body}`} label={`lineup ${m.body}`}>
              <Rig species={m} mode="static" colorway="c1" size={150} />
            </Cell>
          ))}
        </div>
      </Section>
    </Page>
  )
}

function Index() {
  return (
    <Page title="Talvennerne 2 · kontaktark" sub="Vælg et ark.">
      <ul>
        {ROUTES.map((r) =>
          PER_SPECIES.includes(r) ? (
            SPECIES.map((s) => (
              <li key={`${r}${s.id}`}>
                <a href={`?sheet=${r}&id=${s.id}`}>
                  {r} · {s.id}
                </a>
              </li>
            ))
          ) : (
            <li key={r}>
              <a href={`?sheet=${r}`}>{r}</a>
            </li>
          ),
        )}
      </ul>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// scene: Engdalen bag kortet i 393·852 (telefon) og 1180·820 (iPad på tværs) for tier start, bronze og guld,
// og én ramme pr. format med en skitse af kortets lag ovenpå (topbjælke, regionens kort med sti og
// trædesten, sidepanel og dok), så man kan se, at scenen ikke konkurrerer med stien.

const SCENE_TIERS: readonly RegionTier[] = ['start', 'bronze', 'gold']
const allAt = (t: RegionTier): MapSceneProps['tiers'] => Object.fromEntries(Object.values(ENG_REGIONS).map((r) => [r, t]))
/** Blandet fremgang: de første regioner er nået længst. */
const MIXED: MapSceneProps['tiers'] = {
  [ENG_REGIONS.grove]: 'gold', [ENG_REGIONS.garden]: 'silver', [ENG_REGIONS.meadow]: 'silver',
  [ENG_REGIONS.trail]: 'bronze', [ENG_REGIONS.brook]: 'bronze', [ENG_REGIONS.den]: 'start',
}

type Box = readonly [number, number, number, number, number?]
/** Kortets lag som skitse (x, y, b, h, radius) pr. format: hvide flader og trædesten. */
const UI: Record<'phone' | 'ipad', { boxes: Box[]; card: Box; stones: [number, number][] }> = {
  phone: {
    boxes: [[16, 12, 64, 64, 32], [226, 14, 92, 56, 28], [324, 10, 60, 60, 20], [16, 84, 176, 52, 26], [200, 84, 176, 52, 26], [42, 158, 230, 58, 29], [264, 158, 88, 58, 29], [20, 762, 353, 80, 30]],
    card: [12, 196, 369, 600, 44],
    stones: [[196, 250], [281, 362], [204, 474], [100, 586], [185, 698]],
  },
  ipad: {
    boxes: [[24, 12, 64, 64, 32], [230, 18, 440, 54, 27], [960, 14, 110, 58, 29], [1092, 10, 62, 62, 20], [186, 96, 240, 58, 29], [418, 96, 92, 58, 29],
      [868, 92, 200, 40, 10], [868, 140, 300, 64, 20], [868, 220, 146, 92, 20], [1022, 220, 146, 92, 20], [868, 326, 300, 250, 28], [340, 736, 500, 76, 30]],
    card: [157, 136, 536, 700, 44],
    stones: [[425, 196], [548, 308], [436, 420], [302, 532], [409, 644], [425, 756]],
  },
}

function MapSketch({ kind }: { kind: 'phone' | 'ipad' }) {
  const ui = UI[kind]
  const box = ([x, y, w, h, r = 16]: Box, bg: string) => ({ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, background: bg, boxShadow: '0 6px 18px rgba(43,33,68,0.12)' }) as CSSProperties
  return (
    <>
      <div style={box(ui.card, 'rgba(222,246,226,0.86)')} />
      {ui.stones.map(([x, y], i) => (
        <div key={i} style={{ ...box([x - 38, y - 38, 76, 76, 38], i < 2 ? 'rgba(39,174,96,0.95)' : 'rgba(255,255,255,0.95)'), border: '4px solid rgba(39,174,96,0.95)' }} />
      ))}
      {ui.boxes.map((b, i) => <div key={i} style={box(b, 'rgba(255,255,255,0.9)')} />)}
    </>
  )
}

function SceneFrame({ w, h, tiers, cap, sketch }: { w: number; h: number; tiers: MapSceneProps['tiers']; cap: string; sketch?: 'phone' | 'ipad' }) {
  return (
    <Cell cap={cap} lint="" label={`scene ${cap}`}>
      <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: 12 }}>
        <EngScene world="eng" tiers={tiers} className="sh-scene-art" />
        {sketch && <MapSketch kind={sketch} />}
      </div>
    </Cell>
  )
}

// Hestebakkerne: alle fire tiers (alle regioner) i telefon, iPad på langs og iPad på tværs, og blandet fremgang
// med kortets skitse ovenpå (telefon og iPad på tværs).
const BAKKE_TIERS: readonly RegionTier[] = ['start', 'bronze', 'silver', 'gold']
const bakkeAt = (t: RegionTier): MapSceneProps['tiers'] => Object.fromEntries(Object.values(BAKKE_REGIONS).map((r) => [r, t]))
/** Blandet fremgang: de første regioner er nået længst. */
const BAKKE_MIXED: MapSceneProps['tiers'] = {
  [BAKKE_REGIONS.field]: 'gold', [BAKKE_REGIONS.twins]: 'silver', [BAKKE_REGIONS.bridge]: 'silver', [BAKKE_REGIONS.workshop]: 'bronze',
  [BAKKE_REGIONS.tower]: 'bronze', [BAKKE_REGIONS.hop]: 'start', [BAKKE_REGIONS.market]: 'start',
}

function BakkeFrame({ w, h, tiers, cap, sketch }: { w: number; h: number; tiers: MapSceneProps['tiers']; cap: string; sketch?: 'phone' | 'ipad' }) {
  return (
    <Cell cap={cap} lint="" label={`scene bakke ${cap}`}>
      <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: 12 }}>
        <BakkeScene world="bakke" tiers={tiers} className="sh-scene-art" />
        {sketch && <MapSketch kind={sketch} />}
      </div>
    </Cell>
  )
}

function SceneSheet() {
  return (
    <Page title="Scener · Engdalen og Hestebakkerne" sub="Kortets baggrund for Engdalen i 393·852 (telefon) og 1180·820 (iPad på tværs) for tier start, bronze og guld (alle regioner), og med en skitse af kortets lag ovenpå (blandet fremgang). Derefter Hestebakkerne i alle fire tiers, også i 820·1180 (iPad på langs). Kun skyer, blade og hestehaler bevæger sig.">
      <style>{'.sh-scene-art{position:absolute;inset:0;width:100%;height:100%}'}</style>
      <Section title="telefon · 393·852">
        <div className="sh-row" style={{ alignItems: 'flex-start' }}>
          {SCENE_TIERS.map((t) => <SceneFrame key={t} w={393} h={852} tiers={allAt(t)} cap={`393·852 · ${t}`} />)}
          <SceneFrame w={393} h={852} tiers={MIXED} cap="393·852 · blandet · med kortet" sketch="phone" />
        </div>
      </Section>
      <Section title="iPad på tværs · 1180·820">
        <div className="sh-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', width: 2420 }}>
          {SCENE_TIERS.map((t) => <SceneFrame key={t} w={1180} h={820} tiers={allAt(t)} cap={`1180·820 · ${t}`} />)}
          <SceneFrame w={1180} h={820} tiers={MIXED} cap="1180·820 · blandet · med kortet" sketch="ipad" />
        </div>
      </Section>
      <Section title="Hestebakkerne · telefon · 393·852">
        <div className="sh-row" style={{ alignItems: 'flex-start' }}>
          {BAKKE_TIERS.map((t) => <BakkeFrame key={t} w={393} h={852} tiers={bakkeAt(t)} cap={`393·852 · ${t}`} />)}
          <BakkeFrame w={393} h={852} tiers={BAKKE_MIXED} cap="393·852 · blandet · med kortet" sketch="phone" />
        </div>
      </Section>
      <Section title="Hestebakkerne · iPad på langs · 820·1180">
        <div className="sh-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', width: 1700 }}>
          {BAKKE_TIERS.map((t) => <BakkeFrame key={t} w={820} h={1180} tiers={bakkeAt(t)} cap={`820·1180 · ${t}`} />)}
        </div>
      </Section>
      <Section title="Hestebakkerne · iPad på tværs · 1180·820">
        <div className="sh-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', width: 2420 }}>
          {BAKKE_TIERS.map((t) => <BakkeFrame key={t} w={1180} h={820} tiers={bakkeAt(t)} cap={`1180·820 · ${t}`} />)}
          <BakkeFrame w={1180} h={820} tiers={BAKKE_MIXED} cap="1180·820 · blandet · med kortet" sketch="ipad" />
        </div>
      </Section>
    </Page>
  )
}

const SHEETS: Record<Route, (p: { def: SpeciesDef }) => ReactNode> = {
  species: SpeciesSheet,
  moods: MoodsSheet,
  closeup: CloseupSheet,
  sizes: SizesSheet,
  silhouettes: SilhouettesSheet,
  fit: FitSheet,
  fitmatrix: FitMatrixSheet,
  filmstrip: FilmstripSheet,
  lineup: LineupSheet,
  scene: SceneSheet,
  holes: HolesSheet,
}

declare global {
  interface Window {
    __sheetReady?: boolean
    __lint?: typeof runLints
  }
}

export function SheetApp() {
  const q = new URLSearchParams(location.search)
  const sheet = q.get('sheet') as Route | null
  const def = speciesById(q.get('id'))
  const Sheet = sheet && SHEETS[sheet] ? SHEETS[sheet] : null
  useEffect(() => {
    window.__lint = runLints
    let alive = true
    document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (alive) window.__sheetReady = true
        }),
      ),
    )
    return () => {
      alive = false
    }
  }, [])
  return Sheet ? <Sheet def={def} /> : <Index />
}
