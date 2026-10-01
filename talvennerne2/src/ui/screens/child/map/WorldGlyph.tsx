// A small emblem per world for the world picker, drawn like the icon set (24 grid, stroke 2, round
// caps, duotone body): Engdalen a flower on the meadow, Hestebakkerne rolling hills with a fence,
// Regnbueskoven a tree under a rainbow, Stjernefjeldet a peak under a star.
import type { WorldId } from '../../../../engine/types'
import { cx } from '../../../design/cx'

interface Glyph {
  stroke: string[]
  fill: string[]
}

const GLYPHS: Readonly<Record<WorldId, Glyph>> = {
  eng: {
    fill: ['M2.5 20.5c3.2-2.6 6.4-3.6 9.5-3.6s6.3 1 9.5 3.6z', 'M12 5.2a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6z'],
    stroke: [
      'M2.5 20.5c3.2-2.6 6.4-3.6 9.5-3.6s6.3 1 9.5 3.6',
      'M12 9.8v7.1',
      'M12 3.4a2 2 0 0 1 1.9 1.5a2 2 0 0 1 2.4 2.4a2 2 0 0 1-.6 3.3a2 2 0 0 1-3.7.7a2 2 0 0 1-3.7-.7a2 2 0 0 1-.6-3.3a2 2 0 0 1 2.4-2.4A2 2 0 0 1 12 3.4z',
      'M12 14.2c1.6-.4 2.8-1.5 3.3-3',
    ],
  },
  bakke: {
    fill: ['M1.8 18.6c2.8-4.4 5.6-6.6 8.6-6.6c2.2 0 3.6 1.2 5 2.6c1.6-1.6 3.1-2.4 4.8-2.4v6.4z'],
    stroke: [
      'M1.8 18.6c2.8-4.4 5.6-6.6 8.6-6.6c2.2 0 3.6 1.2 5 2.6c1.6-1.6 3.1-2.4 4.8-2.4',
      'M2 21h20',
      'M6.5 21v-3.4M10.5 21v-3.4M14.5 21v-3.4M18.5 21v-3.4M5 18.6h15',
      'M16.4 4.2a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8z',
    ],
  },
  skov: {
    fill: ['M12 7.2c2.9 0 4.6 2.2 4.6 4.6c0 2.2-1.7 3.9-4.6 3.9s-4.6-1.7-4.6-3.9c0-2.4 1.7-4.6 4.6-4.6z'],
    stroke: [
      'M2.6 14.6a9.4 9.4 0 0 1 18.8 0',
      'M5.6 14.6a6.4 6.4 0 0 1 12.8 0',
      'M12 7.2c2.9 0 4.6 2.2 4.6 4.6c0 2.2-1.7 3.9-4.6 3.9s-4.6-1.7-4.6-3.9c0-2.4 1.7-4.6 4.6-4.6z',
      'M12 15.7v5.3M8.6 21h6.8',
    ],
  },
  fjeld: {
    fill: ['M2.4 20.6l6.8-11.2l3.2 4.6l2.4-3l6.8 9.6z'],
    stroke: [
      'M2.4 20.6l6.8-11.2l3.2 4.6l2.4-3l6.8 9.6z',
      'M7.4 12.4l1.8 1.6l1.8-1.6',
      'M16.6 2.8l.9 1.9l2 .3l-1.5 1.4l.4 2l-1.8-1l-1.8 1l.4-2l-1.5-1.4l2-.3z',
    ],
  },
}

export function WorldGlyph({ world, size = 32, className }: { world: WorldId; size?: number | string; className?: string }) {
  const g = GLYPHS[world]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx('tv-icon tv-worldglyph', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {g.fill.map((d, i) => (
        <path key={`f${i}`} d={d} className="tv-icon__fill" fill="currentColor" stroke="none" />
      ))}
      {g.stroke.map((d, i) => (
        <path key={`s${i}`} d={d} />
      ))}
    </svg>
  )
}
