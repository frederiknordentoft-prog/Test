import type { LevelDef } from '../types'
import { BALL_SPECS } from '../physics/constants'
import { useGameStore } from '../store/gameStore'

type Props = { level: LevelDef }

/** Choose which ball to drop — only the balls THIS level offers (gating). */
export function BallPicker({ level }: Props) {
  const ballType = useGameStore((s) => s.ballType)
  const setBallType = useGameStore((s) => s.setBallType)
  const running = useGameStore((s) => s.runResult) === 'running'

  if (level.balls.length <= 1) {
    const spec = BALL_SPECS[level.balls[0] ?? 'iron']
    return (
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <span
          className="h-5 w-5 rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 30%, ${spec.accent === '#241a12' ? '#ffd9b0' : '#ffffffcc'} 0%, ${spec.color} 45%, ${spec.color} 100%)`,
            boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.4)',
          }}
        />
        Kugle: <span className="font-semibold text-slate-200">{spec.label}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      {level.balls.map((type) => {
        const spec = BALL_SPECS[type]
        const active = ballType === type
        return (
          <button
            key={type}
            type="button"
            disabled={running}
            onClick={() => setBallType(type)}
            aria-pressed={active}
            aria-label={`Vælg ${spec.label}`}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-2 transition touch-manipulation active:scale-95',
              active ? 'border-white bg-slate-700/80' : 'border-slate-700 bg-slate-800/60',
            ].join(' ')}
          >
            <span
              className="h-6 w-6 shrink-0 rounded-full"
              style={{
                background: `radial-gradient(circle at 32% 30%, ${spec.accent === '#241a12' ? '#ffd9b0' : '#ffffffcc'} 0%, ${spec.color} 45%, ${spec.color} 100%)`,
                boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.4)',
              }}
            />
            <span className="text-[11px] font-semibold text-slate-100">{spec.label}</span>
          </button>
        )
      })}
    </div>
  )
}
