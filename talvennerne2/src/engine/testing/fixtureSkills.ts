// Test fixtures: four small but real SkillDefs that agree with SKILL_BY_ID, so the registry, the task
// builder, the diagnostics and the round builder can be tested before the real skills exist.
// Never imported by the app — the registry only collects src/engine/skills/<domain>/*.ts.
import type { AnswerValue, Candidate, Fact, FamilyDef, HintSpec, Prompt, SkillId, TaskKind } from '../types'
import type { SkillModule } from '../skills/types'
import { hashSeed, makeRng, type Rng } from '../rng'
import { SKILL_BY_ID } from '../../content/skills'
import { digitSwapOf } from '../misconceptions'

const meta = (id: SkillId) => {
  const m = SKILL_BY_ID[id]
  return { id, domain: m.domain, grade: m.grade, stage: m.stage, mode: m.mode, label: m.label, canDo: `s.cando.${id}`, families: m.families, kinds: m.kinds }
}

const hint = (skill: SkillId, tag: string | null): HintSpec => ({
  speech: [{ clip: `hint.${skill}` }],
  visual: { scene: 'none' },
  ...(tag && tag !== 'near' && tag !== 'operand' && tag !== 'other' && tag !== 'ambiguous' && tag !== 'shareUnequal'
    ? { misconception: tag as HintSpec['misconception'] }
    : {}),
})

const plus = (a: number, b: number): Prompt => ({ scene: 'equation', terms: [{ n: a }, { op: '+' }, { n: b }, { op: '=' }, { blank: true }] })

// ─── addTo10 (recall) ───────────────────────────────────────────────────────

const ADD10: Fact[] = []
for (let a = 0; a <= 10; a++) {
  for (let b = 0; a + b <= 10; b++) {
    ADD10.push({ id: `add:${a}+${b}`, skill: 'addTo10', family: a + b <= 5 ? 'small' : 'big', operands: [a, b], answer: a + b, rank: a + b })
  }
}

export const addTo10Fixture = {
  ...meta('addTo10'),
  enumerate: () => ADD10,
  answerType: () => 'int',
  prompt: (f) => plus(f.operands[0], f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 12],
  speech: (f) => [{ clip: `q.${f.id}` }],
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    const out: Candidate[] = [{ value: s + 1, tag: 'near' }]
    if (b > 0) out.push({ value: s - 1, tag: 'countFromFirst' })
    if (a !== s) out.push({ value: a, tag: 'operand' })
    if (b !== s) out.push({ value: b, tag: 'operand' })
    if (b > 0 && a - b >= 0) out.push({ value: a - b, tag: 'wrongOperation' })
    return out
  },
  hint: (_f, tag) => hint('addTo10', tag),
} satisfies SkillModule

// ─── add100Carry (procedure) ────────────────────────────────────────────────

/** One draw of a family; the families are disjoint so an instance id belongs to one family only. */
function carryPair(family: string, rng: Rng): [number, number] {
  switch (family) {
    case 'toNextTen': {
      const o = rng.between(1, 9)
      return [10 * rng.between(1, 8) + o, 10 - o]
    }
    case 'TOplusOcarry': {
      const o = rng.between(3, 9)
      return [10 * rng.between(1, 8) + o, rng.between(11 - o, 8)]
    }
    case 'TOplusTOcarry': {
      for (;;) {
        const o1 = rng.between(2, 9)
        const o2 = rng.between(11 - o1, 9)
        const t1 = rng.between(1, 7)
        const t2 = rng.between(1, 8 - t1)
        const b = 10 * t2 + o2
        if (b !== 19) return [10 * t1 + o1, b]
      }
    }
    case 'nearTen': {
      const b = rng.pick([9, 19])
      return [10 * rng.between(1, b === 9 ? 8 : 7) + rng.between(2, 9), b]
    }
    default: {
      // TOplusTOover100: 101–198
      for (;;) {
        const a = 10 * rng.between(3, 9) + rng.between(1, 9)
        const b = 10 * rng.between(3, 9) + rng.between(1, 9)
        if (a + b > 100) return [a, b]
      }
    }
  }
}

