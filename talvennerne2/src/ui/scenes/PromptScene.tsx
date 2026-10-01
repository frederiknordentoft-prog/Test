// The prompt card's picture: one renderer per Prompt.scene (src/engine/types.ts), drawn with the
// materials library. Wave 1 scenes are complete; the rest are simple, faithful pictures of their
// data that later waves can deepen (skills may also bring their own Prompt.tsx, SPEC §12.3).
import type { ReactNode } from 'react'
import type { Prompt, Task, Term } from '../../engine/types'
import {
  AnalogClock, BarChart, Base10Group, COIN_VALUES, Coin, CoordGrid, DigitalClock, FractionBars, FractionShape,
  HundredBoard, NumberLine, Pictogram, Ruler, RULER, Seesaw, Shape2D, Solid3D, SquareGrid, Thing,
} from '../../art/materials'
import type { CoinOre } from '../../art/materials'
import { Rig } from '../../art/rig/Rig'
import { Equation } from '../design/Equation'
import { Icon } from '../design/Icon'
import { cx } from '../design/cx'
import { formatMoney, formatNumber } from '../task/answers'
import { CompareScene } from './CompareScene'
import { HearScene } from './HearScene'
import { ObjectsScene } from './ObjectsScene'
import { RowScene } from './RowScene'
import { LongArt, ObjectArt, ObjectIcon, isLong } from './objects'
import { useSpecies } from './useSpecies'

export type BlankSlot = 'empty' | 'active' | 'good' | 'oops'

export interface PromptSceneProps {
  prompt: Prompt
  /** The task the prompt belongs to (its kind changes a few pictures, e.g. the number line). */
  task?: Task
  /** Shown in the first answer blank (typed digits, the struck or right answer). */
  entry?: ReactNode
  slot?: BlankSlot
  /** Bumps on "Hør igen": flashed amounts are shown once more. */
  replay?: number
  /** The prompt is being read aloud (the loudspeaker ripples). */
  speaking?: boolean
  /** Tap on the loudspeaker. */
  onHear?: () => void
  className?: string
}

export function PromptScene(props: PromptSceneProps) {
  const { prompt, className } = props
  return <div className={cx('tv-scene', `tv-scene--${prompt.scene}`, className)}>{scene(props)}</div>
}

const isCoin = (v: number): v is CoinOre => (COIN_VALUES as readonly number[]).includes(v)

