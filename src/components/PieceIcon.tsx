import type { PieceType } from '../types'
import { PIECE_SPECS, ROTATION_TABLE } from '../physics/constants'

type Props = {
  type: PieceType
  /** Index into the global 16-step rotation table. */
  rotation?: number
  size?: number
  /** Stroke/fill colour; defaults to the piece's palette colour. */
  color?: string
}

/**
 * A piece drawn as its TRUE silhouette at its TRUE angle — used on slot
 * buttons, the radial angle picker and the palette, so the angle you tap is
 * exactly the angle you get. (Text glyphs like '／' carry their own built-in
 * slant and misrepresent the rotation — see DECISIONS.)
 */
export function PieceIcon({ type, rotation = 0, size = 26, color }: Props) {
  const c = color ?? PIECE_SPECS[type].color
  const angleDeg = ((ROTATION_TABLE[((rotation % 16) + 16) % 16] ?? 0) * 180) / Math.PI

  // Shapes live in a -20..20 box and mirror the physics geometry's proportions.
  let shape: React.ReactNode
  switch (type) {
    case 'ramp':
      // plank 92×11 → bar
      shape = <rect x={-16} y={-2.2} width={32} height={4.4} rx={2.2} fill={c} />
      break
    case 'bouncer':
      // pad 66×13 → shorter bar with a light membrane stripe
      shape = (
        <>
          <rect x={-12} y={-3} width={24} height={6} rx={3} fill={c} />
          <rect x={-12} y={-3} width={24} height={2.4} rx={1.2} fill="#ffffff" opacity={0.55} />
        </>
      )
      break
    case 'funnel':
      // two inward-sloping plates with the centre gap
      shape = (
        <g stroke={c} strokeWidth={4} strokeLinecap="round">
          <line x1={-15} y1={-5} x2={-5} y2={5} />
          <line x1={15} y1={-5} x2={5} y2={5} />
        </g>
      )
      break
    case 'booster':
      // capsule + arrowhead pointing along the firing direction (+x at 0°)
      shape = (
        <>
          <rect x={-14} y={-5} width={22} height={10} rx={5} fill={c} />
          <path d="M 8 -7 L 17 0 L 8 7 Z" fill={c} />
          <path d="M -8 -3.5 L -3 0 L -8 3.5" stroke="#fff7ed" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M -1 -3.5 L 4 0 L -1 3.5" stroke="#fff7ed" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </>
      )
      break
    case 'portal':
      shape = (
        <>
          <circle r={12} fill="none" stroke={c} strokeWidth={3} />
          <circle r={6.5} fill="none" stroke={c} strokeWidth={1.8} opacity={0.75} />
          <circle r={2} fill={c} />
        </>
      )
      break
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="-20 -20 40 40"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <g transform={`rotate(${angleDeg})`}>{shape}</g>
    </svg>
  )
}
