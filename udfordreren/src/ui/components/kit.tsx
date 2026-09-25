// Fælles UI-kit i Game Dev Story-ånd: tykke kanter, klodsede knapper, pixel-ikoner. Touch-mål ≥ 44 px.
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';

// ---------- Pixel-ikoner (8×8, procedurale — ingen emoji eller eksterne assets) ----------
const IKONER: Record<string, string[]> = {
  penge: ['..####..', '.#oooo#.', '#oo##oo#', '#o#oo#o#', '#o#oo#o#', '#oo##oo#', '.#oooo#.', '..####..'],
  indsigt: ['..####..', '.#oooo#.', '#oooooo#', '#oooooo#', '.#oooo#.', '..#oo#..', '..####..', '...##...'],
  hype: ['...#....', '..#o#...', '..#oo#..', '.#oooo#.', '#oo##oo#', '#o#..#o#', '#oo##oo#', '.######.'],
  stjerne: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '.#....#.', '........'],
  trofae: ['########', '#oooooo#', '.#oooo#.', '.#oooo#.', '..#oo#..', '...##...', '..####..', '.######.'],
  folk: ['.##..##.', '.##..##.', '........', '####.###', '####.###', '####.###', '.##...#.', '........'],
  ur: ['..####..', '.#oooo#.', '#ooo#oo#', '#ooo#oo#', '#ooo##o#', '#oooooo#', '.#oooo#.', '..####..'],
  pause: ['........', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '........'],
  play: ['.#......', '.##.....', '.###....', '.####...', '.####...', '.###....', '.##.....', '.#......'],
  hurtig: ['#...#...', '##..##..', '###.###.', '########', '########', '###.###.', '##..##..', '#...#...'],
  hitliste: ['........', '......##', '......##', '...##.##', '...##.##', '##.##.##', '##.##.##', '########'],
  op: ['...##...', '..####..', '.######.', '########', '...##...', '...##...', '...##...', '........'],
  ned: ['........', '...##...', '...##...', '...##...', '########', '.######.', '..####..', '...##...'],
  laas: ['..####..', '.#....#.', '.#....#.', '########', '###..###', '###..###', '########', '........'],
  flueben: ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
  kryds: ['#......#', '##....##', '.##..##.', '..####..', '..####..', '.##..##.', '##....##', '#......#'],
  tandhjul: ['..#..#..', '.######.', '##o##o##', '.#o..o#.', '.#o..o#.', '##o##o##', '.######.', '..#..#..'],
  gem: ['#######.', '#o###o##', '#o###o##', '#ooooo##', '#######.', '#.....#.', '#.....#.', '#######.'],
  advarsel: ['...##...', '..####..', '..#oo#..', '.##oo##.', '.##oo##.', '########', '###oo###', '########'],
  hus: ['...##...', '..####..', '.######.', '########', '.#oo#o#.', '.#oo#o#.', '.#oo###.', '.######.'],
  bog: ['.######.', '#o#oooo#', '#o#oooo#', '#o#oooo#', '#o#oooo#', '#o#oooo#', '#o######', '.#######'],
  kort: ['########', '#oo#ooo#', '#o###oo#', '#oo#ooo#', '#ooo#oo#', '#oo###o#', '#ooo#oo#', '########'],
  nyhed: ['########', '#oooooo#', '#o##ooo#', '#o##o#o#', '#ooooo##', '#o####o#', '#oooooo#', '########'],
  kontrakt: ['.######.', '.#oooo#.', '.#o##o#.', '.#oooo#.', '.#o###..', '.#ooo#.#', '.####.##', '......#.'],
  produkt: ['.######.', '#oooooo#', '#o#oo#o#', '#oooooo#', '#o####o#', '#oooooo#', '.######.', '..#..#..'],
  firma: ['.#####..', '.#o#o#..', '.#####..', '.#o#o###', '.#####o#', '.#o#o###', '.#####o#', '########'],
  pil: ['........', '....#...', '....##..', '#######.', '#######.', '....##..', '....#...', '........'],
  // + shell-sporet: HUD, indstillinger, nyheder, gem/indlæs
  skjold: ['########', '#oooooo#', '#oo##oo#', '#o####o#', '.#o##o#.', '.#oooo#.', '..#oo#..', '...##...'],
  globus: ['..####..', '.#o##o#.', '#o#oo#o#', '########', '#o#oo#o#', '#o#oo#o#', '.#o##o#.', '..####..'],
  lyn: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
  hoejttaler: ['........', '...#..#.', '..##...#', '####.#.#', '####.#.#', '..##...#', '...#..#.', '........'],
  noder: ['...#####', '...#####', '...#...#', '...#...#', '...#...#', '.###.###', '####.###', '.##...#.'],
  tekst: ['........', '.##.....', '#..#....', '#..#.##.', '####...#', '#..#.###', '#..##..#', '#..#.###'],
  klokke: ['...##...', '..####..', '.#oooo#.', '.#oooo#.', '.#oooo#.', '########', '........', '...##...'],
  download: ['...##...', '...##...', '...##...', '.######.', '..####..', '...##...', '#......#', '########'],
  upload: ['...##...', '..####..', '.######.', '...##...', '...##...', '...##...', '#......#', '########'],
  papirkurv: ['..####..', '########', '.#oooo#.', '.#o##o#.', '.#o##o#.', '.#o##o#.', '.#oooo#.', '..####..'],
  diamant: ['........', '...##...', '..####..', '.######.', '.######.', '..####..', '...##...', '........'],
  krone: ['........', '#..##..#', '##.##.##', '########', '#oooooo#', '########', '########', '........'],
  bille: ['.#....#.', '..#..#..', '..####..', '#.#oo#.#', '.######.', '#.#oo#.#', '.######.', '#..##..#'],
  doer: ['.######.', '.#oooo#.', '.#oooo#.', '.#oooo#.', '.#oo#o#.', '.#oooo#.', '.#oooo#.', '########'],
  // + dev-sporet: projekter, kombinationsbog, anmeldelser
  terning: ['.######.', '#oooooo#', '#o#oo#o#', '#oooooo#', '#oooooo#', '#o#oo#o#', '#oooooo#', '.######.'],
  spoergsmaal: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '...##...', '........', '...##...'],
  raket: ['...##...', '..####..', '..#oo#..', '..####..', '..####..', '.######.', '#.####.#', '...##...'],
  plus: ['........', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........'],
  streg: ['........', '........', '........', '.######.', '.######.', '........', '........', '........'],
  // + firma-sporet: personale, marked, firma og kalender
  kalender: ['.#....#.', '########', '########', '#oooooo#', '#o#o#oo#', '#oooooo#', '#o#oo#o#', '########'],
  kolbe: ['..####..', '...##...', '...##...', '..#oo#..', '.#oooo#.', '#oo##oo#', '#o####o#', '########'],
  noegle: ['..####..', '.#o##o#.', '.#o##o#.', '..####..', '...##...', '...###..', '...##...', '...###..'],
  taske: ['..####..', '..#..#..', '########', '#oooooo#', '########', '#oooooo#', '#oooooo#', '########'],
  stjerneTom: ['...##...', '...##...', '########', '.#oooo#.', '..#oo#..', '.##..##.', '.#....#.', '........'],
  // + tværs-sporet: markeder, regler, trends og sportskalender
  bold: ['..####..', '.#oooo#.', '#oo##oo#', '#o####o#', '#o####o#', '#oo##oo#', '.#oooo#.', '..####..'],
  paragraf: ['..####..', '.##..##.', '..##....', '.##.##..', '..##.##.', '....##..', '.##..##.', '..####..'],
  trend: ['...#####', '.....###', '....##.#', '#..##...', '####....', '.##.....', '........', '########'],
  // + konkurrent-sporet: rivaler, platforme og auktioner
  svaerd: ['##....##', '.##..##.', '..####..', '...##...', '..####..', '#.#..#.#', '.#....#.', '#.#..#.#'],
  server: ['########', '#oooo#o#', '########', '#oooo#o#', '########', '#oooo#o#', '########', '.#....#.'],
  hammer: ['.####...', '.####...', '.####...', '...##...', '....##..', '.....##.', '......##', '.######.'],
  // + AI-sporet: laboratoriet, agenter og overvågning
  chip: ['..#..#..', '.######.', '##oooo##', '.#o##o#.', '.#o##o#.', '##oooo##', '.######.', '..#..#..'],
  terminal: ['########', '#oooooo#', '#o#oooo#', '#oo#ooo#', '#o#o##o#', '#oooooo#', '########', '..####..'],
  oeje: ['........', '..####..', '.#oooo#.', '#oo##oo#', '#oo##oo#', '.#oooo#.', '..####..', '........'],
};

