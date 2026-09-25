// Byen (spec 6.14, fase 5): spillerbyen som pixelby med 200 personer, filtreret pr. marked. Ved siden af: hvem der bor i byen,
// hvor mange der er i gul og rød (med kalibreringen), hvad der trækker og hjælper, hvad det koster i tilsynstillid,
// hvad byen betyder for pengene, og byens korte historier.
import { useState, type ReactNode } from 'react';
import type { GameState, MarketId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi, type PanelId } from '../../store/uiStore';
import { Btn, Ikon, Panel, Tom, type IkonNavn } from '../components/kit';
import { Afsnit, FlagStribe } from '../components/FirmaDele';
import TownCanvas, { PersonIkon } from '../components/TownCanvas';
import { MARKETS } from '../../data/markets';
import { BY } from '../../data/town';
import { aiLabAaben, datoTekst } from '../../sim/selectors';
import { T } from '../../render/palette';
import { fortegn, heltal, pct } from '../format';
import {
  BY_PROFILER,
  NORMAL_FRA,
  NORMAL_TIL,
  PRES_FRA,
  PROFIL_STIL,
  TILSYN_FRA,
  arpuInfo,
  byDriverForklaring,
  byHistorier,
  byMarkeder,
  byOversigt,
  driverMarked,
  risikoInfo,
  tillidLinjer,
  trykTekst,
  type ByOversigt,
  type DriverLinje,
} from '../lib/byHjaelp';

const send = (a: Parameters<ReturnType<typeof useGame.getState>['dispatch']>[0]) => useGame.getState().dispatch(a);
const gaaTil = (p: PanelId) => useUi.getState().setPanel(p);
const gange = (f: number) => `×${f.toFixed(2).replace('.', ',')}`;

/** Husk markedsfilteret, mens man skifter fane */
let husketFilter: MarketId | null = null;

// ---------- Små dele ----------

function Maerke({ m, navn }: { m: MarketId; navn?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <FlagStribe farver={MARKETS[m].farver} className="h-3 w-5 shrink-0" />
      <span className="truncate font-pixel text-xs font-black">{navn ? MARKETS[m].navn : MARKETS[m].kort}</span>
    </span>
  );
}

function Note({ ikon, farve, children, testId }: { ikon: IkonNavn; farve: string; children: ReactNode; testId?: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs" data-testid={testId}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
      <span className="min-w-0 text-muted">{children}</span>
    </p>
  );
}

