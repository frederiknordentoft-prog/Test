import type { Task } from '../../engine/types'
import { Dots, LineStrip, TenFrame, TenFrames } from './Manipulatives'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'

/**
 * What happens after a mistake.
 *
 * Showing the answer teaches nothing — the child already knew they were wrong.
 * This shows the *method*: crossing the ten fills the frame up to ten and takes
 * the rest, ten friends are the empty squares you can count. Then the child has
 * to tap the right number to go on, so the round always ends a mistake with the
 * child producing the correct answer themselves rather than watching it vanish.
 */

interface Explanation {
  line: string
  visual: React.ReactNode
}

function explain(task: Task, accent: string): Explanation {
  const { a, b, answer } = task

  switch (task.skill) {
    case 'addTo20': {
      // start from the bigger number, the way it is taught
      const big = Math.max(a, b)
      const small = Math.min(a, b)
      const toTen = 10 - big
      const rest = small - toTen
      return {
        line: `${big} og ${toTen} giver 10 — og ${rest} mere er ${answer}.`,
        visual: (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TenFrame filled={big} added={toTen} color={accent} size={22} />
            <span className="text-2xl opacity-80">+</span>
            <Dots n={rest} color={accent} size={20} />
          </div>
        ),
      }
    }

    case 'subTo20': {
      const toTen = a - 10
      const rest = b - toTen
      return {
        line: `Tag ${toTen} væk, så er du på 10 — og ${rest} mere er ${answer}.`,
        visual: (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TenFrame filled={10} color={accent} size={22} />
            <TenFrame filled={toTen} color={accent} size={22} />
            <span className="text-2xl opacity-80">→</span>
            <TenFrame filled={answer} color={accent} showGap size={22} />
          </div>
        ),
      }
    }

    case 'tenFriends':
      return {
        line: `Der mangler ${answer} felter. ${a} og ${answer} er tiervenner.`,
        visual: <TenFrame filled={a} added={answer} color={accent} />,
      }

    case 'addTo10':
      return {
        line: `${a} og ${b} er ${answer}.`,
        visual: (
          <div className="flex items-center gap-3">
            <Dots n={a} color={accent} max={10} />
            <span className="text-2xl opacity-80">+</span>
            <Dots n={b} color={accent} max={10} />
          </div>
        ),
      }

    case 'subTo10':
      return {
        line: `${a} minus ${b} er ${answer}.`,
        visual: <Dots n={a} color={accent} struck={b} max={10} />,
      }

    case 'doubles':
      return {
        line: `${a} og ${a} er ${answer}.`,
        visual: (
          <div className="flex items-center gap-3">
            <Dots n={a} color={accent} max={10} />
            <span className="text-2xl opacity-80">+</span>
            <Dots n={a} color={accent} max={10} />
          </div>
        ),
      }

    case 'halves':
      return {
        line: `${a} delt i to er ${answer} og ${answer}.`,
        visual: (
          <div className="flex items-center gap-3">
            <Dots n={answer} color={accent} max={10} />
            <span className="h-12 w-1 rounded-full bg-white/50" />
            <Dots n={answer} color={accent} max={10} />
          </div>
        ),
      }

    case 'count':
      return { line: `Der er ${answer}.`, visual: <Dots n={answer} color={accent} /> }

    case 'neighbour':
      return {
        line: b > 0 ? `Efter ${a} kommer ${answer}.` : `Før ${a} kommer ${answer}.`,
        visual: <LineStrip from={Math.max(0, a - 1)} to={a + 1} missing={-1} color={accent} />,
      }

    case 'tensAndOnes':
      return {
        line: `${a} tiere og ${b} enere er ${answer}.`,
        visual: <TenFrames n={Math.min(answer, 20)} color={accent} size={20} />,
      }

    default:
      return {
        line: `${a} ${task.op === '−' ? 'minus' : 'plus'} ${Math.abs(b)} er ${answer}.`,
        visual: (
          <span className="text-4xl font-black tabular-nums">
            {a} {task.op ?? '+'} {Math.abs(b)} = {answer}
          </span>
        ),
      }
  }
}

export function StrategyHint({ task, accent, onContinue }: {
  task: Task
  accent: string
  onContinue: () => void
}) {
  const { line, visual } = explain(task, accent)

  return (
    <div className="pop-in flex w-full max-w-md flex-col items-center gap-4 rounded-[2rem] bg-[#1b1233]/85 p-5 ring-1 ring-white/20 backdrop-blur-sm">
      <div className="flex min-h-[4rem] items-center justify-center">{visual}</div>
      <p className="text-center text-lg font-bold leading-snug">{line}</p>
      <button
        type="button"
        onPointerDown={() => { sfx.tap(); haptics.tap() }}
        onClick={onContinue}
        className="tap-target punch h-20 w-full rounded-3xl text-4xl font-black tabular-nums text-[#1b1233] shadow-[0_7px_0_rgba(0,0,0,0.35)]"
        style={{ background: accent }}
      >
        Tryk på {task.answer}
      </button>
    </div>
  )
}

export { explain as explainStrategy }
