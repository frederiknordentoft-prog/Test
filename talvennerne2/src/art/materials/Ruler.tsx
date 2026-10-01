// Ruler in centimetres (SPEC §11): mm and half-cm ticks as one path, cm ticks as another, numbers
// 0–15 (or 0–20). The zero sits a little in from the end, like a real ruler. RULER exposes the
// geometry so a scene can lay an object exactly from a given centimetre.
import { ellipse, n, roundRect, segments } from './geom'
import { MatSvg, Num } from './kit'
import type { MatBase } from './kit'
import { GROUND, HIGHLIGHT, INK, MAT, SW } from './palette'

/** Ruler geometry in its own units: 1 cm = CM units, the 0 mark at X0. */
export const RULER = { CM: 40, X0: 22, H: 74 } as const

export interface RulerProps extends MatBase {
  cm?: 15 | 20
  /** CSS px per centimetre (default 22). `size` overrides. */
  cmPx?: number
  /** Highlight a stretch (e.g. the measured length) from `from` to `to` cm. */
  mark?: { from: number; to: number }
}

export function Ruler({ cm = 15, cmPx = 22, mark, size, ...rest }: RulerProps) {
  const { CM, X0, H } = RULER
  const W = X0 * 2 + cm * CM
  const t = MAT.ruler
  const top = 6
  const minor: [number, number, number, number][] = []
  const major: [number, number, number, number][] = []
  for (let i = 0; i <= cm * 10; i++) {
    const x = X0 + (i * CM) / 10
    if (i % 10 === 0) major.push([x, top, x, top + 24])
    else minor.push([x, top, x, top + (i % 5 === 0 ? 17 : 10)])
  }
  return (
    <MatSvg w={W} h={H + 10} size={size ?? W * (cmPx / CM)} {...rest}>
      <path d={ellipse(W / 2, H + 4, W * 0.46, 5)} fill={GROUND} />
      <path d={roundRect(1.5, 1.5 + top - 6, W - 3, H - 3, 9)} fill={t.fill} />
      <path d={roundRect(1.5, H - 20, W - 3, 18.5, 9)} fill={t.shade} opacity={0.8} />
      {mark && <path d={roundRect(X0 + mark.from * CM, top, (mark.to - mark.from) * CM, 30, 3)} fill={MAT.point.fill} opacity={0.18} />}
      <path d={`M14 ${H - 26}h${n(W * 0.34)}`} stroke={HIGHLIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d={segments(minor)} stroke={t.outline} strokeWidth={1.6} strokeLinecap="round" />
      <path d={segments(major)} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      {Array.from({ length: cm + 1 }, (_, i) => (
        <Num key={i} x={X0 + i * CM} y={top + 38} size={17} fill={INK}>
          {i}
        </Num>
      ))}
      <Num x={W - 26} y={H - 12} size={11} fill={t.outline} weight={800}>
        cm
      </Num>
      <path d={roundRect(1.5, 1.5, W - 3, H - 3, 9)} fill="none" stroke={t.outline} strokeWidth={SW} />
    </MatSvg>
  )
}
