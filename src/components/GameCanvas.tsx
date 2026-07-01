import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LevelDef } from '../types'
import { buildWorld, simulate, type BallFrame } from '../physics/simulate'
import { PHYSICS_HZ, PIECE_SPECS, ROTATION_STEPS, rotationDegrees } from '../physics/constants'
import { pieceInSlot } from '../game/inventory'
import { renderScene } from '../render/renderer'
import { useGameStore } from '../store/gameStore'

type Props = { level: LevelDef }

const MAX_BOARD_W = 460

function degLabel(rotation: number): string {
  const d = rotationDegrees(rotation)
  return `${(Number.isInteger(d) ? String(d) : d.toFixed(1)).replace('.', ',')}°`
}

export function GameCanvas({ level }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const placements = useGameStore((s) => s.placements)
  const ballType = useGameStore((s) => s.ballType)
  const runResult = useGameStore((s) => s.runResult)
  const finishRun = useGameStore((s) => s.finishRun)
  const tapSlot = useGameStore((s) => s.tapSlot)
  const removeSlot = useGameStore((s) => s.removeSlot)

  const world = useMemo(() => buildWorld(level, placements, ballType), [level, placements, ballType])
  const [scale, setScale] = useState(0.7)

  // Frozen final frame of a finished run (so won/failed keeps the ball + trail).
  const restFrame: BallFrame = { x: level.dropPoint.x, y: level.dropPoint.y, a: 0 }
  const finalBallRef = useRef<BallFrame>(restFrame)
  const finalTrailRef = useRef<BallFrame[]>([])
  const dprRef = useRef(1)

  const draw = useCallback(
    (ball: BallFrame, trail: BallFrame[]) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderScene(ctx, { level, world, ballType, ball, trail, runResult, scale, dpr: dprRef.current })
    },
    [level, world, ballType, runResult, scale],
  )

  // Fit the whole board inside the available area (width AND height) so the game
  // fills the screen without scrolling. Capped so it never balloons on desktop.
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const cssW = wrap.clientWidth
      const cssH = wrap.clientHeight
      const sc = Math.min(cssW / level.boardWidth, cssH / level.boardHeight, MAX_BOARD_W / level.boardWidth)
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr
      canvas.width = Math.round(level.boardWidth * sc * dpr)
      canvas.height = Math.round(level.boardHeight * sc * dpr)
      canvas.style.width = `${level.boardWidth * sc}px`
      canvas.style.height = `${level.boardHeight * sc}px`
      setScale(sc)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [level])

  // Static frame whenever we are not mid-animation.
  useEffect(() => {
    if (runResult === 'running') return
    if (runResult === 'won' || runResult === 'failed') {
      draw(finalBallRef.current, finalTrailRef.current)
    } else {
      finalTrailRef.current = []
      finalBallRef.current = { x: level.dropPoint.x, y: level.dropPoint.y, a: 0 }
      draw(finalBallRef.current, [])
    }
  }, [draw, runResult, level.dropPoint])

  // Animation: when a run starts, simulate once (deterministic) then play the
  // ball along the recorded trajectory. Physics is fully precomputed — the
  // render loop only interpolates position/spin over time.
  useEffect(() => {
    if (runResult !== 'running') return
    const sim = simulate(level, placements, ballType)
    const traj = sim.trajectory
    const realSec = traj.length / PHYSICS_HZ
    const durationSec = Math.min(3.5, Math.max(1.0, realSec))
    let raf = 0
    let start = 0
    let cancelled = false

    const frame = (now: number) => {
      if (cancelled) return
      if (!start) start = now
      const t = (now - start) / 1000 / durationSec
      const idx = Math.min(traj.length - 1, Math.max(0, Math.floor(t * (traj.length - 1))))
      const pos = traj[idx]!
      const trail = traj.slice(0, idx + 1)
      draw(pos, trail)
      if (idx >= traj.length - 1) {
        finalBallRef.current = pos
        finalTrailRef.current = trail
        finishRun(sim.result, sim.reason)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // Intentionally keyed on runResult only: placements/ball are frozen during a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runResult])

  const interactive = runResult !== 'running'
  const dispW = level.boardWidth * scale
  const dispH = level.boardHeight * scale

  return (
    <div ref={wrapRef} className="flex min-h-0 w-full flex-1 items-center justify-center select-none">
      {/* Inner box is exactly the canvas size, so the slot overlay aligns to it. */}
      <div className="relative" style={{ width: dispW, height: dispH }}>
        <canvas ref={canvasRef} className="block rounded-2xl shadow-2xl" />

        {/* DOM slot overlay — large, reliable tap targets (crucial for iOS). */}
        <div className="pointer-events-none absolute inset-0">
          {level.slots.map((slot) => {
            const placed = pieceInSlot(placements, slot.id)
            const spec = placed ? PIECE_SPECS[placed.type] : null
            const left = slot.position.x * scale
            const top = slot.position.y * scale
            return (
              <div key={slot.id} className="absolute" style={{ left, top, transform: 'translate(-50%, -50%)' }}>
                <button
                  type="button"
                  aria-label={placed ? `Rotér brik i felt ${slot.id}` : `Placér brik i felt ${slot.id}`}
                  disabled={!interactive}
                  onClick={() => interactive && tapSlot(slot.id)}
                  className={[
                    'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold transition',
                    'active:scale-95 touch-manipulation',
                    placed
                      ? 'shadow-lg'
                      : 'border-2 border-dashed border-slate-500/70 text-slate-400 hover:border-sky-400 hover:text-sky-300',
                    !interactive ? 'opacity-70' : '',
                  ].join(' ')}
                  style={
                    placed && spec
                      ? { backgroundColor: `${spec.color}33`, boxShadow: `0 0 0 2px ${spec.color}`, color: '#f8fafc' }
                      : undefined
                  }
                >
                  {placed && spec ? (
                    <span
                      className="transition-transform duration-150"
                      style={{ transform: `rotate(${ROTATION_STEPS[placed.rotation] ?? 0}rad)`, display: 'inline-block' }}
                    >
                      {spec.glyph}
                    </span>
                  ) : (
                    '＋'
                  )}
                </button>

                {placed && (
                  <>
                    <button
                      type="button"
                      aria-label={`Fjern brik i felt ${slot.id}`}
                      disabled={!interactive}
                      onClick={() => interactive && removeSlot(slot.id)}
                      className="pointer-events-auto absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm text-slate-200 shadow ring-1 ring-slate-600 active:scale-95"
                    >
                      ×
                    </button>
                    <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/80 px-1.5 text-[10px] text-slate-300">
                      {degLabel(placed.rotation)}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
