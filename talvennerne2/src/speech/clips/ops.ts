// Operators and connectors (SPEC §10.1): `op.*` are the signs read aloud, `frag.*` the shared
// sentence pieces that templates put numbers between ("Hvad er" 3 "plus" 4). Skill-specific
// sentences live in clips/skills/<domain>.ts, owned by the skill authors.
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'

const WAVED: Readonly<Record<ClipId, readonly [text: string, wave: Wave]>> = {
  // Signs: + − · : = < > (the "=" of a question is never read; see speech/equation.ts)
  'op.plus': ['plus', 1],
  'op.minus': ['minus', 1],
  'op.gange': ['gange', 2],
  'op.divideret_med': ['divideret med', 3],
  'op.er_lig_med': ['er lig med', 1],
  'op.mindre_end': ['mindre end', 1],
  'op.stoerre_end': ['større end', 1],
  'op.giver': ['giver', 1],
  'op.og': ['og', 1],
  'op.komma': ['komma', 3],

  // Question and instruction heads
  'frag.hvad_er': ['Hvad er', 1],
  'frag.hvad': ['hvad', 1],
  'frag.hvad_giver': ['hvad giver', 1],
  'frag.tryk_paa': ['Tryk på', 1],
  'frag.find_tallet': ['Find tallet', 1],
  'frag.laeg': ['Læg', 1],
  'frag.i_kurven': ['i kurven', 1],
  'frag.hvilket_tal_kommer_efter': ['Hvilket tal kommer efter', 1],
  'frag.hvilket_tal_kommer_foer': ['Hvilket tal kommer før', 1],
  'frag.det_dobbelte_af': ['Hvad er det dobbelte af', 2],
  'frag.halvdelen_af': ['Hvad er halvdelen af', 2],
  'frag.hvad_er_klokken': ['Hvad er klokken', 2],
  'frag.klokken_er': ['Klokken er', 2],
  'frag.stil_uret_saa_klokken_er': ['Stil uret, så klokken er', 2],
  'frag.hvor_mange_penge': ['Hvor mange penge', 2],
  'frag.koster': ['koster', 2],
  'frag.du_betaler_med': ['Du betaler med', 2],
  'frag.betal': ['Betal', 2],
  'frag.den_er': ['Den er', 2],
  'frag.det_er': ['Det er', 1],
}

export const clips: Readonly<Record<ClipId, string>> = Object.fromEntries(
  Object.entries(WAVED).map(([id, [text]]) => [id, text]),
)

export function wave(id: ClipId): Wave {
  return WAVED[id]?.[1] ?? 1
}

/** Operators and connectors are small and used everywhere: always in the preloaded core sprite. */
export const pack = 'core'
