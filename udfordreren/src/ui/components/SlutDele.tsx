// Byggeklodser til slutskærmen (spec 6.17): eftermælet, tidslinjen, trofæhylden og byens udvikling.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { GameState } from '../../sim/types';
import type { EftermaeleDel } from '../../sim/endings';
import { Bar, Ikon, type IkonNavn } from './kit';
import { pct } from '../format';
import {
  BY_PROFIL, BY_PROFILER, TIDSLINJE_KIND, TIDSLINJE_KINDS, aarTekst, antalPrKind, byRoedAndel, tidslinjePrAar,
  type ByAar, type TidslinjeKind, type Trofaeer,
} from '../lib/slutHjaelp';
import { rulleKant } from '../hooks/rulleKant';

export function SlutSektion({ titel, ikon, hoejre, children, testId, className = '' }: { titel: string; ikon: IkonNavn; hoejre?: ReactNode; children: ReactNode; testId?: string; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border-2 border-line bg-bg2 p-3 ${className}`} data-testid={testId}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider text-muted">
          <Ikon navn={ikon} farve="var(--color-gold)" indre="var(--color-line)" /> {titel}
        </h3>
        {hoejre}
      </header>
      {children}
    </section>
  );
}

// ---------- Eftermæle ----------

const DEL_IKON: IkonNavn[] = ['skjold', 'hus', 'stjerne', 'trofae', 'kolbe', 'noegle'];

function delFarve(andel: number): { farve: string; ikon: IkonNavn; tekst: string } {
  if (andel >= 0.67) return { farve: 'var(--color-good)', ikon: 'op', tekst: 'stærkt' };
  if (andel >= 0.34) return { farve: 'var(--color-warn)', ikon: 'streg', tekst: 'middel' };
  return { farve: 'var(--color-bad)', ikon: 'ned', tekst: 'svagt' };
}

export function Eftermaele({ dele, total }: { dele: EftermaeleDel[]; total: number }) {
  const maks = dele.reduce((a, d) => a + d.maks, 0) || 100;
  return (
    <SlutSektion
      titel="Eftermæle"
      ikon="trofae"
      testId="slut-eftermaele"
      hoejre={
        <span className="tal font-pixel text-sm font-black text-violet" data-testid="slut-eftermaele-total">
          {String(Math.round(total)).replace('.', ',')}/{maks}
        </span>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {dele.map((d, i) => {
          const f = delFarve(d.maks ? d.point / d.maks : 0);
          return (
            <li key={d.navn} data-testid={`slut-eftermaele-del-${i}`}>
              <div className="mb-0.5 flex items-center gap-2 text-sm">
                <Ikon navn={DEL_IKON[i] ?? 'stjerne'} farve={f.farve} indre="var(--color-line)" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate font-bold text-ink">{d.navn}</span>
                <span className="inline-flex items-center gap-1 font-pixel text-xs font-bold" style={{ color: f.farve }} title={`Et ${f.tekst} resultat`}>
                  <Ikon navn={f.ikon} str={10} />
                  <span className="tal">
                    {String(d.point).replace('.', ',')}/{d.maks}
                  </span>
                </span>
              </div>
              <Bar vaerdi={d.point} max={d.maks} farve={f.farve} hoejde={6} />
              <div className="mt-0.5 text-xs text-muted">{d.forklaring}</div>
            </li>
          );
        })}
      </ul>
    </SlutSektion>
  );
}

// ---------- Tidslinje ----------

const SYNLIGE = 4;

export function Tidslinje({ g }: { g: Pick<GameState, 'tidslinje' | 'uge' | 'slut'> }) {
  const [filter, setFilter] = useState<TidslinjeKind | 'alle'>('alle');
  const [aabne, setAabne] = useState<number[]>([]);
  const aar = tidslinjePrAar(g, filter);
  const liste = useRef<HTMLOListElement>(null);
  // Nyt filter: rul tilbage til starten, så det første træf er synligt
  useEffect(() => {
    liste.current?.scrollTo?.({ left: 0 });
  }, [filter]);
  const antal = antalPrKind(g);
  const kinds = TIDSLINJE_KINDS.filter((k) => antal[k] > 0);
  return (
    <SlutSektion titel="Tidslinjen" ikon="kalender" testId="slut-tidslinje" hoejre={<span className="tal font-pixel text-xs text-muted">{g.tidslinje.length} øjeblikke</span>}>
      {kinds.length > 1 && (
        <div ref={rulleKant} className="shell-uden-scrollbar -mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3" role="radiogroup" aria-label="Filtrér tidslinjen">
          {(['alle', ...kinds] as const).map((k) => {
            const valgt = filter === k;
            const meta = k === 'alle' ? null : TIDSLINJE_KIND[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={valgt}
                data-testid={`tidslinje-filter-${k}`}
                onClick={() => setFilter(k)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-bold ${valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:text-ink'}`}
              >
                {meta && <Ikon navn={meta.ikon} str={14} farve={valgt ? 'var(--color-line)' : meta.farve} indre={valgt ? 'var(--color-gold)' : 'var(--color-line)'} />}
                {meta ? meta.navn : 'Alle'}
                <span className={`tal font-pixel text-[0.65rem] ${valgt ? 'text-line/70' : 'text-dim'}`}>{meta ? antal[k as TidslinjeKind] : g.tidslinje.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {g.tidslinje.length === 0 ? (
        <p className="text-sm text-muted">Tidslinjen er tom. Det var et stille eventyr.</p>
      ) : (
        <div className="relative">
          <ol ref={liste} className="flex snap-x gap-0 overflow-x-auto pb-2" data-testid="tidslinje-aar" tabIndex={0} aria-label="Tidslinje, rul vandret">
            {aar.map(({ aar: a, punkter }) => {
              const udfoldet = aabne.includes(a);
              const vis = udfoldet ? punkter : punkter.slice(0, SYNLIGE);
              // Tomme år: skjult under et filter (så det første træf står forrest), smalle under "Alle"
              if (punkter.length === 0) {
                if (filter !== 'alle') return null;
                return (
                  <li key={a} className="w-14 shrink-0 snap-start" data-testid={`tidslinje-${a}`} aria-label={`${a}: intet`}>
                    <div className="relative mb-2 flex items-center">
                      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-line" aria-hidden />
                      <span className="relative z-10 rounded border-2 border-line bg-panel px-1 font-pixel text-[0.7rem] font-black text-dim">{a}</span>
                    </div>
                    <span className="px-1 text-xs text-dim">–</span>
                  </li>
                );
              }
              return (
                <li key={a} className="w-36 shrink-0 snap-start sm:w-44" data-testid={`tidslinje-${a}`}>
                  <div className="relative mb-2 flex items-center">
                    <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-line" aria-hidden />
                    <span className={`relative z-10 rounded border-2 border-line px-1.5 font-pixel text-xs font-black ${punkter.length ? 'bg-gold text-line' : 'bg-panel text-dim'}`}>{a}</span>
                  </div>
                  <ul className="flex flex-col gap-1 pr-2">
                    {vis.map((p, i) => {
                      const k = TIDSLINJE_KIND[p.kind];
                      return (
                        <li key={`${p.uge}-${i}`} className="flex gap-1.5 rounded border-2 border-line bg-panel px-1.5 py-1 text-xs leading-snug">
                          <Ikon navn={k.ikon} farve={k.farve} indre="var(--color-line)" str={14} className="mt-0.5 shrink-0" titel={k.navn} />
                          <span className="min-w-0 text-ink">{p.tekst}</span>
                        </li>
                      );
                    })}
                    {punkter.length > SYNLIGE && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setAabne((x) => (udfoldet ? x.filter((y) => y !== a) : [...x, a]))}
                          className="min-h-[44px] w-full rounded border-2 border-dashed border-hi px-2 text-xs font-bold text-muted hover:text-ink"
                          aria-expanded={udfoldet}
                        >
                          {udfoldet ? 'Vis færre' : `+${punkter.length - SYNLIGE} mere`}
                        </button>
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ol>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-bg2 to-transparent" aria-hidden />
        </div>
      )}
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-muted" aria-label="Forklaring">
        {TIDSLINJE_KINDS.map((k) => (
          <li key={k} className="inline-flex items-center gap-1">
            <Ikon navn={TIDSLINJE_KIND[k].ikon} farve={TIDSLINJE_KIND[k].farve} indre="var(--color-line)" str={12} /> {TIDSLINJE_KIND[k].navn}
          </li>
        ))}
      </ul>
    </SlutSektion>
  );
}

// ---------- Trofæhylden ----------

function Hylde({ titel, ikon, farve, tom, children, antal, testId }: { titel: string; ikon: IkonNavn; farve: string; tom: string; children: ReactNode; antal: number; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="mb-1 flex items-center gap-1.5 font-pixel text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: farve }}>
        <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={14} /> {titel}
        <span className="tal text-dim">{antal}</span>
      </div>
      <div className="flex min-h-12 flex-wrap items-end gap-1.5 rounded-t-sm border-b-[6px] border-[#6b4423] px-1 pb-1 shadow-[0_3px_0_var(--color-line)]">
        {antal === 0 ? <span className="pb-1 text-xs text-dim">{tom}</span> : children}
      </div>
    </div>
  );
}

function Trofae({ ikon, farve, navn, under, titel, antal }: { ikon: IkonNavn; farve: string; navn: string; under: string; titel?: string; antal?: number }) {
  return (
    <span className="relative flex w-[6.4rem] min-w-0 flex-col items-center gap-0.5 rounded-t-md border-2 border-b-0 border-line bg-panel px-1 pt-1.5 pb-1 text-center sm:w-[7.5rem]" title={titel ?? navn}>
      {antal !== undefined && antal > 1 && (
        <span className="tal absolute top-0.5 right-0.5 rounded border-2 border-line bg-gold px-1 font-pixel text-[0.6rem] font-black leading-3 text-line">×{antal}</span>
      )}
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={22} />
      <span className="w-full truncate text-[0.68rem] font-bold leading-tight text-ink">{navn}</span>
      <span className="tal font-pixel text-[0.6rem] text-dim">{under}</span>
    </span>
  );
}

export function Trofaehylde({ t }: { t: Trofaeer }) {
  return (
    <SlutSektion titel="Trofæhylden" ikon="trofae" testId="slut-trofaeer">
      <div className="flex flex-col gap-3">
        <Hylde titel="Guldkuponer og Hall of Fame" ikon="stjerne" farve="var(--color-gold)" antal={t.guld.length} tom="Hylden venter stadig på sin første Guldkupon." testId="hylde-guld">
          {t.guld.map((p) => (
            <Trofae
              key={p.id}
              ikon={p.hallOfFame ? 'krone' : 'stjerne'}
              farve={p.hallOfFame ? 'var(--color-violet)' : 'var(--color-gold)'}
              navn={p.navn}
              under={`${p.aar} · ${p.total40}/40${p.hallOfFame ? ' · HoF' : ''}`}
              titel={`${p.navn}: ${p.hallOfFame ? 'Hall of Fame' : 'Guldkupon'} (${p.total40}/40)`}
            />
          ))}
        </Hylde>
        <Hylde titel="Gallapriser" ikon="trofae" farve="var(--color-violet)" antal={t.gallaIalt} tom="Ingen statuetter i år. Eller noget år." testId="hylde-galla">
          {t.galla.map((p) => (
            <Trofae key={p.id} ikon="trofae" farve="var(--color-gold)" navn={p.navn} under={aarTekst(p.aar)} antal={p.aar.length} titel={`${p.navn}: ${p.aar.join(', ')}`} />
          ))}
        </Hylde>
        <Hylde titel="Milepæle" ikon="flag" farve="var(--color-sky)" antal={t.milepaele.length} tom="Ingen milepæle nået." testId="hylde-milepaele">
          {t.milepaele.map((m) => (
            <Trofae key={m.id} ikon="flag" farve="var(--color-sky)" navn={m.navn} under={String(m.aar)} />
          ))}
        </Hylde>
      </div>
    </SlutSektion>
  );
}

// ---------- Byens udvikling ----------

export function ByDiagram({ data }: { data: ByAar[] }) {
  const pid = `skravering-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (data.length === 0) {
    return (
      <SlutSektion titel="Byens udvikling" ikon="hus" testId="slut-by">
        <p className="text-sm text-muted">Byen nåede aldrig at få kunder nok til at blive talt op.</p>
      </SlutSektion>
    );
  }
  const n = data.length;
  const B = 10;
  const foerste = data[0];
  const sidste = data[n - 1];
  const roedFoer = byRoedAndel(foerste);
  const roedNu = byRoedAndel(sidste);
  const op = roedNu > roedFoer + 0.005;
  const ned = roedNu < roedFoer - 0.005;
  const trend = op ? { ikon: 'op' as IkonNavn, farve: 'var(--color-bad)' } : ned ? { ikon: 'ned' as IkonNavn, farve: 'var(--color-good)' } : { ikon: 'streg' as IkonNavn, farve: 'var(--color-muted)' };
  const etiketter = n <= 6 ? data.map((r) => r.aar) : [foerste.aar, data[Math.floor((n - 1) / 2)].aar, sidste.aar];
  return (
    <SlutSektion titel="Byens udvikling" ikon="hus" testId="slut-by">
      <svg
        viewBox={`0 0 ${n * B} 100`}
        preserveAspectRatio="none"
        className="block h-32 w-full rounded-sm border-2 border-line bg-bg"
        role="img"
        aria-label={`Byens sammensætning år for år. Risiko og problem: ${pct(roedFoer)} i ${foerste.aar}, ${pct(roedNu)} i ${sidste.aar}.`}
        data-testid="by-diagram"
      >
        <defs>
          <pattern id={pid} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="0.9" height="2.4" fill="rgba(11,12,22,0.55)" />
          </pattern>
        </defs>
        {data.map((r, i) => {
          const sum = BY_PROFILER.reduce((a, p) => a + r[p], 0) || 1;
          let y = 100;
          return (
            <g key={r.aar}>
              {BY_PROFILER.map((p) => {
                const h = (r[p] / sum) * 100;
                y -= h;
                if (h <= 0) return null;
                const x = i * B + 1;
                return (
                  <g key={p}>
                    <rect x={x} y={y} width={B - 2} height={h} fill={BY_PROFIL[p].farve}>
                      <title>{`${r.aar}${r.nu ? ' (nu)' : ''}: ${BY_PROFIL[p].navn} ${pct(r[p] / sum)}`}</title>
                    </rect>
                    {(p === 'problem' || p === 'risiko') && <rect x={x} y={y} width={B - 2} height={h} fill={`url(#${pid})`} opacity={p === 'problem' ? 1 : 0.45} pointerEvents="none" />}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-0.5 flex justify-between font-pixel text-[0.62rem] text-dim" aria-hidden>
        {etiketter.map((a, i) => (
          <span key={`${a}-${i}`}>{a}</span>
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3" aria-label="Forklaring">
        {[...BY_PROFILER].reverse().map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-line" style={{ background: BY_PROFIL[p].farve }}>
              <Ikon navn={BY_PROFIL[p].ikon} farve="var(--color-line)" str={10} />
            </span>
            <span className="text-muted">{BY_PROFIL[p].navn}</span>
            <span className="tal ml-auto font-pixel font-bold text-ink">{pct(sidste[p] / (BY_PROFILER.reduce((a, q) => a + sidste[q], 0) || 1))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-sm" data-testid="by-trend">
        <Ikon navn={trend.ikon} farve={trend.farve} className="shrink-0" />
        <span className="text-muted">
          Risiko og problem: <span className="tal font-bold text-ink">{pct(roedFoer)}</span> i {foerste.aar} → <span className="tal font-bold" style={{ color: trend.farve }}>{pct(roedNu)}</span> i {sidste.aar}
          {sidste.nu ? ' (nu)' : ''}.
        </span>
      </p>
    </SlutSektion>
  );
}