function MarkedsFilter({ g, filter, onSkift }: { g: GameState; filter: MarketId | null; onSkift: (m: MarketId | null) => void }) {
  const markeder = byMarkeder(g);
  const knap = (id: string, valgt: boolean, onClick: () => void, children: ReactNode, titel: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={valgt}
      title={titel}
      data-testid={`by-filter-${id}`}
      onClick={onClick}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border-2 border-line px-2.5 text-xs font-bold ${
        valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:bg-hi hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
  const alle = byOversigt(g).aktive;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrér byen pr. marked" data-testid="by-filter">
      {knap(
        'alle',
        filter === null,
        () => onSkift(null),
        <>
          <Ikon navn="hus" farve="currentColor" indre={filter === null ? 'var(--color-gold)' : 'var(--color-panel2)'} str={14} />
          <span className="font-pixel uppercase">Hele byen</span>
          <span className="tal font-pixel">{alle}</span>
        </>,
        'Vis hele byen',
      )}
      {markeder.map(({ m, aktive }) =>
        knap(
          m,
          filter === m,
          () => onSkift(m),
          <>
            <Maerke m={m} />
            <span className="tal font-pixel">{aktive}</span>
          </>,
          `Vis kunderne i ${MARKETS[m].navn}`,
        ),
      )}
    </div>
  );
}

function Forklaring() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Forklaring" data-testid="by-forklaring">
      {BY_PROFILER.map((p) => (
        <li key={p} className="flex items-center gap-1 text-xs" title={`${PROFIL_STIL[p].navn}: ${PROFIL_STIL[p].markoer.toLowerCase()}`}>
          <PersonIkon profil={p} px={2} />
          <span className="font-bold" style={{ color: PROFIL_STIL[p].farve }}>
            {PROFIL_STIL[p].navn}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Befolkningen ----------

function Befolkning({ o, filter }: { o: ByOversigt; filter: MarketId | null }) {
  return (
    <Afsnit
      titel="Hvem bor i byen"
      ikon="folk"
      farve="var(--color-sky)"
      testId="by-befolkning"
      hoejre={
        <span className="tal font-pixel text-xs font-bold text-sky">
          {o.aktive} {o.aktive === 1 ? 'person' : 'personer'}
        </span>
      }
    >
      <p className="mb-2 text-xs text-muted">
        {filter ? `${o.aktive} af byens 200 pixelfolk er kunder i ${MARKETS[filter].navn}.` : `${o.aktive} af byens 200 pixelfolk er kunder.`}{' '}
        {o.kunderPrPerson >= 1 && (
          <>
            Hver står for ca. <span className="tal font-bold text-ink">{heltal(o.kunderPrPerson)}</span> rigtige kunder.
          </>
        )}
      </p>
      {/* Hele fordelingen i én stribe */}
      <div className="mb-2 flex h-3.5 overflow-hidden rounded-sm border-2 border-line bg-bg" aria-hidden>
        {BY_PROFILER.map((p) => (
          <span key={p} className="h-full" style={{ width: `${o.andel[p] * 100}%`, background: PROFIL_STIL[p].farve }} />
        ))}
      </div>
      <ul className="grid gap-1">
        {BY_PROFILER.map((p) => (
          <li key={p} className="flex min-w-0 items-center gap-2 rounded border-2 border-line bg-panel px-1.5 py-1" data-testid={`by-tal-${p}`}>
            <span className="flex w-[21px] shrink-0 justify-center">
              <PersonIkon profil={p} px={3} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold" style={{ color: PROFIL_STIL[p].farve }}>
                  {PROFIL_STIL[p].navn}
                </span>
                <span className="tal shrink-0 font-pixel text-xs font-bold text-ink">
                  {o.antal[p]} <span className="text-muted">· {pct(o.andel[p])}</span>
                </span>
              </div>
              <div className="text-[0.7rem] leading-snug text-muted">{PROFIL_STIL[p].beskrivelse}</div>
            </div>
          </li>
        ))}
      </ul>
    </Afsnit>
  );
}

// ---------- Risikoandel og kalibrering ----------

const SKALA_MAX = 0.3;

function RisikoMaaler({ g, filter }: { g: GameState; filter: MarketId | null }) {
  const info = risikoInfo(g, filter ?? undefined);
  const a = info.andel ?? 0;
  const pos = (v: number) => `${(Math.min(v, SKALA_MAX) / SKALA_MAX) * 100}%`;
  return (
    <Afsnit
      titel="Gul og rød"
      ikon="oeje"
      farve="var(--color-warn)"
      testId="by-risiko"
      hoejre={
        <span className="inline-flex items-center gap-1 rounded border-2 border-line bg-panel2 px-1.5 py-0.5 text-[0.72rem] font-bold" style={{ color: info.farve }} data-testid="by-risiko-status">
          <Ikon navn={info.ikon} farve={info.farve} indre="var(--color-line)" str={12} />
          {info.titel}
        </span>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="tal font-pixel text-2xl font-black" style={{ color: info.farve }} data-testid="by-risikoandel">
          {info.andel === null ? '–' : pct(a, 1)}
        </span>
        <span className="text-xs text-muted">af kunderne er i gul eller rød</span>
      </div>
      {/* Skala 0-30 % med det normale bånd (5-15 %) og tilsynets grænse (8 %) */}
      <div className="relative mt-2 mb-5 h-5 rounded-sm border-2 border-line bg-bg" aria-hidden>
        <span className="absolute inset-y-0" style={{ left: pos(NORMAL_FRA), width: `calc(${pos(NORMAL_TIL)} - ${pos(NORMAL_FRA)})`, background: 'color-mix(in srgb, var(--color-good) 28%, transparent)' }} />
        <span className="absolute inset-y-0 right-0" style={{ left: pos(PRES_FRA), background: 'color-mix(in srgb, var(--color-bad) 22%, transparent)' }} />
        <span className="absolute inset-y-0 w-[2px] bg-warn" style={{ left: pos(TILSYN_FRA) }} />
        {info.andel !== null && (
          <span className="absolute -top-[3px] h-[calc(100%+6px)] w-[6px] -translate-x-1/2 rounded-sm border-2 border-line" style={{ left: pos(a), background: info.farve }} data-testid="by-risiko-markoer" />
        )}
        <span className="tal absolute top-full mt-0.5 -translate-x-1/2 font-pixel text-[0.6rem] text-good" style={{ left: pos(0.1) }}>
          normalt
        </span>
        <span className="tal absolute top-full left-0 mt-0.5 font-pixel text-[0.6rem] text-dim">0</span>
        <span className="tal absolute top-full right-0 mt-0.5 font-pixel text-[0.6rem] text-dim">30 %</span>
      </div>
      <p className="text-sm text-ink">{info.tekst}</p>
      {info.heleByen && filter && (
        <Note ikon="folk" farve={T.muted} testId="by-risiko-hele">
          For få pixelfolk i {MARKETS[filter].navn} til et eget tal. Viser hele byen.
        </Note>
      )}
      <div className="mt-2 rounded border-2 border-line bg-panel px-2 py-1.5 text-xs text-muted" data-testid="by-kalibrering">
        <span className="font-bold text-ink">Kalibreret efter virkeligheden:</span> 5-15 % af spillerne har mindst et lavt problemniveau (5,2 % i 2016 og 10,9 % i 2021
        blandt danske voksne). En by helt uden gul og rød findes ikke. Over {Math.round(TILSYN_FRA * 100)} % koster det tilsynstillid, og over {Math.round(PRES_FRA * 100)} % hos
        en stor udbyder begynder politikerne at røre på sig.
      </div>
    </Afsnit>
  );
}

// ---------- Drivere ----------

function DriverListe({ linjer, testId }: { linjer: DriverLinje[]; testId: string }) {
  return (
    <ul className="grid gap-1" data-testid={testId}>
      {linjer.map((l) => (
        <li key={l.id} className={`min-w-0 rounded border-2 border-line px-2 py-1 ${l.aktiv ? 'bg-panel' : 'bg-bg2'}`} data-testid={`${testId}-${l.id}`}>
          <div className="flex items-center gap-1.5">
            <Ikon navn={l.ikon} farve={l.farve} indre="var(--color-line)" str={14} className="shrink-0" />
            <span className={`min-w-0 flex-1 truncate text-sm font-bold ${l.aktiv ? 'text-ink' : 'text-muted'}`}>{l.label}</span>
            <span className="tal shrink-0 font-pixel text-xs font-bold" style={{ color: l.aktiv ? l.farve : 'var(--color-dim)' }}>
              {l.vaerdi}
            </span>
          </div>
          <p className="mt-0.5 text-[0.72rem] leading-snug text-muted">{l.forklaring}</p>
        </li>
      ))}
    </ul>
  );
}

function Drivere({ g, m, valgt }: { g: GameState; m: MarketId; valgt: boolean }) {
  const d = byDriverForklaring(g, m);
  const tt = trykTekst(d.tryk);
  const ai = aiLabAaben(g);
  return (
    <Afsnit
      titel="Hvad flytter folk"
      ikon="trend"
      farve="var(--color-warn)"
      testId="by-drivere"
      hoejre={
        <span className="inline-flex items-center gap-1.5">
          <Maerke m={m} navn />
          {!valgt && <span className="text-[0.66rem] text-dim">(største marked)</span>}
        </span>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border-2 border-line bg-panel px-2 py-1.5" data-testid="by-tryk">
        <span className="text-xs text-muted">Samlet tryk mod gul og rød</span>
        <span className="tal font-pixel text-lg font-black" style={{ color: tt.farve }}>
          {gange(d.tryk)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: tt.farve }}>
          <Ikon navn={tt.ikon} farve={tt.farve} indre="var(--color-line)" str={12} />
          {tt.tekst}
        </span>
        <span className="tal w-full text-[0.7rem] text-dim">
          Trækker {gange(d.skade)} ÷ hjælper {gange(d.beskyttelse)}. Normalt er ×1,00.
        </span>
      </div>
      <div className="grid gap-2 @xl:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-1 flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-bad">
            <Ikon navn="ned" farve={T.bad} indre="var(--color-line)" str={12} />
            Trækker mod gul og rød
          </h4>
          <DriverListe linjer={d.traekker} testId="by-traekker" />
        </div>
        <div className="min-w-0">
          <h4 className="mb-1 flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-good">
            <Ikon navn="op" farve={T.good} indre="var(--color-line)" str={12} />
            Hjælper folk tilbage
          </h4>
          <DriverListe linjer={d.hjaelper} testId="by-hjaelper" />
        </div>
      </div>
      {/* Beskyttende forskning kan startes herfra */}
      <h4 className="mt-3 mb-1 flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-cyan">
        <Ikon navn="kolbe" farve={T.cyan} indre="var(--color-line)" str={12} />
        Ansvarsforskning
      </h4>
      <ul className="grid gap-1 @2xl:grid-cols-2" data-testid="by-forskning">
        {d.forskning.map((f) => (
          <li key={f.node.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded border-2 border-line bg-panel px-2 py-1" data-testid={`by-forskning-${f.node.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <span className="min-w-0">{f.node.navn}</span>
                <span className="tal shrink-0 font-pixel text-[0.68rem] text-good">+{Math.round((f.node.effekt.by ?? 0) * 100)} %</span>
              </div>
              {!f.ulaast && !f.igang && !f.ok && f.grund && <div className="text-[0.7rem] text-muted">{f.grund}</div>}
            </div>
            {f.ulaast ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-good">
                <Ikon navn="flueben" farve={T.good} str={12} />
                Færdig
              </span>
            ) : f.igang ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan">
                <Ikon navn="ur" farve={T.cyan} indre="var(--color-line)" str={12} />
                I gang ({g.forskning.igang?.resterendeUger} uger)
              </span>
            ) : (
              <Btn
                lille
                variant={f.ok ? 'god' : 'sekundaer'}
                disabled={!f.ok}
                title={f.ok ? `Start forskningen (${f.node.indsigt} indsigt, ${f.node.uger} uger)` : f.grund}
                onClick={() => send({ t: 'startResearch', nodeId: f.node.id })}
                testId={`by-forsk-${f.node.id}`}
                className="min-h-[44px] @xl:min-h-9"
              >
                <Ikon navn="indsigt" farve="currentColor" indre="var(--color-cyan)" str={12} />
                <span className="tal">{f.node.indsigt}</span>
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Btn onClick={() => gaaTil('marked')} testId="by-gaa-marked" title="Bonus, VIP og kanaler styres i Marked-panelet">
          <Ikon navn="kort" farve="currentColor" indre="var(--color-panel2)" str={14} />
          Bonus og VIP
        </Btn>
        <Btn onClick={() => gaaTil('personale')} testId="by-gaa-personale" title="Ansæt eller omskol til compliance">
          <Ikon navn="folk" farve="currentColor" indre="var(--color-panel2)" str={14} />
          Compliance-folk
        </Btn>
        <Btn onClick={() => gaaTil('firma')} testId="by-gaa-firma" title="Al forskning findes i Firma-panelet">
          <Ikon navn="kolbe" farve="currentColor" indre="var(--color-panel2)" str={14} />
          Forskning
        </Btn>
        {ai && (
          <Btn onClick={() => gaaTil('ailab')} testId="by-gaa-ailab" title="Risikoagenter og hyperpersonalisering">
            <Ikon navn="chip" farve="currentColor" indre="var(--color-panel2)" str={14} />
            AI-lab
          </Btn>
        )}
      </div>
    </Afsnit>
  );
}

// ---------- Tillid og penge ----------

function Tillid({ g, filter }: { g: GameState; filter: MarketId | null }) {
  const linjer = tillidLinjer(g);
  return (
    <Afsnit titel="Tilsynstillid pr. kvartal" ikon="skjold" farve="var(--color-good)" testId="by-tillid">
      <ul className="grid gap-1">
        {linjer.map((l) => {
          const minus = l.tillid < -0.005;
          const farve = minus ? T.bad : T.good;
          return (
            <li
              key={l.m}
              className={`flex min-w-0 items-center gap-2 rounded border-2 px-2 py-1 ${filter === l.m ? 'border-gold bg-panel' : 'border-line bg-panel'}`}
              data-testid={`by-tillid-${l.m}`}
            >
              <Maerke m={l.m} navn />
              <span className="tal ml-auto shrink-0 text-xs text-muted">{l.andel === null ? '–' : pct(l.andel, 1)} i gul/rød</span>
              <span className="tal inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 font-pixel text-xs font-bold" style={{ color: farve }}>
                <Ikon navn={minus ? 'ned' : 'flueben'} farve={farve} indre="var(--color-line)" str={11} />
                {minus ? fortegn(l.tillid, 1) : '0'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Under {Math.round(TILSYN_FRA * 100)} % i gul og rød koster byen intet. Over det trækker hvert procentpoint {Math.abs(BY.tillidPrPp).toFixed(2).replace('.', ',')} i tilsynstillid hvert
        kvartal, højst {fortegn(BY.tillidMaks)}.
      </p>
    </Afsnit>
  );
}

function Penge({ g, m, filter }: { g: GameState; m: MarketId; filter: MarketId | null }) {
  const a = arpuInfo(g, m, filter ?? undefined);
  const op = a.faktor >= 1;
  const raekke = (label: string, farve: string, folk: number, penge: number, testId: string) => (
    <div className="grid gap-0.5" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-bold" style={{ color: farve }}>
          {label}
        </span>
        <span className="tal text-muted">
          <span className="font-bold text-ink">{pct(folk)}</span> af folkene · <span className="font-bold text-gold">{pct(penge)}</span> af pengene
        </span>
      </div>
      <div className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-1.5 text-[0.62rem] text-dim">
        <span>folk</span>
        <span className="h-2 overflow-hidden rounded-sm border border-line bg-bg">
          <span className="block h-full" style={{ width: `${folk * 100}%`, background: farve }} />
        </span>
        <span>penge</span>
        <span className="h-2 overflow-hidden rounded-sm border border-line bg-bg">
          <span className="block h-full" style={{ width: `${penge * 100}%`, background: T.gold }} />
        </span>
      </div>
    </div>
  );
  return (
    <Afsnit titel="Pengene i byen" ikon="penge" farve="var(--color-gold)" testId="by-penge">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="tal font-pixel text-lg font-black" style={{ color: op ? T.gold : T.muted }} data-testid="by-arpu">
          {gange(a.faktor)}
        </span>
        <span className="text-xs text-muted">på BSI pr. kunde i {MARKETS[m].navn} fra byens sammensætning</span>
      </div>
      <div className="grid gap-2">
        {raekke('Guld', T.gold, a.guld.folk, a.guld.penge, 'by-penge-guld')}
        {raekke('Gul og rød', T.bad, a.gulRoed.folk, a.gulRoed.penge, 'by-penge-gulroed')}
      </div>
      <p className="mt-2 text-xs text-muted">
        Ærligt talt: guld og rød er også de dyreste kunder, altså dem, der lægger flest penge. En VIP er {String(BY.vaerdi.vip).replace('.', ',')} gange så meget værd som en rekreativ
        kunde, en i rød {String(BY.vaerdi.problem).replace('.', ',')} gange. Bliver byen grønnere, falder omsætningen pr. kunde en smule. Sådan er regnestykket.
      </p>
    </Afsnit>
  );
}

// ---------- Byhistorier ----------

function Historier({ g, filter }: { g: GameState; filter: MarketId | null }) {
  const liste = byHistorier(g, filter ?? undefined);
  return (
    <Afsnit titel="Byhistorier" ikon="nyhed" farve="var(--color-muted)" testId="by-historier">
      {liste.length === 0 ? (
        <p className="text-sm text-muted">Ingen historier endnu. Byen passer sig selv.</p>
      ) : (
        <ul className="grid gap-1.5">
          {liste.map((h, i) => (
            <li key={`${h.uge}-${i}`} className="flex min-w-0 items-start gap-2 border-b border-line/60 pb-1.5 last:border-b-0 last:pb-0" data-testid="by-historie">
              {h.profil === 'churnet' ? (
                <span className="flex w-[16px] shrink-0 justify-center pt-1">
                  <Ikon navn="doer" farve={T.dim} indre="var(--color-line)" str={14} titel="Stoppede stille" />
                </span>
              ) : (
                <span className="flex w-[16px] shrink-0 justify-center">
                  <PersonIkon profil={h.profil} px={2} titel={PROFIL_STIL[h.profil].navn} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="tal font-pixel text-[0.62rem] uppercase text-dim">{datoTekst(h.uge)}</div>
                <p className="text-sm text-ink">{h.tekst}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Afsnit>
  );
}

// ---------- Panelet ----------

export default function TownPanel() {
  const g = useGame((s) => s.game)!;
  const [valgtFilter, setValgtFilter] = useState<MarketId | null>(husketFilter);
  const markeder = byMarkeder(g);
  // Filteret gælder kun markeder, der stadig har kunder i byen
  const filter = valgtFilter && markeder.some((x) => x.m === valgtFilter) ? valgtFilter : null;
  const skift = (m: MarketId | null) => {
    husketFilter = m;
    setValgtFilter(m);
  };
  const o = byOversigt(g, filter ?? undefined);
  const hele = byOversigt(g);
  const tom = hele.aktive === 0;
  const dm = driverMarked(g, filter ?? undefined);
  const label = tom
    ? 'Byen er tom. Ingen kunder endnu.'
    : `Byen${filter ? ` i ${MARKETS[filter].navn}` : ''}: ${o.aktive} kunder, heraf ${o.antal.vip} VIP, ${o.antal.risiko} i risiko og ${o.antal.problem} med problemer.`;

  return (
    <Panel titel="Byen" ikon="hus" testId="panel-by" hoejre={!tom ? <span className="tal font-pixel text-xs font-bold text-sky">{hele.aktive}/200</span> : undefined}>
      <div className="@container flex flex-col gap-3">
        {tom ? (
          <>
            <TownCanvas filter={null} ariaLabel={label} className="aspect-[4/3] w-full @2xl:aspect-[16/7]" />
            <Tom>
              <span className="flex flex-col items-center gap-2" data-testid="by-tom">
                <Ikon navn="hus" farve="var(--color-sky)" indre="var(--color-line)" str={28} />
                <span className="font-bold text-ink">Byen venter på sine første kunder.</span>
                <span>Lancér et produkt, så flytter de første pixelfolk ind på gågaden. Hver person står for en bid af jeres kunder.</span>
              </span>
            </Tom>
            <Forklaring />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Hver pixelperson er en bid af jeres kunder. Guld er de mest værdifulde, og det er også dem, der oftest glider mod gul og rød, når intensitet, bonus og VIP skrues op.
            </p>
            <MarkedsFilter g={g} filter={filter} onSkift={skift} />
            <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-2">
                <TownCanvas filter={filter} ariaLabel={label} className="aspect-[4/5] w-full @md:aspect-[4/3] @2xl:aspect-square" />
                <Forklaring />
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <RisikoMaaler g={g} filter={filter} />
                <Befolkning o={o} filter={filter} />
              </div>
            </div>
            {dm && <Drivere g={g} m={dm} valgt={filter !== null} />}
            <div className="grid gap-3 @2xl:grid-cols-2">
              <Tillid g={g} filter={filter} />
              {dm && <Penge g={g} m={dm} filter={filter} />}
            </div>
            <Historier g={g} filter={filter} />
          </>
        )}
      </div>
    </Panel>
  );
}