const carryFact = (family: FamilyDef, a: number, b: number): Fact =>
  ({ id: `add:${a}+${b}`, skill: 'add100Carry', family: family.id, operands: [a, b], answer: a + b, rank: family.rank })

const CARRY_FAMILIES = SKILL_BY_ID.add100Carry.families
const CARRY_CANON: Fact[] = CARRY_FAMILIES.flatMap((fam) => {
  const rng = makeRng(hashSeed(`add100Carry/${fam.id}`))
  const out = new Map<string, Fact>()
  for (let i = 0; i < 500 && out.size < 20; i++) {
    const [a, b] = carryPair(fam.id, rng)
    const f = carryFact(fam, a, b)
    out.set(f.id, f)
  }
  return [...out.values()]
})

export const add100CarryFixture = {
  ...meta('add100Carry'),
  enumerate: () => CARRY_CANON,
  instance(family, rng, avoid) {
    let f = carryFact(family, ...carryPair(family.id, rng))
    for (let i = 0; i < 40 && avoid.has(f.id); i++) f = carryFact(family, ...carryPair(family.id, rng))
    return f
  },
  answerType: () => 'int',
  prompt(f, kind): Prompt {
    const [a, b] = f.operands
    if (kind === 'numberline') return { scene: 'line', min: 0, max: a + b > 100 ? 200 : 100, hops: [a, b] }
    return plus(a, b)
  },
  optionView: () => 'numeral',
  range: (f) => [0, (f.answer as number) > 100 ? 200 : 100],
  speech: (f) => [{ clip: 'frag.hvad_er' }, { num: f.operands[0], form: 'mid' }, { clip: 'op.plus' }, { num: f.operands[1], form: 'end' }],
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    const out: Candidate[] = [
      { value: s + 1, tag: 'near' }, { value: s - 1, tag: 'near' }, { value: s + 10, tag: 'near' },
      { value: a, tag: 'operand' }, { value: b, tag: 'operand' },
    ]
    if ((a % 10) + (b % 10) >= 10) out.push({ value: s - 10, tag: 'forgotCarry' })
    if (b < 10) out.push({ value: a + 10 * b, tag: 'placeMisalign' })
    if (a - b >= 0) out.push({ value: a - b, tag: 'wrongOperation' })
    return out
  },
  hint: (_f, tag) => hint('add100Carry', tag),
} satisfies SkillModule

// ─── weightCompare (recall, perceptual contrast, multiSelect production) ────

const THINGS = ['balloon', 'stone', 'pillow', 'apple', 'feather', 'book', 'ball', 'key', 'box', 'marble', 'bottle', 'leaf']
/** Six things beside the teddy (size 4, weight 4): on conflict items size misleads, on congruent ones it agrees. */
const SIZES = [1, 2, 3, 5, 6, 7]
const CONGRUENT_W = [1, 2, 3, 5, 6, 7]
const CONFLICT_W = [6, 2, 7, 1, 5, 3]

interface Scale { names: string[]; sizes: number[]; weights: number[]; contrast: 'conflict' | 'congruent' }
const scaleOf = (f: Fact) => f.data as unknown as Scale

const WEIGHT_FACTS: Fact[] = Array.from({ length: 12 }, (_, i) => {
  const contrast = i < 6 ? 'congruent' : 'conflict'
  const rng = makeRng(hashSeed(`wgt:${i}`))
  const order = rng.shuffle([0, 1, 2, 3, 4, 5])
  const names = rng.shuffle(THINGS).slice(0, 6)
  const weightsBy = contrast === 'congruent' ? CONGRUENT_W : CONFLICT_W
  const data: Scale = { names, sizes: order.map((j) => SIZES[j]), weights: order.map((j) => weightsBy[j]), contrast }
  return { id: `wgt:${i}`, skill: 'weightCompare' as const, family: contrast, operands: [i], answer: '', rank: i % 6, data: data as unknown as Fact['data'] }
}).map((f) => ({ ...f, answer: pairAnswer(f) }))

