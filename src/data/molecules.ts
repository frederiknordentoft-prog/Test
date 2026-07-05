import { elementMicroU } from './elements'

export type Molecule = {
  formula: string
  navn: string
  molarMass: number // u — går EKSAKT op med tray-værdierne
  /** Atomsammensætning: symbol → antal. Kilde til sandhed for molekyle-mode. */
  atoms: Record<string, number>
}

export const MOLECULES: readonly Molecule[] = [
  { formula: 'H₂O', navn: 'Vand', molarMass: 18.015, atoms: { H: 2, O: 1 } },
  { formula: 'CO₂', navn: 'Kuldioxid', molarMass: 44.009, atoms: { C: 1, O: 2 } },
  { formula: 'CH₄', navn: 'Methan', molarMass: 16.043, atoms: { C: 1, H: 4 } },
  { formula: 'NH₃', navn: 'Ammoniak', molarMass: 17.031, atoms: { N: 1, H: 3 } },
  { formula: 'O₂', navn: 'Ilt', molarMass: 31.998, atoms: { O: 2 } },
  { formula: 'NaCl', navn: 'Salt', molarMass: 58.44, atoms: { Na: 1, Cl: 1 } },
  {
    formula: 'C₆H₁₂O₆',
    navn: 'Glukose',
    molarMass: 180.156,
    atoms: { C: 6, H: 12, O: 6 },
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
