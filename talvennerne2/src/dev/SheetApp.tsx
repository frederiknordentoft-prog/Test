// Kontaktark (kun `vite build --mode sheets`; aldrig i produktions-buildet).
// Ruter via ?sheet=<rute>: species, moods, closeup, sizes, silhouettes, fit, filmstrip, lineup.
import { Fragment, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { festHead } from '../art/items/fest/fest-head'
import { hverdagBody } from '../art/items/hverdag/hverdag-body'
import { hverdagHead } from '../art/items/hverdag/hverdag-head'
import { ItemIcon } from '../art/rig/ItemIcon'
import { MAGIC } from '../art/rig/palette'
import { Rig, resolveColorway } from '../art/rig/Rig'
import type { RigProps } from '../art/rig/Rig'
import { MOODS, NATURAL_COLORWAYS, STAGES } from '../art/rig/types'
import type { BreedId, ColorwayId, ItemDef, Mood, Outfit, SpeciesDef, Stage } from '../art/rig/types'
import { rabbit } from '../art/species/rabbit'
import { mannequins } from './mannequin'
import { runLints } from './lints'

export const ROUTES = ['species', 'moods', 'closeup', 'sizes', 'silhouettes', 'fit', 'filmstrip', 'lineup'] as const
export type Route = (typeof ROUTES)[number]

const ITEMS: readonly ItemDef[] = [hverdagHead, festHead, hverdagBody]
const COLORS: readonly ColorwayId[] = [...NATURAL_COLORWAYS, 'gold', 'rainbow']

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
    <div className="sh-grid" style={{ gridTemplateColumns: `76px repeat(${cols.length}, ${colW}px)` }}>
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

const R = (p: Partial<RigProps> & { size: number }) => <Rig species={rabbit} mode="static" {...p} />

// ---------------------------------------------------------------------------------------------
// species: art · race · stadie · farve · humør

function SpeciesSheet() {
  const breeds: { id: BreedId; name: string }[] = rabbit.breeds.map((b) => ({ id: b.id, name: b.name }))
  const stageRows: { stage: Stage; star?: boolean; head: string }[] = [
    { stage: 1, head: STAGE_DA[1] },
    { stage: 2, head: STAGE_DA[2] },
    { stage: 3, head: STAGE_DA[3] },
    { stage: 3, star: true, head: '3 · stjerne' },
  ]
  const moodColors: Record<Stage, ColorwayId> = { 1: 'c1', 2: 'c3', 3: 'c5' }
  return (
    <Page title="Kanin · rabbit" sub="Art · race · stadie · farve · humør. Racen upright er færdig; lop og lionhead er skitser.">
      <Section title="upright · farver · stadier (idle)">
        <Grid
          colW={128}
          cols={COLORS.map((c) => `${c} · ${colorName(rabbit, c)}`)}
          rows={stageRows.map((r) => ({
            head: r.head,
            cells: COLORS.map((c) => (
              <Cell key={c} label={`upright ${r.stage}${r.star ? '★' : ''} ${c}`}>
                <R breed="upright" stage={r.stage} colorway={c} star={r.star} size={112} />
              </Cell>
            )),
          }))}
        />
      </Section>
      <Section title="upright · humør · stadier">
        <Grid
          colW={128}
          cols={MOODS.map((m) => MOOD_DA[m])}
          rows={STAGES.map((s) => ({
            head: `${STAGE_DA[s]} · ${moodColors[s]}`,
            cells: MOODS.map((m) => (
              <Cell key={m} label={`upright ${s} ${moodColors[s]} ${m}`}>
                <R breed="upright" stage={s} colorway={moodColors[s]} mood={m} size={112} />
              </Cell>
            )),
          }))}
        />
      </Section>
      <Section title="racer · skitser">
        <Grid
          colW={128}
          cols={['1 · c3', '2 · c1', '3 · c5', '2 · c2 · happy', '2 · c6 · sleep', '2 · gold', '2 · rainbow']}
          rows={breeds.map((b) => ({
            head: `${b.id} · ${b.name}`,
            cells: [
              <R key="1" breed={b.id} stage={1} colorway="c3" size={112} />,
              <R key="2" breed={b.id} stage={2} colorway="c1" size={112} />,
              <R key="3" breed={b.id} stage={3} colorway="c5" size={112} />,
              <R key="4" breed={b.id} stage={2} colorway="c2" mood="happy" size={112} />,
              <R key="5" breed={b.id} stage={2} colorway="c6" mood="sleep" size={112} />,
              <R key="6" breed={b.id} stage={2} colorway="gold" size={112} />,
              <R key="7" breed={b.id} stage={2} colorway="rainbow" size={112} />,
            ].map((node, i) => (
              <Cell key={i} label={`${b.id} ${i}`}>
                {node}
              </Cell>
            )),
          }))}
        />
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// moods: store humør-billeder

function MoodsSheet() {
  const rows: { stage: Stage; c: ColorwayId }[] = [
    { stage: 2, c: 'c1' },
    { stage: 1, c: 'c6' },
    { stage: 3, c: 'c3' },
  ]
  // Blik: pupillerne følger et punkt (højst 3 enheder). Første række er statisk, anden er den
  // animerede rig, hvor rAF-lerp'en (0,2 pr. frame) har nået målet, før arket tages.
  const dirs: { name: string; at: { x: number; y: number } }[] = [
    { name: 'op-venstre', at: { x: 10, y: 20 } }, { name: 'op', at: { x: 100, y: -40 } }, { name: 'op-højre', at: { x: 190, y: 20 } },
    { name: 'venstre', at: { x: -60, y: 106 } }, { name: 'midt', at: { x: 100, y: 106 } }, { name: 'højre', at: { x: 260, y: 106 } },
    { name: 'ned-venstre', at: { x: 10, y: 230 } }, { name: 'ned', at: { x: 100, y: 300 } }, { name: 'ned-højre', at: { x: 190, y: 230 } },
  ]
  return (
    <Page title="Kanin · humør" sub="Alle 7 humør (statiske nøgleposer). Der findes ingen sad; blink og ørevip kører altid i animeret tilstand.">
      <Section title="øjne der følger et punkt (buddyen følger fingeren)">
        <div className="sh-row">
          {dirs.map((d, i) => (
            <Cell key={i} cap={`${d.name} · statisk`} label={`blik statisk ${i}`}>
              <R breed="upright" stage={2} colorway="c3" lookAt={d.at} size={104} crop="head" />
            </Cell>
          ))}
        </div>
        <div className="sh-row" style={{ marginTop: 10 }}>
          {dirs.map((d, i) => (
            <Cell key={i} cap={`${d.name} · animeret`} label={`blik animeret ${i}`} lint="">
              <Rig species={rabbit} breed="upright" stage={1} colorway="c6" lookAt={d.at} size={104} crop="head" freezeAt={0} />
            </Cell>
          ))}
        </div>
      </Section>
      <Grid
        colW={176}
        cols={MOODS.map((m) => MOOD_DA[m])}
        rows={rows.map((r) => ({
          head: `${STAGE_DA[r.stage]} · ${r.c}`,
          cells: MOODS.map((m) => (
            <Cell key={m} label={`moods ${r.stage} ${r.c} ${m}`}>
              <R breed="upright" stage={r.stage} colorway={r.c} mood={m} size={160} />
            </Cell>
          )),
        }))}
      />
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// closeup: store renders til detaljer og finish

function CloseupSheet() {
  return (
    <Page title="Kanin · nærbillede" sub="Store renders til vurdering af kontur, cel-skygge, øjne og finish.">
      <div className="sh-row">
        <Cell cap="upright · 2 · c1 · idle" label="closeup c1">
          <R breed="upright" stage={2} colorway="c1" size={420} />
        </Cell>
        <Cell cap="upright · 1 · c5 · happy" label="closeup c5" className="sh-sky">
          <R breed="upright" stage={1} colorway="c5" mood="happy" size={420} />
        </Cell>
        <Cell cap="upright · 3 · c3 · hue + trøje" label="closeup c3" lint="safe fit">
          <R breed="upright" stage={3} colorway="c3" size={420} outfit={{ head: { item: hverdagHead }, body: { item: hverdagBody } }} />
        </Cell>
      </div>
      <div className="sh-row" style={{ marginTop: 14 }}>
        <Cell cap="upright · 3 · gold · stjerneform" label="closeup gold">
          <R breed="upright" stage={3} colorway="gold" star size={300} />
        </Cell>
        <Cell cap="upright · 2 · rainbow · cheer" label="closeup rainbow">
          <R breed="upright" stage={2} colorway="rainbow" mood="cheer" size={300} />
        </Cell>
        <Cell cap="upright · 2 · c4 · festhat" label="closeup c4" lint="safe fit">
          <R breed="upright" stage={2} colorway="c4" size={300} outfit={{ head: { item: festHead, colorway: 1 } }} />
        </Cell>
        <Cell cap="upright · 1 · c2 · oops" label="closeup c2">
          <R breed="upright" stage={1} colorway="c2" mood="oops" size={300} />
        </Cell>
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// sizes: 48 / 96 / 256 px + butikskort 64 px

function SizesSheet() {
  const small: { s: Stage; c: ColorwayId; m?: Mood }[] = [
    { s: 1, c: 'c1' }, { s: 2, c: 'c2' }, { s: 3, c: 'c3' }, { s: 2, c: 'c4' }, { s: 1, c: 'c5' },
    { s: 2, c: 'c6' }, { s: 3, c: 'gold' }, { s: 2, c: 'rainbow' }, { s: 2, c: 'c3', m: 'happy' }, { s: 2, c: 'c1', m: 'sleep' },
  ]
  return (
    <Page title="Kanin · størrelser" sub="Genkendelighed ved 48 px, læsbarhed ved 96 og 256 px, og butikskort ved 64 px (CSS-px; arket er taget i 2·).">
      <Section title="48 px">
        <div className="sh-row">
          {small.map((x, i) => (
            <Cell key={i} label={`48 ${i}`}>
              <R breed="upright" stage={x.s} colorway={x.c} mood={x.m} size={48} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="96 px">
        <div className="sh-row">
          {small.slice(0, 8).map((x, i) => (
            <Cell key={i} label={`96 ${i}`}>
              <R breed="upright" stage={x.s} colorway={x.c} mood={x.m} size={96} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="256 px">
        <div className="sh-row">
          {([1, 2, 3] as Stage[]).map((s) => (
            <Cell key={s} label={`256 ${s}`}>
              <R breed="upright" stage={s} colorway={(['c5', 'c1', 'c3'] as const)[s - 1]} size={256} />
            </Cell>
          ))}
        </div>
      </Section>
      <Section title="butikskort · 64 px · genstanden alene">
        <div className="sh-row">
          {ITEMS.flatMap((it) =>
            ([0, 1, 2] as const).map((cw) => (
              <div key={`${it.id}${cw}`} className="sh-card" data-label={`kort ${it.id} ${cw}`}>
                <ItemIcon item={it} colorway={cw} size={54} />
              </div>
            )),
          )}
        </div>
      </Section>
      <Section title="butikskort · 64 px · på kaninen (beskåret)">
        <div className="sh-row">
          {ITEMS.flatMap((it) =>
            ([0, 1, 2] as const).map((cw) => (
              <div key={`${it.id}${cw}`} className="sh-card" data-label={`kort kanin ${it.id} ${cw}`}>
                <R
                  breed="upright"
                  stage={2}
                  colorway={(['c1', 'c3', 'c6'] as const)[cw]}
                  size={60}
                  crop={it.slot === 'head' ? 'head' : 'bust'}
                  outfit={{ [it.slot]: { item: it, colorway: cw } } as Outfit}
                />
              </div>
            )),
          )}
          <div className="sh-card sh-gold" data-label="kort kanin guld">
            <R breed="upright" stage={2} colorway="gold" size={60} crop="bust" />
          </div>
          <div className="sh-card sh-gold" data-label="kort kanin regnbue">
            <R breed="upright" stage={1} colorway="rainbow" size={60} crop="bust" />
          </div>
        </div>
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// silhouettes: sort fyld, ingen navne, fast "tilfældig" rækkefølge

function SilhouettesSheet() {
  const all: { b: BreedId; s: Stage; m: Mood }[] = []
  for (const b of rabbit.breeds) for (const s of STAGES) all.push({ b: b.id, s, m: 'idle' })
  // Deterministisk bland (så arket ikke ændrer sig mellem kørsler).
  const order = all.map((x, i) => ({ x, k: Math.sin(i * 12.9898 + 4.1) * 43758.5453 })).sort((p, q) => (p.k % 1) - (q.k % 1))
  return (
    <Page title="Silhuetter" sub="Sort fyld, uden navne (blind silhuettest). Nummereret, ikke navngivet.">
      <div className="sh-grid" style={{ gridTemplateColumns: 'repeat(5, 150px)' }}>
        {order.map(({ x }, i) => (
          <Cell key={i} cap={`#${i + 1}`} label={`silhuet ${i + 1}`} className="sh-bare">
            <Rig species={rabbit} breed={x.b} stage={x.s} mood={x.m} mode="static" silhouette size={132} />
          </Cell>
        ))}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// fit: genstande på kaninen i 3 stadier · 3 farvesæt

function FitSheet() {
  const outfits: { name: string; outfit: (cw: 0 | 1 | 2) => Outfit }[] = [
    ...ITEMS.map((it) => ({ name: `${it.id}${it.fit.earMode ? ` · ${it.fit.earMode}` : ''}`, outfit: (cw: 0 | 1 | 2) => ({ [it.slot]: { item: it, colorway: cw } }) as Outfit })),
    { name: 'hue + trøje', outfit: (cw) => ({ head: { item: hverdagHead, colorway: cw }, body: { item: hverdagBody, colorway: cw } }) },
    { name: 'festhat + trøje', outfit: (cw) => ({ head: { item: festHead, colorway: cw }, body: { item: hverdagBody, colorway: ((cw + 1) % 3) as 0 | 1 | 2 } }) },
  ]
  const cols: { s: Stage; cw: 0 | 1 | 2; c: ColorwayId }[] = []
  for (const s of STAGES) for (const cw of [0, 1, 2] as const) cols.push({ s, cw, c: (['c1', 'c3', 'c6'] as const)[cw] })
  return (
    <Page title="Pasform · kanin" sub="Genstande på kaninen (upright) i 3 stadier · genstandens 3 farvesæt. Lints: øjne dækkes ikke, bbox inden for artens hull + 6, ≤ 25 elementer pr. genstand.">
      <Grid
        colW={118}
        cols={cols.map((x) => `st. ${x.s} · farve ${x.cw}`)}
        rows={outfits.map((o) => ({
          head: o.name,
          cells: cols.map((x, i) => (
            <Cell key={i} lint="safe fit" label={`fit ${o.name} ${x.s} ${x.cw}`}>
              <R breed="upright" stage={x.s} colorway={x.c} outfit={o.outfit(x.cw)} size={104} />
            </Cell>
          )),
        }))}
      />
      <Section title="lop og lionhead (skitser) med hatte">
        <div className="sh-row">
          {(['lop', 'lionhead'] as const).flatMap((b) =>
            [hverdagHead, festHead].map((it) => (
              <Cell key={`${b}${it.id}`} lint="safe fit" cap={`${b} · ${it.id}`} label={`fit ${b} ${it.id}`}>
                <R breed={b} stage={2} colorway="c3" outfit={{ head: { item: it } }} size={120} />
              </Cell>
            )),
          )}
        </div>
      </Section>
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// filmstrip: 8 frames pr. humør via negative animation-delay (frosset)

function FilmstripSheet() {
  const frames = Array.from({ length: 8 }, (_, i) => i)
  const rows: { head: string; mood: Mood; times: number[]; c: ColorwayId; s: Stage }[] = MOODS.map((m, i) => ({
    head: MOOD_DA[m],
    mood: m,
    times: frames.map((k) => (k * CYCLE[m]) / 8),
    c: (['c1', 'c3', 'c5', 'c2', 'c6', 'c4', 'c3'] as const)[i],
    s: 2 as Stage,
  }))
  // Blink (periode 4,3 s ved seed 0) og ørevip vises tæt samplet.
  rows.push({ head: 'blink + ørevip', mood: 'idle', times: [4.02, 4.08, 4.12, 4.14, 4.17, 6.37, 6.45, 6.55], c: 'c3', s: 2 })
  return (
    <Page title="Filmstrimmel" sub="8 frames pr. humør, samplet med animation-play-state: paused og negative animation-delay. Kun transform og opacity animeres.">
      <Grid
        colW={112}
        cols={frames.map((k) => `frame ${k + 1}`)}
        rows={rows.map((r) => ({
          head: r.head,
          cells: r.times.map((t, i) => (
            <Cell key={i} lint="" cap={`${t.toFixed(2)} s`} label={`film ${r.head} ${i}`}>
              <Rig species={rabbit} breed="upright" stage={r.s} colorway={r.c} mood={r.mood} mode="animated" seed={0} freezeAt={t} size={96} />
            </Cell>
          )),
        }))}
      />
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------
// lineup: proportioner og kropsskabeloner

function LineupSheet() {
  return (
    <Page title="Lineup" sub="Kaninens racer side om side i stadie 2 (reference for alle arter) og de tre kropsskabeloner som grå mannequiner.">
      <div className="sh-row">
        {rabbit.breeds.map((b) => (
          <Cell key={b.id} cap={`rabbit · ${b.id}`} label={`lineup ${b.id}`}>
            <R breed={b.id} stage={2} colorway="c3" size={170} />
          </Cell>
        ))}
        {mannequins.map((m) => (
          <Cell key={m.id + m.body} cap={`skabelon · ${m.body}`} label={`lineup ${m.body}`}>
            <Rig species={m} mode="static" colorway="c1" size={170} />
          </Cell>
        ))}
      </div>
    </Page>
  )
}

function Index() {
  return (
    <Page title="Talvennerne 2 · kontaktark" sub="Vælg et ark.">
      <ul>
        {ROUTES.map((r) => (
          <li key={r}>
            <a href={`?sheet=${r}`}>{r}</a>
          </li>
        ))}
      </ul>
    </Page>
  )
}

const SHEETS: Record<Route, () => ReactNode> = {
  species: SpeciesSheet,
  moods: MoodsSheet,
  closeup: CloseupSheet,
  sizes: SizesSheet,
  silhouettes: SilhouettesSheet,
  fit: FitSheet,
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
  const sheet = new URLSearchParams(location.search).get('sheet') as Route | null
  const Sheet = sheet && SHEETS[sheet] ? SHEETS[sheet] : Index
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
  return <Sheet />
}
