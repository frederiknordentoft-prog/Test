// The misconceptions of the measure skills of 1.–2. klasse through the real diagnostics (SPEC §4.3): a
// child who keeps making one mistake is flagged for it; a child who answers right, and a child who
// guesses 500 times, never is. sizeIsWeight is perceptual: the child who judges weight by size is
// right on the congruent pictures and misled on the conflict ones, which is what the contrast rule
// asks for. measureUnits and unitChoice have no misconception (SPEC §4.2) and must never flag.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, guesser, right } from '../algebra/testing/diagnose'
import type { ErrorTag, SkillId, TaskKind } from '../../types'

const CASES: { skill: SkillId; node: string; kinds: TaskKind[]; tags: ErrorTag[] }[] = [
  { skill: 'measureUnits', node: 'w1-maal-penge-l3', kinds: ['choice', 'keypad', 'keypad'], tags: [] },
  { skill: 'rulerRead', node: 'w1-maal-penge-l3', kinds: ['choice', 'keypad', 'keypad'], tags: [] },
  { skill: 'rulerRead', node: 'w2-maal-data-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['rulerEnd'] },
  { skill: 'weightCompare', node: 'w1-maal-penge-l3', kinds: ['choice', 'multiSelect'], tags: ['sizeIsWeight'] },
  { skill: 'unitChoice', node: 'w2-maal-data-l3', kinds: ['choice', 'multiSelect'], tags: [] },
  { skill: 'readChart', node: 'w2-maal-data-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['wrongOperation'] },
]

describe('diagnostics of the measure skills of 1.–2. klasse (SPEC §4.3)', () => {
  for (const { skill, node, kinds, tags } of CASES) {
    describe(`${skill} on ${node}`, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(node, skill, kinds), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(node, skill, kinds), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(node, skill, kinds), 500, guesser(41))]).toEqual([])
      })
    })
  }

  it('never flags sizeIsWeight within one session, however the child judges', () => {
    // 16 answers a learning day by default: put all 60 answers on one day
    expect([...flagsRaised(builder('w1-maal-penge-l3', 'weightCompare', ['choice', 'multiSelect']), 60, always('sizeIsWeight'), 60)]).toEqual([])
  })

  it('flags sizeIsWeight within 20 conflict pictures', () => {
    const build = builder('w1-maal-penge-l3', 'weightCompare', ['choice', 'multiSelect'])
    const tasks = Array.from({ length: 80 }, (_, i) => build(i))
    let at = -1
    for (let n = 1; n <= tasks.length && at < 0; n++) {
      // eight answers a learning day, as a child who plays a round a day
      if (flagsRaised((i) => tasks[i], n, always('sizeIsWeight'), 8).has('sizeIsWeight')) {
        at = tasks.slice(0, n).filter((t) => t.contrast === 'conflict').length
      }
    }
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThanOrEqual(20)
  })
})
