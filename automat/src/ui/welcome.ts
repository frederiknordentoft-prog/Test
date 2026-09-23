// Splash welcome: a short, mysterious status line inside the machine window under the NORDLYS logo.
// Pure copy (welcomeCopy) + static SVG (legend / storm shards); hud.ts owns the DOM and placement.
//
// Honesty rules (reviewed for the Danish market, see docs):
// - progress is charged by crushed crystals, never "gevinst" (a third of hits pay below the stake)
// - rewards on the way are facts (Ladet spin at Kp 3/5/7), never gifts; the machine at Kp 9 is only "vildere"
// - rarity ("ses sjældent") leads the same sentence as the machine, and the two lines never separate
// - returning states report status only: no distance, no deadline, no teaser, identical at every Kp
import { fmt1 } from '../core/format.ts';
import { TIERS } from '../game/tiers.ts';

export type WelcomeState = 'first' | 'returning' | 'pending' | 'expired' | 'storm';

export interface WelcomeInput {
  /** Real base spins played (demo spins never count). */
  spins: number;
  /** Real Solstorms finished. */
  storms: number;
  /** Saved Kp (display value). */
  kp: number;
  perksPending: number;
  /** The saved meter expired on load (365 days without spins). */
  expired: boolean;
  /** An interrupted Solstorm that resumes after the tap. */
  storm: { spinIndex: number; spinsTotal: number; maxMark: number } | null;
}

/** A line is a run of parts; `b` parts are the teal "Ladet spin" term. */
export interface WelcomeLine {
  parts: { t: string; b?: boolean }[];
  tone: 'cool' | 'ice' | 'strong';
  /** Lines sharing a pair id are one sentence and are never shown apart. */
  pair?: number;
}

export interface WelcomeCopy {
  state: WelcomeState;
  eyebrow: { lead: string; suffix: string };
  lines: WelcomeLine[];
  /** One sentence for screen readers (the visible lines are aria-hidden). */
  summary: string;
  legend: 'kp' | 'storm';
  storm?: { played: number; total: number };
  /** Accessible name for the unlock button when it does more than light the sky. */
  buttonLabel?: string;
}

const NB = ' ';
const kpText = (n: number) => `Kp${NB}${n}`;
export const lineText = (l: WelcomeLine) => l.parts.map((p) => p.t).join('');

/** The next reward in the goal chip's own wording ("Ladet spin ved Kp 5" / "Solstorm ved Kp 9"). */
function nextReward(kp: number): { what: string; kp: number; perk: boolean } {
  const cur = Math.floor(kp);
  const r = TIERS.find((t) => t.kp > cur && (t.perk || t.kp === 9));
  if (!r || r.kp === 9) return { what: 'Solstorm', kp: 9, perk: false };
  return { what: 'Ladet spin', kp: r.kp, perk: true };
}

export function welcomeState(i: WelcomeInput): WelcomeState {
  if (i.storm) return 'storm';
  if (i.expired) return 'expired';
  if (i.perksPending > 0) return 'pending';
  if (i.spins > 0) return 'returning';
  return 'first';
}

