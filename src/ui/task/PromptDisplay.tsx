import type { Task } from '../../engine/types'
import { Dots, LineStrip, TenFrame, TenFrames } from './Manipulatives'

/**
 * The question itself.
 *
 * Where a picture teaches better than a symbol, it is a picture — and the picture
 * is the one the child's teacher uses. Ten friends and crossing the ten are shown
 * on a ten frame, because that is where the answer becomes something you can see
 * rather than something you have to remember.
 *
 * `scaffold` is on while a fact is still new to this child and comes off once it
 * is nearly learned, so the support disappears by itself instead of becoming a
 * crutch.
 */

function TensAndOnes({ tens, ones, color }: { tens: number; ones: number; color: string }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-3">
      {Array.from({ length: tens }, (_, t) => (
        <span key={`t${t}`} className="pop-in flex flex-col gap-[3px] rounded-md p-[3px] ring-1 ring-white/30"
          style={{ animationDelay: `${t * 0.05}s` }}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="block rounded-[2px]" style={{ width: 16, height: 5, background: color }} />
          ))}
        </span>
      ))}
      {ones > 0 && (
        <span className="flex max-w-[7rem] flex-wrap gap-[3px]">
          {Array.from({ length: ones }, (_, i) => (
            <span key={i} className="pop-in block rounded-[3px]"
              style={{ width: 16, height: 16, background: color, animationDelay: `${(tens + i) * 0.05}s` }} />
          ))}
        </span>
      )}
    </div>
  )
}

const BIG = 'prompt-big font-black tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]'

const Blank = () => (
  <span className={`${BIG} inline-grid place-items-center rounded-2xl px-4`}
    style={{ background: 'rgba(255,255,255,0.16)', minWidth: '1.6em' }}>
    ?
  </span>
)

function Equation({ children }: { children: React.ReactNode }) {
  return <div className={`flex flex-wrap items-center justify-center gap-3 ${BIG}`}>{children}</div>
}

const Op = ({ children }: { children: React.ReactNode }) => <span className="opacity-80">{children}</span>

export function PromptDisplay({ task, accent, scaffold = false }: { task: Task; accent: string; scaffold?: boolean }) {
  // "put seven in the basket" shows the numeral; "how many are there?" shows the things
  if (task.kind === 'count') {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-lg font-bold uppercase tracking-widest opacity-80">Læg i kurven</span>
        <span className={`${BIG} pop-in`} style={{ color: accent }}>{task.answer}</span>
      </div>
    )
  }

  switch (task.skill) {
    case 'count':
      return <Dots n={task.a} color={accent} />

    case 'neighbour':
      // the skill is the order of the numbers, so it belongs on a strip of the
      // number line — not dressed up as a plus stykke
      return (
        <LineStrip from={Math.max(0, task.a - 1)} to={task.a + 1} missing={task.answer} color={accent} />
      )

    case 'tensAndOnes':
      return (
        <div className="flex flex-col items-center gap-5">
          <TensAndOnes tens={task.a} ones={task.b} color={accent} />
          <Equation><Blank /></Equation>
        </div>
      )

    case 'tenFriends':
      return (
        <div className="flex flex-col items-center gap-4">
          <TenFrame filled={task.a} color={accent} showGap />
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>+</Op> <Blank /> <Op>=</Op> <span className="tabular-nums">10</span>
          </Equation>
        </div>
      )

    case 'addTo10':
      return (
        <div className="flex flex-col items-center gap-4">
          {scaffold && (
            <div className="flex items-center gap-3">
              <Dots n={task.a} color={accent} max={10} />
              <span className="text-3xl opacity-80">+</span>
              <Dots n={task.b} color={accent} max={10} />
            </div>
          )}
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>+</Op> <span className="tabular-nums">{task.b}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    case 'subTo10':
      return (
        <div className="flex flex-col items-center gap-4">
          {scaffold && <Dots n={task.a} color={accent} struck={task.b} max={10} />}
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>−</Op> <span className="tabular-nums">{task.b}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    case 'addTo20':
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            {/* the frame always holds the bigger number — that is the way over the ten */}
            <TenFrame filled={Math.max(task.a, task.b)} color={accent} showGap size={22} />
            <span className="text-3xl opacity-80">+</span>
            <Dots n={Math.min(task.a, task.b)} color={accent} size={20} />
          </div>
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>+</Op> <span className="tabular-nums">{task.b}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    case 'subTo20':
      return (
        <div className="flex flex-col items-center gap-4">
          <TenFrames n={task.a} color={accent} size={22} />
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>−</Op> <span className="tabular-nums">{task.b}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    case 'doubles':
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Dots n={task.a} color={accent} max={10} />
            <span className="text-3xl opacity-80">+</span>
            <Dots n={task.a} color={accent} max={10} />
          </div>
          <Equation>
            <span className="tabular-nums">{task.a}</span> <Op>+</Op> <span className="tabular-nums">{task.a}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    case 'halves':
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Dots n={task.answer} color={accent} max={10} />
            <span className="h-14 w-1 rounded-full bg-white/50" />
            <Dots n={task.answer} color={accent} max={10} />
          </div>
          <Equation>
            <span className="text-3xl font-bold opacity-85">halvdelen af</span>
            <span className="tabular-nums">{task.a}</span> <Op>=</Op> <Blank />
          </Equation>
        </div>
      )

    default:
      return (
        <Equation>
          <span className="tabular-nums">{task.a}</span>
          <Op>{task.op ?? '+'}</Op>
          <span className="tabular-nums">{Math.abs(task.b)}</span>
          <Op>=</Op>
          <Blank />
        </Equation>
      )
  }
}
