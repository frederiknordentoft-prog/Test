// Procedural 5×7 pixelskrift (SVG) til titler og fejringer. Ingen fonte eller eksterne assets.
import { useMemo } from 'react';

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  Æ: ['.####', '#.#..', '#.#..', '####.', '#.#..', '#.#..', '#.###'],
  Ø: ['.###.', '#..##', '#.#.#', '#.#.#', '#.#.#', '##..#', '.###.'],
  Å: ['..#..', '.#.#.', '.###.', '#...#', '#####', '#...#', '#...#'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
};

type Layout = { pix: [number, number][]; bredde: number };

function layout(tekst: string, mellemrum: number): Layout {
  const pix: [number, number][] = [];
  let x = 0;
  for (const ch of tekst.toUpperCase()) {
    const g = G[ch] ?? G['?'];
    g.forEach((row, y) => [...row].forEach((c, dx) => c === '#' && pix.push([x + dx, y])));
    x += g[0].length + mellemrum;
  }
  return { pix, bredde: Math.max(1, x - mellemrum) };
}

function sti(pix: [number, number][], ox = 0, oy = 0, filter?: (y: number) => boolean): string {
  let d = '';
  for (const [x, y] of pix) if (!filter || filter(y)) d += `M${x + ox} ${y + oy}h1v1h-1z`;
  return d;
}

/**
 * Pixeltekst. `farver` er [top, midte, bund] (rækker 0-2, 3-4, 5-6). `dybde` giver en 3D-kant nedad/højre
 * i farven `side`, og hele teksten får en mørk kontur (`kant`).
 * Skalerer med CSS (bredde/højde via className eller `pixel`).
 */
export function PixelTekst({
  tekst,
  pixel = 4,
  farver = ['#fff1a8', 'var(--color-gold)', '#f59f1a'],
  side = '#8c4a12',
  dybde = 1,
  kant = 'var(--color-line)',
  className,
  titel,
}: {
  tekst: string;
  pixel?: number;
  farver?: [string, string, string] | string;
  side?: string;
  dybde?: number;
  kant?: string;
  className?: string;
  titel?: string;
}) {
  const l = useMemo(() => layout(tekst, dybde > 0 ? 2 : 1), [tekst, dybde]);
  const [top, midt, bund] = typeof farver === 'string' ? [farver, farver, farver] : farver;
  const w = l.bredde + dybde + 2;
  const h = 7 + dybde + 2;
  const lag = useMemo(() => {
    const noegle = (x: number, y: number) => `${x},${y}`;
    const face = new Set(l.pix.map(([x, y]) => noegle(x, y)));
    const ekstrud: [number, number][] = [];
    const ekstrudSet = new Set<string>();
    for (let i = 1; i <= dybde; i++)
      for (const [x, y] of l.pix) {
        const k = noegle(x + i, y + i);
        if (!face.has(k) && !ekstrudSet.has(k)) {
          ekstrudSet.add(k);
          ekstrud.push([x + i, y + i]);
        }
      }
    const kontur: [number, number][] = [];
    const set = new Set<string>();
    for (const [x, y] of [...l.pix, ...ekstrud])
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const k = noegle(x + dx, y + dy);
          if (!face.has(k) && !ekstrudSet.has(k) && !set.has(k)) {
            set.add(k);
            kontur.push([x + dx, y + dy]);
          }
        }
    return { ekstrud: sti(ekstrud, 1, 1), kontur: sti(kontur, 1, 1) };
  }, [l, dybde]);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={className ? undefined : w * pixel}
      height={className ? undefined : h * pixel}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={titel ?? tekst}
    >
      <path d={lag.kontur} fill={kant} />
      {dybde > 0 && <path d={lag.ekstrud} fill={side} />}
      <path d={sti(l.pix, 1, 1, (y) => y <= 2)} fill={top} />
      <path d={sti(l.pix, 1, 1, (y) => y > 2 && y <= 4)} fill={midt} />
      <path d={sti(l.pix, 1, 1, (y) => y > 4)} fill={bund} />
    </svg>
  );
}
