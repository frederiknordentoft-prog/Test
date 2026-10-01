// Prompt 'objects' (SPEC §2.2 count10/count20): n things spread out, on dice, as fingers, in a
// ten-frame, in a row (grouped in fives) or on a bead string. With `flashMs` the things are shown
// for that long and then covered by a cloud ("se antallet med det samme"); "Hør igen" shows them
// once more.
import { useEffect, useMemo, useState } from 'react'
import type { Prompt } from '../../engine/types'
import { hashSeed, makeRng } from '../../engine/rng'
import { BeadString, Die, DoubleTenFrame, Fingers, TenFrame, ThingArt } from '../../art/materials'
import { blob, n as fmt } from '../../art/materials/geom'
import type { V2 } from '../../art/materials/geom'
import { cx } from '../design/cx'

type Objects = Extract<Prompt, { scene: 'objects' }>

/** Seeded, non-overlapping spots for n things in a w x h field (a jittered grid). */
export function scatterSpots(n: number, w: number, h: number, seed: number): { x: number; y: number; tilt: number }[] {
  const rng = makeRng(seed)
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / h)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const cw = w / cols
  const ch = h / rows
  const cells = rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, n)
  return cells.map((c) => {
    const col = c % cols
    const row = Math.floor(c / cols)
    return {
      x: col * cw + cw / 2 + (rng.next() - 0.5) * cw * 0.35,
      y: row * ch + ch / 2 + (rng.next() - 0.5) * ch * 0.3,
      tilt: (rng.next() - 0.5) * 30,
    }
  })
}

function Scatter({ n, thing, seed }: { n: number; thing: string; seed: number }) {
  const W = 320
  const H = n > 12 ? 200 : 170
  const spots = useMemo(() => scatterSpots(n, W - 40, H - 30, seed), [n, seed, H])
  const k = Math.min(1.15, Math.max(0.62, 1.25 - n * 0.035))
  const ground: V2[] = [[10, 40], [70, 14], [170, 10], [280, 18], [314, 60], [310, H - 30], [250, H - 6], [120, H - 4], [20, H - 22]]
  return (
    <svg className="tv-scene__svg tv-objects__field" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
      <path className="tv-objects__ground" d={blob(ground, 0.9)} />
      {spots.map((s, i) => (
        <g key={i} transform={`translate(${fmt(s.x + 20)} ${fmt(s.y + 12)}) rotate(${fmt(s.tilt)})`}>
          <ThingArt id={thing} x={-24 * k} y={-24 * k} k={k} />
        </g>
      ))}
    </svg>
  )
}

function Row({ n, thing }: { n: number; thing: string }) {
  const groups = Math.ceil(n / 5)
  const size = n > 10 ? 30 : 40
  return (
    <div className="tv-objects__row">
      {Array.from({ length: groups }, (_, g) => (
        <span key={g} className="tv-objects__five">
          <svg viewBox={`0 0 ${Math.min(5, n - g * 5) * 50} 50`} height={size} width={(Math.min(5, n - g * 5) * 50 * size) / 50} aria-hidden>
            {Array.from({ length: Math.min(5, n - g * 5) }, (_, i) => (
              <ThingArt key={i} id={thing} x={i * 50 + 1} y={1} />
            ))}
          </svg>
        </span>
      ))}
    </div>
  )
}

export function ObjectsScene({ prompt, replay = 0, seed }: { prompt: Objects; replay?: number; seed: string }) {
  const { n, layout, thing, flashMs } = prompt
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    if (!flashMs) return
    setCovered(false)
    const t = window.setTimeout(() => setCovered(true), flashMs)
    return () => window.clearTimeout(t)
  }, [flashMs, replay, seed])

  let art
  switch (layout) {
    case 'dice':
      art = (
        <div className="tv-objects__dice">
          {n <= 6 ? (
            <Die n={Math.max(1, n) as 1 | 2 | 3 | 4 | 5 | 6} size={112} />
          ) : (
            <>
              <Die n={6} size={104} />
              <Die n={Math.max(1, Math.min(6, n - 6)) as 1 | 2 | 3 | 4 | 5 | 6} size={104} />
            </>
          )}
        </div>
      )
      break
    case 'fingers':
      art = <Fingers n={n} size={n > 5 ? 104 : 124} />
      break
    case 'tenframe':
      art = n <= 10 ? <TenFrame n={n} size={260} ghosts /> : <DoubleTenFrame n={n} size={236} />
      break
    case 'beads':
      art = <BeadString total={n > 10 ? 20 : 10} left={n} size={n > 10 ? 560 : 300} className="tv-objects__beads" />
      break
    case 'row':
      art = <Row n={n} thing={thing} />
      break
    default:
      art = <Scatter n={n} thing={thing} seed={hashSeed(`${seed}:${n}:${thing}`)} />
  }
  return (
    <div className={cx('tv-objects', `tv-objects--${layout}`, !!flashMs && covered && 'is-covered')}>
      <div className="tv-objects__art">{art}</div>
      {flashMs ? <Cloud shown={covered} /> : null}
    </div>
  )
}

/** The soft cloud that hides a flashed amount. */
function Cloud({ shown }: { shown: boolean }) {
  const pts: V2[] = [[20, 70], [34, 40], [70, 30], [96, 10], [140, 8], [170, 26], [210, 20], [244, 42], [262, 74], [240, 100], [190, 108], [140, 104], [90, 110], [44, 102]]
  return (
    <svg className={cx('tv-objects__cloud', shown && 'is-shown')} viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path d={blob(pts, 1)} />
      <path className="tv-objects__cloud-hi" d={blob([[60, 46], [90, 30], [130, 28], [110, 44]], 1)} />
    </svg>
  )
}
