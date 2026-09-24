// Point-bobler (Game Dev Storys vigtigste juice): små farvede bobler med ikon + tal, der popper op over en
// medarbejder, svæver op og fader ud. Faste puljer (ingen allokering pr. frame) og et loft over antallet.
import type { ParamKey, Params } from '../sim/types';
import { PARAM_KEYS } from '../sim/types';
import { PARAM_FARVE, T } from './palette';
import { tekstSprite } from './font';
import { tegnBobleIkon, type BobleIkon } from './sprites';

const MAX_AKTIVE = 120;
const MAX_KOE = 320;
const POP_MS = 220;

/** Boble-sprite: farvet boks, mørk kant, ikon og tal i mørk tekst (ikon + farve, aldrig kun farve) */
export function bobleSprite(tekst: string, farve: string, ikon: BobleIkon, skala: number): HTMLCanvasElement {
  return tekstSprite(tekst, T.line, skala, {
    baggrund: farve,
    kant: T.line,
    pad: 1,
    ikon: (ctx, x, y, s) => tegnBobleIkon(ctx, ikon, x, y, s, T.line),
    ikonNoegle: ikon,
  });
}

function easeOutBack(t: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export class Bobler {
  // kø af planlagte bobler
  private qAt = new Float64Array(MAX_KOE);
  private qPlads = new Int16Array(MAX_KOE);
  private qDx = new Int8Array(MAX_KOE);
  private qLiv = new Float32Array(MAX_KOE);
  private qSprite: (HTMLCanvasElement | null)[] = new Array(MAX_KOE).fill(null);
  private qAntal = 0;
  // aktive bobler
  private bX = new Float32Array(MAX_AKTIVE);
  private bY = new Float32Array(MAX_AKTIVE);
  private bT0 = new Float64Array(MAX_AKTIVE);
  private bLiv = new Float32Array(MAX_AKTIVE);
  private bSprite: (HTMLCanvasElement | null)[] = new Array(MAX_AKTIVE).fill(null);
  private aktive = 0;
  private sideTael = new Uint8Array(64);
  /** Maks samtidige bobler (lavere, når boblerne tegnes stort) */
  loft = MAX_AKTIVE;

  /** Kaldes ved spawn: plads → ankerpunkt i canvas-pixels */
  constructor(private ankerX: Float32Array, private ankerY: Float32Array) {}

  antal(): number {
    return this.aktive + this.qAntal;
  }

  ryd(): void {
    this.qAntal = 0;
    for (let i = 0; i < MAX_AKTIVE; i++) this.bSprite[i] = null;
    this.aktive = 0;
  }

  planlaeg(at: number, plads: number, sprite: HTMLCanvasElement, dx: number, liv: number): void {
    if (this.qAntal >= MAX_KOE) return; // travlt: drop hellere end at hakke
    const i = this.qAntal++;
    this.qAt[i] = at;
    this.qPlads[i] = plads;
    this.qDx[i] = dx;
    this.qLiv[i] = liv;
    this.qSprite[i] = sprite;
  }

  /**
   * Planlæg bobler for ét point-signal: én pr. parameter (≥ 1 efter afrunding) + fejl-boble.
   * Spredt over ugens varighed, så det "pibler" som i Game Dev Story.
   */
  planlaegPoint(nu: number, plads: number, params: Params, fejl: number, fjernet: number, ugeMs: number, skala: number, forskyd: number): number {
    let n = 0;
    const specs = SPEC_TMP;
    for (const k of PARAM_KEYS) {
      const v = params[k];
      if (v >= 0.5 && n < 4) {
        specs[n].tekst = `+${Math.max(1, Math.round(v))}`;
        specs[n].farve = PARAM_FARVE[k as ParamKey];
        specs[n].ikon = k as BobleIkon;
        n++;
      }
    }
    if (fejl >= 0.3) {
      specs[n].tekst = `+${Math.max(1, Math.round(fejl))} FEJL`;
      specs[n].farve = T.bad;
      specs[n].ikon = 'fejl';
      n++;
    }
    if (fjernet >= 0.3) {
      specs[n].tekst = `-${Math.max(1, Math.round(fjernet))} FEJL`;
      specs[n].farve = T.good;
      specs[n].ikon = 'fjernet';
      n++;
    }
    if (n === 0) return 0;
    const spand = Math.max(300, ugeMs * 0.75);
    const trin = spand / n;
    const liv = Math.max(750, Math.min(1500, ugeMs * 0.55));
    const start = nu + forskyd * Math.min(ugeMs * 0.2, trin);
    for (let j = 0; j < n; j++) {
      const s = specs[j];
      const sp = bobleSprite(s.tekst, s.farve, s.ikon, skala);
      // skiftevis venstre/højre for hovedet (også hen over uger), så bobler i træk ikke dækker hinanden
      const side = this.sideTael[plads & 63]++ & 1 ? 1 : -1;
      const dx = side * Math.min(60, Math.round(sp.width * 0.36));
      this.planlaeg(start + j * trin, plads, sp, dx, liv);
    }
    return n;
  }

  /** Én enkelt boble (fx niveau op) */
  planlaegEn(at: number, plads: number, tekst: string, farve: string, ikon: BobleIkon, skala: number, liv = 1600): void {
    this.planlaeg(at, plads, bobleSprite(tekst, farve, ikon, skala), 0, liv);
  }

  /** Flyt forfaldne bobler fra køen til de aktive. Returnerer plads-indeks for bobler, der lige poppede (via callback). */
  opdater(nu: number, onPop: (plads: number) => void): void {
    let i = 0;
    while (i < this.qAntal) {
      if (this.qAt[i] <= nu) {
        this.spawn(nu, this.qPlads[i], this.qSprite[i], this.qDx[i], this.qLiv[i]);
        onPop(this.qPlads[i]);
        // fjern ved at flytte sidste ind
        const sidst = --this.qAntal;
        this.qAt[i] = this.qAt[sidst];
        this.qPlads[i] = this.qPlads[sidst];
        this.qDx[i] = this.qDx[sidst];
        this.qLiv[i] = this.qLiv[sidst];
        this.qSprite[i] = this.qSprite[sidst];
        this.qSprite[sidst] = null;
      } else i++;
    }
  }

  private spawn(nu: number, plads: number, sprite: HTMLCanvasElement | null, dx: number, liv: number): void {
    if (!sprite) return;
    let slot = -1;
    let aeldst = 0;
    let aeldstT = Infinity;
    const loft = this.aktive >= this.loft; // for mange: genbrug den ældste
    for (let i = 0; i < MAX_AKTIVE; i++) {
      if (loft) {
        if (this.bSprite[i] && this.bT0[i] < aeldstT) {
          aeldstT = this.bT0[i];
          aeldst = i;
        }
        continue;
      }
      if (!this.bSprite[i]) {
        slot = i;
        break;
      }
      if (this.bT0[i] < aeldstT) {
        aeldstT = this.bT0[i];
        aeldst = i;
      }
    }
    if (slot < 0) slot = aeldst;
    else this.aktive++;
    this.bX[slot] = (this.ankerX[plads] ?? 0) + dx;
    this.bY[slot] = this.ankerY[plads] ?? 0;
    this.bT0[slot] = nu;
    this.bLiv[slot] = liv;
    this.bSprite[slot] = sprite;
  }

  tegn(ctx: CanvasRenderingContext2D, nu: number, reduceret: boolean, bredde: number, stigning: number): void {
    if (this.aktive === 0) return;
    let levende = 0;
    for (let i = 0; i < MAX_AKTIVE; i++) {
      const sp = this.bSprite[i];
      if (!sp) continue;
      const alder = nu - this.bT0[i];
      const liv = this.bLiv[i];
      if (alder >= liv) {
        this.bSprite[i] = null;
        continue;
      }
      levende++;
      let s = 1;
      let op = 0;
      if (!reduceret) {
        s = easeOutBack(Math.min(1, alder / POP_MS));
        // lille hop ved pop, derefter jævn opdrift
        const k = alder / liv;
        op = stigning * (0.18 * easeOutCubic(Math.min(1, alder / POP_MS)) + 0.82 * k);
      }
      const fadeStart = liv * 0.62;
      const a = alder > fadeStart ? 1 - (alder - fadeStart) / (liv - fadeStart) : 1;
      const dw = Math.round(sp.width * s);
      const dh = Math.round(sp.height * s);
      if (dw < 1 || dh < 1) continue;
      let x = Math.round(this.bX[i] - dw / 2);
      if (x < 0) x = 0;
      else if (x + dw > bredde) x = bredde - dw;
      const y = Math.round(this.bY[i] - op - dh);
      ctx.globalAlpha = a < 0 ? 0 : a;
      ctx.drawImage(sp, x, y, dw, dh);
    }
    ctx.globalAlpha = 1;
    this.aktive = levende;
  }
}

type Spec = { tekst: string; farve: string; ikon: BobleIkon };
const SPEC_TMP: Spec[] = Array.from({ length: 6 }, () => ({ tekst: '', farve: '', ikon: 'stjerne' as BobleIkon }));
