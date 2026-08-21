import { useId } from 'react'
import type { CreatureLook } from './creatureGen'
import { bodyPath, eyePositions } from './creatureGen'

export type Mood = 'idle' | 'cheer' | 'think' | 'sad'

interface Props {
  look: CreatureLook
  mood?: Mood
  size?: number
  golden?: boolean
  className?: string
}

/**
 * One talven, drawn from its parameters. Everything is SVG primitives, so a
 * creature is crisp at any size and weighs nothing.
 */
export function Creature({ look, mood = 'idle', size = 120, golden = false, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const skin = `skin-${uid}`
  const clip = `clip-${uid}`
  const shine = `shine-${uid}`

  const body = bodyPath(look)
  const eyes = eyePositions(look)
  const faceY = look.top + (look.bottom - look.top) * 0.42
  const mouthY = faceY + look.eyeSize + 9
  const { hue, hue2 } = look

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`creature creature-${mood} ${className}`}
      style={{ animationDelay: `${-look.phase}s`, overflow: 'visible' }}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={skin} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue}, 85%, 72%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2}, 75%, 52%)`} />
        </linearGradient>
        <radialGradient id={shine} cx="0.35" cy="0.25" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`halo-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor="hsl(45, 100%, 65%)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="hsl(45, 100%, 65%)" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>

      {golden && (
        <g className="creature-halo">
          <ellipse cx="50" cy={(look.top + look.bottom) / 2} rx={look.width + 20} ry={(look.bottom - look.top) / 2 + 18}
            fill={`url(#halo-${uid})`} />
          <ellipse cx="50" cy={(look.top + look.bottom) / 2} rx={look.width + 9} ry={(look.bottom - look.top) / 2 + 8}
            fill="none" stroke="hsl(45, 100%, 68%)" strokeWidth="2.5" opacity="0.9" />
        </g>
      )}

      {/* feet peek out below the body */}
      {look.feet && (
        <g fill={`hsl(${hue2}, 70%, 44%)`}>
          <ellipse cx={50 - look.width * 0.42} cy={look.bottom - 1} rx="8" ry="5.5" />
          <ellipse cx={50 + look.width * 0.42} cy={look.bottom - 1} rx="8" ry="5.5" />
        </g>
      )}

      {/* what is on top */}
      <g className="creature-crown" fill={`hsl(${hue2}, 72%, 58%)`}>
        {look.crown === 'ears' && (
          <>
            <ellipse cx={50 - look.width * 0.55} cy={look.top + 4} rx="8" ry="12" transform={`rotate(-22 ${50 - look.width * 0.55} ${look.top + 4})`} />
            <ellipse cx={50 + look.width * 0.55} cy={look.top + 4} rx="8" ry="12" transform={`rotate(22 ${50 + look.width * 0.55} ${look.top + 4})`} />
          </>
        )}
        {look.crown === 'horns' && (
          <>
            <path d={`M ${50 - look.width * 0.45} ${look.top + 6} L ${50 - look.width * 0.62} ${look.top - 12} L ${50 - look.width * 0.2} ${look.top + 1} Z`} />
            <path d={`M ${50 + look.width * 0.45} ${look.top + 6} L ${50 + look.width * 0.62} ${look.top - 12} L ${50 + look.width * 0.2} ${look.top + 1} Z`} />
          </>
        )}
        {look.crown === 'antenna' && (
          <>
            <path d={`M 50 ${look.top + 4} Q 54 ${look.top - 10} 47 ${look.top - 18}`} stroke={`hsl(${hue2}, 72%, 58%)`} strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="47" cy={look.top - 20} r="5.5" fill={`hsl(${(hue + 180) % 360}, 95%, 65%)`} />
          </>
        )}
        {look.crown === 'fin' && (
          <path d={`M 50 ${look.top - 14} Q ${50 + look.width * 0.3} ${look.top - 4} 50 ${look.top + 6} Q ${50 - look.width * 0.3} ${look.top - 4} 50 ${look.top - 14} Z`} />
        )}
      </g>

      <path d={body} fill={`url(#${skin})`} />

      <g clipPath={`url(#${clip})`}>
        {look.pattern === 'spots' && (
          <g fill={`hsl(${hue2}, 80%, 42%)`} opacity="0.45">
            <circle cx="34" cy="66" r="7" />
            <circle cx="62" cy="74" r="5" />
            <circle cx="70" cy="55" r="4" />
            <circle cx="42" cy="80" r="4.5" />
          </g>
        )}
        {look.pattern === 'stripes' && (
          <g stroke={`hsl(${hue2}, 80%, 42%)`} strokeWidth="6" opacity="0.35" strokeLinecap="round">
            <path d="M 10 62 H 90" />
            <path d="M 10 76 H 90" />
            <path d="M 10 90 H 90" />
          </g>
        )}
        {look.pattern === 'belly' && (
          <ellipse cx="50" cy={look.bottom - 16} rx={look.width * 0.6} ry="17" fill="rgba(255,255,255,0.5)" />
        )}
        <path d={body} fill={`url(#${shine})`} />
      </g>

      {look.blush && (
        <g fill={`hsl(${(hue + 340) % 360}, 90%, 70%)`} opacity="0.55">
          <ellipse cx={eyes[0] - 6} cy={faceY + 9} rx="6" ry="4" />
          <ellipse cx={eyes[eyes.length - 1] + 6} cy={faceY + 9} rx="6" ry="4" />
        </g>
      )}

      <g className="creature-eyes">
        {eyes.map((x, i) => (
          <g key={i}>
            <ellipse cx={x} cy={faceY} rx={look.eyeSize} ry={look.eyeSize * (look.pupil === 'sleepy' ? 0.62 : 1)} fill="#fff" />
            {look.pupil === 'ring' ? (
              <>
                <circle cx={x} cy={faceY} r={look.eyeSize * 0.55} fill="#1b1233" />
                <circle cx={x} cy={faceY} r={look.eyeSize * 0.26} fill={`hsl(${hue}, 90%, 60%)`} />
              </>
            ) : look.pupil === 'sleepy' ? (
              <path d={`M ${x - look.eyeSize * 0.7} ${faceY} q ${look.eyeSize * 0.7} ${look.eyeSize * 0.7} ${look.eyeSize * 1.4} 0`}
                stroke="#1b1233" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            ) : (
              <circle cx={x} cy={faceY + 1} r={look.eyeSize * 0.5} fill="#1b1233" />
            )}
            <circle cx={x - look.eyeSize * 0.3} cy={faceY - look.eyeSize * 0.35} r={look.eyeSize * 0.2} fill="#fff" />
          </g>
        ))}
      </g>

      <g stroke="#1b1233" strokeWidth="2.4" fill="none" strokeLinecap="round">
        {mood === 'sad' ? (
          <path d={`M ${50 - 8} ${mouthY + 3} q 8 -7 16 0`} />
        ) : look.mouth === 'o' ? (
          <ellipse cx="50" cy={mouthY} rx={mood === 'cheer' ? 8 : 5} ry={mood === 'cheer' ? 9 : 5.5} fill="#1b1233" stroke="none" />
        ) : look.mouth === 'wave' ? (
          <path d={`M ${50 - 10} ${mouthY} q 5 5 10 0 q 5 -5 10 0`} />
        ) : look.mouth === 'fang' ? (
          <>
            <path d={`M ${50 - 9} ${mouthY} q 9 7 18 0`} />
            <path d={`M ${50 - 4} ${mouthY + 3} l 2 4 l 2 -4`} fill="#fff" stroke="none" />
          </>
        ) : (
          <path d={`M ${50 - 9} ${mouthY} q 9 ${mood === 'cheer' ? 13 : 8} 18 0`} />
        )}
      </g>
    </svg>
  )
}

/** The egg a talven arrives in. Cracks open on the reward screen. */
export function Egg({ hue = 45, size = 160, cracked = false, className = '' }: { hue?: number; size?: number; cracked?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`egg-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue}, 90%, 82%)`} />
          <stop offset="100%" stopColor={`hsl(${(hue + 30) % 360}, 70%, 55%)`} />
        </linearGradient>
      </defs>
      <path d="M 50 8 C 76 24 88 50 88 64 C 88 82 71 94 50 94 C 29 94 12 82 12 64 C 12 50 24 24 50 8 Z" fill={`url(#egg-${uid})`} />
      <ellipse cx="38" cy="34" rx="9" ry="13" fill="rgba(255,255,255,0.45)" transform="rotate(-20 38 34)" />
      {cracked && (
        <path d="M 14 58 L 30 52 L 38 62 L 52 50 L 62 62 L 74 52 L 87 60"
          stroke="rgba(27,18,51,0.75)" strokeWidth="3.5" fill="none" strokeLinejoin="round" />
      )}
    </svg>
  )
}
