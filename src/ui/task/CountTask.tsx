import { useEffect, useMemo, useState } from 'react'
import type { TaskProps } from './types'
import { centreOf } from './types'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'
import { hashSeed, makeRng } from '../../engine/rng'

const FRUIT = ['🍎', '🍐', '🍊', '🍋', '🫐', '🍓', '🥕', '🌰']

/**
 * Count out the right number of things. The most concrete task in the app and
 * the one that actually belongs in 0. klasse — the child touches every item, so
 * counting is a physical act rather than a symbol to decode.
 */
export function CountTask({ task, onAnswer, locked, result, accent }: TaskProps) {
  const [taken, setTaken] = useState<number[]>([])

  useEffect(() => {
    setTaken([])
  }, [task.id])

  const pile = useMemo(() => {
    const rng = makeRng(hashSeed(task.id))
    const total = Math.min(12, Math.max(task.answer + 3, 8))
    const fruit = FRUIT[rng.int(FRUIT.length)]
    return Array.from({ length: total }, (_, i) => ({ i, fruit, tilt: (rng.next() - 0.5) * 24 }))
  }, [task.id, task.answer])

  const toggle = (index: number) => {
    if (locked) return
    sfx.pop()
    haptics.tap()
    setTaken((t) => (t.includes(index) ? t.filter((x) => x !== index) : [...t, index]))
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {/* the basket */}
      <div
        className="flex min-h-[7rem] w-full flex-wrap items-center justify-center gap-2 rounded-3xl p-3 ring-2 transition-colors"
        style={{
          background: result?.correct ? 'rgba(52,211,153,0.28)' : 'rgba(255,255,255,0.1)',
          ['--tw-ring-color' as string]: result ? (result.correct ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.3)') : accent,
        }}
      >
        {taken.length === 0 ? (
          <span className="text-4xl opacity-75">🧺</span>
        ) : (
          taken.map((index) => (
            <button key={index} type="button" onClick={() => toggle(index)} disabled={locked}
              aria-label="Tag op af kurven"
              className="pop-in text-4xl leading-none">
              {pile[index].fruit}
            </button>
          ))
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl font-black tabular-nums" style={{ color: accent }}>{taken.length}</span>
        <span className="text-sm font-bold uppercase tracking-widest opacity-85">i kurven</span>
      </div>

      {/* the pile to pick from */}
      <div className="flex max-w-[19rem] flex-wrap items-center justify-center gap-1">
        {pile.map(({ i, fruit, tilt }) =>
          taken.includes(i) ? (
            <span key={i} className="h-12 w-12" />
          ) : (
            <button key={i} type="button" disabled={locked} onClick={() => toggle(i)} aria-label="Læg i kurven"
              className="tap-target grid h-12 w-12 min-h-0 place-items-center text-4xl leading-none"
              style={{ transform: `rotate(${tilt}deg)` }}>
              {fruit}
            </button>
          ),
        )}
      </div>

      <button type="button" disabled={locked || taken.length === 0}
        onClick={(e) => onAnswer(taken.length, centreOf(e.currentTarget))}
        className="tap-target h-16 w-full rounded-3xl bg-emerald-400 text-2xl font-black text-[#0b2b1d] shadow-[0_6px_0_rgba(0,60,35,0.45)] disabled:opacity-45">
        Færdig
      </button>
    </div>
  )
}
