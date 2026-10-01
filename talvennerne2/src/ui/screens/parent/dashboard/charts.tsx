// Hand-built SVG graphics for the parent dashboard (SPEC §9.1: no chart library, ≤ 8 KB). Status is
// always shape + colour + a label nearby, never colour alone. Colours come from tokens via classes.
import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Box } from '../../../../engine/types'
import type { DayBar, DotKind, TableGrid } from '../../../../parent/types'
import { DOT_LABEL, fmtDate, fmtLongDate, fmtMinutes, fmtWeekday } from '../../../../parent/format'

const C = 9
const R = 7

/** ○ ikke startet · ◔ øver · ◑ med støtte · ● kan selv · dashed: sprunget over ved start. */
export function StatusDot({ kind, size = 18, label }: { kind: DotKind; size?: number; label?: string | null }) {
  const named = label !== null
  return (
    <svg
      className={`tv-dot tv-dot--${kind}`} viewBox="0 0 18 18" width={size} height={size}
      role={named ? 'img' : undefined} aria-label={named ? label ?? DOT_LABEL[kind] : undefined} aria-hidden={named ? undefined : true}
    >
      {kind === 'independent' && <circle className="tv-dot__fill" cx={C} cy={C} r={R} />}
      {kind === 'support' && <path className="tv-dot__fill" d={`M${C} ${C - R}A${R} ${R} 0 0 1 ${C} ${C + R}Z`} />}
      {kind === 'practising' && <path className="tv-dot__fill" d={`M${C} ${C}V${C - R}A${R} ${R} 0 0 1 ${C + R} ${C}Z`} />}
      <circle className="tv-dot__ring" cx={C} cy={C} r={R} strokeDasharray={kind === 'skipped' ? '3 2.6' : undefined} />
    </svg>
  )
}

/** A bar with a 4 px rounded top and a square foot on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

const NICE = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

/** The element's width in CSS pixels, so a chart draws in real pixels with real font sizes. */
function useWidth<T extends Element>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Learning and play minutes per day as two separate bars (no judgement, no target line). */
export function DayBars({ days, today }: { days: readonly DayBar[]; today: string }) {
  const [ref, W] = useWidth<HTMLDivElement>(340)
  const left = 30
  const slot = (W - left) / days.length
  const H = 150
  const base = H - 24
  const top = 22
  const maxMin = Math.max(...days.map((d) => Math.max(d.learnMs, d.playMs) / 60_000), 1)
  const scale = NICE.find((n) => n >= maxMin) ?? Math.ceil(maxMin / 60) * 60
  const y = (min: number) => base - ((base - top) * min) / scale
  const bw = Math.max(4, Math.min(12, slot * 0.34))
  return (
    <div ref={ref} className="tv-bars-box">
    <svg className="tv-bars" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Læringstid og legetid pr. dag, de sidste 14 dage">
      {[0, scale / 2, scale].map((m) => (
        <g key={m}>
          <line className="tv-bars__grid" x1={left} x2={W} y1={y(m)} y2={y(m)} />
          <text className="tv-bars__tick" x={left - 5} y={y(m) + 3.5} textAnchor="end">{m}</text>
        </g>
      ))}
      <text className="tv-bars__tick" x={left - 5} y={y(scale) - 9} textAnchor="end">min</text>
      {days.map((d, i) => {
        const cx = left + i * slot + slot / 2
        const learn = d.learnMs / 60_000
        const play = d.playMs / 60_000
        return (
          <g key={d.day}>
            <title>{`${fmtLongDate(d.day)}: læring ${fmtMinutes(d.learnMs)}, leg ${fmtMinutes(d.playMs)}`}</title>
            <rect className="tv-bars__hit" x={cx - slot / 2} y={top} width={slot} height={H - top} />
            {learn > 0 && <path className="tv-bars__learn" d={barPath(cx - bw - 1, y(learn), bw, base - y(learn))} />}
            {play > 0 && <path className="tv-bars__play" d={barPath(cx + 1, y(play), bw, base - y(play))} />}
            <text className={d.day === today ? 'tv-bars__day is-today' : 'tv-bars__day'} x={cx} y={H - 8} textAnchor="middle">
              {Number(d.day.slice(8))}
            </text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}

/** Fourteen days with their dates; an active day (any answer) is filled. Never a streak. */
export function DayCalendar({ days, today }: { days: readonly DayBar[]; today: string }) {
  return (
    <ol className="tv-cal" aria-label="Aktive dage">
      {days.map((d) => (
        <li key={d.day} className={`tv-cal__day${d.active ? ' is-active' : ''}${d.day === today ? ' is-today' : ''}`} title={fmtLongDate(d.day)}>
          <span className="tv-cal__wd">{fmtWeekday(d.day)}</span>
          <span className="tv-cal__date">{fmtDate(d.day).split(' ')[0]}</span>
          <span className="tv-cal__mark" aria-label={d.active ? 'aktiv' : 'ikke aktiv'} />
        </li>
      ))}
    </ol>
  )
}

/** Share of keys in box 4–5, with the 80 % mark that "Kan selv" needs. */
export function ShareBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg className="tv-share" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label={`${Math.round(v * 100)} % sikre (boks 4–5)`}>
      <rect className="tv-share__track" x="0" y="2" width="100" height="8" rx="4" />
      {v > 0 && <rect className="tv-share__fill" x="0" y="2" width={Math.max(v * 100, 3)} height="8" rx="4" />}
      <line className="tv-share__mark" x1="80" x2="80" y1="0" y2="12" />
    </svg>
  )
}

/** The 10 · 10 table, each product shaded by its box (one hue, light to dark). */
export function TableGridView({ grid }: { grid: TableGrid }) {
  const cell = 20
  const pad = 18
  const size = pad + 10 * cell
  return (
    <svg className="tv-grid" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gangetabellen 10 · 10">
      {grid.rows[0].map((c) => (
        <text key={`c${c.b}`} className="tv-grid__head" x={pad + (c.b - 0.5) * cell} y={12} textAnchor="middle">{c.b}</text>
      ))}
      {grid.rows.map((row) => (
        <g key={row[0].a}>
          <text className="tv-grid__head" x={pad - 5} y={pad + (row[0].a - 0.5) * cell + 3.5} textAnchor="end">{row[0].a}</text>
          {row.map((c) => (
            <g key={c.b}>
              <title>{c.key ? `${c.a} · ${c.b} = ${c.a * c.b}: ${boxText(c.box, c.seen)}` : `${c.a} · ${c.b} = ${c.a * c.b}`}</title>
              <rect className={`tv-grid__cell tv-grid__cell--${c.key ? (c.seen ? c.box : 'new') : 'none'}`} x={pad + (c.b - 1) * cell + 1} y={pad + (c.a - 1) * cell + 1} width={cell - 2} height={cell - 2} rx="3" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}

export function boxText(box: Box, seen: boolean): string {
  if (!seen) return 'ikke øvet endnu'
  return box >= 4 ? `boks ${box}, sidder fast` : `boks ${box}`
}
