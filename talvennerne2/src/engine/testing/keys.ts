// Test helper: synthetic plus and minus keys (with operation, misconceptions and a review skill) for
// the round builder's V2 tests. Never imported by the app.
import type { KeyOption } from '../roundBuilder'
import type { ErrorTag, MisconceptionId, SkillId, Task, TaskKind } from '../types'
import type { Rng } from '../rng'

export interface SumFact { id: string; a: number; b: number; op: '+' | '−'; answer: number; rank: number }

export function sums(op: '+' | '−', max = 10): SumFact[] {
  const out: SumFact[] = []
  for (let a = 0; a <= max; a++) {
    for (let b = 0; b <= max; b++) {
      if (op === '+' && a + b <= max) out.push({ id: `add:${a}+${b}`, a, b, op, answer: a + b, rank: a + b })
      if (op === '−' && b <= a) out.push({ id: `sub:${a}-${b}`, a, b, op, answer: a - b, rank: a })
    }
  }
  return out
}

export function sumTask(f: SumFact, kind: TaskKind, rng: Rng, occurrence: number, skill: SkillId, target?: readonly MisconceptionId[]): Task {
  const options = kind === 'choice' ? rng.shuffle([f.answer, f.answer + 1, f.op === '+' ? f.answer + 2 : f.answer + 3]) : []
  const distractorTags: Record<string, ErrorTag> = kind === 'choice' ? { [String(f.answer + 1)]: target?.[0] ?? 'near' } : {}
  return {
    id: `${f.id}#${occurrence}`, factId: f.id, masteryKey: f.id, skill, family: 'all', kind,
    prompt: { scene: 'equation', terms: [{ n: f.a }, { op: f.op }, { n: f.b }, { op: '=' }, { blank: true }] },
    answer: f.answer, answerType: 'int', accept: [], tolerance: 0, modulo: 0,
    options, optionView: 'numeral', distractorTags, optionClips: null, unit: null, entryScale: 1,
    range: [0, 20], maxDigits: 2, scaffold: false, speech: [], retryOf: null,
  }
}

export function sumKeys(facts: readonly SumFact[], skill: SkillId, over: Partial<KeyOption> = {}): KeyOption[] {
  return facts.map((f) => ({
    key: f.id, skill, family: 'all', rank: f.rank, kinds: ['choice', 'keypad'], production: ['keypad'], op: f.op,
    detectable: f.op === '+' && f.b > 0 ? ['countFromFirst'] : [],
    build: (kind, rng, occurrence, extra) => sumTask(f, kind, rng, occurrence, skill, extra?.target),
    ...over,
  }))
}

/** Multiplication keys ('mul:axb', op ·) from another skill: the review pool in round tests. */
export function productKeys(skill: SkillId, max = 5): KeyOption[] {
  const out: KeyOption[] = []
  for (let a = 1; a <= max; a++) {
    for (let b = a; b <= max; b++) {
      const id = `mul:${a}x${b}`
      const f: SumFact = { id, a, b, op: '+', answer: a * b, rank: a * b }
      out.push({
        key: id, skill, family: 'all', rank: a * b, kinds: ['choice', 'keypad'], production: ['keypad'], op: '·',
        detectable: ['tableNeighbour'],
        build: (kind, rng, occurrence) => ({
          ...sumTask(f, kind, rng, occurrence, skill),
          prompt: { scene: 'equation', terms: [{ n: a }, { op: '·' }, { n: b }, { op: '=' }, { blank: true }] },
        }),
      })
    }
  }
  return out
}
