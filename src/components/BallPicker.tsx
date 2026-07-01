import { BALL_SPECS, BALL_TYPES } from '../physics/constants'
import { useGameStore } from '../store/gameStore'

/** Choose which ball to drop — each type has a distinct feel. */
export function BallPicker() {
  const ballType = useGameStore((s) => s.ballType)
  const setBallType = useGameStore((s) => s.setBallType)
  const running = useGameStore((s) => s.runResult) === 'running'

  return (
    <div className="flex items-center justify-center gap-1.5">
      {BALL_TYPES.map((type) => {
        const spec = BALL_SPECS[type]
        const active = ballType === type
        return (
          <button
            key={type}
            type="button"
            disabled={running}
            onClick={() => setBallType(type)}
            aria-pressed={active}
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
