// What a demo film's little example is about (review r1 P2-8): it looks like the child's own task —
// things to count in Tællelunden, a heard number, a row of stepping stones, a figure, a pattern, two
// lengths, a sum in Plusengen — but it is never the child's task itself (SPEC §3.4). A child in 0.
// klasse who is learning to count never meets "1 + 2" as the first thing in the game.
import type { ReactNode } from 'react'
import type { SkillId, Task } from '../../../engine/types'
import { Thing } from '../../../art/materials'
import { Equation } from '../../design/Equation'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { LongArt } from '../../scenes/objects'
import { PatternToken } from '../faces'

export type DemoTopic = 'count' | 'hear' | 'order' | 'shape' | 'pattern' | 'length' | 'add' | 'sub'

const BY_SKILL: Partial<Record<SkillId, DemoTopic>> = {
  count10: 'count', count20: 'count',
  hear20: 'hear', hear100: 'hear', hear1000: 'hear',
  order20: 'order', order100: 'order', order1000: 'order', skipCount: 'order',
  shapes2D: 'shape', patterns: 'pattern', compareLength: 'length',
  addTo10: 'add', addTo20: 'add', tenFriends: 'add', doubles: 'add', addSub20Simple: 'add', missingPart10: 'add',
  subTo10: 'sub', subTo20: 'sub', halves: 'sub',
}

/** The example a demo shows for this task: by its skill, else by what its prompt looks like. */
export function demoTopic(task: Task | null | undefined): DemoTopic {
  if (!task) return 'count'
  const own = BY_SKILL[task.skill]
  if (own) return own
  const p = task.prompt
  if (p.scene === 'objects') return 'count'
  if (p.scene === 'hear') return 'hear'
  if (p.scene === 'row' || p.scene === 'line') return 'order'
  if (p.scene === 'equation') return p.terms.some((t) => 'op' in t && t.op === '−') ? 'sub' : 'add'
  return 'count'
}

/** Topics with a number for an answer, and the number the films use (always three: 1 + 2, 4 − 1, after 2). */
export const NUMBER_TOPICS: readonly DemoTopic[] = ['count', 'hear', 'order', 'add', 'sub']
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
    case 'hear':
    case 'shape':
    case 'length':
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
