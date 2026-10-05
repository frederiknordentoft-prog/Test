// What a demo film's little example is about (review r1 P2-8): it looks like the child's own task —
// things to count in Tællelunden, a heard number, a row of stepping stones, a figure, a pattern, two
// lengths, a sum in Plusengen, a clock in Urtårnet, coins in Købmandsgården, a times table in
// Gangegrotten — but it is never the child's task itself (SPEC §3.4). A child in 0. klasse who is
// learning to count never meets "1 + 2" as the first thing in the game, and a child learning the
// clock never meets three apples (UI-fund 20).
import type { ReactNode } from 'react'
import type { SkillId, Task } from '../../../engine/types'
import { Base10Group, Coin, FractionShape, Shape2D, Thing } from '../../../art/materials'
import { Equation } from '../../design/Equation'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { LongArt, ObjectArt } from '../../scenes/objects'
import { PatternToken } from '../faces'

export type DemoTopic =
  | 'count' | 'hear' | 'order' | 'shape' | 'pattern' | 'length' | 'add' | 'sub'
  | 'clock' | 'coin' | 'money' | 'solid' | 'corners' | 'fraction' | 'measure' | 'unit' | 'weight'
  | 'mul' | 'div' | 'groups' | 'share' | 'base'

const BY_SKILL: Partial<Record<SkillId, DemoTopic>> = {
  count10: 'count', count20: 'count',
  hear20: 'hear', hear100: 'hear', hear1000: 'hear',
  order20: 'order', order100: 'order', order1000: 'order', skipCount: 'order',
  shapes2D: 'shape', sortShapes: 'shape', symmetry: 'shape', patterns: 'pattern', compareLength: 'length',
  addTo10: 'add', addTo20: 'add', tenFriends: 'add', doubles: 'add', addSub20Simple: 'add', missingPart10: 'add', equalSides: 'add',
  subTo10: 'sub', subTo20: 'sub',
  // Urtårnet: a clock, never a heard number
  clockHour: 'clock', clockHalf: 'clock', clockQuarter: 'clock', clockFive: 'clock', clockDigital: 'clock', clockElapsed: 'clock',
  // Købmandsgården: coins, never apples
  coinNames: 'coin', countCoins: 'money', payExact: 'money', change: 'money', kronerOre: 'money',
  // Figurhaven, Arealhaven (a figure, and a number of squares or along) and Brøkbageriet (a share of
  // a heap is dealt into rings: half of six is three)
  shapes3D: 'solid', sidesCorners: 'corners', composeShapes: 'corners', area: 'corners', gridCoords: 'corners',
  halfShape: 'fraction', fractionShape: 'fraction', fractionOfSet: 'share', fractionCompare: 'fraction',
  // Målebakken and Linealstien
  measureUnits: 'measure', rulerRead: 'measure', readChart: 'measure', convertCmM: 'measure', unitChoice: 'unit', weightCompare: 'weight',
  // Gangegrotten: groups, tables and sharing
  groupsOf: 'groups', mul2510: 'mul', mul34: 'mul', mul6to9: 'mul', mulTens: 'mul',
  div2510: 'div', divAll: 'div', shareEqually: 'share', halves: 'share',
  tensOnes: 'base', placeValue1000: 'base',
}

/** The example a demo shows for this task: by its skill, else by what its prompt looks like. */
export function demoTopic(task: Task | null | undefined): DemoTopic {
  if (!task) return 'count'
  const own = BY_SKILL[task.skill]
  if (own) return own
  if (task.answerType === 'minutes') return 'clock'
  if (task.answerType === 'ore') return 'money'
  const p = task.prompt
  switch (p.scene) {
    case 'objects':
      return 'count'
    case 'hear':
      return 'hear'
    case 'row':
    case 'line':
    case 'board':
      return 'order'
    case 'clock':
      return 'clock'
    case 'coins':
    case 'shop':
    case 'amount':
      return 'money'
    case 'solid':
      return 'solid'
    case 'shape':
    case 'shapes':
      return typeof task.answer === 'number' ? 'corners' : 'shape'
    case 'fraction':
    case 'fractionBars':
      return 'fraction'
    case 'ruler':
    case 'unitsRow':
    case 'chart':
      return 'measure'
    case 'groups':
    case 'array':
      return 'groups'
    case 'share':
      return 'share'
    case 'base':
      return 'base'
    case 'balance':
      return 'add'
    case 'equation': {
      const op = p.terms.find((t) => 'op' in t && t.op !== '=')
      const sign = op && 'op' in op ? op.op : '+'
      return sign === '−' ? 'sub' : sign === '·' ? 'mul' : sign === ':' ? 'div' : 'add'
    }
    default:
      return 'count'
  }
}

