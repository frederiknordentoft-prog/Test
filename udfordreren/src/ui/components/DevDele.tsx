// Dev-sporet: små fælles byggeklodser til projekter, tildeling, nyt produkt, anmeldelser og kombinationsbog.
import { useId, useMemo, useState, type ReactNode } from 'react';
import type { ParamKey, Phase, Staff } from '../../sim/types';
import { PHASES } from '../../sim/types';
import { ROLES } from '../../data/roles';
import { FIT_NAVN, type Fit } from '../../data/compatibility';
import { Btn, Ikon, type IkonNavn } from './kit';
import { Portraet, portraetFor } from './ShellPortraet';
import { FASE_NAVN, FIT_STIL, PARAM_FARVE, PARAM_IKON, PARAM_NAVN } from '../lib/devHjaelp';

// ---------- Animationer (hoistes og dedupliceres af React 19; neutraliseres af reduceret bevægelse i index.css) ----------
const CSS = `
@keyframes dev-puls { 0%,100% { box-shadow: 0 3px 0 var(--color-line), 0 0 0 0 rgba(110,224,122,.7); filter: brightness(1); } 50% { box-shadow: 0 3px 0 var(--color-line), 0 0 0 8px rgba(110,224,122,0); filter: brightness(1.12); } }
.dev-puls:not(:disabled) { animation: dev-puls 1.15s ease-in-out infinite; }
@keyframes dev-ind { from { transform: translateY(12px) scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
.dev-ind { animation: dev-ind 280ms cubic-bezier(.2,1.35,.4,1) both; }
@keyframes dev-stempel { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0; } 55% { transform: scale(.9) rotate(-5deg); opacity: 1; } 100% { transform: scale(1) rotate(-4deg); opacity: 1; } }
.dev-stempel { animation: dev-stempel 420ms cubic-bezier(.2,1.2,.4,1) both; }
@keyframes dev-stempel-bred { 0% { transform: scale(1.5) rotate(-5deg); opacity: 0; } 60% { transform: scale(.97) rotate(0); opacity: 1; } 100% { transform: none; opacity: 1; } }
.dev-stempel-bred { animation: dev-stempel-bred 420ms cubic-bezier(.2,1.2,.4,1) both; }
@keyframes dev-slag { 0% { transform: scale(1.35); } 60% { transform: scale(.95); } 100% { transform: scale(1); } }
.dev-slag { animation: dev-slag 380ms cubic-bezier(.2,1.2,.4,1) both; }
@keyframes dev-trommel { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.dev-trommel { animation: dev-trommel 110ms steps(2) infinite; }
@keyframes dev-hop { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }
.dev-hop { animation: dev-hop 160ms ease-out; }
@keyframes dev-glimt { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
.dev-glimt { background-image: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%); background-size: 60% 100%; background-repeat: no-repeat; animation: dev-glimt 1.8s ease-in-out infinite; }
@keyframes dev-blink { 50% { opacity: .45; } }
.dev-blink { animation: dev-blink 1.2s steps(2) infinite; }
.dev-scroll { scrollbar-width: thin; scrollbar-color: var(--color-hi) transparent; }
`;

export function DevStil() {
  return (
    <style href="dev-stil" precedence="medium">
      {CSS}
    </style>
  );
}

// ---------- Kombinationsvurdering ----------
export function FitMaerke({ fit, lille, foersteForsoeg }: { fit: Fit | null; lille?: boolean; foersteForsoeg?: boolean }) {
  if (fit === null || foersteForsoeg) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border-2 border-line bg-bg2 font-pixel font-bold uppercase text-muted ${lille ? 'px-1 py-0 text-[0.62rem]' : 'px-1.5 py-0.5 text-[0.68rem]'}`}
        title="Kombinationen er ikke prøvet endnu"
      >
        <Ikon navn="spoergsmaal" farve="var(--color-muted)" str={lille ? 10 : 12} />
        Første forsøg
      </span>
    );
  }
  const st = FIT_STIL[fit];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border-2 border-line font-pixel font-bold uppercase text-line ${lille ? 'px-1 py-0 text-[0.62rem]' : 'px-1.5 py-0.5 text-[0.68rem]'}`}
      style={{ background: st.farve }}
      title={`Kombination: ${FIT_NAVN[fit]}`}
    >
      <Ikon navn={st.ikon} farve="var(--color-line)" str={lille ? 10 : 12} />
      {FIT_NAVN[fit]}
    </span>
  );
}

