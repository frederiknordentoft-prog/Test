// Pixelkontoret: statuslinje med aktive projekter/opgaver + 320×180 canvas (nearest-neighbor, 16:9 letterbox).
// Selve tegningen sker i src/render/office.ts i ét rAF-loop uden React-rerenders.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { KontorRenderer } from '../../render/office';
import { FASE_FARVE } from '../../render/palette';
import { PHASES, type Phase } from '../../sim/types';
import { Ikon } from './kit';
import { FASE_NAVN } from '../lib/devHjaelp';


type Chip =
  | { kind: 'projekt'; id: string; navn: string; fase: Phase; andel: number; klar: boolean; tomtHold: boolean }
  | { kind: 'kontrakt'; id: string; navn: string; resterende: number };

function FaseSegmenter({ fase, andel, klar }: { fase: Phase; andel: number; klar: boolean }) {
  const idx = PHASES.indexOf(fase);
  return (
    <span className="flex shrink-0 items-center gap-[2px]" aria-hidden>
      {PHASES.map((f, i) => {
        const fyld = klar || i < idx ? 1 : i === idx ? Math.max(0.08, Math.min(1, andel)) : 0;
        return (
          <span key={f} className="relative h-[8px] w-[11px] overflow-hidden rounded-[1px] border border-line bg-bg">
            <span className="absolute inset-y-0 left-0" style={{ width: `${fyld * 100}%`, background: FASE_FARVE[f] }} />
          </span>
        );
      })}
    </span>
  );
}

function ChipVisning({ c }: { c: Chip }) {
  if (c.kind === 'kontrakt') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded border-2 border-line bg-panel px-1.5 py-[3px]" data-testid={`kontor-opgave-${c.id}`}>
        <Ikon navn="kontrakt" str={12} farve="var(--color-gold)" indre="var(--color-line)" />
        <span className="min-w-0 truncate text-xs font-bold text-ink">{c.navn}</span>
        <span className="tal ml-auto shrink-0 font-pixel text-[10px] text-muted">
          {c.resterende} {c.resterende === 1 ? 'uge' : 'uger'}
        </span>
      </div>
    );
  }
  const farve = c.klar ? 'var(--color-good)' : FASE_FARVE[c.fase];
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 rounded border-2 border-line bg-panel px-1.5 py-[3px]"
      data-testid={`kontor-projekt-${c.id}`}
      title={c.klar ? `${c.navn}: klar til lancering` : `${c.navn}: ${FASE_NAVN[c.fase]}`}
    >
      <Ikon navn={c.klar ? 'flueben' : 'produkt'} str={12} farve={farve} indre="var(--color-line)" />
      <span className="min-w-0 truncate text-xs font-bold text-ink">{c.navn}</span>
      {c.klar ? (
        <span className="anim-blink ml-auto shrink-0 font-pixel text-[10px] font-bold uppercase text-good">Klar!</span>
      ) : c.tomtHold ? (
        <span className="ml-auto flex shrink-0 items-center gap-1 font-pixel text-[10px] font-bold uppercase text-warn">
          <Ikon navn="advarsel" str={10} farve="var(--color-warn)" indre="var(--color-line)" />
          Intet hold
        </span>
      ) : (
        <span className="ml-auto shrink-0 font-pixel text-[10px] font-bold uppercase" style={{ color: farve }}>
          {FASE_NAVN[c.fase]}
        </span>
      )}
      <FaseSegmenter fase={c.fase} andel={c.andel} klar={c.klar} />
    </div>
  );
}

