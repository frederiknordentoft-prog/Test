// Clocks (SPEC §11): analog face with 12 numbers and 60 minute ticks (one path), a short thick hour
// hand in ink and a long minute hand in coral red (MINUTE_HAND); and a digital display in Nunito tabular digits.
// Minutes follow the answer model: 0–719 after 12:00 (analog), 0–1439 (24 h digital).
import { circle, ellipse, join, lune, n, polar, roundRect, sector, segments } from './geom'
import { MatSvg, Num } from './kit'
import type { MatBase } from './kit'
import { GROUND, HIGHLIGHT, INK, MAT, MINUTE_HAND, PRIMARY_SOFT, STAR, SW } from './palette'

/** Hand angles in degrees clockwise from 12 o'clock. The hour hand moves continuously. */
export function handAngles(minutes: number): { hour: number; minute: number } {
  const m = ((minutes % 720) + 720) % 720
  return { hour: m * 0.5, minute: (m % 60) * 6 }
}

export interface AnalogClockProps extends MatBase {
  /** 0–719 (or any integer; taken modulo 720). `null` draws the face without hands. */
  minutes: number | null
  numbers?: boolean
  /** Shade the minute-hand sweep from `from` to `to` (clockElapsed, hints). */
  sweep?: { from: number; to: number }
  /** Draw only the minute hand (hint for quarter/five-minute steps) or only the hour hand. */
  hands?: 'both' | 'minute' | 'hour'
}

const C = 100
const R_RIM = 94
const R_FACE = 80

const TICKS = segments(
  Array.from({ length: 60 }, (_, i) => {
    const [x1, y1] = polar(C, C, 76, i * 6 - 90)
    const [x2, y2] = polar(C, C, 71, i * 6 - 90)
    return [x1, y1, x2, y2] as const
  }),
)
const HOUR_TICKS = segments(
  Array.from({ length: 12 }, (_, i) => {
    const [x1, y1] = polar(C, C, 76.5, i * 30 - 90)
    const [x2, y2] = polar(C, C, 67, i * 30 - 90)
    return [x1, y1, x2, y2] as const
  }),
)

/** A hand pointing to 12 o'clock from the centre, rounded at both ends. */
function handPath(length: number, width: number, tail: number): string {
  const w = width / 2
  return (
    `M${n(C - w)} ${n(C + tail)}L${n(C - w * 0.78)} ${n(C - length + w)}` +
    `A${n(w * 0.78)} ${n(w * 0.78)} 0 0 1 ${n(C + w * 0.78)} ${n(C - length + w)}` +
    `L${n(C + w)} ${n(C + tail)}A${n(w)} ${n(w)} 0 0 1 ${n(C - w)} ${n(C + tail)}z`
  )
}
const HOUR_HAND = handPath(46, 12, 10)
const MINUTE_HAND_D = handPath(68, 7.5, 12)