// ---------- Parametre ----------
/** Én parameter som bar med en markør for markedets standard */
export function ParamRaekke({
  param, vaerdi, standard, skala, hoejre, kompakt,
}: { param: ParamKey; vaerdi: number; standard: number; skala: number; hoejre?: ReactNode; kompakt?: boolean }) {
  const p = Math.max(0, Math.min(1, vaerdi / skala));
  const s = Math.max(0, Math.min(1, standard / skala));
  const over = vaerdi >= standard;
  const farve = PARAM_FARVE[param];
  return (
    <div className="flex items-center gap-2" data-testid={`param-${param}`}>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-bold" style={{ color: farve }}>
            <Ikon navn={PARAM_IKON[param]} farve={farve} indre="var(--color-line)" str={12} />
            {PARAM_NAVN[param]}
          </span>
          <span className="tal flex items-center gap-1 font-pixel font-bold text-ink" title={`Markedsstandard: ${Math.round(standard)}`}>
            {over && <Ikon navn="flueben" farve="var(--color-good)" str={10} titel="Over markedsstandarden" />}
            {Math.round(vaerdi)}
          </span>
        </div>
        <div className="relative">
          <div className={`w-full overflow-hidden rounded-sm border-2 border-line bg-bg ${kompakt ? 'h-3' : 'h-4'}`}>
            <div className="h-full transition-[width] duration-500" style={{ width: `${p * 100}%`, background: farve }} />
          </div>
          <div
            className="pointer-events-none absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-sm border border-line bg-ink"
            style={{ left: `${s * 100}%` }}
            title={`Markedsstandard ${Math.round(standard)}`}
            aria-hidden
          />
        </div>
      </div>
      {hoejre}
    </div>
  );
}

// ---------- Medarbejdere ----------
export function StaffAvatar({ m, str = 32, dim, titel }: { m: Staff; str?: number; dim?: boolean; titel?: string }) {
  const { navn, udseende, rolle } = m;
  const u = useMemo(() => portraetFor({ navn, udseende, rolle }), [navn, udseende, rolle]);
  const energiFarve = m.energi >= 60 ? 'var(--color-good)' : m.energi >= 30 ? 'var(--color-warn)' : 'var(--color-bad)';
  return (
    <span className={`inline-flex shrink-0 flex-col items-center gap-0.5 ${dim ? 'opacity-45' : ''}`} title={titel ?? `${m.navn} · ${ROLES[m.rolle].navn} · energi ${Math.round(m.energi)}`}>
      <Portraet udseende={u} str={str} baggrund="var(--color-panel2)" className="rounded border-2 border-line" />
      <span className="block h-[5px] overflow-hidden rounded-sm border border-line bg-bg" style={{ width: str }} aria-hidden>
        <span className="block h-full" style={{ width: `${Math.round(m.energi)}%`, background: energiFarve }} />
      </span>
    </span>
  );
}

export function EnergiBar({ energi }: { energi: number }) {
  const farve = energi >= 60 ? 'var(--color-good)' : energi >= 30 ? 'var(--color-warn)' : 'var(--color-bad)';
  return (
    <span className="flex items-center gap-1" title={`Energi ${Math.round(energi)}`}>
      <Ikon navn="lyn" farve={farve} str={10} />
      <span className="block h-2 w-14 overflow-hidden rounded-sm border border-line bg-bg">
        <span className="block h-full" style={{ width: `${Math.round(energi)}%`, background: farve }} />
      </span>
      <span className="tal w-6 text-right text-[0.68rem] text-muted">{Math.round(energi)}</span>
    </span>
  );
}

