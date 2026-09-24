// Små procedurale pixelportrætter (stiftere, mentoren) og en lille siddende figur til titelscenen.
import { useMemo } from 'react';

const HUD = ['#f6d2ae', '#e8b58a', '#c98f5f', '#9d6a43', '#6b462c'];
const HAAR = ['#2a1d16', '#5b3a1f', '#a4582c', '#d9b25f', '#1d2238', '#b8322e', '#e9e4d6'];
type Stil = 'kort' | 'lang' | 'hanekam' | 'hue' | 'maane';
const STILE: Stil[] = ['kort', 'lang', 'hanekam', 'hue', 'kort', 'lang'];

export type Udseende = { hud: string; haar: string; stil: Stil; skjorte: string; briller: boolean; skaeg: boolean; hue: string };

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function udseendeFor(seed: number, skjorte: string): Udseende {
  const r = rng(seed + 17);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
  return {
    hud: pick(HUD),
    haar: pick(HAAR.slice(0, 6)),
    stil: pick(STILE),
    skjorte,
    briller: r() < 0.3,
    skaeg: r() < 0.2,
    hue: pick(['#ff6fae', '#5cb8ff', '#6ee07a', '#a58bff']),
  };
}

export const VETERAN: Udseende = { hud: '#e8b58a', haar: '#dfe2ea', stil: 'maane', skjorte: '#7b5a3c', briller: true, skaeg: true, hue: '#000' };

type Px = [number, number, string];

/** 12×12 portræt (hoved og skuldre) */
function portraetPixels(u: Udseende): Px[] {
  const px: Px[] = [];
  const s = (x: number, y: number, c: string) => px.push([x, y, c]);
  const rect = (x0: number, y0: number, w: number, h: number, c: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s(x, y, c);
  };
  // Skuldre og skjorte
  rect(1, 10, 10, 2, u.skjorte);
  rect(2, 9, 8, 1, u.skjorte);
  rect(5, 9, 2, 1, '#f3efe2'); // krave
  // Hals og ansigt
  rect(5, 8, 2, 1, u.hud);
  rect(3, 3, 6, 5, u.hud);
  s(2, 5, u.hud);
  s(9, 5, u.hud); // ører
  // Øjne og mund
  s(4, 5, '#1b1b2a');
  s(7, 5, '#1b1b2a');
  rect(5, 7, 2, 1, '#9c4a3a');
  if (u.briller) {
    rect(3, 4, 3, 1, '#1b1b2a');
    rect(6, 4, 3, 1, '#1b1b2a');
    s(4, 5, '#4ee6d8');
    s(7, 5, '#4ee6d8');
    s(3, 5, '#1b1b2a');
    s(8, 5, '#1b1b2a');
  }
  if (u.skaeg) {
    rect(4, 6, 4, 1, u.haar);
    s(3, 7, u.haar);
    s(8, 7, u.haar);
    rect(4, 7, 1, 1, u.haar);
    rect(7, 7, 1, 1, u.haar);
  }
  // Hår
  switch (u.stil) {
    case 'kort':
      rect(3, 1, 6, 2, u.haar);
      rect(2, 2, 1, 3, u.haar);
      rect(9, 2, 1, 3, u.haar);
      s(3, 3, u.haar);
      break;
    case 'lang':
      rect(3, 1, 6, 2, u.haar);
      rect(2, 2, 1, 7, u.haar);
      rect(9, 2, 1, 7, u.haar);
      rect(3, 3, 1, 1, u.haar);
      rect(8, 3, 1, 1, u.haar);
      break;
    case 'hanekam':
      rect(5, 0, 2, 3, u.haar);
      rect(4, 2, 4, 1, u.haar);
      break;
    case 'hue':
      rect(3, 0, 6, 1, u.hue);
      rect(2, 1, 8, 2, u.hue);
      rect(2, 3, 8, 1, '#0b0c16');
      break;
    case 'maane':
      rect(2, 3, 1, 3, u.haar);
      rect(9, 3, 1, 3, u.haar);
      s(3, 2, u.haar);
      s(8, 2, u.haar);
      break;
  }
  return px;
}

function tilSti(px: Px[]): { farve: string; d: string }[] {
  const pr = new Map<string, string>();
  for (const [x, y, c] of px) pr.set(c, (pr.get(c) ?? '') + `M${x} ${y}h1v1h-1z`);
  return [...pr.entries()].map(([farve, d]) => ({ farve, d }));
}

export function Portraet({ udseende, str = 48, baggrund = 'var(--color-bg2)', className }: { udseende: Udseende; str?: number; baggrund?: string; className?: string }) {
  const lag = useMemo(() => tilSti(portraetPixels(udseende)), [udseende]);
  return (
    <svg viewBox="0 0 12 12" width={str} height={str} shapeRendering="crispEdges" className={className} aria-hidden>
      <rect x={0} y={0} width={12} height={12} fill={baggrund} />
      {lag.map((l) => (
        <path key={l.farve} d={l.d} fill={l.farve} />
      ))}
    </svg>
  );
}

/** Lille figur (7×9) til titelscenen — tegnes direkte i en forældre-SVG ved (x, y) */
export function FigurPixels({ udseende, x, y }: { udseende: Udseende; x: number; y: number }) {
  const lag = useMemo(() => {
    const px: Px[] = [];
    const rect = (x0: number, y0: number, w: number, h: number, c: string) => {
      for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) px.push([xx, yy, c]);
    };
    const u = udseende;
    rect(0, 5, 7, 4, u.skjorte); // krop
    rect(2, 5, 3, 1, '#f3efe2');
    rect(1, 1, 5, 4, u.hud); // hoved
    px.push([2, 3, '#1b1b2a'], [4, 3, '#1b1b2a']);
    if (u.stil === 'hue') rect(1, 0, 5, 2, u.hue);
    else if (u.stil === 'maane') {
      px.push([1, 1, u.haar], [5, 1, u.haar]);
    } else {
      rect(1, 0, 5, 1, u.haar);
      px.push([1, 1, u.haar], [5, 1, u.haar]);
      if (u.stil === 'lang') {
        rect(0, 1, 1, 5, u.haar);
        rect(6, 1, 1, 5, u.haar);
      }
      if (u.stil === 'hanekam') rect(2, -1, 3, 1, u.haar);
    }
    if (u.briller) px.push([2, 3, '#4ee6d8'], [4, 3, '#4ee6d8'], [3, 3, '#1b1b2a']);
    return tilSti(px);
  }, [udseende]);
  return (
    <g transform={`translate(${x} ${y})`}>
      {lag.map((l) => (
        <path key={l.farve} d={l.d} fill={l.farve} />
      ))}
    </g>
  );
}
