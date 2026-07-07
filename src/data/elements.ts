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
  /** Kort, fagligt solidt "vidste du"-faktum (vises ved sejr og i indstillinger). */
  fact: string
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
// Grundstof 8 hedder Oxygen på dansk fagsprog; "ilt" er dagligsprog for O₂.
export const ELEMENTS: readonly Element[] = [
  { symbol: 'H', navn: 'Brint', atomicNumber: 1, mass: 1.008, category: 'ikkemetal',
    fact: 'Brint er universets letteste og mest almindelige atom — ca. 74 % af al almindelig masse.' },
  { symbol: 'He', navn: 'Helium', atomicNumber: 2, mass: 4.0026, category: 'ædelgas',
    fact: 'Helium er så let, at Jordens tyngdekraft ikke kan holde på det — det siver langsomt ud i rummet.' },
  { symbol: 'Li', navn: 'Lithium', atomicNumber: 3, mass: 6.94, category: 'alkalimetal',
    fact: 'Lithium er det letteste metal — det flyder på vand (og reagerer livligt med det).' },
  { symbol: 'C', navn: 'Kulstof', atomicNumber: 6, mass: 12.011, category: 'ikkemetal',
    fact: 'Kulstof-12 definerer selve masseenheden: 1 u er præcis 1/12 af et ¹²C-atom.' },
  { symbol: 'N', navn: 'Kvælstof', atomicNumber: 7, mass: 14.007, category: 'ikkemetal',
    fact: 'Kvælstof udgør 78 % af luften — som molekylet N₂, altid to atomer ad gangen.' },
  { symbol: 'O', navn: 'Oxygen', atomicNumber: 8, mass: 15.999, category: 'ikkemetal',
    fact: 'Oxygen er fagnavnet for atomet — "ilt" bruger vi om molekylet O₂, det du indånder.' },
  { symbol: 'Na', navn: 'Natrium', atomicNumber: 11, mass: 22.99, category: 'alkalimetal',
    fact: 'Natrium er så blødt, at det kan skæres med en kniv — og det eksploderer i vand.' },
  { symbol: 'Al', navn: 'Aluminium', atomicNumber: 13, mass: 26.982, category: 'andet-metal',
    fact: 'Aluminium er det mest almindelige metal i jordskorpen.' },
  { symbol: 'S', navn: 'Svovl', atomicNumber: 16, mass: 32.06, category: 'ikkemetal',
    fact: 'Svovls 32,06 er et gennemsnit af fire naturlige isotoper.' },
  { symbol: 'Cl', navn: 'Klor', atomicNumber: 17, mass: 35.45, category: 'halogen',
    fact: '35,45 er ikke et helt tal, fordi klor er en blanding: ca. 76 % ³⁵Cl og 24 % ³⁷Cl.' },
  { symbol: 'Fe', navn: 'Jern', atomicNumber: 26, mass: 55.845, category: 'overgangsmetal',
    fact: 'Jern er endestationen for fusion i stjerner — alt tungere kræver en supernova.' },
  { symbol: 'Cu', navn: 'Kobber', atomicNumber: 29, mass: 63.546, category: 'overgangsmetal',
    fact: 'Kobber og guld er de eneste rene metaller med egen farve — alle andre er grå.' },
  { symbol: 'Ag', navn: 'Sølv', atomicNumber: 47, mass: 107.8682, category: 'overgangsmetal',
    fact: 'Sølv leder strøm og varme bedst af alle metaller.' },
  { symbol: 'Au', navn: 'Guld', atomicNumber: 79, mass: 196.96657, category: 'overgangsmetal',
    fact: 'Ét guldatom vejer det samme som ca. 195 brintatomer — prøv selv på vægten!' },
  { symbol: 'Pb', navn: 'Bly', atomicNumber: 82, mass: 207.2, category: 'andet-metal',
    fact: 'Bly er så blødt, at man kan skrive med det — deraf ordet "blyant".' },
  // U er et indre overgangsmetal (actinid); spec'ens kategoriliste nævner ikke U,
  // så den lægges under overgangsmetal — se DECISIONS.md.
  { symbol: 'U', navn: 'Uran', atomicNumber: 92, mass: 238.02891, category: 'overgangsmetal',
    fact: 'Uran er naturens tungeste grundstof — der skal ca. 236 brint til at balancere ét uranatom.' },
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
