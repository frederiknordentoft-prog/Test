// Test fixture: a tiny addition "skill" that builds real V2 tasks, so the round builder and the
// round state machine can be tested before the real SkillDefs exist. Never imported by the app.
import type { KeyOption } from '../roundBuilder'
import type { Rng } from '../rng'
import type { SkillId, Task, TaskKind } from '../types'

export interface AddFact { id: string; a: number; b: number; answer: number; rank: number }

export function addFacts(max = 10): AddFact[] {
  const out: AddFact[] = []
  for (let a = 0; a <= max; a++) for (let b = 0; a + b <= max; b++) out.push({ id: `add:${a}+${b}`, a, b, answer: a + b, rank: a + b })
  return out
}

export function buildAddTask(f: AddFact, kind: TaskKind, rng: Rng, occurrence: number, skill: SkillId = 'addTo10'): Task {
  let options: number[] = []
  if (kind === 'choice') {
    const wrong = [f.answer + 1, f.answer - 1, f.answer + 2, f.a, f.b].filter((v, i, xs) => v >= 0 && v !== f.answer && xs.indexOf(v) === i)
    options = rng.shuffle([f.answer, ...rng.shuffle(wrong).slice(0, 2)])
  }
  return {
    id: `${f.id}#${occurrence}`, factId: f.id, masteryKey: f.id, skill, family: 'big', kind,
    prompt: { scene: 'equation', terms: [{ n: f.a }, { op: '+' }, { n: f.b }, { op: '=' }, { blank: true }] },
    answer: f.answer, answerType: 'int', accept: [], tolerance: 0, modulo: 0,
    options, optionView: 'numeral', distractorTags: {}, optionClips: null, unit: null, entryScale: 1,
    range: [0, 12], maxDigits: 2, scaffold: false,
    speech: [{ clip: 'frag.hvad_er' }, { num: f.a, form: 'mid' }, { clip: 'op.plus' }, { num: f.b, form: 'end' }],
    retryOf: null,
  }
}

export function addKeys(facts: readonly AddFact[], kinds: readonly TaskKind[] = ['choice', 'keypad']): KeyOption[] {
  return facts.map((f) => ({
    key: f.id, skill: 'addTo10', rank: f.rank, kinds, production: kinds.filter((k) => k === 'keypad'),
    build: (kind, rng, occurrence) => buildAddTask(f, kind, rng, occurrence),
  }))
}
