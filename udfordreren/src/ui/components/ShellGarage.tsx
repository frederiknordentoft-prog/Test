// Titelskærmens lille procedurale pixelscene: en garage en vinteraften i 2012, hvor de valgte
// stiftere sidder og koder, mens point-boblerne stiger. Ren SVG — ingen eksterne assets.
import { memo } from 'react';
import { FigurPixels, type Udseende } from './ShellPortraet';

type R = [number, number, number, number, string];

const STJERNER: [number, number][] = [
  [4, 4], [13, 9], [22, 3], [31, 7], [44, 2], [58, 5], [70, 2], [84, 6], [95, 3], [101, 11], [118, 15], [124, 4],
  [9, 17], [36, 13], [117, 24], [3, 26], [66, 9], [89, 13],
];

// Statisk baggrund (tegnes én gang)
const BAGGRUND: R[] = [
  // Jord, fortov og indkørsel
  [0, 58, 128, 14, '#1f2238'],
  [0, 58, 128, 2, '#343956'],
  [30, 60, 68, 12, '#282c47'],
  [40, 66, 6, 1, '#3a3f5e'], [60, 66, 6, 1, '#3a3f5e'], [80, 66, 6, 1, '#3a3f5e'],
  // Tag (trappet gavl)
  [52, 11, 24, 2, '#6a4458'],
  [52, 12, 24, 2, '#4a2f3f'],
  [42, 14, 44, 1, '#6a4458'], [42, 15, 44, 1, '#4a2f3f'],
  [32, 16, 64, 1, '#6a4458'], [32, 17, 64, 1, '#4a2f3f'],
  [24, 18, 80, 1, '#6a4458'], [24, 19, 80, 1, '#4a2f3f'],
  [18, 20, 92, 1, '#6a4458'], [18, 21, 92, 1, '#4a2f3f'],
  [16, 22, 96, 2, '#2a1c26'],
  // Mure
  [22, 24, 84, 34, '#7a4b3c'],
  // Porten (åbning), bagvæg og gulv
  [32, 30, 64, 28, '#3b3150'],
  [32, 53, 64, 5, '#4a4060'],
  [32, 53, 64, 1, '#5a5078'],
  // Rullet port og karm
  [30, 27, 68, 3, '#8c90ac'], [30, 28, 68, 1, '#6d7299'],
  [30, 30, 2, 28, '#5a3a30'], [96, 30, 2, 28, '#5a3a30'],
  // Skilt over porten
  [50, 24, 28, 3, '#1e2236'],
  // Serverrack
  [34, 37, 6, 16, '#23263d'], [34, 37, 6, 1, '#4a5282'], [35, 40, 4, 1, '#30365a'], [35, 44, 4, 1, '#30365a'], [35, 48, 4, 1, '#30365a'],
  // Skærm på bagvæggen med graf
  [56, 33, 16, 9, '#0b0c16'], [57, 34, 14, 7, '#16324a'],
  [58, 39, 2, 1, '#4ee6d8'], [60, 38, 2, 1, '#4ee6d8'], [62, 38, 2, 1, '#4ee6d8'], [64, 37, 2, 1, '#4ee6d8'], [66, 36, 2, 1, '#4ee6d8'], [68, 35, 2, 1, '#6ee07a'],
  [63, 42, 2, 3, '#23263d'],
  // Plakat og kasser
  [86, 33, 7, 8, '#ff6fae'], [88, 35, 3, 1, '#fff'], [87, 37, 5, 1, '#ffd23f'], [88, 39, 3, 1, '#fff'],
  [89, 47, 7, 6, '#b0804a'], [89, 49, 7, 1, '#8a6238'], [90, 42, 5, 5, '#c2925a'], [90, 44, 5, 1, '#8a6238'],
  // Borde
  [41, 47, 18, 2, '#a0673f'], [42, 49, 16, 4, '#7d4e30'], [42, 49, 16, 1, '#5e3a24'],
  [69, 47, 18, 2, '#a0673f'], [70, 49, 16, 4, '#7d4e30'], [70, 49, 16, 1, '#5e3a24'],
  // Laptops (bagside) og kaffekop
  [42, 43, 8, 4, '#c9cbd9'], [45, 44, 2, 2, '#ffd23f'], [42, 46, 8, 1, '#9aa0bd'],
  [78, 43, 8, 4, '#c9cbd9'], [81, 44, 2, 2, '#ffd23f'], [78, 46, 8, 1, '#9aa0bd'],
  [56, 45, 2, 2, '#f3efe2'], [58, 45, 1, 1, '#f3efe2'],
  // Lampe
  [64, 30, 1, 3, '#15151f'], [63, 33, 3, 2, '#fff2b0'],
  // Gadelampe
  [9, 30, 2, 28, '#4a4f6c'], [6, 28, 8, 2, '#4a4f6c'], [7, 30, 6, 1, '#ffe7a0'],
  // Postkasse
  [113, 50, 6, 4, '#c0392b'], [113, 50, 6, 1, '#e05546'], [115, 54, 2, 4, '#4a4f6c'],
  // Kat på taget
  [80, 11, 4, 2, '#0b0c16'], [83, 10, 2, 1, '#0b0c16'], [79, 9, 1, 3, '#0b0c16'], [84, 9, 1, 1, '#0b0c16'],
  // Månen
  [107, 5, 4, 1, '#f3efe2'], [105, 6, 8, 1, '#f3efe2'], [104, 7, 10, 4, '#f3efe2'], [105, 11, 8, 1, '#f3efe2'], [107, 12, 4, 1, '#f3efe2'],
  [106, 8, 2, 2, '#d8d2bf'], [110, 9, 2, 1, '#d8d2bf'], [109, 11, 2, 1, '#d8d2bf'],
];

