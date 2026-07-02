import type { LevelDef } from '../types'
import { PIECE_SPECS, ROTATION_DOMAINS } from '../physics/constants'
import { inventoryTypes, remaining } from '../game/inventory'
import { useGameStore } from '../store/gameStore'
import { PieceIcon } from './PieceIcon'

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
              'relative flex min-w-[84px] flex-col items-center gap-0.5 rounded-xl border-2 px-3 pb-1.5 pt-2 transition touch-manipulation',
              'hover:-translate-y-0.5 active:scale-95',
              isActive
                ? 'border-white bg-gradient-to-b from-slate-600/90 to-slate-700/90 shadow-lg'
                : 'border-slate-700 bg-slate-800/60 hover:border-slate-500',
              exhausted ? 'opacity-45' : '',
            ].join(' ')}
          >
            <PieceIcon type={type} rotation={ROTATION_DOMAINS[type][0]} size={30} />
            <span className="text-xs font-semibold text-slate-100">{spec.label}</span>
            <span
              className={[
                'absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-black shadow',
                exhausted ? 'bg-slate-600 text-slate-300' : 'bg-amber-400 text-slate-900',
              ].join(' ')}
            >
              {left}
            </span>
          </button>
        )
      })}
    </div>
  )
}
