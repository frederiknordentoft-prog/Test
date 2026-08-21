import { useMemo } from 'react'
import type { IslandPalette } from '../../content/islands'
import { hashSeed, makeRng } from '../../engine/rng'

/**
 * The scenery behind every screen: a sky, a few layers of hills and some drifting
 * motes, all generated from the island id so each place looks like itself. Kept
 * deliberately calm — the foreground has to stay readable while particles fly.
 */
export function Backdrop({ palette, seed, dim = false }: { palette: IslandPalette; seed: string; dim?: boolean }) {
  const scene = useMemo(() => {
    const rng = makeRng(hashSeed(seed))
    const stars = Array.from({ length: 30 }, () => ({
      x: rng.next() * 100,
      y: rng.next() * 58,
      r: 0.12 + rng.next() * 0.24,
      o: 0.2 + rng.next() * 0.45,
    }))
    const motes = Array.from({ length: 7 }, () => ({
      x: rng.next() * 100,
      y: 18 + rng.next() * 52,
      r: 0.28 + rng.next() * 0.5,
      dx: `${(rng.next() - 0.5) * 22}px`,
      dy: `${-6 - rng.next() * 16}px`,
      dur: `${5 + rng.next() * 7}s`,
    }))
    const hill = (base: number, amp: number, phase: number) => {
      const pts: string[] = [`M -5 110`, `L -5 ${base}`]
      for (let x = -5; x <= 105; x += 5)
        pts.push(`L ${x} ${base + Math.sin((x + phase) / 14) * amp + Math.sin((x + phase) / 5) * amp * 0.28}`)
      pts.push('L 105 110 Z')
      return pts.join(' ')
    }
    return {
      stars,
      motes,
      far: hill(64 + rng.next() * 5, 3.5, rng.next() * 40),
      mid: hill(76 + rng.next() * 4, 4.5, rng.next() * 40),
      near: hill(88 + rng.next() * 3, 3, rng.next() * 40),
    }
  }, [seed])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.skyFrom} />
            <stop offset="62%" stopColor={palette.skyTo} />
            <stop offset="100%" stopColor={palette.ground} />
          </linearGradient>
          <radialGradient id={`glow-${seed}`} cx="0.5" cy="0.42" r="0.5">
            <stop offset="0%" stopColor={palette.glow} stopOpacity="0.4" />
            <stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#sky-${seed})`} />
        <ellipse cx="50" cy="42" rx="62" ry="42" fill={`url(#glow-${seed})`} />
        {scene.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
        ))}
        <path d={scene.far} fill={palette.ground} opacity="0.45" />
        <path d={scene.mid} fill={palette.ground} opacity="0.7" />
        <path d={scene.near} fill={palette.ground} />
        {scene.motes.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={palette.accent} opacity="0.32" className="drift"
            style={{ ['--dx' as string]: m.dx, ['--dy' as string]: m.dy, animationDuration: m.dur, animationDelay: `${-i}s` }} />
        ))}
      </svg>
      {dim && <div className="absolute inset-0 bg-[#1b1233]/55" />}
    </div>
  )
}
