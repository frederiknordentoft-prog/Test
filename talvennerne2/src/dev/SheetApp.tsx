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
import { MAGIC } from '../art/rig/palette'
import { Rig, magicOf, resolveColorway } from '../art/rig/Rig'
import type { RigProps } from '../art/rig/Rig'
import { MOODS, NATURAL_COLORWAYS, SPECIES_IDS, STAGES } from '../art/rig/types'
import type { BreedId, ColorwayId, ItemDef, Mood, Outfit, SpeciesDef, Stage } from '../art/rig/types'
import { mannequins } from './mannequin'
import { runLints } from './lints'

export const ROUTES = ['species', 'moods', 'closeup', 'sizes', 'silhouettes', 'fit', 'fitmatrix', 'filmstrip', 'lineup'] as const
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

const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]

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
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// sizes: 48 / 96 / 256 px + butikskort 64 px

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
      <Section title="butikskort · 64 px · genstanden alene">
        <div className="sh-row">
          {ITEMS.flatMap((it) =>
            ([0, 1, 2] as const).map((cw) => (
              <div key={`${it.id}${cw}`} className="sh-card" data-card="item" data-label={`kort ${it.id} ${cw}`}>
                <ItemIcon item={it} colorway={cw} size={62} />
              </div>
            )),
          )}
        </div>
      </Section>
      <Section title={`butikskort · 64 px · på ${def.name.toLowerCase()} (beskåret efter slot)`}>
        <div className="sh-row">
          {ITEMS.flatMap((it) =>
            ([0, 1, 2] as const).map((cw) => (
              <div key={`${it.id}${cw}`} className="sh-card" data-label={`kort ${def.id} ${it.id} ${cw}`}>
                <R
                  breed={br(cw)}
                  stage={2}
                  colorway={(['c1', 'c3', 'c6'] as const)[cw]}
                  size={64}
                  crop={it.slot === 'head' ? 'head' : 'torso'}
                  outfit={{ [it.slot]: { item: it, colorway: cw } } as Outfit}
                />
              </div>
            )),
          )}
          <div className="sh-card sh-gold" data-label={`kort ${def.id} guld`}>
            <R breed={br(0)} stage={2} colorway="gold" size={64} crop="bust" />
          </div>
          <div className="sh-card sh-gold" data-label={`kort ${def.id} regnbue`}>
            <R breed={br(1)} stage={1} colorway="rainbow" size={64} crop="bust" />
          </div>
        </div>
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
// fit: genstande på én art i 3 stadier · 3 farvesæt (alle racer)

function FitSheet({ def }: { def: SpeciesDef }) {
  const outfits: { name: string; outfit: (cw: 0 | 1 | 2) => Outfit }[] = [
    ...ITEMS.map((it) => ({ name: `${it.id}${it.fit.earMode ? ` · ${it.fit.earMode}` : ''}`, outfit: (cw: 0 | 1 | 2) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit })),
    { name: 'hue + trøje', outfit: (cw) => ({ head: { item: hverdagHead, colorway: cw }, body: { item: hverdagBody, colorway: cw } }) },
    { name: 'festhat + trøje', outfit: (cw) => ({ head: { item: festHead, colorway: cw }, body: { item: hverdagBody, colorway: ((cw + 1) % 3) as 0 | 1 | 2 } }) },
  ]
  const cols: { s: Stage; cw: 0 | 1 | 2; c: ColorwayId; b: BreedId }[] = []
  for (const s of STAGES) for (const cw of [0, 1, 2] as const) cols.push({ s, cw, c: (['c1', 'c3', 'c6'] as const)[cw], b: def.breeds[cw % def.breeds.length].id })
  // Tøj i alle humør: ærmerne følger de løftede arme (jubel, vink, tænker, ups).
  const moodRows: { s: Stage; b: BreedId; c: ColorwayId; outfit: Outfit }[] = [
    { s: 1, b: def.breeds[1 % def.breeds.length].id, c: 'c2', outfit: { body: { item: hverdagBody, colorway: 1 }, head: { item: festHead } } },
    { s: 2, b: def.breeds[0].id, c: 'c1', outfit: { body: { item: hverdagBody }, head: { item: hverdagHead } } },
    { s: 3, b: def.breeds[2 % def.breeds.length].id, c: 'c4', outfit: { body: { item: hverdagBody, colorway: 2 } } },
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
            head: `${r.b} · ${STAGE_DA[r.s]}`,
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
              <Rig species={r.def} mode="static" breed={r.b} stage={r.s} colorway={(['c1', 'c3', 'c5', 'c2', 'c6'] as const)[i]} outfit={c.outfit} size={100} />
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
