import type { Element } from '../data/elements'
import type { Molecule } from '../data/molecules'

export type Tile =
  | { id: string; kind: 'element'; element: Element }
  | { id: string; kind: 'molecule'; molecule: Molecule } // kun på låst challenge-side

export type PanSide = 'left' | 'right'
export type Mode = 'fri' | 'balancer' | 'ram' | 'molekyle'

export type Challenge = {
  mode: Mode
  fixedSide: Tile[] // forudfyldt+låst side ([] i 'fri' og 'ram')
  fixedSideOf: PanSide
  targetMass: number | null // sat i 'ram'; ellers mål = sum(fixedSide)
  fewestMode?: boolean // 'færrest brikker'-variant af 'ram'
  toleranceU: number // input-generøsitet i u
  /** Kun i molekyle-mode: det valgte molekyle (til sejrstekst m.m.). */
  molecule?: Molecule
  seed: number
}

export type BeamState = {
  angle: number
  angularVel: number
  leftMass: number // u
  rightMass: number // u
  settled: boolean // |angularVel| < settleVel og tæt på mål-udslag
  balanced: boolean // inden for tolerance mod modstander/target
}

export function tileMass(tile: Tile): number {
  return tile.kind === 'element' ? tile.element.mass : tile.molecule.molarMass
}

export function tileLabel(tile: Tile): string {
  return tile.kind === 'element' ? tile.element.symbol : tile.molecule.formula
}
