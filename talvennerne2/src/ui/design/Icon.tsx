// Renders one icon from icons.ts: a 24-grid SVG in currentColor, stroke 2, round caps and joins.
// Duotone body at 18 % (override with --icon-fill / --icon-fill-o), or fully filled with `solid`.
import type { CSSProperties } from 'react'
import { ICONS } from './icons'
import type { IconDef, IconName } from './icons'
import { cx } from './cx'

export interface IconProps {
  name: IconName
  /** CSS pixels; the drawing is on a 24 grid. */
  size?: number | string
  /** Accessible name; decorative (aria-hidden) when omitted. */
  title?: string
  /** Fill the body completely instead of the 18 % duotone. */
  solid?: boolean
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 28, title, solid, strokeWidth = 2, className, style }: IconProps) {
  const def: IconDef = ICONS[name]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx('tv-icon', solid && 'tv-icon--solid', className)}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {def.fill?.map((d, i) => (
        <path key={`f${i}`} d={d} className="tv-icon__fill" fill="currentColor" stroke="none" opacity={solid ? 1 : 0.18} />
      ))}
      {def.stroke.map((d, i) => (
        <path key={`s${i}`} d={d} />
      ))}
      {def.solid?.map((d, i) => (
        <path key={`d${i}`} d={d} fill="currentColor" stroke="none" />
      ))}
    </svg>
  )
}
