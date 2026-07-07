import { elementMicroU } from './elements'

export type Molecule = {
  formula: string
  navn: string
  molarMass: number // u — går EKSAKT op med tray-værdierne
  /** Atomsammensætning: symbol → antal. Kilde til sandhed for molekyle-mode. */
  atoms: Record<string, number>
  /** Kort "vidste du"-faktum (vises ved sejr). */
  fact: string
  /** Faglig note til udfordringsteksten, fx at NaCl er en formelenhed. */
  note?: string
}

export const MOLECULES: readonly Molecule[] = [
  { formula: 'H₂O', navn: 'Vand', molarMass: 18.015, atoms: { H: 2, O: 1 },
    fact: '18 u betyder 18 g/mol: 18 gram vand — én stor slurk — er 6,022·10²³ molekyler.' },
  { formula: 'CO₂', navn: 'Kuldioxid', molarMass: 44.009, atoms: { C: 1, O: 2 },
    fact: 'CO₂ (44 u) er tungere end luft (≈29 u) — derfor kan den samle sig i lavninger.' },
  { formula: 'CH₄', navn: 'Methan', molarMass: 16.043, atoms: { C: 1, H: 4 },
    fact: 'Methan (16 u) er lettere end luft (≈29 u) — derfor stiger den til vejrs.' },
  { formula: 'NH₃', navn: 'Ammoniak', molarMass: 17.031, atoms: { N: 1, H: 3 },
    fact: 'Ammoniak-molekylet er formet som en lille pyramide med kvælstof i toppen.' },
  { formula: 'O₂', navn: 'Ilt', molarMass: 31.998, atoms: { O: 2 },
    fact: 'Det er O₂ — ikke frie O-atomer — du indånder. Enkelt-oxygen er alt for reaktivt.',
    note: 'dioxygen — to oxygenatomer' },
  { formula: 'NaCl', navn: 'Salt', molarMass: 58.44, atoms: { Na: 1, Cl: 1 },
    fact: 'Salt er ikke et molekyle men et iongitter — NaCl kaldes derfor en formelenhed.',
    note: 'en formelenhed, ikke et molekyle' },
  {
    formula: 'C₆H₁₂O₆',
    navn: 'Glukose',
    molarMass: 180.156,
    atoms: { C: 6, H: 12, O: 6 },
    fact: 'Glukose: 24 atomer og 180,156 u — planter bygger den af CO₂, vand og sollys.',
  },
]

/** Summen af molekylets atomer i mikro-u — skal være === toMicroU(molarMass). */
export function moleculeAtomSumMicroU(m: Molecule): number {
  let sum = 0
  for (const [symbol, count] of Object.entries(m.atoms)) {
    sum += elementMicroU(symbol) * count
  }
  return sum
}

/** Menneskelæselig opløsning: «H₂O = 2 × H + 1 × O». */
export function moleculeBreakdown(m: Molecule): string {
  const parts = Object.entries(m.atoms).map(([s, n]) => `${n} × ${s}`)
  return `${m.formula} = ${parts.join(' + ')}`
}
