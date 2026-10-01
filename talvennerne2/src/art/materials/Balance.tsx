// Balances: the seesaw (vippebræt, equalSides: "det samme på begge sider") and the pan scale
// (skålvægt, weightCompare). Both are HTML shells around SVG parts so any content – equations,
// animals, things – can sit on them. Tilting animates with transform only (400 ms); calm mode and
// reduced motion get the end state without travel.
import type { CSSProperties, ReactNode } from 'react'
import { circle, ellipse, join, n, roundPoly, roundRect } from './geom'
import { MatSvg } from './kit'
import { GROUND, HIGHLIGHT, MAT, SW } from './palette'

const TRANSITION = 'transform 400ms cubic-bezier(.2,.8,.2,1)'

export interface SeesawProps {
  /** -1: left side down (heavier), 0: level, 1: right side down. */
  tilt: -1 | 0 | 1
  left?: ReactNode
  right?: ReactNode
  /** Width in CSS px (default 320). */
  width?: number
  label?: string
  className?: string
}

export function Seesaw({ tilt, left, right, width = 320, label, className }: SeesawProps) {
  const W = width
  const fulH = W * 0.2
  const plankH = W * 0.055
  const angle = tilt * 8
  const box: CSSProperties = { position: 'relative', width: W, height: W * 0.5 }
  const slot: CSSProperties = {
    position: 'absolute',
    bottom: plankH * 0.9,
    width: '44%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
  }
  return (
    <div className={className} style={box} role={label ? 'img' : undefined} aria-label={label}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <MatSvg w={200} h={42} size={W}>
          <path d={ellipse(100, 38, 46, 4)} fill={GROUND} />
          <path d={roundPoly([[100, 4], [124, 38], [76, 38]], 5)} fill={MAT.fulcrum.fill} />
          <path d={roundPoly([[100, 4], [124, 38], [104, 38]], 4)} fill={MAT.fulcrum.shade} />
          <path d={roundPoly([[100, 4], [124, 38], [76, 38]], 5)} fill="none" stroke={MAT.fulcrum.outline} strokeWidth={SW * 0.9} strokeLinejoin="round" />
        </MatSvg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: fulH - plankH * 0.3,
          height: plankH,
          transformOrigin: '50% 100%',
          transform: `rotate(${angle}deg)`,
          transition: TRANSITION,
        }}
        className="tv-mat-motion"
      >
        <MatSvg w={200} h={11} size={W} style={{ position: 'absolute', left: 0, bottom: 0 }}>
          <path d={roundRect(2, 1.5, 196, 8, 4)} fill={MAT.seesaw.fill} />
          <path d={roundRect(2, 6, 196, 3.5, 1.75)} fill={MAT.seesaw.shade} />
          <path d="M10 3.6h60" stroke={HIGHLIGHT} strokeWidth={1.6} strokeLinecap="round" />
          <path d={roundRect(2, 1.5, 196, 8, 4)} fill="none" stroke={MAT.seesaw.outline} strokeWidth={1.8} />
        </MatSvg>
        <div style={{ ...slot, left: '3%' }}>{left}</div>
        <div style={{ ...slot, right: '3%' }}>{right}</div>
      </div>
    </div>
  )
}

export interface PanScaleProps {
  /** -1: left pan down, 0: level, 1: right pan down. */
  tilt: -1 | 0 | 1
  left?: ReactNode
  right?: ReactNode
  width?: number
  label?: string
  className?: string
}

export function PanScale({ tilt, left, right, width = 320, label, className }: PanScaleProps) {
  const W = width
  const H = W * 0.7
  const k = W / 200 // px per unit
  const theta = (tilt * 10 * Math.PI) / 180
  const L = 70 // beam half-length in units
  const beamY = 40
  const dx = L * (1 - Math.cos(theta)) * k
  const dy = L * Math.sin(theta) * k
  // The pan's shaded underside: the outer bowl arc back along a smaller inner arc.
  const panShade = `M${20} 54.5a33 14 0 0 0 47-10.5h-8a26 10 0 0 1-39 10.5z`
  const pan = (side: -1 | 1, content: ReactNode) => {
    const tx = side === 1 ? -dx : dx
    const ty = side === 1 ? dy : -dy
    return (
      <div
        className="tv-mat-motion"
        style={{
          position: 'absolute',
          left: (100 + side * L - 36) * k,
          top: beamY * k,
          width: 72 * k,
          transform: `translate(${n(tx)}px, ${n(ty)}px)`,
          transition: TRANSITION,
        }}
      >
        <MatSvg w={72} h={62} size={72 * k}>
          <path d="M36 2L8 44M36 2L64 44" stroke={MAT.pan.outline} strokeWidth={1.6} />
          <path d="M3 44h66a33 14 0 0 1-66 0z" fill={MAT.pan.fill} />
          <path d={panShade} fill={MAT.pan.shade} />
          <path d="M3 44h66a33 14 0 0 1-66 0z" fill="none" stroke={MAT.pan.outline} strokeWidth={2.4} strokeLinejoin="round" />
          <path d={circle(36, 2.5, 3)} fill={MAT.pan.outline} />
        </MatSvg>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20 * k, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className={className} style={{ position: 'relative', width: W, height: H }} role={label ? 'img' : undefined} aria-label={label}>
      <MatSvg w={200} h={140} size={W} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={ellipse(100, 134, 50, 5)} fill={GROUND} />
        <path d={roundRect(94, beamY, 12, 86, 4)} fill={MAT.wood.fill} stroke={MAT.wood.outline} strokeWidth={2.4} />
        <path d={roundPoly([[64, 132], [136, 132], [124, 116], [76, 116]], 6)} fill={MAT.wood.fill} />
        <path d={roundPoly([[64, 132], [136, 132], [124, 116], [76, 116]], 6)} fill="none" stroke={MAT.wood.outline} strokeWidth={2.4} strokeLinejoin="round" />
      </MatSvg>
      <MatSvg
        w={200}
        h={140}
        size={W}
        className="tv-mat-motion"
        style={{ position: 'absolute', left: 0, top: 0, transformOrigin: `50% ${n((beamY / 140) * 100)}%`, transform: `rotate(${tilt * 10}deg)`, transition: TRANSITION }}
      >
        <path d={roundRect(100 - L - 4, beamY - 4, 2 * L + 8, 8, 4)} fill={MAT.pan.fill} stroke={MAT.pan.outline} strokeWidth={2.4} />
        <path d={join(circle(100, beamY, 7))} fill={MAT.fulcrum.fill} stroke={MAT.fulcrum.outline} strokeWidth={2.4} />
      </MatSvg>
      {pan(-1, left)}
      {pan(1, right)}
    </div>
  )
}
