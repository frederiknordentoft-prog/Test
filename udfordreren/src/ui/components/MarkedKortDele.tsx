// Marked-sporet: små målere til konsolkortene — tillidsskala med sanktionstrappe, politisk pres og offshore-drivere.
// Alt er CSS/SVG (ingen eksterne assets). Markeringer bruger altid ikon + farve.
import type { ReactNode } from 'react';
import { Ikon } from './kit';
import { SANKTION_TRIN, PRES_TAERSKEL, presDeltaTekst, presOverskrift, type OffshorePost, type PresPost } from '../lib/markedHjaelp';
import { datoTekst } from '../../sim/time';
import { tillidFarve } from '../lib/firmaHjaelp';

const fmt = (v: number, dec = 1) => String(Math.round(v * 10 ** dec) / 10 ** dec).replace('.', ',').replace('-', '−');

/** Tilsynstillid 0-100 som vandret skala: zoner for sanktionstrappen (55/40/25/10) og en markør for den aktuelle værdi */
export function TillidsSkala({ vaerdi, testId }: { vaerdi: number; testId?: string }) {
  const p = Math.max(0, Math.min(100, vaerdi));
  const farve = tillidFarve(p);
  const zoner = [
    { fra: 0, til: 10, farve: '#6e2330' },
    { fra: 10, til: 25, farve: '#8a3336' },
    { fra: 25, til: 40, farve: '#94503a' },
    { fra: 40, til: 55, farve: '#8a6a2e' },
    { fra: 55, til: 60, farve: '#4e5a3a' },
    { fra: 60, til: 100, farve: '#2f5a3e' },
  ];
  return (
    <div className="w-full" data-testid={testId}>
      <div className="relative h-3" aria-hidden>
        <svg viewBox="0 0 8 5" width={12} height={8} className="absolute top-0 -translate-x-1/2" style={{ left: `${p}%` }} shapeRendering="crispEdges">
          <path d="M0 0h8v1H7v1H6v1H5v1H3V3H2V2H1V1H0z" fill={farve} stroke="var(--color-line)" strokeWidth={0.6} />
        </svg>
      </div>
      <div className="relative h-5 w-full rounded-sm border-2 border-line bg-bg" role="img" aria-label={`Tilsynstillid ${Math.round(p)} af 100`}>
        <div className="absolute inset-0 overflow-hidden rounded-[1px]">
          {zoner.map((z) => (
            <span key={z.fra} className="absolute inset-y-0" style={{ left: `${z.fra}%`, width: `${z.til - z.fra}%`, background: z.farve }} />
          ))}
          <span className="absolute inset-y-0 left-0 bg-ink/15" style={{ width: `${p}%` }} />
          {SANKTION_TRIN.map((t) => (
            <span key={t.trin} className="absolute inset-y-0 w-0.5 bg-line" style={{ left: `calc(${t.graense}% - 1px)` }} />
          ))}
        </div>
        <span className="absolute -inset-y-1 w-1.5 rounded-[1px] border border-line" style={{ left: `calc(${p}% - 3px)`, background: farve }} />
      </div>
      <div className="relative mt-0.5 h-4 text-[0.62rem] font-bold text-dim" aria-hidden>
        {SANKTION_TRIN.map((t) => (
          <span key={t.trin} className="tal absolute -translate-x-1/2 font-pixel" style={{ left: `${t.graense}%` }}>
            {t.graense}
          </span>
        ))}
        <span className="tal absolute -translate-x-1/2 font-pixel text-good/70" style={{ left: '60%' }}>
          60
        </span>
        <span className="tal absolute right-0 font-pixel">100</span>
      </div>
    </div>
  );
}

