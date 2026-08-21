/**
 * The concrete representations Danish indskoling actually teaches with.
 *
 * The ten frame is the important one: tiervenner and tierovergangen are both
 * taught as "how much is missing before the frame is full", and a child who can
 * see the empty squares does not have to remember anything. Counters are grouped
 * in fives for the same reason — seven should read as "five and two", not as
 * seven things to count one by one.
 */

interface DotsProps {
  n: number
  color: string
  /** the last `struck` counters are drawn crossed out — this is subtraction */
  struck?: number
  max?: number
  size?: number
}

export function Dots({ n, color, struck = 0, max = 20, size = 22 }: DotsProps) {
  const shown = Math.min(n, max)
  const rows: number[][] = []
  for (let i = 0; i < shown; i += 5) rows.push(Array.from({ length: Math.min(5, shown - i) }, (_, k) => i + k))
  const gone = (i: number) => i >= shown - struck

  return (
    <div className="flex flex-col items-center gap-1.5">
      {rows.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((i) => (
            <span key={i} className="pop-in relative block rounded-full"
              style={{
                width: size,
                height: size,
                background: gone(i) ? 'transparent' : color,
                boxShadow: gone(i) ? `inset 0 0 0 2px ${color}` : 'none',
                opacity: gone(i) ? 0.45 : 1,
                animationDelay: `${i * 0.035}s`,
              }}>
              {gone(i) && (
                <span className="absolute inset-0 grid place-items-center text-[0.9em] font-black leading-none"
                  style={{ color }}>
                  ✕
                </span>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

interface TenFrameProps {
  /** counters already in the frame */
  filled: number
  /** counters added on top, drawn in the accent colour — the "and how many more" */
  added?: number
  color: string
  /** outline the empty squares so the gap is the thing you notice */
  showGap?: boolean
  size?: number
}

export function TenFrame({ filled, added = 0, color, showGap = false, size = 26 }: TenFrameProps) {
  const cells = Array.from({ length: 10 }, (_, i) => i)
  return (
    <div className="grid grid-cols-5 gap-[3px] rounded-lg p-[3px] ring-1 ring-white/30">
      {cells.map((i) => {
        const isFilled = i < filled
        const isAdded = i >= filled && i < filled + added
        const isGap = !isFilled && !isAdded
        return (
          <span key={i} className={isFilled || isAdded ? 'pop-in' : ''}
            style={{
              width: size,
              height: size,
              borderRadius: 6,
              background: isFilled ? color : isAdded ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.08)',
              boxShadow: isGap && showGap ? 'inset 0 0 0 2px rgba(255,255,255,0.55)' : 'none',
              animationDelay: `${i * 0.04}s`,
            }} />
        )
      })}
    </div>
  )
}

/** More than ten: a full frame plus the leftovers. */
export function TenFrames({ n, color, showGap = false, size = 26 }: { n: number; color: string; showGap?: boolean; size?: number }) {
  const full = Math.min(Math.floor(n / 10), 2)
  const rest = n - full * 10
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {Array.from({ length: full }, (_, i) => (
        <TenFrame key={i} filled={10} color={color} size={size} />
      ))}
      {(rest > 0 || full === 0) && <TenFrame filled={rest} color={color} showGap={showGap} size={size} />}
    </div>
  )
}

/** A short stretch of the number line, for "what comes after 6?". */
export function LineStrip({ from, to, missing, color }: { from: number; to: number; missing: number; color: string }) {
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div className="flex items-center gap-2">
      {numbers.map((n) => (
        <span key={n}
          className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black tabular-nums"
          style={
            n === missing
              ? { background: 'rgba(255,255,255,0.16)', color: 'white', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.5)' }
              : { background: color, color: '#1b1233' }
          }>
          {n === missing ? '?' : n}
        </span>
      ))}
    </div>
  )
}