/** Kompakt statuslinje over kontoret: aktive projekter (fase + 4-delt fremdrift) og kontraktopgaver. Skifter side, hvis der er flere, end der er plads til. */
function StatusLinje() {
  const projekter = useGame((s) => s.game?.projekter);
  const kontrakter = useGame((s) => s.game?.kontraktopgaver);
  const ref = useRef<HTMLDivElement>(null);
  const [bredde, setBredde] = useState(640);
  const [side, setSide] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setBredde(Math.round(e[0]?.contentRect.width ?? 640)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chips = useMemo<Chip[]>(() => {
    const ud: Chip[] = [];
    for (const p of projekter ?? []) {
      ud.push({
        kind: 'projekt',
        id: p.id,
        navn: p.navn,
        fase: p.fase,
        andel: p.faseLaengde[p.fase] > 0 ? p.faseUge / p.faseLaengde[p.fase] : 0,
        klar: p.klar,
        tomtHold: !p.klar && p.faseTildeling[p.fase].length === 0,
      });
    }
    for (const c of kontrakter ?? []) {
      ud.push({ kind: 'kontrakt', id: c.id, navn: c.tilbud.navn, resterende: c.resterendeUger });
    }
    return ud;
  }, [projekter, kontrakter]);

  const prSide = Math.max(1, Math.floor(bredde / 230));
  const sider = Math.max(1, Math.ceil(chips.length / prSide));
  useEffect(() => {
    if (sider <= 1) return;
    const t = window.setInterval(() => setSide((s) => (s + 1) % sider), 4000);
    return () => window.clearInterval(t);
  }, [sider]);
  const aktiv = side % sider;
  const vis = chips.slice(aktiv * prSide, aktiv * prSide + prSide);

  return (
    <div ref={ref} className="flex h-[34px] items-center gap-1.5 border-b-2 border-line bg-bg2 px-1.5" data-testid="kontor-status">
      {vis.length === 0 ? (
        <span className="min-w-0 truncate px-1 text-xs text-muted">Ingen opgaver i gang. Start et produkt eller tag en kontraktopgave.</span>
      ) : (
        vis.map((c) => <ChipVisning key={c.id} c={c} />)
      )}
      {sider > 1 && (
        <span className="tal shrink-0 font-pixel text-[10px] text-dim" aria-label={`Side ${aktiv + 1} af ${sider}`}>
          {aktiv + 1}/{sider}
        </span>
      )}
    </div>
  );
}

/** Tastatur/skærmlæser-adgang til medarbejderne (canvas kan ikke fokuseres). Usynlige, indtil de får fokus. */
function MedarbejderKnapper() {
  const staff = useGame(useShallow((s) => (s.game?.staff ?? []).map((m) => `${m.id}|${m.navn}`)));
  const aabn = useUi((s) => s.aabn);
  return (
    <ul className="pointer-events-none absolute inset-0 m-0 list-none p-0" aria-label="Medarbejdere i kontoret">
      {staff.map((x) => {
        const [id, navn] = x.split('|');
        return (
          <li key={id}>
            <button
              type="button"
              data-testid={`kontor-medarbejder-${id}`}
              onClick={() => aabn({ kind: 'medarbejder', staffId: id })}
              className="sr-only focus:not-sr-only focus:pointer-events-auto focus:absolute focus:bottom-2 focus:left-2 focus:z-10 focus:min-h-[44px] focus:rounded-md focus:border-2 focus:border-line focus:bg-gold focus:px-3 focus:font-bold focus:text-line"
            >
              Åbn {navn}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function OfficeCanvas() {
  const boks = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!boks.current || !cv.current) return;
    const r = new KontorRenderer(cv.current, boks.current);
    r.start();
    return () => r.stop();
  }, []);
  return (
    <div className="overflow-hidden rounded-lg border-2 border-line bg-bg2 pixel-skygge" data-testid="kontor">
      <StatusLinje />
      <div ref={boks} className="relative aspect-video w-full overflow-hidden bg-[#0d0f1c]">
        <canvas
          ref={cv}
          className="pixel absolute left-0 top-0 touch-manipulation select-none"
          style={{ imageRendering: 'pixelated' }}
          role="img"
          aria-label="Pixelkontoret"
          data-testid="kontor-canvas"
        />
        <MedarbejderKnapper />
      </div>
    </div>
  );
}
