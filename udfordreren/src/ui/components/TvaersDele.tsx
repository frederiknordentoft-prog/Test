// Tværs-sporet: små delte byggeklodser til markeder, licenser, regler, trends og sanktionstrappen.
import type { ReactNode } from 'react';
import type { MarketId } from '../../sim/types';
import { MARKETS } from '../../data/markets';
import { Ikon } from './kit';
import { Chip, FlagStribe } from './FirmaDele';
import { LICENS_STIL, TONE_FARVE, TRAPPE, licensTekst, type EffektChip, type MarkedLicens } from '../lib/tvaersHjaelp';

/** Flagstribe + landekode, fx [rød/hvid] DK */
export function MarkedMaerke({ m, navn, className = '' }: { m: MarketId; navn?: boolean; className?: string }) {
  const def = MARKETS[m];
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <FlagStribe farver={def.farver} className="h-3 w-5 shrink-0" />
      <span className="truncate font-pixel text-xs font-black">{navn ? def.navn : def.kort}</span>
    </span>
  );
}

/** Licensstatus som chip (ikon + farve + tekst) */
export function LicensChip({ lic, praefiks, titel }: { lic: MarkedLicens; praefiks?: string; titel?: string }) {
  const st = LICENS_STIL[lic.tilstand];
  return (
    <Chip ikon={st.ikon} farve={st.farve} titel={titel}>
      {praefiks ? `${praefiks} · ` : ''}
      {licensTekst(lic)}
    </Chip>
  );
}

/** Nøgletal-celle i et markedskort */
export function Noegle({ label, children, titel, testId }: { label: string; children: ReactNode; titel?: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded border-2 border-line bg-panel px-2 py-1.5" title={titel} data-testid={testId}>
      <div className="truncate text-[0.66rem] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

/** Effekt-chips (trends og regler): ikon + farve efter tone */
export function EffektChips({ chips, className = '', nowrap }: { chips: EffektChip[]; className?: string; nowrap?: boolean }) {
  return (
    <span className={`flex gap-1 ${nowrap ? 'shrink-0 flex-nowrap' : 'flex-wrap'} ${className}`}>
      {chips.map((c) => (
        <span
          key={c.tekst}
          className="inline-flex items-center gap-1 rounded border-2 border-line bg-bg2 px-1.5 py-0.5 text-[0.7rem] font-bold leading-tight"
          style={{ color: TONE_FARVE[c.tone] }}
        >
          <Ikon navn={c.ikon} farve={TONE_FARVE[c.tone]} indre="var(--color-line)" str={10} className="shrink-0" />
          <span className="tal">{c.tekst}</span>
        </span>
      ))}
    </span>
  );
}

/** Sanktionstrappen: tillidsbar med grænserne og de fire trin, det nuværende fremhævet */
export function TillidsTrappe({ tillid, trin, testId }: { tillid: number; trin: 0 | 1 | 2 | 3 | 4; testId?: string }) {
  const t = Math.max(0, Math.min(100, tillid));
  const farve = t >= 60 ? 'var(--color-good)' : t >= 40 ? 'var(--color-warn)' : 'var(--color-bad)';
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted">
            <Ikon navn="skjold" farve={farve} indre="var(--color-line)" str={12} /> Tilsynstillid
          </span>
          <b className="tal font-pixel text-sm" style={{ color: farve }} data-testid={testId ? `${testId}-tillid` : undefined}>
            {Math.round(t)}
            <span className="text-[0.66rem] text-dim">/100</span>
          </b>
        </div>
        <div className="relative h-4 rounded-sm border-2 border-line bg-bg">
          <div className="absolute inset-y-0 left-0" style={{ width: `${t}%`, background: farve }} />
          {TRAPPE.map((x) => (
            <span key={x.trin} className="absolute inset-y-0 w-[2px] bg-line" style={{ left: `${x.graense}%` }} aria-hidden />
          ))}
          <span className="absolute inset-y-0 w-[2px] bg-good/70" style={{ left: '60%' }} aria-hidden />
        </div>
        <div className="relative mt-0.5 h-3 text-[0.6rem] text-dim" aria-hidden>
          {TRAPPE.map((x) => (
            <span key={x.trin} className="tal absolute -translate-x-1/2" style={{ left: `${x.graense}%` }}>
              {x.graense}
            </span>
          ))}
        </div>
      </div>
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {TRAPPE.map((x) => {
          const nu = x.trin === trin;
          const passeret = x.trin < trin;
          return (
            <li
              key={x.trin}
              className={`flex min-w-0 flex-col gap-0.5 rounded-md border-2 px-2 py-1.5 ${nu ? 'border-line bg-bad text-line pixel-skygge' : passeret ? 'border-line bg-bad/20' : 'border-line bg-bg2'}`}
              aria-current={nu ? 'step' : undefined}
              data-testid={testId ? `${testId}-trin-${x.trin}` : undefined}
            >
              <span className={`flex items-center gap-1 font-pixel text-[0.7rem] font-black uppercase ${nu ? 'text-line' : passeret ? 'text-bad' : 'text-ink'}`}>
                <span className={`tal inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-line text-[0.6rem] ${nu ? 'bg-line text-bad' : 'bg-panel2 text-muted'}`}>
                  {x.trin}
                </span>
                <span className="truncate">{x.navn}</span>
              </span>
              <span className={`text-[0.66rem] leading-tight ${nu ? 'text-line' : 'text-muted'}`}>{x.tekst}</span>
              <span className={`tal text-[0.62rem] ${nu ? 'font-bold text-line' : 'text-dim'}`}>Tillid under {x.graense}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