function scene({ prompt: p, task, entry, slot = 'empty', replay = 0, speaking = false, onHear }: PromptSceneProps): ReactNode {
  const seed = task?.id ?? p.scene
  switch (p.scene) {
    case 'equation':
      return <Equation terms={p.terms} entry={entry} slot={slot} />
    case 'objects':
      return <ObjectsScene prompt={p} replay={replay} seed={seed} />
    case 'hear':
      return <HearScene speaking={speaking} onHear={onHear} />
    case 'row':
      return <RowScene prompt={p} entry={entry} slot={slot} />
    case 'line':
      if (task?.kind === 'numberline') return <PlaceChip prompt={p} task={task} />
      return <NumberLine min={p.min} max={p.max} arrowAt={p.arrowAt} target={p.target} hops={p.hops} className="tv-scene__line" />
    case 'board':
      return (
        <div className="tv-board">
          <HundredBoard highlight={p.highlight} blank={p.blank} className="tv-scene__board" />
          {p.blank !== undefined && entry !== undefined && entry !== null && entry !== '' && <span className={cx('tv-board__entry', `is-${slot}`)}>{entry}</span>}
        </div>
      )
    case 'shape':
      return <Shape2D shape={p.shape} variant={p.variant} mark={p.mark} cut={p.cut} size={170} className="tv-scene__shape" />
    case 'shapes':
      return (
        <div className={cx('tv-shapes', p.items.length > 4 && 'tv-shapes--many')}>
          {p.items.map((it) => (
            <Shape2D key={it.id} shape={it.shape} variant={it.variant} size={p.items.length > 4 ? 72 : 96} />
          ))}
        </div>
      )
    case 'compareObjects':
      return <CompareScene prompt={p} seed={seed} />
    case 'story':
      return <StoryScene species={p.species} nums={p.nums} />
    case 'base':
      return <Base10Group h={p.h} t={p.t} o={p.o} order={p.order} unit={p.h > 0 ? 7 : 11} className="tv-scene__base" />
    case 'groups':
      return <Groups groups={p.groups} size={p.size} thing={p.thing} />
    case 'array':
      return <DotArray rows={p.rows} cols={p.cols} split={p.split} />
    case 'share':
      return <ShareScene total={p.total} recipients={p.recipients} thing={p.thing} />
    case 'balance':
      return <Seesaw tilt={0} width={300} left={<TermsChip terms={p.left} entry={entry} slot={slot} />} right={<TermsChip terms={p.right} entry={entry} slot={slot} />} className="tv-scene__seesaw" />
    case 'solid':
      return p.asObject ? <ObjectIcon id={p.asObject} size={150} /> : <Solid3D solid={p.solid} size={160} />
    case 'symmetry':
      return (
        <div className={cx('tv-symmetry', `is-${p.line}`)}>
          <ObjectIcon id={p.picture} size={150} />
          <span className="tv-symmetry__line" aria-hidden />
        </div>
      )
    case 'grid':
      return p.coords ? (
        <CoordGrid w={p.w} h={p.h} points={p.point ? [{ x: p.point[0], y: p.point[1] }] : []} className="tv-scene__grid" />
      ) : (
        <SquareGrid w={p.w} h={p.h} filled={p.filled} axis={p.axis} className="tv-scene__grid" />
      )
    case 'clock':
      return p.digital ? (
        <DigitalClock minutes={p.minutes ?? 0} h24={p.h24} size={220} />
      ) : (
        <AnalogClock minutes={p.minutes} size={190} sweep={p.to !== undefined && p.minutes !== null ? { from: p.minutes, to: p.to } : undefined} />
      )
    case 'coins':
      return <CoinRow ore={p.ore} />
    case 'shop':
      return (
        <div className="tv-shop">
          <span className="tv-shop__item">
            <Thing id={p.thing} size={96} />
            <span className="tv-shop__tag">{formatMoney(p.priceOre)}</span>
          </span>
          {p.paidOre !== undefined && <CoinRow ore={splitCoins(p.paidOre)} small />}
        </div>
      )
    case 'ruler':
      return <RulerScene object={p.object} startCm={p.startCm} lengthCm={p.lengthCm} />
    case 'unitsRow':
      return <UnitsRow object={p.object} unit={p.unit} length={p.length} />
    case 'chart':
      return p.kind === 'bar' ? <BarChart data={p.data} className="tv-scene__chart" /> : <Pictogram data={p.data} className="tv-scene__chart" />
    case 'fraction':
      return <FractionShape shape={p.shape} parts={p.parts} colored={p.colored} equal={p.equal} size={170} />
    case 'fractionBars':
      return <FractionBars fracs={p.fracs} className="tv-scene__bars" />
    case 'area':
      return <SquareGrid w={p.w} h={p.h} filled={p.cells} className="tv-scene__grid" />
    case 'amount':
      return (
        <div className="tv-amount">
          <span className="tv-amount__text">{formatMoney(p.ore)}</span>
        </div>
      )
  }
}

// ─── Small scenes ───────────────────────────────────────────────────────────

/** numberline tasks on a 'line' prompt: the line is the answer, so the card shows what to place. */
function PlaceChip({ prompt, task }: { prompt: Extract<Prompt, { scene: 'line' }>; task: Task }) {
  if (prompt.hops && prompt.hops.length >= 2) {
    const terms: Term[] = []
    prompt.hops.forEach((h, i) => {
      if (i > 0) terms.push({ op: '+' })
      terms.push({ n: h })
    })
    terms.push({ op: '=' }, { blank: true })
    return <Equation terms={terms} />
  }
  const target = prompt.target ?? (typeof task.answer === 'number' ? task.answer : null)
  return (
    <span className="tv-chip">
      <Icon name="pin" size={34} strokeWidth={2.4} className="tv-chip__icon" />
      {target !== null ? formatNumber(target) : '?'}
    </span>
  )
}

function TermsChip({ terms, entry, slot }: { terms: Term[]; entry?: ReactNode; slot: BlankSlot }) {
  return (
    <span className="tv-termschip">
      <Equation terms={terms} entry={entry} slot={slot} size="answer" nowrap />
    </span>
  )
}

function Groups({ groups, size, thing }: { groups: number; size: number; thing: string }) {
  const per = Math.min(size, 10)
  return (
    <div className={cx('tv-groups', groups > 4 && 'tv-groups--many')}>
      {Array.from({ length: groups }, (_, g) => (
        <span key={g} className="tv-groups__ring">
          <svg viewBox={`0 0 ${Math.min(per, 5) * 48} ${Math.ceil(per / 5) * 48}`} width={Math.min(per, 5) * (groups > 4 ? 15 : 20)} aria-hidden>
            {Array.from({ length: per }, (_, i) => (
              <ThingArt48 key={i} id={thing} x={(i % 5) * 48} y={Math.floor(i / 5) * 48} />
            ))}
          </svg>
        </span>
      ))}
    </div>
  )
}

