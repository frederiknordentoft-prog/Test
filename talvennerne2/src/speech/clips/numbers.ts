// Number clips (SPEC §10.2): n.mid/end.0–100 and 1000, the neuter "et", round hundreds and the
// "… hundrede og" heads. Generated from numberWords so the catalogue and compile() never disagree.
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'
import { numberWords } from '../numberWords'

const table: Record<ClipId, string> = {}
for (const form of ['mid', 'end'] as const) {
  for (let n = 0; n <= 100; n++) table[`n.${form}.${n}`] = numberWords(n)
  table[`n.${form}.1000`] = numberWords(1000)
  table[`n.${form}.1.et`] = numberWords(1, 'n')
  for (let h = 100; h <= 900; h += 100) table[`h.${form}.${h}`] = numberWords(h)
}
for (let h = 100; h <= 900; h += 100) table[`hog.${h}`] = `${numberWords(h)} og`

export const clips = table

/** 0–100 and "et" are wave 1; hundreds and tusind arrive with 1.–2. klasse (wave 2). */
export function wave(id: ClipId): Wave {
  return id.startsWith('n.') && !id.endsWith('.1000') ? 1 : 2
}

/** n0-20 is preloaded; 21–100 and the hundreds load on demand. */
export function pack(id: ClipId): string {
  const m = /^n\.(?:mid|end)\.(\d+)(\.et)?$/.exec(id)
  if (m && Number(m[1]) <= 20) return 'n0-20'
  if (m && Number(m[1]) <= 100) return 'n21-100'
  return 'hundreds'
}
