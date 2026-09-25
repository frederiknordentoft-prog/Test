// Skærm-juice, som alle spor kan importere: konfetti(opts?) og rystelse(ms).
// Konfetti tegnes på et fuldskærms-overlay (over dialoger), i grove pixels, så det passer til pixel-looket.
// Begge respekterer settings.reduceretBevaegelse og prefers-reduced-motion (så sker der intet).
import { useGame } from '../store/gameStore';
import { T } from './palette';

let mq: MediaQueryList | null = null;

/** Skal bevægelse dæmpes? (manuel indstilling ELLER systemindstilling) */
export function reduceretBevaegelse(): boolean {
  try {
    if (useGame.getState().settings.reduceretBevaegelse) return true;
    if (!mq && typeof window !== 'undefined' && window.matchMedia) mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!mq?.matches;
  } catch {
    return false;
  }
}

// ---------- Konfetti ----------
export type KonfettiOpts = {
  /** Antal stykker (standard 140, maks 420 i alt) */
  antal?: number;
  /** Udspring som andel af vinduet (0..1). Standard: midt for, lidt over midten. */
  x?: number;
  y?: number;
  /** Alternativt: sprøjt fra midten af et element (fx kontoret eller en dialog) */
  element?: Element | null;
  /** Farver (hex). Standard: guld, pink, cyan, violet, grøn, himmelblå, creme. */
  farver?: string[];
  /** Regn ned fra toppen i hele bredden i stedet for et udbrud */
  regn?: boolean;
  /** Kraft 0.5..2 (standard 1) */
  kraft?: number;
};

const PIX = 3; // CSS-px pr. konfettipixel
const MAX = 420;
const STD_FARVER = [T.gold, T.pink, T.cyan, T.violet, T.good, T.sky, T.ink];

const kx = new Float32Array(MAX);
const ky = new Float32Array(MAX);
const kvx = new Float32Array(MAX);
const kvy = new Float32Array(MAX);
const kliv = new Float32Array(MAX); // resterende sek.
const kmax = new Float32Array(MAX);
const kfase = new Float32Array(MAX);
const kspin = new Float32Array(MAX);
const kfarve: string[] = new Array(MAX).fill(T.gold);
let antalLevende = 0;
let naesteSlot = 0;

let cv: HTMLCanvasElement | null = null;
let cx: CanvasRenderingContext2D | null = null;
let cw = 0;
let ch = 0;
let raf = 0;
let sidst = 0;

function sikrCanvas(): boolean {
  if (typeof document === 'undefined') return false;
  if (!cv) {
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.dataset.testid = 'konfetti';
    cv.style.cssText =
      'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:70;image-rendering:pixelated;image-rendering:crisp-edges;display:none;';
    document.body.appendChild(cv);
    cx = cv.getContext('2d');
  }
  const w = Math.ceil(window.innerWidth / PIX);
  const h = Math.ceil(window.innerHeight / PIX);
  if (w !== cw || h !== ch) {
    cw = w;
    ch = h;
    cv.width = w;
    cv.height = h;
  }
  return !!cx;
}

export function konfetti(opts: KonfettiOpts = {}): void {
  if (reduceretBevaegelse()) return;
  if (!sikrCanvas() || !cv) return;
  const n = Math.max(1, Math.min(MAX, Math.round(opts.antal ?? 140)));
  const farver = opts.farver?.length ? opts.farver : STD_FARVER;
  const kraft = Math.max(0.5, Math.min(2, opts.kraft ?? 1));
  let ox = (opts.x ?? 0.5) * cw;
  let oy = (opts.y ?? 0.38) * ch;
  if (opts.element) {
    const r = opts.element.getBoundingClientRect();
    ox = (r.left + r.width / 2) / PIX;
    oy = (r.top + r.height / 2) / PIX;
  }
  for (let k = 0; k < n; k++) {
    const i = naesteSlot;
    naesteSlot = (naesteSlot + 1) % MAX;
    if (kliv[i] <= 0) antalLevende++;
    if (opts.regn) {
      kx[i] = Math.random() * cw;
      ky[i] = -Math.random() * ch * 0.4;
      kvx[i] = (Math.random() - 0.5) * 20;
      kvy[i] = 10 + Math.random() * 30;
    } else {
      const vinkel = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const fart = (60 + Math.random() * 130) * kraft * (Math.min(cw, 520) / 320);
      kx[i] = ox + (Math.random() - 0.5) * 6;
      ky[i] = oy + (Math.random() - 0.5) * 4;
      kvx[i] = Math.cos(vinkel) * fart;
      kvy[i] = Math.sin(vinkel) * fart;
    }
    const liv = 2.2 + Math.random() * 1.4;
    kliv[i] = liv;
    kmax[i] = liv;
    kfase[i] = Math.random() * Math.PI * 2;
    kspin[i] = 5 + Math.random() * 9;
    kfarve[i] = farver[(Math.random() * farver.length) | 0];
  }
  cv.style.display = 'block';
  if (!raf) {
    sidst = performance.now();
    raf = requestAnimationFrame(konfettiLoop);
  }
}

