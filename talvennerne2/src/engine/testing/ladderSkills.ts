// Test helper: plain numeric stand-ins for the 14 placement-ladder skills, so the whole ladder can be
// walked before the real skills exist. Never imported by the app.
import type { Fact, SkillDef, SkillId } from '../types'
import { SKILL_BY_ID } from '../../content/skills'

export function standIn(id: SkillId): SkillDef {
  const m = SKILL_BY_ID[id]
  const facts: Fact[] = m.families.flatMap((fam) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = 3 + i + 10 * fam.rank
      const b = 2 + fam.rank
      return { id: `${id}:${fam.id}:${i}`, skill: id, family: fam.id, operands: [a, b], answer: a + b, rank: fam.rank * 10 + i }
    }),
  )
  const def: SkillDef = {
    id, domain: m.domain, grade: m.grade, stage: m.stage, mode: m.mode, label: m.label, canDo: `s.cando.${id}`,
    families: m.families, kinds: m.kinds,
    enumerate: () => facts,
    answerType: () => 'int',
    prompt: (f, kind) =>
      kind === 'countTap'
        ? { scene: 'objects', n: f.answer as number, layout: 'scatter', thing: 'carrot' }
        : { scene: 'equation', terms: [{ n: f.operands[0] }, { op: '+' }, { n: f.operands[1] }, { op: '=' }, { blank: true }] },
    optionView: () => 'numeral',
    range: (f) => [0, Math.max(20, (f.answer as number) * 2)],
    speech: () => [],
    candidates: (f) => [{ value: (f.answer as number) + 1, tag: 'near' }],
    hint: () => ({ speech: [], visual: { scene: 'none' } }),
  }
  if (m.mode === 'procedure') {
    def.instance = (fam, rng, avoid) => {
      const own = facts.filter((f) => f.family === fam.id)
      const fresh = own.filter((f) => !avoid.has(f.id))
      return rng.pick(fresh.length > 0 ? fresh : own)
    }
  }
  return def
}
