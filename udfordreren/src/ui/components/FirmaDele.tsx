// Firma-sporet: små delte byggeklodser — pixelavatar, afsnit, chips, stat-barer, pips, segmentvælger,
// donut, søjlegraf og måler. Alt er SVG/CSS (ingen eksterne assets).
import { useId, type ReactNode } from 'react';
import type { Staff } from '../../sim/types';
import { Ikon, type IkonNavn } from './kit';
import { Portraet, portraetFor } from './ShellPortraet';
import { bland, T } from '../../render/palette';
import { ROLES } from '../../data/roles';

// ---------- Avatar ----------

/** Pixelportræt, der matcher figuren i kontoret (hud, hår, trøje), med rollefarvet baggrund */
export function FirmaAvatar({ m, str = 44 }: { m: Pick<Staff, 'navn' | 'udseende' | 'rolle'>; str?: number }) {
  const rolleFarve = ROLES[m.rolle]?.farve ?? T.gold;
  const p = portraetFor(m);
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-md border-2 border-line" style={{ width: str, height: str, background: rolleFarve }}>
      <Portraet udseende={p} str={str - 4} baggrund={bland(rolleFarve, T.bg2, 0.55)} />
    </span>
  );
}

// ---------- Layout ----------

/** Et afsnit i et panel (kort med overskrift) */
export function Afsnit({
  titel, ikon, farve = 'var(--color-gold)', hoejre, children, id, testId, className = '',
}: { titel: ReactNode; ikon?: IkonNavn; farve?: string; hoejre?: ReactNode; children: ReactNode; id?: string; testId?: string; className?: string }) {
  return (
    <section id={id} data-testid={testId} className={`scroll-mt-2 rounded-md border-2 border-line bg-bg2 ${className}`}>
      <header className="flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b-2 border-line px-2.5 py-1.5">
        <h3 className="flex min-w-0 items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
          {ikon && <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={14} className="shrink-0" />}
          <span className="min-w-0">{titel}</span>
        </h3>
        {hoejre}
      </header>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

/** Lille etiket med valgfrit ikon */
export function Chip({ children, ikon, farve = 'var(--color-muted)', fyld, titel, className = '' }: { children: ReactNode; ikon?: IkonNavn; farve?: string; fyld?: boolean; titel?: string; className?: string }) {
  return (
    <span
      title={titel}
      className={`inline-flex max-w-full items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 text-[0.72rem] font-bold leading-tight ${fyld ? 'text-line' : 'bg-panel2'} ${className}`}
      style={fyld ? { background: farve } : { color: farve }}
    >
      {ikon && <Ikon navn={ikon} farve={fyld ? 'var(--color-line)' : farve} indre={fyld ? farve : 'var(--color-line)'} str={12} className="shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** Tal med ikon (penge, indsigt, hype …) */
export function Maengde({ ikon, farve, children, titel, className = '' }: { ikon: IkonNavn; farve: string; children: ReactNode; titel?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-pixel font-bold tal ${className}`} style={{ color: farve }} title={titel}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={13} className="shrink-0" />
      {children}
    </span>
  );
}

/** ✓/✗-række til krav */
export function KravRaekke({ ok, children, testId }: { ok: boolean; children: ReactNode; testId?: string }) {
  return (
    <li className="flex items-start gap-1.5 text-sm" data-testid={testId}>
      <span
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-line"
        style={{ background: ok ? 'var(--color-good)' : 'var(--color-panel2)' }}
      >
        <Ikon navn={ok ? 'flueben' : 'kryds'} farve={ok ? 'var(--color-line)' : 'var(--color-bad)'} str={10} titel={ok ? 'Opfyldt' : 'Ikke opfyldt'} />
      </span>
      <span className={ok ? 'text-ink' : 'text-muted'}>{children}</span>
    </li>
  );
}

// ---------- Små målere ----------

/** Kompakt stat-bar: etiket, bar og tal på én linje */
export function StatBar({ label, vaerdi, max = 100, farve, titel }: { label: string; vaerdi: number; max?: number; farve: string; titel?: string }) {
  const p = Math.max(0, Math.min(1, vaerdi / max));
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={titel ?? `${label}: ${Math.round(vaerdi)}`}>
      <span className="w-9 shrink-0 font-pixel text-[0.66rem] font-bold uppercase text-muted">{label}</span>
      <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
        <span className="block h-full" style={{ width: `${p * 100}%`, background: farve }} />
      </span>
      <span className="tal w-6 shrink-0 text-right font-pixel text-xs font-bold text-ink">{Math.round(vaerdi)}</span>
    </div>
  );
}

/** Pips 0..max (fx strenghed eller investorpres); halve værdier vises som halvfyldt pip */
export function Pips({ vaerdi, max = 5, farve = 'var(--color-warn)', label }: { vaerdi: number; max?: number; farve?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${label}: ${String(Math.round(vaerdi * 10) / 10).replace('.', ',')} af ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const fyld = Math.max(0, Math.min(1, vaerdi - i));
        return (
          <span key={i} className="relative h-3.5 w-3 overflow-hidden rounded-[2px] border-2 border-line bg-bg">
            <span className="absolute inset-y-0 left-0" style={{ width: `${fyld * 100}%`, background: farve }} />
          </span>
        );
      })}
    </span>
  );
}

/** Segmentvælger (radiogruppe) med 44 px høje knapper */
export function Segment<T extends string | number>({
  valg, vaerdi, onSkift, label, testIdPrefix,
}: { valg: { id: T; navn: ReactNode; titel?: string }[]; vaerdi: T; onSkift: (v: T) => void; label: string; testIdPrefix: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md border-2 border-line bg-bg p-1">
      {valg.map((v) => {
        const valgt = v.id === vaerdi;
        return (
          <button
            key={String(v.id)}
            type="button"
            role="radio"
            aria-checked={valgt}
            title={v.titel}
            data-testid={`${testIdPrefix}-${v.id}`}
            onClick={() => onSkift(v.id)}
            className={`min-h-[44px] rounded border-2 px-1 font-pixel text-sm font-black ${valgt ? 'border-line bg-gold text-line pixel-skygge' : 'border-transparent text-muted hover:bg-panel2 hover:text-ink'}`}
          >
            {v.navn}
          </button>
        );
      })}
    </div>
  );
}

/** Tre-farvet flagstribe (markedets farver) */
export function FlagStribe({ farver, className = '' }: { farver: readonly string[]; className?: string }) {
  return (
    <span className={`flex overflow-hidden rounded-sm border-2 border-line ${className}`} aria-hidden>
      {farver.map((f, i) => (
        <span key={i} className="h-full flex-1" style={{ background: f }} />
      ))}
    </span>
  );
}

// ---------- Grafer ----------

export type DonutDel = { id: string; navn: string; andel: number; farve: string };

/** Donut for andele (del af helhed). 2 px mellemrum mellem stykkerne; titel pr. stykke som tooltip. */
export function Donut({ dele, str = 150, midte }: { dele: DonutDel[]; str?: number; midte?: ReactNode }) {
  const r = 38;
  const sum = dele.reduce((a, d) => a + d.andel, 0) || 1;
  const gab = 0.7;
  let akk = 0;
  return (
    <div className="relative shrink-0" style={{ width: str, height: str }}>
      <svg viewBox="0 0 100 100" width={str} height={str} role="img" aria-label="Markedsandele">
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--color-bg)" strokeWidth={20} />
        <g transform="rotate(-90 50 50)">
          {dele.map((d) => {
            const len = (d.andel / sum) * 100;
            const synlig = Math.max(0, len - (dele.length > 1 ? gab : 0));
            const offset = -akk;
            akk += len;
            if (synlig <= 0.05) return null;
            return (
              <circle
                key={d.id}
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke={d.farve}
                strokeWidth={d.id === 'spiller' ? 22 : 18}
                pathLength={100}
                strokeDasharray={`${synlig} ${100 - synlig}`}
                strokeDashoffset={offset}
              >
                <title>{`${d.navn}: ${(Math.round((d.andel / sum) * 1000) / 10).toString().replace('.', ',')} %`}</title>
              </circle>
            );
          })}
        </g>
      </svg>
      {midte && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{midte}</div>}
    </div>
  );
}

export type Soejle = { label: string; v: number; titel: string };

/** Enkel søjlegraf med nul-linje (negative værdier går nedad). Tooltip pr. søjle; værdien står i overskriften og tabellen. */
export function SoejleGraf({
  soejler, farve, negativFarve = 'var(--color-bad)', hoejde = 72, testId,
}: { soejler: Soejle[]; farve: string; negativFarve?: string; hoejde?: number; testId?: string }) {
  const id = useId();
  const W = 300;
  const H = hoejde;
  const top = 12;
  const bund = 14;
  const maxV = Math.max(0, ...soejler.map((s) => s.v));
  const minV = Math.min(0, ...soejler.map((s) => s.v));
  const span = maxV - minV || 1;
  const plotH = H - top - bund;
  const y0 = top + (maxV / span) * plotH;
  const n = Math.max(1, soejler.length);
  const slot = W / n;
  const bw = Math.max(3, Math.min(22, slot - 3));
  const sidste = soejler[soejler.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-labelledby={id} data-testid={testId} className="block overflow-visible">
      <title id={id}>{soejler.map((s) => s.titel).join(' · ')}</title>
      <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--color-hi)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {soejler.map((s, i) => {
        const h = (Math.abs(s.v) / span) * plotH;
        const x = i * slot + (slot - bw) / 2;
        const y = s.v >= 0 ? y0 - h : y0;
        return (
          <g key={i}>
            <rect x={i * slot} y={0} width={slot} height={H} fill="transparent">
              <title>{s.titel}</title>
            </rect>
            <rect x={x} y={y} width={bw} height={Math.max(1, h)} rx={1.5} fill={s.v >= 0 ? farve : negativFarve} pointerEvents="none" />
          </g>
        );
      })}
      {soejler.length > 0 && (
        <>
          <text x={2} y={H - 2} fontSize={9} fill="var(--color-dim)" className="font-pixel">
            {soejler[0].label}
          </text>
          <text x={W - 2} y={H - 2} fontSize={9} fill="var(--color-dim)" textAnchor="end" className="font-pixel">
            {sidste.label}
          </text>
        </>
      )}
    </svg>
  );
}

/** Halvcirkel-måler 0..max (fx tilsynstillid eller investorpres) */
export function Maaler({ vaerdi, max = 100, farve, str = 132, children }: { vaerdi: number; max?: number; farve: string; str?: number; children?: ReactNode }) {
  const p = Math.max(0, Math.min(1, vaerdi / max));
  const d = 'M 10 50 A 40 40 0 0 1 90 50';
  return (
    <div className="relative shrink-0" style={{ width: str, height: str * 0.6 }}>
      <svg viewBox="0 0 100 58" width={str} height={str * 0.58} aria-hidden>
        <path d={d} fill="none" stroke="var(--color-line)" strokeWidth={14} strokeLinecap="butt" />
        <path d={d} fill="none" stroke="var(--color-bg)" strokeWidth={10} />
        <path d={d} fill="none" stroke={farve} strokeWidth={10} pathLength={100} strokeDasharray={`${p * 100} 100`} />
        {[0.4, 0.6].map((t) => {
          const a = Math.PI * (1 - t);
          return <line key={t} x1={50 + 33 * Math.cos(a)} y1={50 - 33 * Math.sin(a)} x2={50 + 47 * Math.cos(a)} y2={50 - 47 * Math.sin(a)} stroke="var(--color-line)" strokeWidth={1.5} />;
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">{children}</div>
    </div>
  );
}