export function welcomeCopy(i: WelcomeInput): WelcomeCopy {
  const state = welcomeState(i);
  const kp = fmt1(i.kp);
  const settled = i.kp < 0.05 && i.storms > 0; // right after a Solstorm emptied the sky
  const where: WelcomeLine = { parts: [{ t: settled ? 'Himlen er faldet til ro.' : 'Nordlyset står, hvor du slap det.' }], tone: 'cool' };

  if (state === 'storm') {
    const s = i.storm!;
    const left = Math.max(0, s.spinsTotal - s.spinIndex);
    const lines: WelcomeLine[] = [
      { parts: [{ t: 'Glasset er stadig brudt.' }], tone: 'cool' },
      { parts: [{ t: 'Solstormen fortsætter, hvor den slap.' }], tone: 'cool' },
      { parts: [{ t: left > 0 ? `${left} stormspin tilbage.` : 'Alle stormspin er spillet.' }], tone: 'ice' },
      { parts: [{ t: `Højeste mærke${NB}×${s.maxMark}.` }], tone: 'ice' },
    ];
    return {
      state, eyebrow: { lead: 'Solstorm', suffix: 'G5 Ekstrem' }, lines, legend: 'storm',
      storm: { played: Math.min(s.spinIndex, s.spinsTotal), total: s.spinsTotal },
      summary: `Solstorm, G5 Ekstrem. ${lines.map(lineText).join(' ')}`.replace(/ /g, ' '),
      buttonLabel: 'Tænd himlen og fortsæt Solstormen',
    };
  }
  if (state === 'expired') {
    const lines: WelcomeLine[] = [
      { parts: [{ t: 'Himlen er faldet til ro.' }], tone: 'cool' },
      { parts: [{ t: 'Din ladning udløb efter 365 dage' }], tone: 'ice', pair: 1 },
      { parts: [{ t: 'uden spin og er nulstillet.' }], tone: 'ice', pair: 1 },
    ];
    return { state, eyebrow: { lead: 'Møns Klint', suffix: 'Kp 0,0' }, lines, legend: 'kp', summary: `Møns Klint, Kp 0,0. ${lines.map(lineText).join(' ')}`.replace(/ /g, ' ') };
  }
  if (state === 'pending') {
    const n = Math.max(1, Math.floor(i.perksPending));
    const lines: WelcomeLine[] = [
      where,
      { parts: n === 1 ? [{ t: 'Et ' }, { t: 'Ladet spin', b: true }, { t: ' ligger klar.' }] : [{ t: `${n} ` }, { t: 'Ladede spin', b: true }, { t: ' ligger klar.' }], tone: 'ice' },
    ];
    return { state, eyebrow: { lead: 'Møns Klint', suffix: `Kp ${kp}` }, lines, legend: 'kp', summary: `Møns Klint, Kp ${kp}. ${lines.map(lineText).join(' ')}`.replace(/ /g, ' ') };
  }
  if (state === 'returning') {
    const nx = nextReward(i.kp);
    const lines: WelcomeLine[] = [
      where,
      { parts: [{ t: 'Næste: ' }, { t: nx.what, b: nx.perk }, { t: ` ved ${kpText(nx.kp)}.` }], tone: 'ice' },
    ];
    return { state, eyebrow: { lead: 'Møns Klint', suffix: `Kp ${kp}` }, lines, legend: 'kp', summary: `Møns Klint, Kp ${kp}. ${lines.map(lineText).join(' ')}`.replace(/ /g, ' ') };
  }
  const lines: WelcomeLine[] = [
    { parts: [{ t: 'Hver knust krystal lader himlen op.' }], tone: 'cool' },
    { parts: [{ t: `Ved ${kpText(3)}, 5 og 7 får du et ` }, { t: 'Ladet spin', b: true }, { t: '.' }], tone: 'cool' },
    { parts: [{ t: `${kpText(9)} ses sjældent${NB}– da brister glasset,` }], tone: 'ice', pair: 1 },
    { parts: [{ t: 'og bag det vågner en vildere maskine.' }], tone: 'strong', pair: 1 },
  ];
  return {
    state, eyebrow: { lead: 'Møns Klint', suffix: 'Polarnat' }, lines, legend: 'kp',
    summary: 'Nordlys ved Møns Klint: hver knust krystal lader himlen op, ved Kp 3, 5 og 7 får du et Ladet spin, og Kp 9 ses sjældent – da brister glasset, og bag det vågner en vildere maskine.',
  };
}

/** Kp legend: a pure key (no fill, no position marker — identical at every Kp), 3/5/7 diamonds and the locked G5 glyph.
 *  The 7→9 stretch is dotted so it reads as long (thresholds are front-loaded: Kp 8 is only 55 % of the charge). */
export function kpLegendSvg(): string {
  const x = (i: number) => 12 + 24 * i;
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i, n) => `<line class="lg-tick" style="--i:${n}" x1="${x(i)}" y1="10" x2="${x(i)}" y2="15"/>`).join('');
  const dia = [3, 5, 7].map((i, n) => `<rect class="lg-dia" style="--i:${n}" x="${x(i) - 3}" y="7" width="6" height="6" transform="rotate(45 ${x(i)} 10)"/>`).join('');
  const hex = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(x(9) + 7 * Math.cos(a)).toFixed(2)},${(10 + 7 * Math.sin(a)).toFixed(2)}`; }).join(' ');
  const labels = [0, 3, 5, 7].map((i) => `<text x="${x(i)}" y="27">${i}</text>`).join('') + `<text class="g5" x="${x(9)}" y="27">G5</text>`;
  return `<svg class="w-legend-svg" viewBox="0 0 240 30" aria-hidden="true" focusable="false">
<line class="lg-base" x1="${x(0)}" y1="10" x2="${x(7)}" y2="10" pathLength="1"/>
<line class="lg-dot" x1="${x(7)}" y1="10" x2="${x(9) - 8}" y2="10"/>
${ticks}${dia}
<polygon class="lg-glyph" points="${hex}"/>
<polyline class="lg-crack" points="225,4 229,10 226,16" pathLength="1"/>
<g class="lg-labels">${labels}</g></svg>`;
}

/** Storm resume: one static shard per storm spin — played ones filled, the rest outlined. No amounts, no highlight. */
export function stormShardsSvg(played: number, total: number): string {
  const w = total * 12 - 6;
  const shards = Array.from({ length: total }, (_, i) =>
    `<rect class="sh${i < played ? ' on' : ''}" style="--i:${i}" x="${i * 12 + 1}" y="1" width="6" height="10" transform="skewX(-12)"/>`).join('');
  return `<svg class="w-shards-svg" viewBox="-2 0 ${w + 4} 12" width="${w + 4}" height="12" aria-hidden="true" focusable="false">${shards}<line class="sh-crack" x1="-2" y1="7" x2="${w + 2}" y2="5"/></svg>`;
}
