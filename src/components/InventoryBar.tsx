import type { LevelDef } from '../types'
import { PIECE_SPECS } from '../physics/constants'
import { inventoryTypes, remaining } from '../game/inventory'
import { useGameStore } from '../store/gameStore'

type Props = { level: LevelDef }

/** Piece palette: pick the active piece type, see how many of each remain. */
export function InventoryBar({ level }: Props) {
  const placements = useGameStore((s) => s.placements)
  const activePieceType = useGameStore((s) => s.activePieceType)
  const setActivePieceType = useGameStore((s) => s.setActivePieceType)
  const runResult = useGameStore((s) => s.runResult)
  const disabled = runResult === 'running'

  const types = inventoryTypes(level)

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {types.map((type) => {
        const spec = PIECE_SPECS[type]
        const left = remaining(level, placements, type)
        const isActive = activePieceType === type
        const exhausted = left <= 0
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => setActivePieceType(type)}
            aria-pressed={isActive}
            className={[
              'flex min-w-[84px] flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-2 transition touch-manipulation active:scale-95',
              isActive ? 'border-white bg-slate-700/80' : 'border-slate-700 bg-slate-800/60',
              exhausted ? 'opacity-45' : '',
            ].join(' ')}
          >
            <span className="text-2xl leading-none" style={{ color: spec.color }}>
              {spec.glyph}
            </span>
            <span className="text-xs font-medium text-slate-200">{spec.label}</span>
            <span className={['text-xs font-bold', exhausted ? 'text-slate-500' : 'text-slate-300'].join(' ')}>
              {left} tilbage
            </span>
          </button>
        )
      })}
    </div>
  )
}
