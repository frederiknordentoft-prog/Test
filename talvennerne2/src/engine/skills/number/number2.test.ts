// Tests for the number skills of 1.–2. klasse: hear100, order100, numberLine100, hear1000, order1000
// and numberLine1000 (SK2-NUM). The shared contract (testing/harness.ts) runs every fact, 200
// seeded instances per family and every kind through the real task builder; the blocks below add
// independent answers, the misconceptions and A9, production and ceilings per kind, and the regions.
import { describe, expect, it } from 'vitest'
import hear100Module from './hear100'
import hear1000Module from './hear1000'
import order100Module from './order100'
import order1000Module from './order1000'
import numberLine100Module from './numberLine100'
import numberLine1000Module from './numberLine1000'
import { factsUnderTest, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from './testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, digitSwapOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { keysForNode } from '../../registry'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { NODES } from '../../../content/curriculum'
import type { AnswerValue, Fact, Prompt, SkillDef, Task, TaskKind } from '../../types'

// Through the frozen contract, as the engine calls them.
const hear100: SkillDef = hear100Module
const hear1000: SkillDef = hear1000Module
const order100: SkillDef = order100Module
const order1000: SkillDef = order1000Module
const numberLine100: SkillDef = numberLine100Module
const numberLine1000: SkillDef = numberLine1000Module

const text = (t: Task) => compile(t.speech).text
const words = (n: number) => compile([{ num: n, form: 'end' }]).text.replace(/\.$/, '').toLowerCase()
const lastNumber = (id: string) => Number(id.slice(id.lastIndexOf(':') + 1))
const row = (p: Prompt) => {
  if (p.scene !== 'row') throw new Error(`expected a row, got ${p.scene}`)
  return p
}
const build = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => {
  const fact = factsUnderTest(def).find((f) => f.id === id) ?? findById(def, id)
  return buildTask(def, fact, kind, makeRng(seed), 0).task
}
/** A fact by id: canonical, or drawn until it turns up (procedure instances are kept in the id). */
function findById(def: SkillDef, id: string): Fact {
  const family = def.families.find((f) => id.split(':').includes(f.id)) ?? def.families[0]
  const rng = makeRng(7)
  for (let i = 0; i < 20000; i++) {
    const f = def.instance!(family, rng, new Set())
    if (f.id === id) return f
  }
  throw new Error(`no instance ${id}`)
}

// ─── Independent answers ────────────────────────────────────────────────────

/** order100 and order1000 ±: the answer from the id, without the skill's own code. */
function orderAnswer(id: string): number {
  const bits = id.split(':')
  const family = bits[1]
  const n = Number(bits.at(-1))
  if (family === 'crossTen') return bits[2] === 'after' ? n + 1 : n - 1
  if (family === 'crossHundred') return n + ({ plus1: 1, plus10: 10, minus1: -1, minus10: -10 } as Record<string, number>)[bits[2]]
  if (family.startsWith('bigger')) return Math.max(...bits.slice(2).map(Number))
  const m = /^(plus|minus)(\d+)$/.exec(family)!
  return n + (m[1] === 'plus' ? 1 : -1) * Number(m[2])
}

/** A sortOrder answer checked against its stones: counting on or back from the first stone, or biggest first. */
function sortProblems(t: Task): string[] {
  const cards = String(t.answer).split('|').map(Number)
  const stones = row(t.prompt).cells
  if (cards.length < 4) return [`${t.factId}: ${cards.length} cards`]
  if (stones[0] === null) return [...cards].sort((a, b) => b - a).join('|') === cards.join('|') ? [] : [`${t.factId}: not biggest first`]
  const d = cards[0] - (stones[0] as number)
  const steady = cards.every((c, i) => c - (i === 0 ? (stones[0] as number) : cards[i - 1]) === d)
  return steady && [1, -1, 10, -10, 100, -100].includes(d) ? [] : [`${t.factId}: stones ${stones.join(',')} cards ${cards.join(',')}`]
}

describe('number skills of 1.–2. klasse: the contract', () => {
  globalIdCheck()

  skillContract(hear100, {
    families: { d2x: 10, d3x: 10, d4x: 10, d5x: 10, d6x: 10, d7x: 10, d8x: 10, d9x: 10 },
    answerOf: (f) => lastNumber(f.id),
  })
  skillContract(hear1000, { families: { hundreds: 10, h0o: 20, hTeen: 20, hT0: 20, hTO: 20 }, answerOf: (f) => lastNumber(f.id) })
  skillContract(order100, {
    families: { plus1: 20, minus1: 20, plus10: 20, minus10: 20, crossTen: 18, biggerDiffTens: 20, biggerSwapped: 20 },
    answerOf: (f, kind) => (kind === 'sortOrder' ? undefined : orderAnswer(f.id)),
  })
  skillContract(order1000, {
    families: { plus1: 20, plus10: 20, plus100: 20, minus1: 20, minus10: 20, minus100: 20, crossHundred: 20, bigger3: 20, biggerMixed: 20 },
    answerOf(f, kind) {
      if (kind === 'sortOrder') return undefined
      if (kind === 'choice' && f.family === 'biggerMixed') {
        const [x, y] = f.id.split(':').slice(2).map(Number)
        return x < y ? 'cmp:<' : 'cmp:>'
      }
      return orderAnswer(f.id)
    },
  })
  skillContract(numberLine100, { families: { placeTens: 9, placeAny: 20, readArrow: 19 }, answerOf: (f) => lastNumber(f.id) })
  skillContract(numberLine1000, {
    families: { placeHundreds: 9, placeAny: 20, round10: 20, round100: 20 },
    answerOf(f) {
      const n = lastNumber(f.id)
      if (f.family === 'round10') return n % 10 >= 5 ? n - (n % 10) + 10 : n - (n % 10)
      if (f.family === 'round100') return n % 100 >= 50 ? n - (n % 100) + 100 : n - (n % 100)
      return n
    },
  })
})