// Mursten: mørke fuger hver 4. række, forskudte lodrette fuger
const MURSTEN: R[] = [];
for (let y = 27; y < 58; y += 4) {
  MURSTEN.push([22, y, 10, 1, '#5f3a2f'], [98, y, 8, 1, '#5f3a2f']);
  const off = ((y - 27) / 4) % 2 === 0 ? 0 : 3;
  for (let x = 22 + off; x < 32; x += 6) MURSTEN.push([x, y + 1, 1, 3, '#5f3a2f']);
  for (let x = 98 + off; x < 106; x += 6) MURSTEN.push([x, y + 1, 1, 3, '#5f3a2f']);
}
for (let x = 32; x < 96; x += 6) MURSTEN.push([x, 24, 1, 3, '#5f3a2f']);

const PARAM_FARVER = ['#ff6fae', '#a58bff', '#5cb8ff', '#6ee07a'];

function Boble({ x, y, farve, delay }: { x: number; y: number; farve: string; delay: number }) {
  return (
    <g className="shell-boble" style={{ animationDelay: `${delay}s` }}>
      <rect x={x} y={y} width={5} height={5} fill="#0b0c16" />
      <rect x={x + 0.5} y={y + 0.5} width={4} height={4} fill={farve} />
      <rect x={x + 2} y={y + 1} width={1} height={3} fill="#fff" />
      <rect x={x + 1} y={y + 2} width={3} height={1} fill="#fff" />
    </g>
  );
}

export const Garage = memo(function Garage({ figurer, stille, className }: { figurer: Udseende[]; stille?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 128 72" className={className} shapeRendering="crispEdges" role="img" aria-label="En garage om aftenen, hvor to stiftere arbejder ved deres borde">
      <defs>
        <linearGradient id="shell-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1230" />
          <stop offset="1" stopColor="#2c2452" />
        </linearGradient>
        <radialGradient id="shell-lampelys" cx="0.5" cy="0.2" r="0.75">
          <stop offset="0" stopColor="#ffd88a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="shell-gadelys" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#ffe7a0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe7a0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={128} height={72} fill="url(#shell-himmel)" />
      {STJERNER.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill="#f3efe2" className={stille ? undefined : 'shell-stjerne'} style={{ animationDelay: `${(i * 0.37) % 3}s` }} />
      ))}
      {BAGGRUND.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
      {MURSTEN.map(([x, y, w, h, c], i) => (
        <rect key={`m${i}`} x={x} y={y} width={w} height={h} fill={c} />
      ))}
      {/* Lys fra lampen og gadelampen */}
      <rect x={32} y={30} width={64} height={28} fill="url(#shell-lampelys)" className={stille ? undefined : 'shell-flimmer'} />
      <polygon points="32,58 96,58 110,72 18,72" fill="#ffd88a" opacity={0.08} />
      <polygon points="7,31 13,31 20,58 0,58" fill="url(#shell-gadelys)" />
      {/* Neonskilt */}
      <g className={stille ? undefined : 'shell-neon'}>
        <rect x={52} y={25} width={2} height={1} fill="#ff6fae" />
        <rect x={55} y={25} width={6} height={1} fill="#4ee6d8" />
        <rect x={62} y={25} width={4} height={1} fill="#ffd23f" />
        <rect x={67} y={25} width={9} height={1} fill="#ff6fae" />
      </g>
      {/* Serverens lamper */}
      <rect x={35} y={38} width={1} height={1} fill="#6ee07a" className={stille ? undefined : 'anim-blink'} />
      <rect x={37} y={42} width={1} height={1} fill="#ffa94d" className={stille ? undefined : 'anim-blink'} style={{ animationDelay: '0.4s' }} />
      <rect x={35} y={46} width={1} height={1} fill="#6ee07a" className={stille ? undefined : 'anim-blink'} style={{ animationDelay: '0.7s' }} />
      <rect x={37} y={50} width={1} height={1} fill="#5cb8ff" className={stille ? undefined : 'anim-blink'} style={{ animationDelay: '0.2s' }} />
      {/* Kattens øjne */}
      <rect x={83} y={11} width={1} height={1} fill="#ffd23f" className={stille ? undefined : 'shell-stjerne'} />
      {/* Stifterne bag bordene */}
      {figurer.slice(0, 2).map((u, i) => (
        <g key={i} className={stille ? undefined : 'shell-tast'} style={{ animationDelay: `${i * 0.23}s` }}>
          <FigurPixels udseende={u} x={i === 0 ? 51 : 70} y={38} />
        </g>
      ))}
      {/* Borde foran figurerne (dækker underkroppen) */}
      <rect x={41} y={47} width={18} height={2} fill="#a0673f" />
      <rect x={69} y={47} width={18} height={2} fill="#a0673f" />
      <rect x={42} y={43} width={8} height={4} fill="#c9cbd9" />
      <rect x={45} y={44} width={2} height={2} fill="#ffd23f" />
      <rect x={78} y={43} width={8} height={4} fill="#c9cbd9" />
      <rect x={81} y={44} width={2} height={2} fill="#ffd23f" />
      {/* Point-bobler */}
      {!stille &&
        figurer.slice(0, 2).map((_, i) =>
          [0, 1].map((j) => (
            <Boble key={`${i}-${j}`} x={(i === 0 ? 52 : 71) + j * 2} y={31} farve={PARAM_FARVER[(i * 2 + j) % 4]} delay={i * 0.9 + j * 1.6} />
          )),
        )}
    </svg>
  );
});
