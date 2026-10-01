// Prompt 'compareObjects' (compareLength, weightCompare): long things lie on their side, one per
// row, from a common start line (aligned) or shifted (lengthByEnd conflict items); things to weigh
// stand side by side at their drawn size on a shelf. The drawn size is all the prompt knows: which
// one is heavier is the child's knowledge, never shown by the picture.
import type { Prompt } from '../../engine/types'
import { hashSeed, makeRng } from '../../engine/rng'
import { n } from '../../art/materials/geom'
import { LongArt, ObjectArt, isLong } from './objects'

type Compare = Extract<Prompt, { scene: 'compareObjects' }>

export function CompareScene({ prompt, seed }: { prompt: Compare; seed: string }) {
  const { objects, sizes, aligned, mode } = prompt
  // `starts` (where each thing begins, same units as sizes) is the SK1 addition to the contract
  const starts = (prompt as Compare & { starts?: number[] }).starts
  if (mode === 'length' || objects.every(isLong)) return <Lengths objects={objects} sizes={sizes} aligned={aligned} starts={starts} seed={seed} />
  return <Weights objects={objects} sizes={sizes} />
}

function Lengths({ objects, sizes, aligned, starts, seed }: { objects: string[]; sizes: number[]; aligned: boolean; starts?: number[]; seed: string }) {
  const W = 330
  const rowH = 40
  const H = objects.length * rowH + 16
  const x0 = 26
  const span = W - x0 - 18
  const reach = Math.max(1, ...sizes.map((s, i) => s + (starts?.[i] ?? 0)))
  const max = Math.max(...sizes, 1)
  const rng = makeRng(hashSeed(`len:${seed}`))
  return (
    <svg className="tv-scene__svg tv-compare" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
      {aligned && !starts?.some((v) => v > 0) && <path className="tv-compare__start" d={`M${x0} 4V${H - 4}`} />}
      {objects.map((id, i) => {
        const unit = starts ? span / reach : (span * 0.94) / max
        const len = sizes[i] * unit
        const shift = starts ? (starts[i] ?? 0) * unit : aligned ? 0 : rng.between(0, Math.max(0, Math.round(span - len)))
        const y = 8 + i * rowH + rowH / 2
        return (
          <g key={i}>
            <path className="tv-compare__lane" d={`M8 ${n(y + rowH / 2 - 4)}H${W - 8}`} />
            <LongArt id={isLong(id) ? id : 'stick'} length={len} x={x0 + shift} y={y} h={15} />
          </g>
        )
      })}
    </svg>
  )
}

function Weights({ objects, sizes }: { objects: string[]; sizes: number[] }) {
  const max = Math.max(...sizes, 1)
  const slot = 86
  const W = objects.length * slot + 20
  const H = 110
  return (
    <svg className="tv-scene__svg tv-compare" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
      <path className="tv-compare__shelf" d={`M4 ${H - 10}H${W - 4}`} />
      {objects.map((id, i) => {
        const k = 0.75 + 0.9 * (sizes[i] / max)
        const cx = 10 + slot * i + slot / 2
        return (
          <g key={i} transform={`translate(${n(cx)} ${H - 12})`}>
            <ellipse className="tv-compare__shadow" cx={0} cy={0} rx={20 * k} ry={4} />
            <ObjectArt id={id} x={-24 * k} y={-46 * k} k={k} />
          </g>
        )
      })}
    </svg>
  )
}