export function AnalogClock({ minutes, numbers = true, sweep, hands = 'both', size, ...rest }: AnalogClockProps) {
  const a = minutes === null ? null : handAngles(minutes)
  const rim = MAT.rim
  const face = MAT.face
  let sweepD = ''
  if (sweep) {
    const from = handAngles(sweep.from).minute
    let to = from + ((((sweep.to - sweep.from) % 720) + 720) % 720) * 6
    if (to === from) to = from + 0.01
    sweepD = sector(C, C, 64, from - 90, Math.min(to, from + 359.99) - 90)
  }
  return (
    <MatSvg w={200} h={206} size={size ?? 200} {...rest}>
      <path d={ellipse(C, 196, 74, 7)} fill={GROUND} />
      {/* rim with cel shade and highlight */}
      <path d={circle(C, C, R_RIM)} fill={rim.fill} />
      <path d={lune(C, C, R_RIM - 1.5, 9, 9)} fill={rim.shade} />
      <path d={`M${n(C - 62)} ${n(C - 62)}A88 88 0 0 1 ${n(C + 10)} ${n(C - 87.4)}`} fill="none" stroke={HIGHLIGHT} strokeWidth={6} strokeLinecap="round" />
      <path d={circle(C, C, R_RIM)} fill="none" stroke={rim.outline} strokeWidth={SW + 0.5} />
      {/* face */}
      <path d={circle(C, C, R_FACE)} fill={face.fill} />
      <path d={lune(C, C, R_FACE, -5, -5)} fill={face.shade} />
      <path d={circle(C, C, R_FACE)} fill="none" stroke={rim.outline} strokeWidth={2.5} />
      {sweepD && <path d={sweepD} fill={PRIMARY_SOFT} stroke={MAT.point.fill} strokeWidth={1.5} strokeOpacity={0.5} />}
      <path d={TICKS} stroke={face.outline} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      <path d={HOUR_TICKS} stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
      {numbers &&
        Array.from({ length: 12 }, (_, i) => {
          const h = i + 1
          const [x, y] = polar(C, C, 55.5, h * 30 - 90)
          return (
            <Num key={h} x={x} y={y} size={21} fill={INK}>
              {h}
            </Num>
          )
        })}
      {a && hands !== 'minute' && (
        <g transform={`rotate(${n(a.hour)} ${C} ${C})`}>
          <path d={HOUR_HAND} fill={INK} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      )}
      {a && hands !== 'hour' && (
        <g transform={`rotate(${n(a.minute)} ${C} ${C})`}>
          <path d={MINUTE_HAND_D} fill={MINUTE_HAND} stroke={MAT.apple.outline} strokeWidth={1.8} strokeLinejoin="round" />
        </g>
      )}
      <path d={circle(C, C, 8.5)} fill={INK} />
      <path d={circle(C, C, 3)} fill={MINUTE_HAND} />
    </MatSvg>
  )
}

export interface DigitalClockProps extends MatBase {
  /** 0–1439. */
  minutes: number
  /** 24-hour display (14:30) or 12-hour (2:30). */
  h24?: boolean
}

/** "14:30" / "2:05": minutes always two digits, hours without a leading zero. */
export function digitalText(minutes: number, h24 = true): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  let h = Math.floor(m / 60)
  if (!h24) h = h % 12 || 12
  return `${h}:${String(m % 60).padStart(2, '0')}`
}

export function DigitalClock({ minutes, h24 = true, size, ...rest }: DigitalClockProps) {
  const body = MAT.rim
  const text = digitalText(minutes, h24)
  const [hh, mm] = text.split(':')
  return (
    <MatSvg w={220} h={112} size={size ?? 220} {...rest}>
      <path d={ellipse(110, 104, 84, 6)} fill={GROUND} />
      <path d={join(roundRect(28, 88, 26, 14, 6), roundRect(166, 88, 26, 14, 6))} fill={body.shade} stroke={body.outline} strokeWidth={SW} />
      <path d={roundRect(4, 4, 212, 92, 26)} fill={body.fill} />
      <path d={roundRect(4, 60, 212, 36, 18)} fill={body.shade} opacity={0.55} />
      <path d={`M24 13h${n(120)}`} stroke={HIGHLIGHT} strokeWidth={5} strokeLinecap="round" />
      <path d={roundRect(4, 4, 212, 92, 26)} fill="none" stroke={body.outline} strokeWidth={SW} />
      <path d={roundRect(20, 18, 180, 64, 16)} fill={INK} stroke={body.outline} strokeWidth={2.5} />
      <Num x={100} y={50} size={50} fill={STAR} anchor="end">
        {hh}
      </Num>
      <path d={join(circle(110, 40, 4), circle(110, 60, 4))} fill={STAR} />
      <Num x={120} y={50} size={50} fill={STAR} anchor="start">
        {mm}
      </Num>
    </MatSvg>
  )
}