function konfettiLoop(nu: number): void {
  const dt = Math.min(0.05, (nu - sidst) / 1000);
  sidst = nu;
  const ctx = cx;
  if (!ctx || !cv) {
    raf = 0;
    return;
  }
  ctx.clearRect(0, 0, cw, ch);
  let levende = 0;
  const g = 150;
  const traek = Math.pow(0.35, dt); // luftmodstand
  for (let i = 0; i < MAX; i++) {
    if (kliv[i] <= 0) continue;
    kliv[i] -= dt;
    if (kliv[i] <= 0 || ky[i] > ch + 4) {
      kliv[i] = 0;
      continue;
    }
    levende++;
    kvx[i] *= traek;
    kvy[i] = kvy[i] * traek + g * dt;
    if (kvy[i] > 55) kvy[i] = 55; // terminal hastighed: blafrer ned
    kfase[i] += kspin[i] * dt;
    const s = Math.sin(kfase[i]);
    kx[i] += (kvx[i] + s * 12) * dt;
    ky[i] += kvy[i] * dt;
    const a = Math.min(1, kliv[i] / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = kfarve[i];
    // "rotation": skift mellem bred, smal og firkantet
    const w = s > 0.35 ? 2 : 1;
    const h = s < -0.35 ? 2 : 1;
    ctx.fillRect(kx[i] | 0, ky[i] | 0, w, h);
  }
  ctx.globalAlpha = 1;
  antalLevende = levende;
  if (antalLevende > 0) raf = requestAnimationFrame(konfettiLoop);
  else {
    raf = 0;
    ctx.clearRect(0, 0, cw, ch);
    cv.style.display = 'none';
  }
}

// ---------- Skærmrystelse ----------
let rystSlut = 0;
let rystVarighed = 1;
let rystStyrke = 0;
let rystRaf = 0;
let rystEl: HTMLElement | null = null;

/** Ryst skærmen i `ms` millisekunder. `styrke` i CSS-px (standard 4). */
export function rystelse(ms = 350, styrke = 4): void {
  if (reduceretBevaegelse() || typeof document === 'undefined') return;
  rystEl = document.getElementById('root') ?? document.body;
  const nu = performance.now();
  rystSlut = Math.max(rystSlut, nu + ms);
  rystVarighed = Math.max(1, rystSlut - nu);
  rystStyrke = Math.max(rystStyrke, styrke);
  if (!rystRaf) rystRaf = requestAnimationFrame(rystLoop);
}

function rystLoop(nu: number): void {
  const el = rystEl;
  if (!el) {
    rystRaf = 0;
    return;
  }
  const rest = rystSlut - nu;
  if (rest <= 0) {
    el.style.transform = '';
    rystStyrke = 0;
    rystRaf = 0;
    return;
  }
  const k = rest / rystVarighed;
  const s = rystStyrke * k;
  const dx = Math.round((Math.random() * 2 - 1) * s);
  const dy = Math.round((Math.random() * 2 - 1) * s * 0.6);
  el.style.transform = `translate(${dx}px, ${dy}px)`;
  rystRaf = requestAnimationFrame(rystLoop);
}

/** Fjern al konfetti med det samme (fx når et nyt spil starter fra slutskærmen) */
export function stopKonfetti(): void {
  kliv.fill(0);
  antalLevende = 0;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (cx) cx.clearRect(0, 0, cw, ch);
  if (cv) cv.style.display = 'none';
}

/** Antal levende konfettistykker (til test/fejlfinding) */
export function konfettiAntal(): number {
  return antalLevende;
}
