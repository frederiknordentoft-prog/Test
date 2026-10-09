// The picture half of a strategy (HintSpec.visual, SPEC §3.5): the contract's hint scenes (makeTen,
// backToTen, columns, splitArray, coinsSum, clockMove), every prompt scene, and the round's own
// pictures (hintFor.ts LocalVisual) including the animated films for digitSwap, forgotCarry and
// smallerFromLarger. Films play once when the card appears; calm motion shows their last frame.
import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { AnalogClock, Base10Group, COIN_VALUES, Coin } from '../../art/materials'
import { isPiece } from '../task/pay/logic'
import { PieceArt } from '../task/faces'
import type { CoinOre } from '../../art/materials'
import { Equation } from '../design/Equation'
import { cx } from '../design/cx'
import { MarkedLine } from '../scenes/MarkedLine'
import { PromptScene, rowFit } from '../scenes/PromptScene'
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
    case 'anim.borrowNoDecrement':
      // the same borrowing, with the tens digit that goes down by one in focus
      return (
        <div className="tv-hv">
          <Columns a={visual.a} b={visual.b} op="−" regroup film stressLent />
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
    case 'coinsSum':
      return <CoinsSum ore={visual.ore} />
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
 * The lightbulb's coins and their sum (coinsSum). In the round's card they keep their own sizes while
 * the card has room for them under the task's picture, and only when they would not fit do they get
 * smaller, all by the same factor (rowFit, as the task's own coins), so a 2-krone stays bigger than a
 * 1-krone (QA3c P2-2; QA3b P2-9: on an iPhone SE "9 kr." stays in the card). They never get smaller
 * than a sixth of the card high, the most a short card gave them before. Outside the round's card (the
 * strategy, a demo) nothing is measured.
 */
function CoinsSum({ ore }: { ore: readonly number[] }) {
  const ref = useFitHelpCoins()
  const sorted = [...ore].sort((x, y) => y - x)
  return (
    <div className="tv-hv tv-hv--coins">
      <span ref={ref} className="tv-hv__coins">
        {sorted.map((v, i) =>
          (COIN_VALUES as readonly number[]).includes(v) ? (
            <span key={i} className="tv-step" style={{ animationDelay: `${200 + i * 220}ms` }}>
              <Coin ore={v as CoinOre} mm={2.3} />
            </span>
          ) : isPiece(v) ? (
            <span key={i} className="tv-step" style={{ animationDelay: `${200 + i * 220}ms` }}>
              <PieceArt piece={v} />
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

/**
 * The help's pieces, sized as above. What is stacked in the card (the task's picture, the help, the
 * gaps between) may use its padding but for a little, as the picture and the sum stood before; what
 * overflows is taken from the coins: as a column over their sum, or, in a card too short for that (an
 * iPhone SE's keypad, the error flow), beside it.
 */
function useFitHelpCoins() {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const coins = ref.current
    const help = coins?.parentElement
    const scaffold = coins?.closest<HTMLElement>('.tv-round__scaffold')
    const card = scaffold?.closest<HTMLElement>('.tv-round__card')
    if (!coins || !help || !scaffold || !card) return
    const pieces = () => [...coins.querySelectorAll<SVGSVGElement>('svg[width][height]')]
    const fit = () => {
      help.classList.remove('is-row')
      for (const p of pieces()) {
        p.style.removeProperty('width')
        p.style.removeProperty('height')
      }
      const room = card.clientHeight - 8
      const gap = parseFloat(getComputedStyle(card).rowGap) || 0
      const stacked = [...card.children].filter((c): c is HTMLElement => c instanceof HTMLElement && getComputedStyle(c).position !== 'absolute')
      // (a picture's box may be squeezed below its content, which then overflows it: count the content)
      const used = stacked.reduce((sum, c) => sum + Math.max(c.offsetHeight, c.scrollHeight), 0) + gap * Math.max(0, stacked.length - 1)
      if (!(room > 0) || used <= room) return
      const over = used - room
      // own sizes (the drawing's attributes: the coins may still be springing in, scaled)
      const own = new Map<Element | null, { w: number; h: number }>(pieces().map((p) => [p.parentElement, { w: Number(p.getAttribute('width')), h: Number(p.getAttribute('height')) }]))
      const sizes = [...coins.children].map((c) => own.get(c) ?? { w: (c as HTMLElement).offsetWidth, h: (c as HTMLElement).offsetHeight })
      const css = getComputedStyle(scaffold)
      const width = scaffold.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
      const column = coins.offsetHeight > over ? rowFit(sizes, { w: width, h: coins.offsetHeight - over }, 4) : 0
      const sum = help.querySelector<HTMLElement>('.tv-hv__chip--total')
      const high = help.offsetHeight - over
      const beside = sum && sum.offsetHeight <= high ? rowFit(sizes, { w: width - sum.offsetWidth - (parseFloat(getComputedStyle(help).columnGap) || 0), h: high }, 4) : 0
      const ch = parseFloat(card.style.getPropertyValue('--ch')) || room
      const floor = (ch * 0.18) / Math.max(...sizes.map((z) => z.h))
      // beside the sum only when over it they would get much smaller (a column keeps the help's order)
      const row = column < 0.6 && beside > column
      const k = Math.min(1, Math.max(row ? beside : column, floor))
      if (row) help.classList.add('is-row')
      if (k >= 1) return
      for (const p of pieces()) {
        p.style.width = `${(Number(p.getAttribute('width')) * k).toFixed(2)}px`
        p.style.height = `${(Number(p.getAttribute('height')) * k).toFixed(2)}px`
      }
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    // the card, and the task's picture above (its coins fit themselves again when the help comes)
    const ro = new ResizeObserver(fit)
    ro.observe(card)
    for (const c of card.children) if (c !== scaffold) ro.observe(c)
    return () => ro.disconnect()
  }, [])
  return ref
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