// ---------- Fase-stepper ----------
export function FaseStepper({ fase, klar, faseUge, faseLaengde }: { fase: Phase; klar: boolean; faseUge: number; faseLaengde: number }) {
  const i = PHASES.indexOf(fase);
  return (
    <div>
      <ol className="grid grid-cols-4 gap-1" aria-label="Faser">
        {PHASES.map((f, j) => {
          const faerdig = klar || j < i;
          const nu = !klar && j === i;
          return (
            <li
              key={f}
              aria-current={nu ? 'step' : undefined}
              data-testid={`fase-${f}`}
              className={`flex min-w-0 items-center justify-center gap-1 rounded border-2 border-line px-1 py-1 font-pixel text-[0.62rem] font-bold uppercase tracking-wide sm:text-[0.68rem] ${
                nu ? 'bg-gold text-line pixel-skygge' : faerdig ? 'bg-bg2 text-good' : 'bg-bg2 text-dim'
              }`}
            >
              {faerdig ? <Ikon navn="flueben" farve="var(--color-good)" str={10} /> : <span className="tal">{j + 1}</span>}
              <span className="truncate">{FASE_NAVN[f]}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-sm border-2 border-line bg-bg" aria-hidden>
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${klar ? 100 : Math.min(100, (faseUge / Math.max(1, faseLaengde)) * 100)}%`, background: klar ? 'var(--color-good)' : 'var(--color-gold)' }}
          />
        </div>
        <span className="tal shrink-0 text-xs text-muted" data-testid="fase-uge">
          {klar ? 'Færdigtestet' : `Uge ${Math.min(faseUge + 1, faseLaengde)} af ${faseLaengde}`}
        </span>
      </div>
    </div>
  );
}

// ---------- Segmenteret vælger ----------
export function Segment<T extends string | number>({
  valg, vaerdi, onSkift, label, testIdPrefix,
}: { valg: { id: T; navn: ReactNode; titel?: string }[]; vaerdi: T; onSkift: (v: T) => void; label: string; testIdPrefix?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {valg.map((v) => {
        const valgt = v.id === vaerdi;
        return (
          <button
            key={String(v.id)}
            type="button"
            role="radio"
            aria-checked={valgt}
            title={v.titel}
            data-testid={testIdPrefix ? `${testIdPrefix}-${v.id}` : undefined}
            onClick={() => onSkift(v.id)}
            className={`min-h-[44px] min-w-0 flex-1 rounded-md border-2 border-line px-1 font-pixel text-sm font-bold ${
              valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:bg-hi hover:text-ink'
            }`}
          >
            {v.navn}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Skyder med markør ----------
export function MarkeretSkyder({
  min, max, trin, vaerdi, onSkift, label, vis, markoer, markoerTekst, minTekst, maxTekst, testId,
}: {
  min: number; max: number; trin: number; vaerdi: number; onSkift: (v: number) => void; label: ReactNode; vis: ReactNode;
  markoer?: number; markoerTekst?: string; minTekst?: string; maxTekst?: string; testId?: string;
}) {
  const id = useId();
  const pm = markoer !== undefined && max > min ? Math.max(0, Math.min(1, (markoer - min) / (max - min))) : null;
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="tal font-pixel font-bold text-ink">{vis}</span>
      </label>
      <div className="relative">
        <input
          id={id}
          data-testid={testId}
          type="range"
          min={min}
          max={max}
          step={trin}
          value={vaerdi}
          disabled={max <= min}
          onChange={(e) => onSkift(Number(e.target.value))}
          className="relative z-[1] h-[44px] w-full cursor-pointer accent-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {pm !== null && (
          <span
            className="pointer-events-none absolute bottom-0 z-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(${pm} * (100% - 16px) + 8px)` }}
            aria-hidden
          >
            <span className="h-2 w-[3px] rounded-sm bg-ink" />
          </span>
        )}
      </div>
      <div className="relative flex justify-between text-[0.68rem] text-dim">
        <span className="tal">{minTekst}</span>
        {pm !== null && markoerTekst && (
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-bold text-muted" style={{ left: `calc(${pm} * (100% - 16px) + 8px)` }}>
            {markoerTekst}
          </span>
        )}
        <span className="tal">{maxTekst}</span>
      </div>
    </div>
  );
}

// ---------- Bekræftelse inline ----------
export function BekraeftKnap({
  tekst, spoergsmaal, ja, onJa, ikon = 'papirkurv', testId, variant = 'ghost', className = '',
}: { tekst: ReactNode; spoergsmaal: ReactNode; ja: string; onJa: () => void; ikon?: IkonNavn; testId?: string; variant?: 'ghost' | 'sekundaer'; className?: string }) {
  const [aaben, setAaben] = useState(false);
  if (!aaben) {
    return (
      <Btn variant={variant} onClick={() => setAaben(true)} testId={testId} className={className}>
        <Ikon navn={ikon} /> {tekst}
      </Btn>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-md border-2 border-line bg-bg2 p-2" role="alertdialog" aria-label="Bekræft">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink">
        <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="shrink-0" />
        <span>{spoergsmaal}</span>
      </span>
      <div className="flex gap-2">
        <Btn onClick={() => setAaben(false)} testId={testId ? `${testId}-fortryd` : undefined}>
          Fortryd
        </Btn>
        <Btn
          variant="fare"
          onClick={() => {
            setAaben(false);
            onJa();
          }}
          testId={testId ? `${testId}-ja` : undefined}
        >
          {ja}
        </Btn>
      </div>
    </div>
  );
}

// ---------- Sektionsoverskrift ----------
export function Afsnit({ nr, titel, hoejre, children, className = '' }: { nr?: string; titel: ReactNode; hoejre?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider text-ink">
          {nr && <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-line bg-gold text-[0.65rem] text-line">{nr}</span>}
          {titel}
        </h3>
        {hoejre}
      </header>
      {children}
    </section>
  );
}
