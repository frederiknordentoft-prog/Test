// The picture half of a strategy (HintSpec.visual, SPEC §3.5): the contract's hint scenes (makeTen,
// backToTen, columns, splitArray, coinsSum, clockMove), every prompt scene, and the round's own
// pictures (hintFor.ts LocalVisual) including the animated films for digitSwap, forgotCarry and
// smallerFromLarger. Films play once when the card appears; calm motion shows their last frame.
import type { CSSProperties } from 'react'
import { AnalogClock, Base10Group, COIN_VALUES, Coin } from '../../art/materials'
import type { CoinOre } from '../../art/materials'
import { Equation } from '../design/Equation'
import { cx } from '../design/cx'
import { MarkedLine } from '../scenes/MarkedLine'
import { PromptScene } from '../scenes/PromptScene'
import { formatMoney, formatNumber } from '../task/answers'
import { Columns } from './Columns'
import { Frame, cells } from './Counters'
import type { Cell } from './Counters'
import type { AnyVisual } from './hintFor'

export function HintVisual({ visual, size = 'md' }: { visual: AnyVisual; size?: 'sm' | 'md' }) {
  const fw = size === 'sm' ? 150 : 190
  switch (visual.scene) {
    case 'none':
      return null
    case 'dotsAdd': {
      const { a, b } = visual
      const spec: Cell[] = [
        ...Array.from({ length: a }, () => ({ tone: 'a' as const })),
        ...Array.from({ length: b }, (_, i) => ({ tone: 'b' as const, arrive: 350 + i * 120 })),
      ]
      return (
        <div className="tv-hv tv-hv--frames">
          <Frame cells={cells(spec)} size={fw * 1.1} />
        </div>
      )
    }
    case 'dotsSub': {
      const { a, b } = visual
      const spec = Array.from({ length: a }, (_, i) => ({ tone: 'a' as const, struck: i >= a - b, leave: i >= a - b ? 400 + (a - 1 - i) * 150 : undefined }))
      return (
        <div className="tv-hv tv-hv--frames">
          <Frame cells={cells(spec)} size={fw * 1.1} />
        </div>
      )
    }
    case 'makeTen': {
      const { a, b } = visual
      const fill = Math.max(0, 10 - a)
      const rest = Math.max(0, b - fill)
      const first: Cell[] = [
        ...Array.from({ length: a }, () => ({ tone: 'a' as const })),
        ...Array.from({ length: fill }, (_, i) => ({ tone: 'b' as const, arrive: 700 + i * 160 })),
      ]
      const second: Cell[] = [
        ...Array.from({ length: rest }, () => ({ tone: 'b' as const })),
        ...Array.from({ length: fill }, () => ({ tone: null, ghost: true })),
      ]
      return (
        <div className="tv-hv tv-hv--frames">
          <span className="tv-hv__frame">
            <Frame cells={cells(first)} size={fw} />
            <span className="tv-hv__chip tv-step" style={{ animationDelay: `${900 + fill * 160}ms` }}>
              {formatNumber(10)}
            </span>
          </span>
          <span className="tv-hv__plus">+</span>
          <span className="tv-hv__frame">
            <Frame cells={second} size={fw} />
            <span className="tv-hv__chip tv-step" style={{ animationDelay: `${1100 + fill * 160}ms` }}>
              {formatNumber(rest)}
            </span>
          </span>
        </div>
      )
    }
    case 'backToTen': {
      const { a, b } = visual
      const down = Math.max(0, a - 10)
      const rest = Math.max(0, b - down)
      const second: Cell[] = Array.from({ length: down }, (_, i) => ({ tone: 'a' as const, struck: true, leave: 500 + (down - 1 - i) * 150 }))
      const first: Cell[] = Array.from({ length: 10 }, (_, i) => ({
        tone: 'a' as const,
        struck: i >= 10 - rest,
        leave: i >= 10 - rest ? 900 + down * 150 + (9 - i) * 150 : undefined,
      }))
      return (
        <div className="tv-hv tv-hv--frames">
          <Frame cells={cells(first)} size={fw} />
          <Frame cells={cells(second)} size={fw} />
        </div>
      )
    }
    case 'columns':
      return (
        <div className="tv-hv">
          <Columns a={visual.a} b={visual.b} op={visual.op} regroup={!!visual.carry} />
        </div>
      )
    case 'anim.forgotCarry':
      return (
        <div className="tv-hv">
          <Columns a={visual.a} b={visual.b} op="+" regroup film />
        </div>
      )
    case 'anim.smallerFromLarger':
      return (
        <div className="tv-hv">
          <Columns a={visual.a} b={visual.b} op="−" regroup film />
        </div>
      )
    case 'anim.digitSwap':
      return <DigitSwap n={visual.n} given={visual.given} film />
    case 'tensOnes':
      return <DigitSwap n={visual.n} given={null} film={false} />
    case 'splitArray':
      return (
        <div className="tv-hv tv-hv--split">
          <PromptScene prompt={{ scene: 'array', rows: visual.rows, cols: visual.cols, split: visual.split }} className="tv-hv__scene" />
          <span className="tv-hv__eqs">
            <Equation terms={[{ n: visual.split }, { op: '·' }, { n: visual.cols }]} size="answer" nowrap />
            <Equation terms={[{ n: visual.rows - visual.split }, { op: '·' }, { n: visual.cols }]} size="answer" nowrap />
          </span>
        </div>
      )
    case 'coinsSum': {
      const sorted = [...visual.ore].sort((x, y) => y - x)
      return (
        <div className="tv-hv tv-hv--coins">
          <span className="tv-hv__coins">
            {sorted.map((v, i) =>
              (COIN_VALUES as readonly number[]).includes(v) ? (
                <span key={i} className="tv-step" style={{ animationDelay: `${200 + i * 220}ms` }}>
                  <Coin ore={v as CoinOre} mm={2.3} />
                </span>
              ) : (
                <span key={i} className="tv-hv__chip">{formatMoney(v)}</span>
              ),
            )}
          </span>
          <span className="tv-hv__chip tv-hv__chip--total tv-step" style={{ animationDelay: `${300 + sorted.length * 220}ms` }}>
            {formatMoney(sorted.reduce((x, y) => x + y, 0))}
          </span>
        </div>
      )
    }
    case 'markedLine':
      return (
        <div className="tv-hv tv-hv--prompt">
          <div className="tv-scene tv-scene--line tv-hv__scene">
            <MarkedLine min={visual.min} max={visual.max} marks={visual.marks} hops={visual.hops} className="tv-scene__line" />
          </div>
        </div>
      )
    case 'clockMove':
      return (
        <div className="tv-hv">
          <AnalogClock minutes={visual.to} sweep={{ from: visual.from, to: visual.to }} size={size === 'sm' ? 130 : 160} />
        </div>
      )
    default:
      return (
        <div className="tv-hv tv-hv--prompt">
          <PromptScene prompt={visual} className="tv-hv__scene" />
        </div>
      )
  }
}

/**
 * digitSwap film: the number's blocks, tens first, with its digits underneath. The child's swapped
 * digits stand under the wrong blocks first, then trade places.
 */
function DigitSwap({ n, given, film }: { n: number; given: number | null; film: boolean }) {
  const tens = Math.floor(n / 10) % 10
  const ones = n % 10
  const swapped = film && given !== null && given === ones * 10 + tens
  return (
    <div className={cx('tv-hv tv-swap', swapped && 'is-film')}>
      <span className="tv-swap__group">
        <Base10Group t={tens} o={0} unit={7} />
        <span className={cx('tv-swap__digit is-tens', swapped && 'tv-swap__digit--from-right')} style={{ ['--d' as string]: '0ms' } as CSSProperties}>
          {tens}
        </span>
      </span>
      <span className="tv-swap__group">
        <Base10Group o={ones} unit={10} />
        <span className={cx('tv-swap__digit is-ones', swapped && 'tv-swap__digit--from-left')}>{ones}</span>
      </span>
    </div>
  )
}
