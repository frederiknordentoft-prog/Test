import type { Task } from '../../engine/types'

/**
 * The question itself.
 *
 * Where a picture teaches better than a symbol, it is a picture: counting fields
 * are grouped in fives so a child can see "five and two" instead of counting to
 * seven, and tens-and-ones is drawn as actual rods and cubes. Everything else is
 * the plain equation, big.
 */

function Dots({ n, color, max = 20 }: { n: number; color: string; max?: number }) {
  const rows: number[][] = []
  for (let i = 0; i < Math.min(n, max); i += 5) rows.push(Array.from({ length: Math.min(5, Math.min(n, max) - i) }, (_, k) => i + k))
  return (
    <div className="flex flex-col items-center gap-1.5">
      {rows.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((i) => (
            <span
              key={i}
              className="pop-in block rounded-full"
              style={{ width: 22, height: 22, background: color, animationDelay: `${i * 0.035}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function TensAndOnes({ tens, ones, color }: { tens: number; ones: number; color: string }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-3">
      {Array.from({ length: tens }, (_, t) => (
        <span key={`t${t}`} className="pop-in flex flex-col gap-[3px] rounded-md p-[3px] ring-1 ring-white/25"
          style={{ animationDelay: `${t * 0.05}s` }}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="block rounded-[2px]" style={{ width: 16, height: 5, background: color }} />
          ))}
        </span>
      ))}
      {ones > 0 && (
        <span className="flex max-w-[7rem] flex-wrap gap-[3px]">
          {Array.from({ length: ones }, (_, i) => (
            <span key={i} className="pop-in block rounded-[3px]" style={{ width: 16, height: 16, background: color, animationDelay: `${(tens + i) * 0.05}s` }} />
          ))}
        </span>
      )}
    </div>
  )
}

const Num = ({ children }: { children: React.ReactNode }) => (
  <span className="tabular-nums">{children}</span>
)

export function PromptDisplay({ task, accent }: { task: Task; accent: string }) {
  const big = 'text-6xl sm:text-7xl font-black tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]'
  const blank = (
    <span className={`${big} inline-grid place-items-center rounded-2xl px-4`} style={{ background: 'rgba(255,255,255,0.14)', minWidth: '1.6em' }}>
      ?
    </span>
  )

  // "put seven in the basket" shows the numeral; "how many are there?" shows the things
  if (task.kind === 'count') {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-lg font-bold uppercase tracking-widest opacity-70">Læg i kurven</span>
        <span className={`${big} pop-in`} style={{ color: accent }}>{task.answer}</span>
      </div>
    )
  }

  switch (task.skill) {
    case 'count':
      return <Dots n={task.a} color={accent} />

    case 'tensAndOnes':
      return (
        <div className="flex flex-col items-center gap-5">
          <TensAndOnes tens={task.a} ones={task.b} color={accent} />
          <div className={`${big} opacity-90`}>{blank}</div>
        </div>
      )

    case 'tenFriends':
      return (
        <div className={`flex flex-wrap items-center justify-center gap-3 ${big}`}>
          <Num>{task.a}</Num> <span className="opacity-70">+</span> {blank} <span className="opacity-70">=</span> <Num>10</Num>
        </div>
      )

    case 'doubles':
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Dots n={task.a} color={accent} max={10} />
            <span className="text-3xl opacity-70">+</span>
            <Dots n={task.a} color={accent} max={10} />
          </div>
          <div className={`flex items-center gap-3 ${big}`}>
            <Num>{task.a}</Num> <span className="opacity-70">+</span> <Num>{task.a}</Num> <span className="opacity-70">=</span> {blank}
          </div>
        </div>
      )

    case 'halves':
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Dots n={task.answer} color={accent} max={10} />
            <span className="h-14 w-1 rounded-full bg-white/40" />
            <Dots n={task.answer} color={accent} max={10} />
          </div>
          <div className={`flex flex-wrap items-center justify-center gap-3 ${big}`}>
            <span className="text-3xl font-bold opacity-80">halvdelen af</span> <Num>{task.a}</Num>
            <span className="opacity-70">=</span> {blank}
          </div>
        </div>
      )

    default:
      return (
        <div className={`flex flex-wrap items-center justify-center gap-3 ${big}`}>
          <Num>{task.a}</Num>
          <span className="opacity-70">{task.op ?? '+'}</span>
          <Num>{Math.abs(task.b)}</Num>
          <span className="opacity-70">=</span>
          {blank}
        </div>
      )
  }
}