/** Sanktionstrappen med det aktuelle trin fremhævet */
export function SanktionsTrappe({ trin, tillid }: { trin: 0 | 1 | 2 | 3 | 4; tillid: number }) {
  return (
    <ol className="grid grid-cols-2 gap-1 @xl:grid-cols-4" aria-label="Sanktionstrappen" data-testid="sanktionstrappe">
      {SANKTION_TRIN.map((t) => {
        const nu = t.trin === trin;
        const passeret = t.trin < trin;
        const truet = !nu && !passeret && tillid < t.graense;
        return (
          <li
            key={t.trin}
            aria-current={nu ? 'step' : undefined}
            data-testid={`sanktion-trin-${t.trin}`}
            className={`flex min-w-0 flex-col gap-0.5 rounded border-2 px-1.5 py-1 ${nu ? 'border-line pixel-skygge' : 'border-line bg-panel'}`}
            style={nu ? { background: t.farve, color: 'var(--color-line)' } : undefined}
          >
            <span className="flex items-center gap-1 font-pixel text-[0.7rem] font-black uppercase">
              <Ikon
                navn={nu ? 'advarsel' : passeret ? 'flueben' : truet ? 'advarsel' : 'skjold'}
                farve={nu ? 'var(--color-line)' : passeret ? 'var(--color-dim)' : truet ? t.farve : 'var(--color-dim)'}
                indre={nu ? t.farve : 'var(--color-line)'}
                str={12}
                className="shrink-0"
              />
              <span className="min-w-0 truncate" style={!nu ? { color: truet ? t.farve : 'var(--color-ink)' } : undefined}>
                {t.trin}. {t.navn}
              </span>
            </span>
            <span className={`text-[0.66rem] leading-snug ${nu ? 'font-bold' : 'text-muted'}`}>
              Under {t.graense}: {t.konsekvens.charAt(0).toLowerCase() + t.konsekvens.slice(1)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Politisk pres 0-5 som fem segmenter med tærsklen (3) markeret */
export function PresMaaler({ pres }: { pres: number }) {
  const over = pres >= PRES_TAERSKEL;
  return (
    <div className="flex items-center gap-2" data-testid="politisk-pres">
      <span className="relative inline-flex gap-0.5" role="img" aria-label={`Politisk pres ${fmt(pres)} af 5. Ved ${PRES_TAERSKEL} vedtages en ny regel.`}>
        {Array.from({ length: 5 }, (_, i) => {
          const fyld = Math.max(0, Math.min(1, pres - i));
          const farve = i + 1 > PRES_TAERSKEL - 1 ? 'var(--color-bad)' : i + 1 > 1 ? 'var(--color-warn)' : 'var(--color-sky)';
          return (
            <span key={i} className="relative h-5 w-6 overflow-hidden rounded-[3px] border-2 border-line bg-bg">
              <span className="absolute inset-y-0 left-0" style={{ width: `${fyld * 100}%`, background: farve }} />
            </span>
          );
        })}
        <span className="absolute -top-1 bottom-[-4px] w-0.5 bg-ink" style={{ left: `calc(${(PRES_TAERSKEL / 5) * 100}% - 2px)` }} aria-hidden />
      </span>
      <span className="tal font-pixel text-sm font-black" style={{ color: over ? 'var(--color-bad)' : 'var(--color-ink)' }}>
        {fmt(pres)}
        <span className="text-xs text-dim">/5</span>
      </span>
    </div>
  );
}

/** De seneste ændringer i det politiske pres (ms.presLog): dato, kilde og fortegn. Op = gul pil, ned = grøn pil. */
export function PresLog({ poster, overskrift, testId = 'pres-log' }: { poster: PresPost[]; overskrift?: string; testId?: string }) {
  if (poster.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <span className="flex items-center gap-1.5 font-pixel text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        <Ikon navn="spoergsmaal" farve="var(--color-muted)" str={11} /> {overskrift ?? presOverskrift(poster)}
      </span>
      <ul className="flex flex-col gap-0.5">
        {poster.map((p, i) => {
          const op = p.delta > 0;
          const farve = op ? 'var(--color-warn)' : 'var(--color-good)';
          return (
            <li key={`${p.uge}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-1.5 text-xs" data-testid={`${testId}-${i}`}>
              <span className="tal pt-px font-pixel text-[0.66rem] font-bold whitespace-nowrap text-dim">{datoTekst(p.uge)}</span>
              <span className="min-w-0 break-words text-ink">{p.kilde}</span>
              <span className="tal flex items-center gap-0.5 font-pixel text-[0.7rem] font-black whitespace-nowrap" style={{ color: farve }}>
                <Ikon navn={op ? 'op' : 'ned'} farve={farve} str={10} titel={op ? 'Presset steg' : 'Presset faldt'} />
                {presDeltaTekst(p.delta)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Offshore-drivere som en lodret liste med midterstillede bjælker: op = flere spiller offshore */
export function DriverListe({ poster, fod }: { poster: OffshorePost[]; fod?: ReactNode }) {
  const max = Math.max(4, ...poster.map((p) => Math.abs(p.pp)));
  return (
    <ul className="flex flex-col gap-1" data-testid="offshore-drivere">
      {poster.map((p) => {
        const op = p.pp > 0.05;
        const ned = p.pp < -0.05;
        const farve = op ? 'var(--color-warn)' : ned ? 'var(--color-good)' : 'var(--color-dim)';
        const w = (Math.min(max, Math.abs(p.pp)) / max) * 50;
        return (
          <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_4rem_3.9rem] @md:grid-cols-[minmax(0,1fr)_5rem_3.9rem] items-center gap-2 rounded border-2 border-line bg-panel px-1.5 py-1" title={p.forklaring}>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-bold">
                <Ikon navn={op ? 'op' : ned ? 'ned' : 'streg'} farve={farve} str={11} className="shrink-0" />
                <span className="truncate">{p.navn}</span>
              </span>
              <span className="block truncate text-[0.68rem] text-dim">{p.forklaring}</span>
            </span>
            <span className="relative h-2.5 rounded-sm border border-line bg-bg" aria-hidden>
              <span className="absolute inset-y-0 left-1/2 w-px bg-hi" />
              <span className="absolute inset-y-0" style={{ background: farve, width: `${w}%`, left: p.pp >= 0 ? '50%' : `${50 - w}%` }} />
            </span>
            <span className="tal text-right font-pixel text-xs font-bold" style={{ color: farve }}>
              {p.pp > 0 ? '+' : ''}
              {fmt(p.pp)} pp
            </span>
          </li>
        );
      })}
      {fod}
    </ul>
  );
}