/** Topics with a number for an answer, and the number the films use (always three: 1 + 2, 4 − 1, after 2). */
export const NUMBER_TOPICS: readonly DemoTopic[] = [
  'count', 'hear', 'order', 'add', 'sub', 'money', 'corners', 'measure', 'mul', 'div', 'groups', 'share', 'base',
]

/** Topics whose question is only heard: the loudspeaker stands for it. */
const HEARD: readonly DemoTopic[] = ['hear', 'shape', 'length', 'clock', 'coin', 'solid', 'unit', 'weight']
export const DEMO_ANSWER = 3

/** The question of a number film, small: three apples, the loudspeaker, the stones 2 → ?, or a sum. */
export function DemoQuestion({ topic, answer }: { topic: DemoTopic; answer: string | null }) {
  switch (topic) {
    case 'count':
      return (
        <span className="tv-demo__pile tv-demo__pile--count">
          {[0, 1, 2].map((i) => (
            <Thing key={i} id="apple" size={40} />
          ))}
        </span>
      )
    case 'money':
      // two coins on the counter: how much money? (2 kr + 1 kr)
      return (
        <span className="tv-demo__pile tv-demo__pile--money">
          <Coin ore={200} size={52} />
          <Coin ore={100} size={44} />
        </span>
      )
    case 'corners':
      return <Shape2D shape="triangle" size={70} />
    case 'fraction':
      return <FractionShape shape="circle" parts={2} colored={1} size={70} />
    case 'measure':
      // a pencil three cubes long
      return (
        <svg viewBox="0 0 140 110" width="112" height="88" aria-hidden overflow="visible">
          <LongArt id="pencil" length={120} x={10} y={28} h={22} />
          {[0, 1, 2].map((i) => (
            <ObjectArt key={i} id="cube" x={10 + i * 40 - 4} y={52} k={1} />
          ))}
        </svg>
      )
    case 'groups':
    case 'share':
      // three rings of one (groups: 3 in all) or six shared into two rings (share: 3 each)
      return (
        <span className="tv-demo__rings">
          {(topic === 'groups' ? [1, 1, 1] : [3, 3]).map((n, g) => (
            <span key={g} className="tv-groups__ring tv-demo__ring">
              {Array.from({ length: n }, (_, i) => (
                <Thing key={i} id="apple" size={26} />
              ))}
            </span>
          ))}
        </span>
      )
    case 'base':
      return <Base10Group h={0} t={0} o={3} unit={14} />
    case 'mul':
    case 'div':
      return (
        <Equation
          terms={topic === 'mul' ? [{ n: 3 }, { op: '·' }, { n: 1 }, { op: '=' }, { blank: true }] : [{ n: 6 }, { op: ':' }, { n: 2 }, { op: '=' }, { blank: true }]}
          size="answer"
          slot={answer ? 'good' : 'empty'}
          entry={answer ?? undefined}
        />
      )
    default:
      if (!HEARD.includes(topic)) return null
      return (
        <span className="tv-demo__hear" aria-hidden>
          <Icon name="soundOn" size="58%" strokeWidth={2.2} solid />
        </span>
      )
    case 'order':
      return (
        <span className="tv-demo__stones">
          <span className="tv-demo__stone">2</span>
          <span className={cx('tv-demo__stone is-gap', answer && 'is-good')}>{answer ?? '?'}</span>
        </span>
      )
    case 'pattern':
      return (
        <span className="tv-demo__stones">
          {['red', 'blue', 'red'].map((c, i) => (
            <span key={i} className="tv-demo__stone is-bead">
              <PatternToken token={c} px={44} />
            </span>
          ))}
          <span className={cx('tv-demo__stone is-gap is-bead', answer && 'is-good')}>{answer ? <PatternToken token={answer} px={44} /> : '?'}</span>
        </span>
      )
    case 'add':
    case 'sub':
      return (
        <Equation
          terms={topic === 'add' ? [{ n: 1 }, { op: '+' }, { n: 2 }, { op: '=' }, { blank: true }] : [{ n: 4 }, { op: '−' }, { n: 1 }, { op: '=' }, { blank: true }]}
          size="answer"
          slot={answer ? 'good' : 'empty'}
          entry={answer ?? undefined}
        />
      )
  }
}

/** A pencil of a given length, as a picture card face (compareLength). */
export function DemoStick({ length }: { length: number }): ReactNode {
  return (
    <svg viewBox="0 0 100 24" width="88" height="22" aria-hidden overflow="visible">
      <LongArt id="pencil" length={length} x={(100 - length) / 2} y={12} />
    </svg>
  )
}
