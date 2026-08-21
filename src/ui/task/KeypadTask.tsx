import { useEffect, useRef, useState } from 'react'
import type { TaskProps } from './types'
import { centreOf } from './types'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'

/** Type the answer. Removes guessing entirely, which is why the later islands use it. */
export function KeypadTask({ task, onAnswer, locked, result, accent }: TaskProps) {
  const [entry, setEntry] = useState('')
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setEntry('')
  }, [task.id])

  const maxDigits = String(task.range[1]).length
  const value = entry === '' ? null : Number(entry)

  const press = (digit: string) => {
    if (locked || entry.length >= maxDigits) return
    sfx.tap()
    haptics.tap()
    setEntry((e) => (e === '0' ? digit : e + digit))
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <div
        className="flex h-20 w-full items-center justify-center rounded-3xl text-6xl font-black tabular-nums ring-2 transition-colors"
        style={{
          background: result ? (result.correct ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.12)',
          color: result?.correct ? '#0b2b1d' : 'white',
          borderColor: accent,
          ['--tw-ring-color' as string]: result ? 'transparent' : 'rgba(255,255,255,0.28)',
        }}
      >
        {result && !result.correct ? (
          // the child's own answer stays on screen beside the right one — replacing
          // it in place reads as "you mistyped", not "you miscounted"
          <span className="flex items-baseline gap-4">
            <span className="text-3xl line-through opacity-70">{result.given}</span>
            <span className="nudge" style={{ color: accent }}>{result.answer}</span>
          </span>
        ) : (
          entry || <span className="opacity-55">–</span>
        )}
      </div>

      <div className="grid w-full grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" disabled={locked}
            onClick={() => press(d)}
            className="tap-target h-16 rounded-2xl bg-white/92 text-3xl font-black text-[#1b1233] shadow-[0_5px_0_rgba(0,0,0,0.28)]">
            {d}
          </button>
        ))}
        <button type="button" disabled={locked} aria-label="Slet"
          onClick={() => { sfx.tap(); setEntry((e) => e.slice(0, -1)) }}
          className="tap-target h-16 rounded-2xl bg-white/15 text-2xl font-black text-white ring-1 ring-white/25">
          ⌫
        </button>
        <button key="0" type="button" disabled={locked}
          onClick={() => press('0')}
          className="tap-target h-16 rounded-2xl bg-white/92 text-3xl font-black text-[#1b1233] shadow-[0_5px_0_rgba(0,0,0,0.28)]">
          0
        </button>
        <button ref={okRef} type="button" disabled={locked || value === null} aria-label="Svar"
          onClick={(e) => value !== null && onAnswer(value, centreOf(e.currentTarget))}
          className="tap-target h-16 rounded-2xl bg-emerald-400 text-2xl font-black text-[#0b2b1d] shadow-[0_5px_0_rgba(0,60,35,0.45)] disabled:opacity-45">
          ✓
        </button>
      </div>
    </div>
  )
}
