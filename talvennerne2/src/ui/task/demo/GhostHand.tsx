// The ghost hand of the demo films: a soft white pointing hand with an ink contour. CSS shifts the
// svg so the fingertip (14, 2.2 in the drawing) sits on the wrapper's origin: moving the wrapper to
// a point puts the fingertip on it.
import { blob, ellipse, join } from '../../../art/materials/geom'
import type { V2 } from '../../../art/materials/geom'

const OUTLINE: V2[] = [
  [9.5, 8], [14, 2.2], [18.5, 8], [18.6, 21], [22.6, 19.4], [26.6, 21.6], [30.6, 20.6], [34, 23.2],
  [38, 24.4], [40, 29], [40.4, 37], [38, 46], [31, 52], [18.5, 52], [12, 47], [7, 41.5], [2.4, 35],
  [2.6, 30.6], [6, 29.2], [9.4, 32], [9.4, 24],
]
const HAND = blob(OUTLINE, 0.62)
const NAIL = ellipse(14, 6.6, 2.6, 2.1)
const CREASES = join('M19 30q2.4 1.6 4.8 0', 'M27.2 30.4q2.2 1.4 4.4 0', 'M13.5 22.5h3.6')

export function GhostHand() {
  return (
    <svg className="tv-ghost" viewBox="0 0 44 56" width="58" height="74" aria-hidden overflow="visible">
      <path className="tv-ghost__shadow" d={HAND} transform="translate(3 5)" />
      <path className="tv-ghost__fill" d={HAND} />
      <path className="tv-ghost__nail" d={NAIL} />
      <path className="tv-ghost__crease" d={CREASES} />
      <path className="tv-ghost__line" d={HAND} />
    </svg>
  )
}
