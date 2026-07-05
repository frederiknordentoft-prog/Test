export type ElementCategory =
  | 'ikkemetal'
  | 'ædelgas'
  | 'alkalimetal'
  | 'overgangsmetal'
  | 'halogen'
  | 'andet-metal'

export type Element = {
  symbol: string
  navn: string
  atomicNumber: number
  mass: number // standard atomvægt i u
  category: ElementCategory
}

/**
 * Al masse-matematik foregår i mikro-u (1 u = 100 000 µu) som heltal,
 * så summer er eksakte og H₂O === O + 2·H uden float-drift.
 */
export const MICRO = 100_000

export function toMicroU(mass: number): number {
  return Math.round(mass * MICRO)
}

export function formatU(microU: number, decimals = 3): string {
  const u = microU / MICRO
  return u.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Standard atomvægte (IUPAC forkortet) — værdierne er låst af spec'en.
export const ELEMENTS: readonly Element[] = [
  { symbol: 'H', navn: 'Brint', atomicNumber: 1, mass: 1.008, category: 'ikkemetal' },
  { symbol: 'He', navn: 'Helium', atomicNumber: 2, mass: 4.0026, category: 'ædelgas' },
  { symbol: 'Li', navn: 'Lithium', atomicNumber: 3, mass: 6.94, category: 'alkalimetal' },
  { symbol: 'C', navn: 'Kulstof', atomicNumber: 6, mass: 12.011, category: 'ikkemetal' },
  { symbol: 'N', navn: 'Kvælstof', atomicNumber: 7, mass: 14.007, category: 'ikkemetal' },
  { symbol: 'O', navn: 'Ilt', atomicNumber: 8, mass: 15.999, category: 'ikkemetal' },
  { symbol: 'Na', navn: 'Natrium', atomicNumber: 11, mass: 22.99, category: 'alkalimetal' },
  { symbol: 'Al', navn: 'Aluminium', atomicNumber: 13, mass: 26.982, category: 'andet-metal' },
  { symbol: 'S', navn: 'Svovl', atomicNumber: 16, mass: 32.06, category: 'ikkemetal' },
  { symbol: 'Cl', navn: 'Klor', atomicNumber: 17, mass: 35.45, category: 'halogen' },
  { symbol: 'Fe', navn: 'Jern', atomicNumber: 26, mass: 55.845, category: 'overgangsmetal' },
  { symbol: 'Cu', navn: 'Kobber', atomicNumber: 29, mass: 63.546, category: 'overgangsmetal' },
  { symbol: 'Ag', navn: 'Sølv', atomicNumber: 47, mass: 107.8682, category: 'overgangsmetal' },
  { symbol: 'Au', navn: 'Guld', atomicNumber: 79, mass: 196.96657, category: 'overgangsmetal' },
  { symbol: 'Pb', navn: 'Bly', atomicNumber: 82, mass: 207.2, category: 'andet-metal' },
  // U er et indre overgangsmetal (actinid); spec'ens kategoriliste nævner ikke U,
  // så den lægges under overgangsmetal — se DECISIONS.md.
  { symbol: 'U', navn: 'Uran', atomicNumber: 92, mass: 238.02891, category: 'overgangsmetal' },
]

export const ELEMENT_BY_SYMBOL: ReadonlyMap<string, Element> = new Map(
  ELEMENTS.map((e) => [e.symbol, e]),
)

export function elementMicroU(symbol: string): number {
  const el = ELEMENT_BY_SYMBOL.get(symbol)
  if (!el) throw new Error(`Ukendt grundstof: ${symbol}`)
  return toMicroU(el.mass)
}

/** Okabe–Ito-baseret, colorblind-sikker kategoripalette. */
export const CATEGORY_COLORS: Record<ElementCategory, string> = {
  ikkemetal: '#0072B2',
  ædelgas: '#56B4E9',
  alkalimetal: '#D55E00',
  overgangsmetal: '#E69F00',
  halogen: '#009E73',
  'andet-metal': '#CC79A7',
}

/** Form-cue pr. kategori så farve aldrig står alene. */
export const CATEGORY_SHAPES: Record<ElementCategory, 'cirkel' | 'diamant' | 'trekant' | 'firkant' | 'sekskant' | 'femkant'> = {
  ikkemetal: 'cirkel',
  ædelgas: 'diamant',
  alkalimetal: 'trekant',
  overgangsmetal: 'firkant',
  halogen: 'sekskant',
  'andet-metal': 'femkant',
}

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  ikkemetal: 'Ikkemetal',
  ædelgas: 'Ædelgas',
  alkalimetal: 'Alkalimetal',
  overgangsmetal: 'Overgangsmetal',
  halogen: 'Halogen',
  'andet-metal': 'Andet metal',
}
