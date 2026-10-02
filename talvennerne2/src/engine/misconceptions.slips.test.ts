// SPEC §4.3 fixture: "50 % tilfældige ±1-fejl giver aldrig countFromFirst". Cards always show one
// short as the diagnostic card but one more only sometimes, so a child whose slips go either way
// lands on "one short" more often on cards; the direction rule reads typed answers only.
import { describe, expect, it } from 'vitest'
import { NODE_BY_ID } from '../content/curriculum'
import { keysForNode } from './registry'
import { makeRng } from './rng'
import { flagsRaised } from './skills/number/testing/harness'
import type { AnswerValue, SkillId, Task } from './types'

const ctx = { states: {}, audioVerified: true }

/** Every third task on cards, the rest typed; the keys in a random order per run. */
function builder(node: string, skill: SkillId, seed: number) {
  const keys = keysForNode(NODE_BY_ID[node], ctx).filter((k) => k.skill === skill)
  const pick = makeRng(seed)
  return (i: number): Task => keys[pick.int(keys.length)].build(i % 3 === 0 ? 'choice' : 'keypad', makeRng(seed * 1000 + i), i)
}

/** Half the answers slip by one, either way; on cards the other way when the first is not shown. */
function slipper(seed: number) {
  const rng = makeRng(seed)
  return (t: Task): AnswerValue => {
    const answer = Number(t.answer)
    if (rng.next() >= 0.5) return answer
    const first = rng.next() < 0.5 ? -1 : 1
    if (t.kind !== 'choice') return answer + first
    const shown = new Set(t.options.map(Number))
    if (shown.has(answer + first)) return answer + first
    return shown.has(answer - first) ? answer - first : answer
  }
}

const CASES: { skill: SkillId; node: string }[] = [
  { skill: 'addTo10', node: 'w0-plus10-l3' },
  { skill: 'subTo10', node: 'w0-minus10-l3' },
  { skill: 'addTo20', node: 'w1-tieren-l3' },
  { skill: 'subTo20', node: 'w1-tieren-l3' },
]

describe('countFromFirst and random slips of one (SPEC §4.3)', { timeout: 120_000 }, () => {
  for (const { skill, node } of CASES) {
    it(`never flags countFromFirst for 50 % random ±1 slips in ${skill} (60 runs)`, () => {
      const runs = Array.from({ length: 60 }, (_, run) => flagsRaised(builder(node, skill, 500 + run), 160, slipper(900 + run)))
      expect(runs.filter((flags) => flags.has('countFromFirst')).length).toBe(0)
    })
  }
})