export type IkonNavn = keyof typeof IKONER;

export function Ikon({ navn, farve = 'currentColor', indre, str = 16, className, titel }: { navn: IkonNavn; farve?: string; indre?: string; str?: number; className?: string; titel?: string }) {
  const rows = IKONER[navn] ?? IKONER.kryds;
  const rects: ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === '#') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={farve} />);
      else if (c === 'o' && indre) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={indre} />);
    }),
  );
  return (
    <svg viewBox="0 0 8 8" width={str} height={str} shapeRendering="crispEdges" className={className} aria-hidden={titel ? undefined : true} role={titel ? 'img' : undefined}>
      {titel ? <title>{titel}</title> : null}
      {rects}
    </svg>
  );
}

// ---------- Knapper ----------
type BtnVariant = 'primaer' | 'sekundaer' | 'fare' | 'god' | 'ghost';
const BTN_FARVER: Record<BtnVariant, string> = {
  primaer: 'bg-gold text-line hover:brightness-110',
  sekundaer: 'bg-panel2 text-ink hover:bg-hi',
  fare: 'bg-bad text-line hover:brightness-110',
  god: 'bg-good text-line hover:brightness-110',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-panel2 shadow-none',
};

export function Btn({
  children, onClick, variant = 'sekundaer', disabled, title, className = '', lille, type = 'button', testId, ariaLabel,
}: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant; disabled?: boolean; title?: string; className?: string; lille?: boolean;
  type?: 'button' | 'submit'; testId?: string; ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-line font-bold select-none transition-[transform,filter] duration-75 ${
        lille ? 'min-h-9 px-2.5 text-sm' : 'min-h-[44px] px-3.5'
      } ${BTN_FARVER[variant]} ${variant === 'ghost' ? '' : 'pixel-skygge active:translate-y-[2px] active:shadow-none'} disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

// ---------- Paneler og layout ----------
export function Panel({ titel, hoejre, children, className = '', ikon, testId }: { titel?: ReactNode; hoejre?: ReactNode; children: ReactNode; className?: string; ikon?: IkonNavn; testId?: string }) {
  return (
    <section data-testid={testId} className={`rounded-lg border-2 border-line bg-panel pixel-skygge ${className}`}>
      {titel !== undefined && (
        <header className="flex items-center justify-between gap-2 border-b-2 border-line bg-panel2 px-3 py-2 rounded-t-md">
          <h2 className="flex items-center gap-2 font-pixel text-sm font-bold uppercase tracking-wider text-ink">
            {ikon && <Ikon navn={ikon} farve="var(--color-gold)" indre="var(--color-line)" />}
            {titel}
          </h2>
          {hoejre}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Bar({ vaerdi, max = 100, farve = 'var(--color-good)', hoejde = 8, label, visTal }: { vaerdi: number; max?: number; farve?: string; hoejde?: number; label?: string; visTal?: boolean }) {
  const p = Math.max(0, Math.min(1, max > 0 ? vaerdi / max : 0));
  return (
    <div className="w-full" aria-label={label}>
      {(label || visTal) && (
        <div className="mb-0.5 flex justify-between text-xs text-muted">
          <span>{label}</span>
          {visTal && <span className="tal">{Math.round(vaerdi)}</span>}
        </div>
      )}
      <div className="w-full overflow-hidden rounded-sm border-2 border-line bg-bg" style={{ height: hoejde + 4 }}>
        <div className="h-full transition-[width] duration-300" style={{ width: `${p * 100}%`, background: farve }} />
      </div>
    </div>
  );
}

export function Stat({ label, vaerdi, farve, ikon, titel }: { label: string; vaerdi: ReactNode; farve?: string; ikon?: IkonNavn; titel?: string }) {
  return (
    <div className="flex items-center gap-1.5" title={titel}>
      {ikon && <Ikon navn={ikon} farve={farve ?? 'var(--color-ink)'} indre="var(--color-line)" />}
      <div className="leading-tight">
        <div className="text-[0.68rem] uppercase tracking-wide text-muted">{label}</div>
        <div className="tal font-pixel text-sm font-bold" style={{ color: farve }}>
          {vaerdi}
        </div>
      </div>
    </div>
  );
}

export function Badge({ children, farve = 'var(--color-hi)', tekstFarve = 'var(--color-ink)', className = '' }: { children: ReactNode; farve?: string; tekstFarve?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 font-pixel text-[0.68rem] font-bold uppercase leading-none ${className}`} style={{ background: farve, color: tekstFarve }}>
      {children}
    </span>
  );
}

/** Konkurrenter vises som farvede monogrammer — aldrig logoer */
export function Monogram({ tekst, farve, str = 28 }: { tekst: string; farve: string; str?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded border-2 border-line font-pixel font-black text-white"
      style={{ width: str, height: str, background: farve, fontSize: Math.max(9, str * (tekst.length > 2 ? 0.3 : 0.4)), textShadow: '1px 1px 0 #0008' }}
      aria-hidden
    >
      {tekst}
    </span>
  );
}

const FOKUSERBAR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Er dette den øverste åbne dialog? (fx en signal-dialog oven på en åben menu) */
function erOeverst(el: HTMLElement | null): boolean {
  const alle = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return alle.length === 0 || alle[alle.length - 1] === el;
}

export function Modal({
  titel, onLuk, children, bredde = 560, lukbar = true, testId, fod,
}: { titel: ReactNode; onLuk?: () => void; children: ReactNode; bredde?: number; lukbar?: boolean; testId?: string; fod?: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const lukRef = useRef<{ lukbar: boolean; onLuk?: () => void }>({ lukbar, onLuk });
  useEffect(() => {
    lukRef.current = { lukbar, onLuk };
  }, [lukbar, onLuk]);

  // Fokus: selve dialogen (ikke dens første knap — så mellemrum/Enter ikke vælger noget ved et uheld).
  // Tab holdes inde i den øverste dialog, og fokus gives tilbage til det, der havde det før, når dialogen lukkes.
  useEffect(() => {
    const el = ref.current;
    const forrige = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (!el || !erOeverst(el)) return;
      if (e.key === 'Escape') {
        const { lukbar: kan, onLuk: luk } = lukRef.current;
        if (kan && luk) luk();
        return;
      }
      if (e.key !== 'Tab') return;
      const liste = [...el.querySelectorAll<HTMLElement>(FOKUSERBAR)].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (liste.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const foerste = liste[0];
      const sidste = liste[liste.length - 1];
      const aktiv = document.activeElement;
      const inde = aktiv instanceof Node && el.contains(aktiv);
      if (e.shiftKey && (aktiv === foerste || aktiv === el || !inde)) {
        e.preventDefault();
        sidste.focus();
      } else if (!e.shiftKey && (aktiv === sidste || !inde)) {
        e.preventDefault();
        foerste.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      // Giv fokus tilbage (kun hvis elementet stadig findes og er synligt, og fokus ikke allerede er flyttet til en anden dialog)
      const nu = document.activeElement;
      const fokusErVaek = !nu || nu === document.body || (el?.contains(nu) ?? false);
      if (forrige && fokusErVaek && forrige.isConnected && forrige.offsetParent !== null) forrige.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-line/70 p-0 sm:items-center sm:p-4" role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        data-testid={testId}
        className="anim-pop flex max-h-[92dvh] w-full flex-col rounded-t-xl border-2 border-line bg-panel pixel-kant outline-none sm:rounded-xl"
        style={{ maxWidth: bredde }}
      >
        <header className="flex items-center justify-between gap-2 border-b-2 border-line bg-panel2 px-4 py-1.5 sm:rounded-t-xl">
          <h2 id={id} className="font-pixel text-base font-bold uppercase tracking-wider">
            {titel}
          </h2>
          {lukbar && onLuk && (
            <Btn variant="ghost" onClick={onLuk} ariaLabel="Luk" testId="modal-luk" className="-mr-2 min-w-[44px] px-0">
              <Ikon navn="kryds" />
            </Btn>
          )}
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${fod ? '' : 'pb-[max(16px,env(safe-area-inset-bottom))] sm:pb-4'}`}>{children}</div>
        {fod && (
          <footer className="flex flex-wrap justify-end gap-2 border-t-2 border-line bg-bg2 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:rounded-b-xl sm:pb-3">
            {fod}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Faner<T extends string>({ valg, vaerdi, onSkift, className = '' }: { valg: { id: T; navn: string; ikon?: IkonNavn; badge?: ReactNode }[]; vaerdi: T; onSkift: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto ${className}`}>
      {valg.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={v.id === vaerdi}
          data-testid={`fane-${v.id}`}
          onClick={() => onSkift(v.id)}
          className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border-2 border-line px-3 font-pixel text-xs font-bold uppercase tracking-wide ${
            v.id === vaerdi ? 'bg-gold text-line' : 'bg-panel2 text-muted hover:text-ink'
          }`}
        >
          {v.ikon && <Ikon navn={v.ikon} farve="currentColor" indre={v.id === vaerdi ? 'var(--color-gold)' : 'var(--color-panel2)'} />}
          <span>{v.navn}</span>
          {v.badge}
        </button>
      ))}
    </div>
  );
}

export function Skyder({ min, max, trin = 1, vaerdi, onSkift, label, vis, testId }: { min: number; max: number; trin?: number; vaerdi: number; onSkift: (v: number) => void; label: string; vis?: (v: number) => ReactNode; testId?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tal font-pixel font-bold">{vis ? vis(vaerdi) : vaerdi}</span>
      </label>
      <input
        id={id}
        data-testid={testId}
        type="range"
        min={min}
        max={max}
        step={trin}
        value={vaerdi}
        onChange={(e) => onSkift(Number(e.target.value))}
        className="h-[44px] w-full cursor-pointer accent-[var(--color-gold)]"
      />
    </div>
  );
}

export function Tom({ children }: { children: ReactNode }) {
  return <div className="rounded-md border-2 border-dashed border-hi p-4 text-center text-sm text-muted">{children}</div>;
}

export function Tip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p className="rounded-md border-2 border-line bg-bg2 px-3 py-2 text-sm text-muted" style={style}>
      {children}
    </p>
  );
}
