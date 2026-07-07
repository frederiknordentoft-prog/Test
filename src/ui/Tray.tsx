import { useEffect, useRef, useState } from 'react'
import { unlockAudio } from '../audio/sound'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_SHAPES,
  ELEMENTS,
  type Element,
} from '../data/elements'
import { engine } from '../engine/instance'
import { playerSideOf, useGameStore } from '../state/store'
import type { PanSide } from '../game/types'
import { canvasHolder } from './ScaleCanvas'

/** Lille SVG-glyf pr. kategoriform — farve står aldrig alene. */
export function ShapeGlyph({ el, size = 10 }: { el: Element; size?: number }) {
  const color = CATEGORY_COLORS[el.category]
  const shape = CATEGORY_SHAPES[el.category]
  const s = size
  const half = s / 2
  const points: Record<string, string> = {
    diamant: `${half},0 ${s},${half} ${half},${s} 0,${half}`,
    trekant: `${half},0 ${s},${s} 0,${s}`,
    femkant: polygonPoints(5, half),
    sekskant: polygonPoints(6, half),
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      {shape === 'cirkel' ? (
        <circle cx={half} cy={half} r={half} fill={color} />
      ) : shape === 'firkant' ? (
        <rect x={0.5} y={0.5} width={s - 1} height={s - 1} fill={color} />
      ) : (
        <polygon points={points[shape]} fill={color} />
      )}
    </svg>
  )

  function polygonPoints(sides: number, r: number): string {
    const pts: string[] = []
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides
      pts.push(`${r + Math.cos(a) * r},${r + Math.sin(a) * r}`)
    }
    return pts.join(' ')
  }
}

function panAtClient(clientX: number, clientY: number): PanSide | null {
  const el = canvasHolder.el
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null
  }
  return engine.panAt(clientX - rect.left, clientY - rect.top)
}

type DragState = { x: number; y: number }

function TrayChip({ el }: { el: Element }) {
  const addElement = useGameStore((s) => s.addElement)
  const mode = useGameStore((s) => s.mode)
  const challenge = useGameStore((s) => s.challenge)
  const activeSide = useGameStore((s) => s.activeSide)

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const holdTimer = useRef<number | null>(null)
  const repeatTimer = useRef<number | null>(null)
  const repeated = useRef(false)

  const allowedSide = (side: PanSide | null): PanSide | null => {
    if (!side) return null
    const target = mode === 'fri' ? side : playerSideOf(challenge)
    return side === target ? side : null
  }

  const clearTimers = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    if (repeatTimer.current !== null) window.clearTimeout(repeatTimer.current)
    holdTimer.current = null
    repeatTimer.current = null
  }

  useEffect(() => clearTimers, [])

  const startHoldRepeat = () => {
    let count = 0
    const tick = () => {
      repeated.current = true
      addElement(el.symbol)
      count++
      // accelererende "hæld brint i"-følelse: 110 ms → 40 ms
      const delay = Math.max(40, 110 - count * 6)
      repeatTimer.current = window.setTimeout(tick, delay)
    }
    holdTimer.current = window.setTimeout(tick, 420)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    unlockAudio()
    e.currentTarget.setPointerCapture(e.pointerId)
    startPos.current = { x: e.clientX, y: e.clientY }
    dragging.current = false
    repeated.current = false
    startHoldRepeat()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (!dragging.current && dx * dx + dy * dy > 100) {
      dragging.current = true
      clearTimers() // et træk er ikke et hold
    }
    if (dragging.current) {
      setDrag({ x: e.clientX, y: e.clientY })
      engine.setDropPreview(allowedSide(panAtClient(e.clientX, e.clientY)))
    }
  }

  const finish = (e: React.PointerEvent<HTMLButtonElement>, commit: boolean) => {
    clearTimers()
    engine.setDropPreview(null)
    if (commit) {
      if (dragging.current) {
        const side = allowedSide(panAtClient(e.clientX, e.clientY))
        if (side) addElement(el.symbol, side)
      } else if (!repeated.current) {
        addElement(el.symbol) // alm. tap/klik/Enter
      }
    }
    dragging.current = false
    setDrag(null)
  }

  const shownSide = mode === 'fri' ? activeSide : playerSideOf(challenge)

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            unlockAudio()
            addElement(el.symbol)
          }
        }}
        className="tray-chip"
        style={{ borderColor: CATEGORY_COLORS[el.category] }}
        aria-label={`${el.navn} (${el.symbol}), ${el.mass.toLocaleString('da-DK')} u, ${CATEGORY_LABELS[el.category]}. Læg i ${shownSide === 'left' ? 'venstre' : 'højre'} skål`}
      >
        <span className="absolute right-1 top-1" aria-hidden="true">
          <ShapeGlyph el={el} size={9} />
        </span>
        <span className="font-display text-lg font-bold leading-none">{el.symbol}</span>
        <span className="text-[11px] font-semibold leading-tight tabular-nums">
          {el.mass.toLocaleString('da-DK', { maximumFractionDigits: 3 })}
        </span>
        <span className="text-[9px] leading-tight text-ink/60">{el.navn}</span>
      </button>
      {drag && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-4 bg-amber-100/95 font-display text-lg font-bold text-ink shadow-lg"
            style={{ borderColor: CATEGORY_COLORS[el.category] }}
          >
            {el.symbol}
          </div>
        </div>
      )}
    </>
  )
}

export function Tray() {
  const mode = useGameStore((s) => s.mode)
  const activeSide = useGameStore((s) => s.activeSide)
  const setActiveSide = useGameStore((s) => s.setActiveSide)

  return (
    <div className="border-t border-amber-900/20 bg-parchment-dark/70 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 pb-1.5">
        <p className="text-xs text-ink/70">
          Tip: hold en brik inde for at hælde mange i ad gangen.
        </p>
        {mode === 'fri' && (
          <div className="flex shrink-0 gap-1" role="group" aria-label="Aktiv skål ved tap">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setActiveSide(side)}
                className={`min-h-[32px] rounded-full px-3 text-xs font-semibold transition ${
                  activeSide === side
                    ? 'bg-walnut text-amber-100'
                    : 'bg-amber-900/10 text-ink/80'
                }`}
                aria-pressed={activeSide === side}
              >
                {side === 'left' ? '◀ Venstre' : 'Højre ▶'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1.5 sm:grid-cols-8">
        {ELEMENTS.map((el) => (
          <TrayChip key={el.symbol} el={el} />
        ))}
      </div>
    </div>
  )
}
