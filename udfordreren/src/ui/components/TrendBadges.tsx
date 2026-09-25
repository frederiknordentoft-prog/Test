// Aktive trends (game.trends) som badges: titel, berørte markeder, effekt-chips (betting +25 %, offshore +5 pp …)
// og uger tilbage. Kompakt variant (mobil): vandret rulleliste under kontoret, med sportskalenderens næste slutrunde.
// På mobil er kortene knapper: et tryk folder alle detaljer ud under listen (touch har ingen tooltips).
import { useState } from 'react';
import type { AktivTrend } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Ikon, type IkonNavn } from './kit';
import { EffektChips } from './TvaersDele';
import { naesteSport, trendChips, trendMarkederTekst, trendRammerJer, ugerKort } from '../lib/tvaersHjaelp';

const TREND_IKON: Record<string, IkonNavn> = {
  em: 'bold',
  vm: 'bold',
  covid: 'advarsel',
  covidEfter: 'bold',
  inflation: 'penge',
  kryptoBoom: 'diamant',
  kryptoKrak: 'diamant',
  streamere: 'hoejttaler',
  dokumentar: 'nyhed',
  predictionMarkets: 'hitliste',
  mobilBoelge: 'lyn',
};

function ikonFor(t: AktivTrend): IkonNavn {
  return TREND_IKON[t.id] ?? 'trend';
}

function farveFor(t: AktivTrend): string {
  const chips = trendChips(t.effekt);
  if (chips.some((c) => c.tone === 'god') && !chips.some((c) => c.tone === 'skidt')) return 'var(--color-good)';
  if (chips.some((c) => c.tone === 'skidt') && !chips.some((c) => c.tone === 'god')) return 'var(--color-bad)';
  return 'var(--color-violet)';
}

