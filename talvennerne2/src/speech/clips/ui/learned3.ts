// "Det lærte du" in Stjernefjeldet (QA3a P2-1, src/ui/screens/child/ceremony/describe.ts): the few
// words a fact of 3. klasse needs beside the skills' own clips — "463 ligger tættest på 460", "2 m er
// 103 cm længere end 97 cm", "Den største figur dækker 2 kvadrater mere". Fragments carry no
// punctuation. Wave 3; each clip lies in the sprite of its domain's wave 3 clips, which the round
// already fetched for its tasks, so the end of the round speaks it at once.
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

export const clips: Readonly<Record<ClipId, string>> = {
  's.learned.closestTo': 'ligger tættest på',
  's.learned.longerThan': 'længere end',
  's.learned.rightAngles': 'Fire rette hjørner',
  's.learned.area.bigger': 'Den største figur dækker',
  's.learned.area.more': 'kvadrater mere',
  's.learned.area.moreOne': 'kvadrat mere',
}

export const wave: Wave = 3

export function pack(id: ClipId): string {
  if (id === 's.learned.closestTo') return 'number-3'
  if (id === 's.learned.longerThan') return 'measure-3'
  return 'shapes-3'
}
