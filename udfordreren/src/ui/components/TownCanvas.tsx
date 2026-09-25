// Spillerbyen (spec 6.14): en lille procedural pixelby (huse, fortov, gågade) med op til 200 pixelpersoner.
// Farve + markør pr. profil: VIP = guld med krone, risiko = gul med udråbstegn, problem = rød med advarselsskilt,
// rekreativ og engageret i rolige toner (engagerede kigger på telefonen). 'churnet' tegnes ikke — heller ikke dem,
// der forsvandt stille ved selvudelukkelse. Blid idle-animation ved ca. 12 fps; ved reduceret bevægelse står alle stille.
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { MarketId, TownPerson, TownProfile } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { HAAR, HUD, T } from '../../render/palette';
import { PROFIL_STIL, personTekst } from '../lib/byHjaelp';

// ---------- Sprites (deles med SVG-ikonet i forklaringen) ----------

/** Pixelperson 3×6. h = hår, s = hud, b = trøje (profilfarve), p = bukser, c = telefon (kun engagerede) */
const KROP = ['.h.', '.s.', 'bbb', 'bbb', '.p.'];
const BEN = ['p.p', '.p.'] as const; // stå / skridt

type Markoer = { kerne: string[]; farver: Record<string, string> };

/** Markører over hovedet. Omrids i linjefarve lægges på automatisk. */
const MARKOERER: Partial<Record<TownProfile, Markoer>> = {
  vip: { kerne: ['g.g.g', 'GGGGG'], farver: { g: T.gold, G: '#e0a91f' } },
  risiko: { kerne: ['y', 'y', 'y', '.', 'y'], farver: { y: PROFIL_STIL.risiko.farve } },
  problem: { kerne: ['..r..', '.rwr.', '.rwr.', 'rrrrr', 'rrwrr'], farver: { r: T.bad, w: '#ffffff' } },
};

const BUKSER = ['#2b3050', '#3a3346', '#27343d', '#403a2e'] as const;
const SILHUET = T.hi;
const TELEFON = T.cyan;

/** Deterministisk hash (til udseende og bevægelse pr. person) */
function hash(n: number): number {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Udseende = { hud: string; haar: string; bukser: string; amp: number; fart: number; fase: number; ampY: number };

function udseende(id: number): Udseende {
  const h = hash(id);
  return {
    hud: HUD[h % HUD.length],
    haar: HAAR[(h >>> 4) % HAAR.length],
    bukser: BUKSER[(h >>> 8) % BUKSER.length],
    amp: [0, 1, 2, 2, 3, 4][(h >>> 11) % 6],
    fart: 0.35 + ((h >>> 14) % 9) * 0.07,
    fase: ((h >>> 18) % 628) / 100,
    ampY: (h >>> 27) % 3 === 0 ? 1 : 0,
  };
}

function troejeFarve(p: TownProfile): string {
  return PROFIL_STIL[p].farve;
}

/** Tegn markør med 1 px omrids i linjefarve på et lille lærred (gøres én gang) */
function markoerLag(m: Markoer): HTMLCanvasElement {
  const w = m.kerne[0].length + 2;
  const h = m.kerne.length + 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = T.line;
  m.kerne.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
    }),
  );
  m.kerne.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = m.farver[ch] ?? T.ink;
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }),
  );
  return c;
}

// ---------- Baggrunden: huse, fortov og gågade ----------

const FACADER = ['#5a3f3a', '#4f4a2e', '#2f4a4f', '#4a3a5a', '#3a4a38', '#5a4a38', '#3b4466', '#5a3a4a', '#474b5e'] as const;
const TAG = ['#2b2130', '#3a2426', '#22283a', '#2e2a22'] as const;

export function husHoejde(H: number): number {
  return Math.max(20, Math.min(40, Math.round(H * 0.27)));
}