/** The card question compares the biggest and the smallest thing. */
function pair(f: Fact): [number, number] {
  const { sizes } = scaleOf(f)
  return [sizes.indexOf(Math.max(...sizes)), sizes.indexOf(Math.min(...sizes))]
}
function pairAnswer(f: Fact): string {
  const { names, weights } = scaleOf(f)
  const [big, small] = pair(f)
  return `obj:${weights[big] > weights[small] ? names[big] : names[small]}`
}
const heavierSet = (f: Fact, by: 'weights' | 'sizes') =>
  scaleOf(f)[by].flatMap((v, i) => (v > 4 ? [`o${i}`] : [])).join('|')

export const weightCompareFixture = {
  ...meta('weightCompare'),
  enumerate: () => WEIGHT_FACTS,
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? heavierSet(f, 'weights') : f.answer),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'token'),
  answerType: () => 'token',
  options: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'] : []),
  contrast: (f: Fact) => scaleOf(f).contrast,
  prompt(f, kind): Prompt {
    const { names, sizes } = scaleOf(f)
    if (kind === 'multiSelect') return { scene: 'compareObjects', objects: ['teddy', ...names], sizes: [4, ...sizes], aligned: true, mode: 'weight' }
    const [big, small] = pair(f)
    return { scene: 'compareObjects', objects: [names[big], names[small]], sizes: [sizes[big], sizes[small]], aligned: true, mode: 'weight' }
  },
  optionView: () => 'picture',
  range: () => [0, 1],
  speech: (_f, kind) => [{ clip: kind === 'multiSelect' ? 's.weight.heavierThanTeddy' : 's.weight.heaviest' }],
  candidates(f) {
    const { names } = scaleOf(f)
    const [big, small] = pair(f)
    const out: Candidate[] = [
      { value: `obj:${names[big]}`, tag: 'sizeIsWeight' },
      { value: `obj:${names[small]}`, tag: 'other' },
    ]
    const bySize = heavierSet(f, 'sizes')
    if (bySize !== heavierSet(f, 'weights')) out.push({ value: bySize, tag: 'sizeIsWeight' })
    return out
  },
  hint: (_f, tag) => hint('weightCompare', tag),
} satisfies SkillModule

// ─── hear20 (recall, needs sound) ───────────────────────────────────────────

const HEAR20: Fact[] = Array.from({ length: 21 }, (_, n) => ({
  id: `hear:${n}`, skill: 'hear20' as const, family: n <= 10 ? 'small' : 'teens', operands: [n], answer: n,
  // 11–19 are irregular in Danish and come last
  rank: n <= 10 ? n : n === 20 ? 11 : n + 1,
}))

export const hear20Fixture = {
  ...meta('hear20'),
  enumerate: () => HEAR20,
  answerType: () => 'int',
  prompt: () => ({ scene: 'hear' }),
  optionView: () => 'numeral',
  range: () => [0, 20],
  speech: (f) => [{ num: f.answer as number, form: 'end' }],
  candidates(f) {
    const n = f.answer as number
    const out: Candidate[] = [{ value: n + 1, tag: 'near' }]
    if (n > 0) out.push({ value: n - 1, tag: 'near' })
    const swapped = digitSwapOf(n)
    if (swapped !== null) out.push({ value: swapped, tag: 'digitSwap' })
    return out
  },
  hint: (_f, tag) => hint('hear20', tag),
} satisfies SkillModule

export const FIXTURE_SKILLS: readonly SkillModule[] = [addTo10Fixture, add100CarryFixture, weightCompareFixture, hear20Fixture]
