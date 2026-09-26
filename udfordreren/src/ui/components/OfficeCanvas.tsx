// Pixelkontoret: statuslinje med aktive projekter/opgaver + 320×180 canvas (nearest-neighbor, 16:9 letterbox).
// Selve tegningen sker i src/render/office.ts i ét rAF-loop uden React-rerenders.
// Et klik på trofæhylden (eller dens usynlige tastaturknap) åbner en lille oversigt over priser, kuponer og licenser.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { KontorRenderer } from '../../render/office';
import { FASE_FARVE } from '../../render/palette';
import { PHASES, type GameState, type Phase } from '../../sim/types';
import { Btn, Ikon, Modal, type IkonNavn } from './kit';
import { FASE_NAVN, HALL_OF_FAME_KRAV } from '../lib/devHjaelp';
import { trofaeOversigt, type LicensLinje } from '../lib/trofaeHjaelp';
import { useReduceretBevaegelse } from '../hooks/useMedia';


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

/** Tastatur/skærmlæser-adgang til medarbejderne og trofæhylden (canvas kan ikke fokuseres). Usynlige, indtil de får fokus. */
function MedarbejderKnapper({ onTrofaeer }: { onTrofaeer: () => void }) {
  const staff = useGame(useShallow((s) => (s.game?.staff ?? []).map((m) => `${m.id}|${m.navn}`)));
  const aabn = useUi((s) => s.aabn);
  const knap =
    'sr-only focus:not-sr-only focus:pointer-events-auto focus:absolute focus:bottom-2 focus:left-2 focus:z-10 focus:min-h-[44px] focus:rounded-md focus:border-2 focus:border-line focus:bg-gold focus:px-3 focus:font-bold focus:text-line';
  return (
    <ul className="pointer-events-none absolute inset-0 m-0 list-none p-0" aria-label="Medarbejdere og trofæer i kontoret">
      {staff.map((x) => {
        const [id, navn] = x.split('|');
        return (
          <li key={id}>
            <button type="button" data-testid={`kontor-medarbejder-${id}`} onClick={() => aabn({ kind: 'medarbejder', staffId: id })} className={knap}>
              Åbn {navn}
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" data-testid="kontor-trofaehylde" onClick={onTrofaeer} className={knap}>
          Se trofæhylden
        </button>
      </li>
    </ul>
  );
}

// ---------- Trofæhylden: lille oversigt ----------

function Hylde({ ikon, farve, titel, antal, tom, children, testId }: { ikon: IkonNavn; farve: string; titel: string; antal: number; tom: string; children: ReactNode; testId: string }) {
  return (
    <section className="rounded-md border-2 border-line bg-bg2 p-2" data-testid={testId}>
      <h3 className="mb-1 flex items-center justify-between gap-2 font-pixel text-xs font-black uppercase">
        <span className="flex items-center gap-1.5">
          <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={14} /> {titel}
        </span>
        <span className="tal" style={{ color: farve }}>
          {antal}
        </span>
      </h3>
      {antal === 0 ? <p className="text-xs text-muted">{tom}</p> : children}
    </section>
  );
}

const LICENS_STIL: Record<LicensLinje['status'], { ikon: IkonNavn; farve: string; tekst: string }> = {
  aktiv: { ikon: 'flueben', farve: 'var(--color-good)', tekst: 'Aktiv' },
  ansoegt: { ikon: 'ur', farve: 'var(--color-sky)', tekst: 'Ansøgt' },
  suspenderet: { ikon: 'advarsel', farve: 'var(--color-bad)', tekst: 'Suspenderet' },
  inddraget: { ikon: 'kryds', farve: 'var(--color-bad)', tekst: 'Inddraget' },
};

function TrofaeOversigt({ g, onLuk }: { g: GameState; onLuk: () => void }) {
  const t = useMemo(() => trofaeOversigt(g), [g]);
  const setPanel = useUi((s) => s.setPanel);
  const reduceret = useReduceretBevaegelse();
  const seAlt = () => {
    onLuk();
    setPanel('firma');
    // panelet skal først monteres, før der kan rulles til trofæafsnittet
    setTimeout(() => document.getElementById('firma-trofaeer')?.scrollIntoView({ block: 'start', behavior: reduceret ? 'auto' : 'smooth' }), 60);
  };
  return (
    <Modal
      titel="Trofæhylden"
      onLuk={onLuk}
      bredde={520}
      testId="dialog-trofaeer"
      fod={
        <>
          <Btn variant="ghost" onClick={onLuk} testId="trofaeer-luk">
            Luk
          </Btn>
          <Btn variant="primaer" onClick={seAlt} testId="trofaeer-firma">
            <Ikon navn="firma" /> Se alt under Firma
          </Btn>
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">{t.tekst}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Hylde ikon="trofae" farve="var(--color-gold)" titel="Gallapriser" antal={t.priserIalt} tom="Branchegallaen er i december. Hylden er støvet af." testId="trofaeer-galla">
          <ul className="flex flex-col gap-0.5 text-sm">
            {t.priser.map((p) => (
              <li key={p.aar} className="flex gap-2">
                <span className="tal font-pixel font-black text-gold">{p.aar}</span>
                <span className="min-w-0 text-ink">{p.navne.join(', ')}</span>
              </li>
            ))}
          </ul>
        </Hylde>
        <Hylde ikon="stjerne" farve="var(--color-gold)" titel="Guldkuponer" antal={t.kuponerIalt} tom="32 point eller mere hos de fire anmeldere." testId="trofaeer-kuponer">
          <ul className="flex flex-col gap-0.5 text-sm">
            {t.kuponer.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{p.navn}</span>
                <span className="tal shrink-0 font-pixel text-xs font-bold text-gold">{p.total40}/40</span>
              </li>
            ))}
            {t.kuponerIalt > t.kuponer.length && <li className="text-xs text-muted">… og {t.kuponerIalt - t.kuponer.length} ældre</li>}
          </ul>
        </Hylde>
        <Hylde ikon="krone" farve="var(--color-violet)" titel="Hall of Fame" antal={t.hof.length} tom={HALL_OF_FAME_KRAV} testId="trofaeer-hof">
          <ul className="flex flex-col gap-0.5 text-sm">
            {t.hof.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{p.navn}</span>
                <span className="tal shrink-0 font-pixel text-xs font-bold text-violet">{p.total40}/40</span>
              </li>
            ))}
          </ul>
        </Hylde>
        <Hylde ikon="paragraf" farve="var(--color-sky)" titel="Licenser" antal={t.licenser.length} tom="Ingen licenser endnu. De hænger på væggen, når tilsynet har sagt ja." testId="trofaeer-licenser">
          <ul className="flex flex-col gap-0.5 text-sm">
            {t.licenser.map((l) => {
              const s = LICENS_STIL[l.status];
              return (
                <li key={l.marked} className="flex items-center justify-between gap-2" data-testid={`trofaeer-licens-${l.marked}`}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-3 w-[15px] shrink-0 overflow-hidden rounded-[1px] border border-line" aria-hidden>
                      {l.farver.map((f, i) => (
                        <span key={i} className="h-full flex-1" style={{ background: f }} />
                      ))}
                    </span>
                    <span className="truncate">{l.navn}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-pixel text-[0.68rem] font-bold uppercase" style={{ color: s.farve }}>
                    <Ikon navn={s.ikon} farve={s.farve} str={11} /> {s.tekst}
                  </span>
                </li>
              );
            })}
          </ul>
        </Hylde>
      </div>
    </Modal>
  );
}

export default function OfficeCanvas() {
  const boks = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [trofaeer, setTrofaeer] = useState(false);
  const g = useGame((s) => (trofaeer ? s.game : null));
  useEffect(() => {
    if (!boks.current || !cv.current) return;
    const r = new KontorRenderer(cv.current, boks.current, { onTrofaeer: () => setTrofaeer(true) });
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
        <MedarbejderKnapper onTrofaeer={() => setTrofaeer(true)} />
      </div>
      {trofaeer && g && createPortal(<TrofaeOversigt g={g} onLuk={() => setTrofaeer(false)} />, document.body)}
    </div>
  );
}