function TrendKort({
  t, uge, rammer, kompakt, aaben = false, onSkift,
}: { t: AktivTrend; uge: number; rammer: boolean; kompakt: boolean; aaben?: boolean; onSkift?: () => void }) {
  const tilbage = Math.max(0, t.slutUge - uge);
  const farve = farveFor(t);
  if (kompakt) {
    // Mobil: to linjer — titel og uger, derefter den vigtigste effekt og markederne. Tryk viser resten.
    const chips = trendChips(t.effekt);
    return (
      <li className="flex shrink-0" data-testid={`trend-${t.id}`}>
        <button
          type="button"
          onClick={onSkift}
          aria-expanded={aaben}
          aria-controls="trend-detaljer"
          className={`flex min-h-[44px] w-[212px] flex-col gap-1 rounded-md border-2 px-2 py-1 text-left ${
            aaben ? 'border-gold bg-panel2' : rammer ? 'border-line bg-bg2' : 'border-line bg-bg2 opacity-80'
          }`}
          data-testid={`trend-knap-${t.id}`}
        >
          <span className="flex w-full min-w-0 items-center gap-1.5">
            <Ikon navn={ikonFor(t)} farve={farve} indre="var(--color-line)" str={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate font-pixel text-[0.7rem] font-black text-ink">{t.titel}</span>
            {rammer && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-line bg-gold" title="Rammer markeder, hvor I har licens" data-testid={`trend-${t.id}-rammer`}>
                <span className="sr-only">Rammer jer</span>
              </span>
            )}
            <span className="tal shrink-0 font-pixel text-[0.62rem] font-bold text-muted" data-testid={`trend-${t.id}-uger`}>
              {tilbage}u
            </span>
          </span>
          <span className="flex w-full min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
            <EffektChips chips={chips.slice(0, 1)} nowrap />
            {chips.length > 1 && <span className="tal shrink-0 font-pixel text-[0.6rem] font-bold text-muted">+{chips.length - 1}</span>}
            <span className="min-w-0 truncate text-[0.62rem] text-dim">{trendMarkederTekst(t.markeder)}</span>
          </span>
        </button>
      </li>
    );
  }
  return (
    <li
      className={`flex min-w-0 flex-col gap-1 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 ${kompakt ? 'w-[228px] shrink-0' : ''}`}
      data-testid={`trend-${t.id}`}
      title={`${t.titel}: ${trendMarkederTekst(t.markeder)}, ${ugerKort(tilbage)} tilbage`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Ikon navn={ikonFor(t)} farve={farve} indre="var(--color-line)" str={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-pixel text-xs font-black text-ink">{t.titel}</span>
        <span className="tal flex shrink-0 items-center gap-0.5 font-pixel text-[0.65rem] font-bold text-muted" data-testid={`trend-${t.id}-uger`}>
          <Ikon navn="ur" farve="var(--color-muted)" indre="var(--color-line)" str={10} />
          {tilbage}u
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1 text-[0.68rem] text-muted">
        <Ikon navn="globus" farve="var(--color-sky)" indre="var(--color-line)" str={10} className="shrink-0" />
        <span className="truncate">{trendMarkederTekst(t.markeder)}</span>
        {rammer && (
          <span className="ml-auto shrink-0 rounded border border-line bg-gold px-1 font-pixel text-[0.58rem] font-black uppercase text-line" title="Rammer markeder, hvor I har licens">
            Rammer jer
          </span>
        )}
      </div>
      <EffektChips chips={trendChips(t.effekt)} />
    </li>
  );
}

/** Sportskalenderens næste slutrunde som en lille række (til "I sigte" og mobil-listen) */
export function NaesteSport({ uge, kort = false }: { uge: number; kort?: boolean }) {
  const s = naesteSport(uge);
  if (!s || s.igang) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" data-testid="naeste-sport">
      <Ikon navn="bold" farve="var(--color-good)" indre="var(--color-ink)" str={14} className="shrink-0" />
      <span className="min-w-0 truncate">
        {kort ? '' : 'Næste slutrunde: '}
        <b className="text-ink">{s.titel}</b>
      </span>
      <span className="tal shrink-0 text-muted">om {ugerKort(s.uger)}</span>
    </span>
  );
}

/** Mobil: alle detaljer for den trend, der er trykket på (effekter, markeder, uger og om den rammer jer) */
function TrendDetaljer({ t, uge, rammer, onLuk }: { t: AktivTrend; uge: number; rammer: boolean; onLuk: () => void }) {
  const tilbage = Math.max(0, t.slutUge - uge);
  return (
    <div id="trend-detaljer" className="anim-glid mt-1.5 flex flex-col gap-1.5 rounded-md border-2 border-gold bg-bg2 p-2" data-testid="trend-detaljer" role="region" aria-label={`${t.titel}: detaljer`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Ikon navn={ikonFor(t)} farve={farveFor(t)} indre="var(--color-line)" str={14} className="shrink-0" />
        <span className="min-w-0 flex-1 font-pixel text-xs font-black text-ink">{t.titel}</span>
        <button
          type="button"
          onClick={onLuk}
          className="-my-1 -mr-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded"
          aria-label="Luk detaljer"
          data-testid="trend-detaljer-luk"
        >
          <Ikon navn="kryds" farve="var(--color-muted)" str={12} />
        </button>
      </div>
      <EffektChips chips={trendChips(t.effekt)} />
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Ikon navn="globus" farve="var(--color-sky)" indre="var(--color-line)" str={11} /> {trendMarkederTekst(t.markeder)}
        </span>
        <span className="tal flex items-center gap-1">
          <Ikon navn="ur" farve="var(--color-muted)" indre="var(--color-line)" str={11} /> {ugerKort(tilbage)} tilbage
        </span>
        {rammer && (
          <span className="rounded border border-line bg-gold px-1 font-pixel text-[0.6rem] font-black uppercase text-line" title="Rammer markeder, hvor I har licens">
            Rammer jer
          </span>
        )}
      </p>
    </div>
  );
}

export default function TrendBadges({ kompakt = false }: { kompakt?: boolean }) {
  const g = useGame((s) => s.game);
  const [aaben, setAaben] = useState<string | null>(null);
  if (!g) return null;
  const trends = [...g.trends].sort((a, b) => a.slutUge - b.slutUge);
  const sport = naesteSport(g.uge);
  if (kompakt) {
    if (trends.length === 0 && !sport) return null;
    const noegle = (t: AktivTrend) => `${t.id}-${t.startUge}`;
    const valgt = trends.find((t) => noegle(t) === aaben);
    return (
      <section aria-label="Trends" data-testid="trends" className="min-w-0">
        <ul className="shell-uden-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {trends.map((t) => (
            <TrendKort
              key={noegle(t)}
              t={t}
              uge={g.uge}
              rammer={trendRammerJer(g, t)}
              kompakt
              aaben={noegle(t) === aaben}
              onSkift={() => setAaben(noegle(t) === aaben ? null : noegle(t))}
            />
          ))}
          {sport && !sport.igang && (
            <li className="flex w-[212px] shrink-0 flex-col justify-center gap-1 rounded-md border-2 border-dashed border-hi px-2 py-1 text-[0.7rem] text-muted">
              <span className="flex items-center gap-1.5 font-pixel text-[0.6rem] font-black uppercase tracking-wider text-dim">
                <Ikon navn="kalender" farve="var(--color-dim)" indre="var(--color-line)" str={10} /> Næste slutrunde
              </span>
              <NaesteSport uge={g.uge} kort />
            </li>
          )}
        </ul>
        {valgt && <TrendDetaljer t={valgt} uge={g.uge} rammer={trendRammerJer(g, valgt)} onLuk={() => setAaben(null)} />}
      </section>
    );
  }
  return (
    <section aria-label="Trends nu" data-testid="trends">
      {trends.length === 0 ? (
        <p className="text-xs text-dim">Ingen store trends lige nu. Markedet kører sin vante gang.</p>
      ) : (
        <ul className="grid gap-1.5">
          {trends.map((t) => (
            <TrendKort key={`${t.id}-${t.startUge}`} t={t} uge={g.uge} rammer={trendRammerJer(g, t)} kompakt={false} />
          ))}
        </ul>
      )}
    </section>
  );
}
