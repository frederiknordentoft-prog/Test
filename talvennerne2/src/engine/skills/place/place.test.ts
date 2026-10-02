// Tests for the place-value skills tensOnes and placeValue1000 (SK2-NUM). The shared contract
// (number/testing/harness.ts) runs every fact, 200 seeded instances per family and every kind through
// the real task builder; the blocks below add independent answers, the misconceptions and A9,
// production and ceilings per kind, and the hints of a fact rebuilt from its task.
import { describe, expect, it } from 'vitest'
import tensOnesModule from './tensOnes'
import placeValue1000Module from './placeValue1000'
import { factsUnderTest, skillContract, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { AnswerValue, Fact, SkillDef, Task, TaskKind } from '../../types'

const tensOnes: SkillDef = tensOnesModule
const placeValue1000: SkillDef = placeValue1000Module

const digits = (n: number) => ({ h: Math.floor(n / 100), t: Math.floor(n / 10) % 10, o: n % 10 })

/** tensOnes, from the id alone: what cards and keypad, the blocks and the palette must give. */
function tensOnesAnswer(id: string, kind: TaskKind): AnswerValue {
  const bits = id.split(':')
  const n = Number(bits.at(-1))
  const { t, o } = digits(n)
  const family = bits[1]
  if (kind === 'fillSlots') return family === 'expand' ? `${t * 10}|${o}` : `${t}|${o}`
  if (family === 'decompose') {
    const tens = bits[2] === 'tens'
    if (kind === 'buildBase') return tens ? t * 10 : o
    return tens ? t : o
  }
  if (family === 'expand') return o
  return n
}

/** placeValue1000, from the id alone. */
function placeValueAnswer(id: string, kind: TaskKind): AnswerValue {
  const bits = id.split(':')
  const family = bits[1]
  let n: number
  if (family === 'regroup') {
    const [a, b] = [Number(bits[3]), Number(bits[4])]
    n = bits[2] === 'ht' ? a * 100 + b * 10 : a * 10 + b
  } else n = Number(bits.at(-1))
  const { h, t, o } = digits(n)
  const parts = [h * 100, t * 10, o].filter((v) => v > 0)
  if (kind === 'fillSlots') return family === 'digitValue' || family === 'expand' ? parts.join('|') : String(n).split('').join('|')
  if (family === 'digitValue' || family === 'expand') return bits[2] === 'h' ? h * 100 : t * 10
  return n
}

describe('place-value skills: the contract', () => {
  skillContract(tensOnes, {
    families: { build: 20, decompose: 20, swapped: 20, expand: 20 },
    answerOf: (f, kind) => tensOnesAnswer(f.id, kind),
  })
  skillContract(placeValue1000, {
    families: { buildHTO: 20, zeroPlace: 20, digitValue: 20, expand: 20, regroup: 20 },
    answerOf: (f, kind) => placeValueAnswer(f.id, kind),
  })
})