function ThingArt48({ id, x, y }: { id: string; x: number; y: number }) {
  return <ObjectArt id={id} x={x} y={y} />
}

function DotArray({ rows, cols, split }: { rows: number; cols: number; split?: number }) {
  const s = 26
  const W = cols * s + 16
  const H = rows * s + 16 + (split ? 10 : 0)
  return (
    <svg className="tv-scene__svg tv-array" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const below = split !== undefined && r >= split
          return <circle key={`${r}.${c}`} className={cx('tv-array__dot', below && 'is-b')} cx={8 + c * s + s / 2} cy={8 + r * s + s / 2 + (below ? 10 : 0)} r={s * 0.36} />
        }),
      )}
      {split !== undefined && <path className="tv-array__split" d={`M2 ${8 + split * s + 5}H${W - 2}`} />}
    </svg>
  )
}

function ShareScene({ total, recipients, thing }: { total: number; recipients: number; thing: string }) {
  const pile = Math.min(total, 24)
  return (
    <div className="tv-share">
      <svg className="tv-share__pile" viewBox={`0 0 ${Math.min(pile, 6) * 34 + 20} ${Math.ceil(pile / 6) * 30 + 30}`} aria-hidden>
        {Array.from({ length: pile }, (_, i) => (
          <ObjectArt key={i} id={thing} x={(i % 6) * 34 + (Math.floor(i / 6) % 2) * 12} y={Math.floor(i / 6) * 30} k={0.8} />
        ))}
      </svg>
      <div className="tv-share__friends">
        {Array.from({ length: Math.min(recipients, 6) }, (_, i) => (
          <span key={i} className="tv-share__friend">
            <Icon name="paw" size={34} />
          </span>
        ))}
      </div>
    </div>
  )
}

/** A whole amount as the fewest coins and notes (used to picture paid money). */
function splitCoins(ore: number): number[] {
  const out: number[] = []
  let left = ore
  for (const d of [2000, 1000, 500, 200, 100, 50]) {
    while (left >= d && out.length < 12) {
      out.push(d)
      left -= d
    }
  }
  return out
}

function CoinRow({ ore, small }: { ore: number[]; small?: boolean }) {
  return (
    <div className={cx('tv-coins', small && 'tv-coins--small')}>
      {ore.map((v, i) =>
        isCoin(v) ? <Coin key={i} ore={v} mm={small ? 2 : ore.length > 6 ? 2.3 : 2.9} /> : <span key={i} className="tv-coins__note">{formatMoney(v)}</span>,
      )}
    </div>
  )
}

function RulerScene({ object, startCm, lengthCm }: { object: string; startCm: number; lengthCm: number | null }) {
  const len = lengthCm ?? 8
  const cm = startCm + len > 15 ? 20 : 15
  const W = RULER.X0 * 2 + cm * RULER.CM
  return (
    <div className="tv-rulerscene">
      <svg className="tv-scene__svg" viewBox={`0 0 ${W} 60`} aria-hidden>
        <LongArt id={isLong(object) ? object : 'pencil'} length={len * RULER.CM} x={RULER.X0 + startCm * RULER.CM} y={34} h={30} />
      </svg>
      <Ruler cm={cm} className="tv-scene__ruler" />
    </div>
  )
}

function UnitsRow({ object, unit, length }: { object: string; unit: 'cube' | 'clip'; length: number }) {
  const W = Math.max(length, 1) * 40 + 20
  return (
    <svg className="tv-scene__svg tv-unitsrow" viewBox={`0 0 ${W} 110`} aria-hidden>
      <LongArt id={isLong(object) ? object : 'pencil'} length={length * 40} x={10} y={28} h={22} />
      {Array.from({ length }, (_, i) => (
        <ObjectArt key={i} id={unit === 'cube' ? 'cube' : 'clip'} x={10 + i * 40 - 4} y={52} k={1} />
      ))}
    </svg>
  )
}

function StoryScene({ species, nums }: { species: string; nums: number[] }) {
  const def = useSpecies(species as never)
  return (
    <div className="tv-story">
      <span className="tv-story__animal">{def && <Rig species={def} mood="wave" mode="static" size="100%" />}</span>
      <span className="tv-story__nums">
        {nums.map((v, i) => (
          <span key={i} className="tv-story__num">
            {formatNumber(v)}
          </span>
        ))}
      </span>
    </div>
  )
}
