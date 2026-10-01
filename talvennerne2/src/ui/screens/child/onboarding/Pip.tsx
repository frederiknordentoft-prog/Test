// Pip, the narrator (SPEC §1): a round little sparrow beside a speech bubble on the screens before
// the map. Drawn here, with colours from tokens (first-start.css), until Pip has a rig drawing of
// its own. Kept apart from the animal art so a screen with only Pip stays small.
import { blob, circle, ellipse, join } from '../../../../art/materials/geom'
import type { V2 } from '../../../../art/materials/geom'
import { cx } from '../../../design/cx'

const PIP_BODY: V2[] = [[60, 14], [86, 22], [102, 46], [104, 74], [92, 98], [60, 108], [28, 98], [16, 74], [18, 46], [34, 22]]
const PIP_WING: V2[] = [[0, 0], [10, 6], [14, 20], [8, 30], [0, 26], [-4, 12]]
const wing = blob(PIP_WING, 0.9)

/**
 * Pip, the narrator (a round little sparrow). Bobs while talking; still in calm mode. Drawn here
 * until Pip has a rig drawing of its own.
 */
export function PipFigure({ talking, className }: { talking?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 124" className={cx('tv-pip', talking && 'is-talking', className)} aria-hidden>
      <ellipse cx="60" cy="116" rx="30" ry="5" className="tv-pip__shadow" />
      <g className="tv-pip__bird">
        <path d="M50 106l-3 9M70 106l3 9M44 115h7M69 115h7" className="tv-pip__feet" />
        <path d={blob(PIP_BODY, 0.95)} className="tv-pip__body" />
        <path d="M60 14c-4-8 2-12 6-9M60 14c2-7 9-8 11-4" className="tv-pip__tuft" />
        <path d="M30 32q30-22 60 0q-10 12-30 12t-30-12z" className="tv-pip__cap" />
        <path d={ellipse(60, 82, 26, 22)} className="tv-pip__belly" />
        <path d={wing} transform="translate(18 62) rotate(14)" className="tv-pip__wing" />
        <path d={wing} transform="translate(102 62) scale(-1 1) rotate(14)" className="tv-pip__wing" />
        <path d={join(circle(46, 54, 6.4), circle(74, 54, 6.4))} className="tv-pip__eye" />
        <path d={join(circle(48, 51.6, 2.2), circle(76, 51.6, 2.2))} className="tv-pip__glint" />
        <path d={join(ellipse(36, 66, 6.5, 4), ellipse(84, 66, 6.5, 4))} className="tv-pip__cheek" />
        <path d="M53 63q7-7 14 0q-7 6-14 0z" className="tv-pip__beak" />
        <path d="M54.5 64.5q5.5 6 11 0" className="tv-pip__beak-low" />
      </g>
    </svg>
  )
}
