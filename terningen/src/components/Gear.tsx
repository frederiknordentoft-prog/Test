import { memo } from 'react'
import { makeGearPath } from '../lib/gear'
import { periodFor, type GearSpec } from '../lib/gearTrain'

type Props = { spec: GearSpec }

/**
 * Ét tandhjul = ét <svg>, så rotationen er en ren composited CSS-transform
 * på et HTML-element (60 fps uden repaint af hele urværket).
 */
function GearImpl({ spec }: Props) {
  const R = spec.outerR * 1.04
  const path = makeGearPath(spec.teeth, spec.outerR, spec.innerR, spec.toothDepth)
  const gradId = `brass-${spec.id}`
  const period = periodFor(spec)
  const hasHoles = spec.teeth >= 13
  const holeCount = spec.teeth >= 20 ? 5 : 4
  const holeR = spec.r * 0.145
  const holeRing = spec.r * 0.55
  const isBack = spec.layer === 'back'

  return (
    <div
      className="gear-slot"
      data-layer={spec.layer}
      style={{
        left: `${50 + spec.cx}%`,
        top: `${50 + spec.cy}%`,
        width: `${2 * R}%`,
        height: `${2 * R}%`,
        marginLeft: `${-R}%`,
        marginTop: `${-R}%`,
      }}
    >
      <svg
        className="gear-spin"
        viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
        aria-hidden="true"
        focusable="false"
        style={
          {
            '--gear-period': `${period}s`,
            '--gear-direction': spec.dir === 1 ? 'normal' : 'reverse',
          } as React.CSSProperties
        }
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brass-dark)" />
            <stop offset="0.38" stopColor={isBack ? 'var(--brass-dark)' : 'var(--brass-mid)'} />
            <stop offset="0.5" stopColor={isBack ? 'var(--brass-mid)' : 'var(--brass-light)'} />
            <stop offset="0.62" stopColor={isBack ? 'var(--brass-dark)' : 'var(--brass-mid)'} />
            <stop offset="1" stopColor="var(--brass-dark)" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${spec.phase})`}>
          <path
            d={path}
            fill={`url(#${gradId})`}
            fillRule="evenodd"
            className="gear-stroke"
            strokeWidth={Math.max(0.35, spec.outerR * 0.018)}
            strokeLinejoin="round"
          />
          {hasHoles &&
            Array.from({ length: holeCount }, (_, i) => {
              const a = (i / holeCount) * Math.PI * 2 + Math.PI / holeCount
              return (
                <circle
                  key={i}
                  className="gear-hole"
                  cx={Math.cos(a) * holeRing}
                  cy={Math.sin(a) * holeRing}
                  r={holeR}
                />
              )
            })}
          {/* nav og aksel */}
          <circle
            cx={0}
            cy={0}
            r={spec.innerR * 1.9}
            fill="none"
            className="gear-stroke"
            strokeWidth={Math.max(0.3, spec.innerR * 0.22)}
          />
        </g>
      </svg>
    </div>
  )
}

export const Gear = memo(GearImpl)
