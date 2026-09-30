// Kropsskabeloner (SPEC §6.4): funktioner fra ankrene (rx, ry, bias) til en body-path.
// `inflate` udvider formen jævnt – tøj klippes til kroppen udvidet 2 enheder (fit-regel 3).
import { bun } from './shapes'
import type { AnchorSet, BodyKind, OutlineFn } from './types'

interface Template {
  /** Hvor langt under centrum det bredeste sted ligger (andel af ry). */
  bias: number
  eTop: number
  eBottom: number
  taper: number
}

const TEMPLATES: Record<BodyKind, Template> = {
  // Siddende bolle med flad, tung bund (kanin, kat, hamster, panda, lam, isbjørn).
  round: { bias: 0.34, eTop: 2.0, eBottom: 2.45, taper: 0.2 },
  // Pære/æg: smal top, bred bund (pingvin, egern, pindsvin, ugle, Pip).
  pear: { bias: 0.36, eTop: 2.0, eBottom: 2.7, taper: 0.3 },
  // Høj og slank siddende krop (hest, enhjørning, pegasus, hvalp, ræv, drage).
  tall: { bias: 0.18, eTop: 2.1, eBottom: 2.5, taper: 0.18 },
}

export function templateBody(kind: BodyKind): OutlineFn {
  const t = TEMPLATES[kind]
  return (a: AnchorSet, inflate: number) => {
    const { x, y } = a.bodyCenter
    const cy = y + a.bodyRy * t.bias
    return bun({
      cx: x,
      cy,
      rx: a.bodyRx + inflate,
      top: cy - (y - a.bodyRy) + inflate,
      bottom: y + a.bodyRy - cy + inflate,
      eTop: t.eTop,
      eBottom: t.eBottom,
      taper: t.taper,
    })
  }
}

/** Husets hovedform: bredest ved kinderne, blød top (bruges når arten ikke har sit eget hoved). */
export const defaultHead: OutlineFn = (a: AnchorSet, inflate: number) => {
  const { x, y } = a.headCenter
  const cy = y + a.headRy * 0.12
  return bun({
    cx: x,
    cy,
    rx: a.headRx + inflate,
    top: a.headRy * 1.12 + inflate,
    bottom: a.headRy * 0.88 + inflate,
    eTop: 2.15,
    eBottom: 2.35,
    taper: 0.04,
  })
}
