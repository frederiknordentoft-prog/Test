import type { TaskProps } from './types'
import { centreOf } from './types'

/** Three big answer buttons — the house style, and the fastest to answer. */
export function ChoiceTask({ task, onAnswer, locked, result, accent }: TaskProps) {
  return (
    <div className="grid w-full max-w-md grid-cols-3 gap-3">
      {task.options.map((option) => {
        const isAnswer = option === task.answer
        const wasChosen = result?.given === option
        const revealed = result !== null
        const state = revealed && isAnswer ? 'right' : revealed && wasChosen ? 'wrong' : 'idle'
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            onClick={(e) => onAnswer(option, centreOf(e.currentTarget))}
            className={`tap-target flex h-24 items-center justify-center rounded-3xl text-5xl font-black tabular-nums transition-colors sm:h-28 sm:text-6xl ${
              state === 'right'
                ? 'punch bg-emerald-400 text-[#0b2b1d] shadow-[0_8px_0_rgba(0,60,35,0.45)]'
                : state === 'wrong'
                  ? 'nudge bg-white/15 text-white/45 ring-2 ring-white/25'
                  : 'bg-white/95 text-[#1b1233] shadow-[0_8px_0_rgba(0,0,0,0.3)]'
            }`}
            style={state === 'idle' && !revealed ? { borderBottom: `0 solid ${accent}` } : undefined}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
