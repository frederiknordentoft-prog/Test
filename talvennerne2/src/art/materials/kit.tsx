// Shared building blocks for material SVGs: the svg wrapper, numbers, and the cel-shaded disc that
// coins, counters, beads and pips are made of (flat fill, shade half-moon, 45 % highlight, coloured
// contour – the animals' style). No filter, mask, foreignObject or <image>; numbers use <text>.
import type { CSSProperties, ReactNode } from 'react'
import { circle, ellipse, lune, n } from './geom'
import { HIGHLIGHT, NUM_FONT, SW } from './palette'
import type { Tone } from './palette'

export interface MatBase {
  /** Rendered width in CSS px (height follows the aspect ratio). */
  size?: number
  /** Accessible name; decorative (aria-hidden) when omitted. */
  label?: string
  className?: string
  style?: CSSProperties
}

export function MatSvg({
  w,
  h,
  size,
  label,
  className,
  style,
  children,
  x = 0,
  y = 0,
}: MatBase & { w: number; h: number; x?: number; y?: number; children: ReactNode }) {
  const width = size ?? w
  return (
    <svg
      viewBox={`${n(x)} ${n(y)} ${n(w)} ${n(h)}`}
      width={n(width)}
      height={n((width * h) / w)}
      className={['tv-mat', className].filter(Boolean).join(' ')}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      overflow="visible"
    >
      {children}
    </svg>
  )
}

export interface NumProps {
  x: number
  y: number
  /** Font size in material units; the text is centred on (x, y). */
  size: number
  fill: string
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
  children: ReactNode
  letterSpacing?: number
  stroke?: string
  strokeWidth?: number
}

/** A number (or short word) centred on (x, y) in Nunito with tabular digits. */
export function Num({ x, y, size, fill, weight = 900, anchor = 'middle', children, letterSpacing, stroke, strokeWidth }: NumProps) {
  return (
    <text
      x={n(x)}
      y={n(y + size * 0.355)}
      fontSize={n(size)}
      fontWeight={weight}
      fontFamily={NUM_FONT}
      textAnchor={anchor}
      fill={fill}
      letterSpacing={letterSpacing}
      stroke={stroke}
      strokeWidth={strokeWidth}
      paintOrder={stroke ? 'stroke' : undefined}
      strokeLinejoin={stroke ? 'round' : undefined}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </text>
  )
}

/** Cel-shaded disc: fill, shade half-moon lower right, highlight upper left, contour on top. */
export function Disc({
  cx,
  cy,
  r,
  tone,
  sw = SW,
  hi = true,
  shade = true,
}: {
  cx: number
  cy: number
  r: number
  tone: Tone
  sw?: number
  hi?: boolean
  shade?: boolean
}) {
  const inner = r - sw / 2
  return (
    <g>
      <path d={circle(cx, cy, r)} fill={tone.fill} />
      {shade && <path d={lune(cx, cy, inner, inner * 0.3, inner * 0.3)} fill={tone.shade} />}
      {hi && <path d={ellipse(cx - r * 0.36, cy - r * 0.4, r * 0.26, r * 0.15)} fill={HIGHLIGHT} transform={`rotate(-38 ${n(cx - r * 0.36)} ${n(cy - r * 0.4)})`} />}
      <path d={circle(cx, cy, r)} fill="none" stroke={tone.outline} strokeWidth={sw} />
    </g>
  )
}

/** Soft flat ground shadow (an ellipse) under an object. */
export function Ground({ cx, cy, rx, ry, fill }: { cx: number; cy: number; rx: number; ry: number; fill: string }) {
  return <path d={ellipse(cx, cy, rx, ry)} fill={fill} />
}