function tegnBaggrund(W: number, H: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const r = mulberry(seed);
  const hb = husHoejde(H);

  // Himmel og stjerner
  ctx.fillStyle = '#12152a';
  ctx.fillRect(0, 0, W, hb);
  for (let i = 0; i < W / 6; i++) {
    ctx.fillStyle = r() < 0.3 ? '#6d7299' : '#343a63';
    ctx.fillRect(Math.floor(r() * W), Math.floor(r() * hb * 0.5), 1, 1);
  }
  // Månen
  const mx = W - 10 - Math.floor(r() * 12);
  ctx.fillStyle = '#e8e2c8';
  ctx.fillRect(mx, 3, 3, 4);
  ctx.fillRect(mx - 1, 4, 5, 2);
  ctx.fillStyle = '#12152a';
  ctx.fillRect(mx + 1, 3, 2, 3);

  // Gågaden: brosten
  ctx.fillStyle = '#1f2338';
  ctx.fillRect(0, hb, W, H - hb);
  for (let y = hb + 2; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = hash(x * 7919 + y * 104729 + seed) / 4294967296;
      if (v < 0.07) {
        ctx.fillStyle = '#272c46';
        ctx.fillRect(x, y, 1, 1);
      } else if (v < 0.1) {
        ctx.fillStyle = '#1a1d30';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // En rende midt på gaden
  const rende = hb + Math.round((H - hb) * 0.55);
  for (let x = 0; x < W; x += 3) {
    ctx.fillStyle = '#191c2e';
    ctx.fillRect(x, rende, 2, 1);
  }

  // Husrækken (skiftende gavle, facader og vinduer)
  let x = -Math.floor(r() * 6);
  const butik = Math.floor(W / 2);
  while (x < W) {
    const w = 9 + Math.floor(r() * 8);
    const fh = Math.round(hb * (0.42 + r() * 0.28));
    const top = hb - fh;
    const facade = FACADER[Math.floor(r() * FACADER.length)];
    const tag = TAG[Math.floor(r() * TAG.length)];
    const gavl = r();
    // Tag/gavl
    ctx.fillStyle = tag;
    if (gavl < 0.45) {
      // Spids gavl
      const th = Math.min(Math.ceil(w / 2), 3 + Math.floor(r() * 3));
      for (let i = 0; i < th; i++) {
        const ind = Math.round(((th - i) * w) / (2 * (th + 1)));
        ctx.fillRect(x + ind, top - th + i, w - ind * 2, 1);
      }
    } else if (gavl < 0.75) {
      // Trappegavl i facadens farve
      ctx.fillStyle = facade;
      const trin = 3;
      for (let i = 0; i < trin; i++) {
        const ind = Math.round((i * w) / (2 * (trin + 0.5)));
        ctx.fillRect(x + ind, top - (i + 1) * 2, w - ind * 2, 2);
      }
    } else {
      // Fladt tag med gesims
      ctx.fillRect(x - 1, top - 1, w + 2, 1);
    }
    // Facade
    ctx.fillStyle = facade;
    ctx.fillRect(x, top, w, fh);
    ctx.fillStyle = '#0003';
    ctx.fillRect(x + w - 1, top, 1, fh);
    // Vinduer
    for (let wy = top + 2; wy < hb - 5; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const t = r();
        ctx.fillStyle = t < 0.28 ? '#c9a55a' : t < 0.45 ? '#7f95c9' : '#1a1d33';
        ctx.fillRect(wx, wy, 1, 2);
      }
    }
    // Dør (eller butiksfacade med neonskilt midt i gaden — jeres egen butik)
    const erButik = x <= butik && butik < x + w && w >= 11;
    if (erButik) {
      ctx.fillStyle = '#10131f';
      ctx.fillRect(x + 2, hb - 5, w - 4, 5);
      ctx.fillStyle = T.cyan;
      ctx.fillRect(x + 2, hb - 7, w - 4, 1);
      ctx.fillStyle = '#2a8f88';
      ctx.fillRect(x + 3, hb - 4, w - 6, 1);
    } else {
      ctx.fillStyle = '#1b1416';
      ctx.fillRect(x + Math.floor(w / 2) - 1, hb - 4, 2, 4);
    }
    x += w + (r() < 0.25 ? 1 : 0);
  }

  // Fortov
  ctx.fillStyle = '#3b4165';
  ctx.fillRect(0, hb, W, 2);
  ctx.fillStyle = '#4a5282';
  ctx.fillRect(0, hb, W, 1);

  // Lygtepæle langs fortovet
  for (let lx = 12 + Math.floor(r() * 10); lx < W - 4; lx += 34 + Math.floor(r() * 18)) {
    ctx.fillStyle = '#0d0f1c';
    ctx.fillRect(lx, hb - 7, 1, 9);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(lx - 1, hb - 8, 3, 1);
    ctx.fillStyle = '#8a7d5a';
    ctx.fillRect(lx, hb - 9, 1, 1);
  }

  // Træer og bænke ved gadens kant (nederst)
  const traeer = Math.max(2, Math.round(W / 55));
  for (let i = 0; i < traeer; i++) {
    const tx = Math.round(((i + 0.5) * W) / traeer + (r() - 0.5) * 16);
    const ty = H - 3;
    ctx.fillStyle = '#3b2e25';
    ctx.fillRect(tx, ty - 3, 1, 4);
    ctx.fillStyle = '#23402f';
    ctx.fillRect(tx - 3, ty - 8, 7, 5);
    ctx.fillRect(tx - 2, ty - 9, 5, 7);
    ctx.fillStyle = '#2f5a3c';
    ctx.fillRect(tx - 2, ty - 8, 3, 3);
    ctx.fillRect(tx - 1, ty - 9, 2, 1);
    // Bænk ved siden af
    if (r() < 0.6) {
      const bx = tx + 6;
      ctx.fillStyle = '#5a4a38';
      ctx.fillRect(bx, ty - 2, 5, 1);
      ctx.fillStyle = '#3a3026';
      ctx.fillRect(bx, ty - 1, 1, 2);
      ctx.fillRect(bx + 4, ty - 1, 1, 2);
    }
  }
  return c;
}

// ---------- Tegning af personer ----------

type Placeret = { p: TownPerson; x: number; y: number; u: Udseende };

function placer(personer: TownPerson[], W: number, H: number): Placeret[] {
  const hb = husHoejde(H);
  const y0 = hb + 8;
  const y1 = H - 2;
  return personer
    .map((p) => ({ p, x: 1 + Math.round(p.x * (W - 6)), y: y0 + Math.round(p.y * Math.max(1, y1 - y0)), u: udseende(p.id) }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function tegnPerson(ctx: CanvasRenderingContext2D, pl: Placeret, x: number, fod: number, skridt: boolean, silhuet: boolean): void {
  const top = fod - 5;
  const rows = [...KROP, skridt ? BEN[1] : BEN[0]];
  const troeje = silhuet ? SILHUET : troejeFarve(pl.p.profil);
  rows.forEach((r, y) => {
    for (let i = 0; i < 3; i++) {
      const ch = r[i];
      if (ch === '.') continue;
      ctx.fillStyle = silhuet ? SILHUET : ch === 'h' ? pl.u.haar : ch === 's' ? pl.u.hud : ch === 'b' ? troeje : pl.u.bukser;
      ctx.fillRect(x + i, top + y, 1, 1);
    }
  });
  if (!silhuet && pl.p.profil === 'engageret') {
    ctx.fillStyle = TELEFON;
    ctx.fillRect(x + 2, top + 1, 1, 1);
  }
}

// ---------- Komponenten ----------

export type ByFilter = MarketId | null;

export default function TownCanvas({ filter, className = '', ariaLabel }: { filter: ByFilter; className?: string; ariaLabel: string }) {
  const by = useGame((s) => s.game?.by);
  const seed = useGame((s) => s.game?.seed ?? 1);
  const red = useReduceretBevaegelse();
  const boks = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [str, setStr] = useState<{ w: number; h: number; dpr: number } | null>(null);
  const [valgt, setValgt] = useState<number | null>(null);

  // Mål boksen (CSS-pixels og skærmens tæthed)
  useEffect(() => {
    const el = boks.current;
    if (!el) return;
    const maal = () => {
      const r = el.getBoundingClientRect();
      setStr((f) => {
        const w = Math.floor(r.width);
        const h = Math.floor(r.height);
        const dpr = window.devicePixelRatio || 1;
        return f && f.w === w && f.h === h && f.dpr === dpr ? f : { w, h, dpr };
      });
    };
    const ro = new ResizeObserver(maal);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Logisk opløsning: hele device-pixels pr. bypixel (skarpe kanter på alle skærme)
  const geo = useMemo(() => {
    if (!str || str.w < 40 || str.h < 40) return null;
    const S = str.w >= 1100 ? 4 : str.w >= 260 ? 3 : 2;
    const P = Math.max(1, Math.round(S * str.dpr));
    const W = Math.floor((str.w * str.dpr) / P);
    const H = Math.floor((str.h * str.dpr) / P);
    return { P, W, H, cssW: (W * P) / str.dpr, cssH: (H * P) / str.dpr };
  }, [str]);

  const baggrund = useMemo(() => (geo ? tegnBaggrund(geo.W, geo.H, seed) : null), [geo, seed]);
  const markoerer = useMemo(() => {
    const m: Partial<Record<TownProfile, HTMLCanvasElement>> = {};
    if (typeof document === 'undefined') return m;
    for (const [k, v] of Object.entries(MARKOERER)) m[k as TownProfile] = markoerLag(v);
    return m;
  }, []);

  const aktive = useMemo(() => (by ?? []).filter((p) => p.profil !== 'churnet'), [by]);
  const placeret = useMemo(() => (geo ? placer(aktive, geo.W, geo.H) : []), [aktive, geo]);

  // Nye kunder toner blidt frem (ikke ved første visning, og ikke ved reduceret bevægelse)
  const ankomst = useRef(new Map<number, number>());
  const kendte = useRef<Set<number> | null>(null);
  useEffect(() => {
    const nu = performance.now();
    const forrige = kendte.current;
    const ny = new Set<number>();
    for (const p of aktive) {
      ny.add(p.id);
      if (forrige && !forrige.has(p.id)) ankomst.current.set(p.id, nu);
    }
    for (const id of [...ankomst.current.keys()]) if (!ny.has(id)) ankomst.current.delete(id);
    kendte.current = ny;
  }, [aktive]);

  // Den valgte person (tryk eller hover). Holder personen op, forsvinder valget stille.
  const valgtPerson = valgt === null ? null : (aktive.find((p) => p.id === valgt && (filter === null || p.marked === filter)) ?? null);

  // Tegn (rAF ved ~12 fps, eller én gang ved reduceret bevægelse)
  useEffect(() => {
    const c = cv.current;
    if (!c || !geo || !baggrund) return;
    const { P, W, H } = geo;
    c.width = W * P;
    c.height = H * P;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const lag = document.createElement('canvas');
    lag.width = W;
    lag.height = H;
    const lctx = lag.getContext('2d')!;

    const tegn = (ms: number) => {
      const t = red ? 0 : ms / 1000;
      lctx.drawImage(baggrund, 0, 0);
      // Blinkende stjerner (kun med bevægelse)
      if (!red) {
        const hb = husHoejde(H);
        for (let i = 0; i < 4; i++) {
          const h = hash(i * 31 + Math.floor(t / 1.7) * 97 + seed);
          lctx.fillStyle = '#c9cce8';
          lctx.fillRect(h % W, (h >>> 12) % Math.max(1, Math.floor(hb * 0.45)), 1, 1);
        }
      }
      const markeringer: { m: HTMLCanvasElement; x: number; y: number; a: number }[] = [];
      let valgtPos: { x: number; y: number } | null = null;
      for (const pl of placeret) {
        const silhuet = filter !== null && pl.p.marked !== filter;
        const u = pl.u;
        const vinkel = u.fart * t + u.fase;
        const dx = red ? 0 : Math.round(u.amp * Math.sin(vinkel));
        const dy = red ? 0 : Math.round(u.ampY * Math.sin(vinkel * 0.5));
        const gaar = !red && u.amp > 0 && Math.abs(Math.cos(vinkel)) > 0.35;
        const skridt = gaar && Math.floor(t * 5 + u.fase) % 2 === 1;
        const x = Math.max(0, Math.min(W - 3, pl.x + dx));
        const fod = pl.y + dy;
        const start = ankomst.current.get(pl.p.id) ?? 0;
        const a = red || start === 0 ? 1 : Math.max(0, Math.min(1, (ms - start) / 800));
        lctx.globalAlpha = silhuet ? 0.35 * a : a;
        tegnPerson(lctx, pl, x, fod, skridt, silhuet);
        lctx.globalAlpha = 1;
        const mk = silhuet ? undefined : markoerer[pl.p.profil];
        if (mk) markeringer.push({ m: mk, x: x + 1 - Math.floor(mk.width / 2), y: fod - 6 - mk.height, a });
        if (pl.p.id === valgtPerson?.id) valgtPos = { x, y: fod };
      }
      // Markører oven på alle personer, så de altid kan ses
      for (const mk of markeringer) {
        lctx.globalAlpha = mk.a;
        lctx.drawImage(mk.m, mk.x, mk.y);
      }
      lctx.globalAlpha = 1;
      if (valgtPos) {
        // Pixelhjørner om den valgte person
        const { x, y } = valgtPos;
        lctx.fillStyle = T.ink;
        const l = x - 2;
        const r = x + 4;
        const o = y - 7;
        const n = y + 1;
        for (const [cx, cy, sx, sy] of [[l, o, 1, 1], [r, o, -1, 1], [l, n, 1, -1], [r, n, -1, -1]] as const) {
          lctx.fillRect(cx, cy, 1, 1);
          lctx.fillRect(cx + sx, cy, 1, 1);
          lctx.fillRect(cx, cy + sy, 1, 1);
        }
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(lag, 0, 0, W * P, H * P);
    };

    if (red) {
      tegn(0);
      return;
    }
    let raf = 0;
    let sidst = -1e9;
    let synlig = true;
    const loop = (ms: number) => {
      raf = requestAnimationFrame(loop);
      if (!synlig || document.hidden) return;
      if (ms - sidst < 83) return;
      sidst = ms;
      tegn(ms);
    };
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((e) => (synlig = e.some((x) => x.isIntersecting))) : null;
    io?.observe(c);
    tegn(performance.now());
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [geo, baggrund, placeret, filter, red, markoerer, valgtPerson, seed]);

  // Tryk/klik: vælg nærmeste person (mus: også ved hover)
  const find = (e: PointerEvent<HTMLCanvasElement>): number | null => {
    if (!geo) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const lx = ((e.clientX - r.left) / r.width) * geo.W;
    const ly = ((e.clientY - r.top) / r.height) * geo.H;
    let bedst: number | null = null;
    let afst = 7 * 7;
    for (const pl of placeret) {
      if (filter !== null && pl.p.marked !== filter) continue;
      const d = (pl.x + 1 - lx) ** 2 + (pl.y - 3 - ly) ** 2;
      if (d < afst) {
        afst = d;
        bedst = pl.p.id;
      }
    }
    return bedst;
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={boks} className={`relative flex items-center justify-center overflow-hidden rounded-md border-2 border-line bg-[#1f2338] ${className}`} data-testid="by-canvas-ramme">
        <canvas
          ref={cv}
          role="img"
          aria-label={ariaLabel}
          data-testid="by-canvas"
          className="pixel block touch-manipulation select-none"
          style={{ width: geo?.cssW ?? '100%', height: geo?.cssH ?? '100%', imageRendering: 'pixelated' }}
          onPointerDown={(e) => setValgt(find(e))}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return;
            const id = find(e);
            if (id !== null && id !== valgt) setValgt(id);
          }}
        />
        {/* Skilt oven på lærredet: på mobil står teksten under lærredet ofte under folden */}
        {valgtPerson && (
          <span
            className="pointer-events-none absolute top-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1.5 rounded border-2 border-line bg-panel/95 px-2 py-1 text-xs pixel-skygge"
            data-testid="by-valgt-skilt"
            aria-hidden
          >
            <PersonIkon profil={valgtPerson.profil} px={2} />
            <span className="min-w-0 truncate font-bold text-ink">{personTekst(valgtPerson)}</span>
          </span>
        )}
      </div>
      <p className="flex min-h-6 items-center gap-1.5 text-xs text-muted" aria-live="polite" data-testid="by-valgt">
        {valgtPerson ? (
          <>
            <PersonIkon profil={valgtPerson.profil} px={2} />
            <span className="min-w-0 truncate font-bold text-ink">{personTekst(valgtPerson)}</span>
          </>
        ) : aktive.length ? (
          <span>Tryk på en person for at se, hvem det er.</span>
        ) : null}
      </p>
    </div>
  );
}

// ---------- SVG-ikon til forklaring, lister og historier (samme pixels som på lærredet) ----------

export function PersonIkon({ profil, px = 3, titel }: { profil: TownProfile; px?: number; titel?: string }) {
  const rects: ReactNode[] = [];
  const mk = MARKOERER[profil];
  // Fast bredde 7 (den bredeste markør med omrids), så ikonerne står på linje i lister
  const W = 7;
  const mH = mk ? mk.kerne.length + 2 + 1 : 0;
  const H = mH + 6;
  const ox0 = 2;
  const top = mH;
  const farve = profil === 'churnet' ? T.dim : troejeFarve(profil);
  const u = { hud: HUD[1], haar: HAAR[1], bukser: BUKSER[0] };
  [...KROP, BEN[0]].forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      const f = profil === 'churnet' ? T.dim : ch === 'h' ? u.haar : ch === 's' ? u.hud : ch === 'b' ? farve : u.bukser;
      rects.push(<rect key={`p${x}-${y}`} x={ox0 + x} y={top + y} width={1} height={1} fill={f} />);
    }),
  );
  if (profil === 'engageret') rects.push(<rect key="tlf" x={ox0 + 2} y={top + 1} width={1} height={1} fill={TELEFON} />);
  if (mk) {
    const mw = mk.kerne[0].length;
    const ox = Math.floor((W - mw) / 2);
    const oy = 1;
    mk.kerne.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch === '.') return;
        rects.push(<rect key={`o${x}-${y}`} x={ox + x - 1} y={oy + y} width={3} height={1} fill={T.line} />);
        rects.push(<rect key={`v${x}-${y}`} x={ox + x} y={oy + y - 1} width={1} height={3} fill={T.line} />);
      }),
    );
    mk.kerne.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (ch === '.') return;
        rects.push(<rect key={`m${x}-${y}`} x={ox + x} y={oy + y} width={1} height={1} fill={mk.farver[ch] ?? T.ink} />);
      }),
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * px} height={H * px} shapeRendering="crispEdges" aria-hidden={titel ? undefined : true} role={titel ? 'img' : undefined} className="shrink-0">
      {titel ? <title>{titel}</title> : null}
      {rects}
    </svg>
  );
}
