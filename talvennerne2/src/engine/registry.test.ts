import { describe, expect, it } from 'vitest'
import {
  collectSkills, factsOf, goldenTask, isSkillDef, keyInfo, keysForNode, keysForSkills, makeRegistry, newBuildSession,
  registeredSkills, skillKeyIndex, skillKeys, skillRegistry, validateSkill,
} from './registry'
import { FIXTURE_SKILLS, add100CarryFixture, addTo10Fixture, hear20Fixture } from './testing/fixtureSkills'
import { buildTask, resolveTag } from './tasks'
import { classifyAnswer, swapDisambiguated } from './misconceptions'
import { isCorrect } from './answer'
import { isProduction } from './kinds'
import { SKILL_BY_ID } from '../content/skills'
import { NODE_BY_ID } from '../content/curriculum'
import { hashSeed, makeRng } from './rng'
import { emptyKey } from './mastery'
import type { ErrorTag, Fact, KeyState, SkillDef, TaskKind } from './types'
import { extrasOf, kindsOf, type SkillModule } from './skills/types'

const fixtures = makeRegistry(FIXTURE_SKILLS)
const ctx = (over: Partial<Parameters<typeof keysForNode>[1]> = {}) => ({ skills: fixtures, states: {}, audioVerified: true, ...over })
const node = (id: string) => NODE_BY_ID[id]

describe('collecting skills (SPEC §2.4)', () => {
  it('takes the default SkillDef of each file, skipping tests, oracles and helpers', () => {
    const found = collectSkills({
      './skills/addsub/addTo10.ts': { default: addTo10Fixture },
      './skills/addsub/addsub.test.ts': { default: add100CarryFixture },
      './skills/addsub/addsub.oracle.ts': { default: add100CarryFixture },
      './skills/shapes/isA.ts': { isA: () => true },
      './skills/number/hear20.ts': { default: hear20Fixture },
    })
    expect(found.map((d) => d.id)).toEqual(['addTo10', 'hear20'])
    expect(isSkillDef({ id: 'nope', enumerate() {} })).toBe(false)
  })

  it('refuses the same skill twice', () => {
    expect(() => makeRegistry([addTo10Fixture, addTo10Fixture])).toThrow(/twice/)
  })

  it('collects the real skill folder (empty until the skills land) and every one agrees with SKILL_BY_ID', () => {
    expect(registeredSkills()).toBe(skillRegistry().all)
    for (const def of registeredSkills()) expect(validateSkill(def)).toEqual([])
  })
})

describe('validation against SKILL_BY_ID', () => {
  it('accepts the fixtures', () => {
    for (const def of FIXTURE_SKILLS) expect(validateSkill(def)).toEqual([])
  })

  it('reports domain, grade, stage, mode, kinds and families that disagree', () => {
    const bad: SkillModule = {
      ...addTo10Fixture, domain: 'number', grade: 1, stage: 0.9, mode: 'procedure', kinds: ['choice'],
      families: [{ id: 'small', label: '', rank: 0 }],
    }
    const problems = validateSkill(bad).join('\n')
    for (const what of ['domain', 'grade', 'stage', 'mode', 'kinds', 'families', 'instance', 'unknown family']) expect(problems).toContain(what)
  })
})

/**
 * The contract every skill must keep (SPEC §15.1), run on the fixtures now and on each registered
 * skill as it lands: ids unique, candidates tagged consistently, cards valid, production possible.
 */
function contract(defs: readonly SkillDef[]) {
  const instancesOf = (def: SkillDef): Fact[] => {
    if (def.mode === 'recall' || !def.instance) return [...def.enumerate()]
    const rng = makeRng(hashSeed(`contract:${def.id}`))
    return def.families.flatMap((fam) => Array.from({ length: 200 }, () => def.instance!(fam, rng, new Set())))
  }

  it('has globally unique fact ids', () => {
    const seen = new Map<string, string>()
    for (const def of defs) {
      for (const f of def.enumerate()) {
        expect(seen.get(f.id) ?? def.id).toBe(def.id)
        seen.set(f.id, def.id)
      }
    }
  })

  for (const def of defs) {
    describe(def.id, () => {
      const facts = instancesOf(def)

      it('draws procedure instances inside their own family', () => {
        for (const f of facts) {
          expect(f.skill).toBe(def.id)
          expect(def.families.map((x) => x.id)).toContain(f.family)
        }
      })

      it('classifies every candidate as its (disambiguated) tag, on every kind', () => {
        for (const kind of def.kinds) {
          for (const [i, f] of facts.entries()) {
            if (i % 7 !== 0) continue
            const { task } = buildTask(def, f, kind, makeRng(i), i)
            const byValue = new Map<string, ErrorTag[]>()
            for (const c of def.candidates(f)) {
              const key = String(c.value)
              if (!(key in task.distractorTags)) continue
              byValue.set(key, [...(byValue.get(key) ?? []), c.tag])
            }
            for (const [key, tags] of byValue) {
              const value = typeof task.answer === 'number' ? Number(key) : key
              expect(task.distractorTags[key]).toBe(swapDisambiguated(task, value, resolveTag(tags)))
              expect(classifyAnswer(task, value)).toBe(task.distractorTags[key])
            }
          }
        }
      })

      it('deals valid cards: unique, wrong, ≥ 0, in range and tagged', () => {
        const cardKinds = def.kinds.filter((k) => k === 'choice' || k === 'pair')
        for (const kind of cardKinds) {
          for (const [i, f] of facts.entries()) {
            const { task } = buildTask(def, f, kind, makeRng(i), i)
            expect(new Set(task.options.map(String)).size).toBe(task.options.length)
            for (const o of task.options.filter((x) => x !== task.answer)) {
              expect(isCorrect(task, o)).toBe(false)
              if (typeof o === 'number') {
                expect(o).toBeGreaterThanOrEqual(Math.max(0, task.range[0]))
                expect(o).toBeLessThanOrEqual(task.range[1])
              }
              expect(task.distractorTags[String(o)]).toBeDefined()
            }
          }
        }
      })

      it('has a kind that is production for at least 90 % of its instances', () => {
        const shares = SKILL_BY_ID[def.id].production.filter((k) => def.kinds.includes(k)).map((kind: TaskKind) => {
          const prod = facts.filter((f, i) => isProduction(buildTask(def, f, kind, makeRng(i), i).task)).length
          return prod / facts.length
        })
        expect(Math.max(0, ...shares)).toBeGreaterThanOrEqual(0.9)
      })
    })
  }
}

describe('skill contract: fixtures', () => contract(FIXTURE_SKILLS))
describe('skill contract: registered skills', () => {
  it('runs for every registered skill', () => expect(Array.isArray(registeredSkills())).toBe(true))
  contract(registeredSkills())
})

describe('mastery keys', () => {
  it('lists every key of a skill and knows where a key belongs', () => {
    expect(skillKeys(addTo10Fixture)).toHaveLength(66)
    expect(skillKeys(add100CarryFixture)).toEqual(SKILL_BY_ID.add100Carry.families.map((f) => `add100Carry/${f.id}`))
    expect(keyInfo('add:2+3', fixtures)).toEqual({ skill: 'addTo10', family: 'small' })
    expect(keyInfo('add100Carry/nearTen', fixtures)).toEqual({ skill: 'add100Carry', family: 'nearTen' })
    expect(keyInfo('mul6to9/t7', fixtures)).toEqual({ skill: 'mul6to9', family: 't7' })
    expect(keyInfo('nothing', fixtures)).toBeUndefined()
    const index = skillKeyIndex(fixtures)
    expect(Object.keys(index).sort()).toEqual(['add100Carry', 'addTo10', 'hear20', 'weightCompare'])
    expect(index.hear20).toHaveLength(21)
  })
})

describe('keys for a node', () => {
  it('gives one key per fact for recall skills, house kind first', () => {
    const keys = keysForNode(node('w0-plus10-l1'), ctx())
    expect(keys).toHaveLength(66)
    expect(keys.map((k) => k.key)).toEqual(addTo10Fixture.enumerate().map((f) => f.id))
    expect(keys[0].kinds).toEqual(['choice', 'keypad'])
    expect(keys[0].production).toEqual(['keypad'])
    expect([...(keys.find((k) => k.key === 'add:5+3')?.detectable ?? [])].sort()).toEqual(['countFromFirst', 'wrongOperation'])
    expect(keys.find((k) => k.key === 'add:5+3')?.op).toBe('+')
  })

  it('gives one key per family for procedure skills', () => {
    const keys = keysForNode(node('w2-veksling-l3'), ctx())
    expect(keys.map((k) => k.key)).toEqual(SKILL_BY_ID.add100Carry.families.map((f) => `add100Carry/${f.id}`))
    expect(keysForSkills([{ skill: 'add100Carry', families: ['nearTen'] }], ctx()).map((k) => k.key)).toEqual(['add100Carry/nearTen'])
  })

  it('keeps operands and answer at or below the region max', () => {
    const hear = keysForNode(node('w0-tal10-l1'), ctx()).filter((k) => k.skill === 'hear20')
    expect(hear.map((k) => k.key)).toEqual(Array.from({ length: 11 }, (_, n) => `hear:${n}`))
    const small = keysForSkills([{ skill: 'add100Carry', max: 60 }], ctx())
    expect(small.length).toBeGreaterThan(0)
    for (const k of small) {
      for (let i = 0; i < 30; i++) {
        const t = k.build('keypad', makeRng(i), i)
        expect(t.answer as number).toBeLessThanOrEqual(60)
      }
    }
  })

  it('hides hear* until the sound check has passed', () => {
    expect(keysForNode(node('w0-tal10-l1'), ctx({ audioVerified: false })).some((k) => k.skill === 'hear20')).toBe(false)
    expect(keysForNode(node('w0-tal10-l1'), ctx({ audioVerified: true })).some((k) => k.skill === 'hear20')).toBe(true)
  })

  it('marks review-only skills', () => {
    const keys = keysForNode(node('w0-minus10-mix'), ctx())
    expect(keys.length).toBe(66)
    expect(keys.every((k) => k.reviewOnly)).toBe(true) // subTo10 is not a fixture; addTo10 is review here
  })

  it('merges a skill listed by several regions (world finale)', () => {
    const keys = keysForNode(node('eng-finale'), ctx())
    expect(keys.filter((k) => k.skill === 'hear20')).toHaveLength(21)
  })

  it('draws fresh procedure instances: never a recent one, never twice in a plan', () => {
    const key = 'add100Carry/TOplusTOcarry'
    const probe = keysForSkills([{ skill: 'add100Carry', families: ['TOplusTOcarry'] }], ctx())[0]
    const recent = Array.from({ length: 5 }, (_, i) => probe.build('keypad', makeRng(100 + i), i).factId)
    const states: Record<string, KeyState> = { [key]: { ...emptyKey(), seen: 5, recent } }
    const session = newBuildSession()
    const [k] = keysForSkills([{ skill: 'add100Carry', families: ['TOplusTOcarry'] }], ctx({ states, session }))
    const ids = Array.from({ length: 12 }, (_, i) => k.build('keypad', makeRng(i), i).factId)
    for (const id of ids) expect(recent).not.toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...session.used.get(key)!]).toEqual(ids)
  })

  it('shows the scaffold only for keys still in box 0', () => {
    const states: Record<string, KeyState> = { 'add:2+2': { ...emptyKey(), box: 2, seen: 4 } }
    const keys = keysForNode(node('w0-plus10-l1'), ctx({ states }))
    expect(keys.find((k) => k.key === 'add:2+2')!.build('choice', makeRng(1), 0).scaffold).toBe(false)
    expect(keys.find((k) => k.key === 'add:2+3')!.build('choice', makeRng(1), 0).scaffold).toBe(true)
  })

  it('rotates the diagnostic card across a plan', () => {
    const session = newBuildSession({ countFromFirst: 0, wrongOperation: 0 })
    const keys = keysForNode(node('w0-plus10-l1'), ctx({ session })).filter((k) => ['add:5+3', 'add:6+2', 'add:7+1', 'add:4+3'].includes(k.key))
    for (const [i, k] of keys.entries()) k.build('choice', makeRng(i), i)
    expect(session.offered.countFromFirst).toBe(2)
    expect(session.offered.wrongOperation).toBe(2)
  })
})

describe('a fact asked only in its own kinds (SkillExtras.kindsFor)', () => {
  const real = { states: {}, audioVerified: true }

  it('deals a div2510 pile on the share view only up to 20 things (pædagogik §1.3), house kind first, keypad production', () => {
    const keys = keysForSkills([{ skill: 'div2510' }], { ...real, houseKind: 'share' })
    expect(keys).toHaveLength(30)
    const dealt: string[] = []
    for (const k of keys) {
      const c = Number(/^div:(\d+)\//.exec(k.key)![1])
      expect(k.kinds, k.key).toEqual(c <= 20 ? ['share', 'choice', 'keypad'] : ['choice', 'keypad'])
      expect(k.production, k.key).toEqual(['keypad'])
      if (c <= 20) dealt.push(k.key)
    }
    // all of d2, and 5, 10, 15, 20 : 5 and 10, 20 : 10
    expect(dealt).toHaveLength(16)
    expect(dealt.filter((id) => id.endsWith('/5'))).toEqual(['div:5/5', 'div:10/5', 'div:15/5', 'div:20/5'])
  })

  it('lets a family key take every kind one of its facts suits, and draws a fact that suits the kind asked', () => {
    // a stand-in rule on the add100Carry fixture: cards only up to 60
    const def: SkillModule = { ...add100CarryFixture, kindsFor: (f) => ((f.answer as number) <= 60 ? add100CarryFixture.kinds : ['keypad', 'numberline']) }
    expect(validateSkill(def)).toEqual([])
    const keys = keysForSkills([{ skill: 'add100Carry' }], { ...real, skills: makeRegistry([def]) })
    const kindsOfKey = Object.fromEntries(keys.map((k) => [k.key, k.kinds.join(',')]))
    expect(kindsOfKey['add100Carry/toNextTen']).toBe('choice,keypad,numberline')
    expect(kindsOfKey['add100Carry/TOplusTOover100']).toBe('keypad,numberline')
    for (const k of keys.filter((x) => x.kinds.includes('choice'))) {
      for (let i = 0; i < 20; i++) expect(k.build('choice', makeRng(i), i).answer as number, k.key).toBeLessThanOrEqual(60)
    }
    // the same draws as without the hook where every fact suits the kind
    const plain = keysForSkills([{ skill: 'add100Carry', families: ['TOplusTOover100'] }], ctx())[0]
    const hooked = keys.find((k) => k.key === 'add100Carry/TOplusTOover100')!
    expect(Array.from({ length: 8 }, (_, i) => hooked.build('keypad', makeRng(i), i).factId))
      .toEqual(Array.from({ length: 8 }, (_, i) => plain.build('keypad', makeRng(i), i).factId))
  })

  it('is checked by validateSkill: some of the skill’s kinds, never none, a production kind whenever the skill has one', () => {
    const at = (kinds: TaskKind[]) => {
      const def: SkillModule = { ...addTo10Fixture, kindsFor: (f) => (f.id === 'add:2+3' ? kinds : addTo10Fixture.kinds) }
      return validateSkill(def).join('\n')
    }
    expect(at(['keypad'])).toBe('')
    expect(at([])).toMatch(/kindsFor\(add:2\+3\) is \[\], not some of/)
    expect(at(['keypad', 'share'])).toMatch(/kindsFor\(add:2\+3\) is \[keypad,share\], not some of/)
    expect(at(['choice'])).toMatch(/kindsFor\(add:2\+3\) has no production kind/)
  })

  it('leaves every other skill as it was: no kindsFor, so each of its keys has all the skill’s kinds in the skill’s order', () => {
    expect(registeredSkills().filter((d) => extrasOf(d).kindsFor).map((d) => d.id)).toEqual(['div2510'])
    for (const def of registeredSkills()) {
      if (def.id === 'div2510') continue
      for (const f of factsOf(def)) expect(kindsOf(def, f), f.id).toBe(def.kinds)
      const keys = keysForSkills([{ skill: def.id }], real)
      expect(keys.length, def.id).toBeGreaterThan(0)
      for (const k of keys) expect(k.kinds, k.key).toEqual(def.kinds)
    }
  })
})

describe('the golden egg', () => {
  it('is a harder fact from the node, on cards, without scaffold, reproducible', () => {
    const keys = keysForNode(node('w0-plus10-l1'), ctx())
    const ranks = keys.map((k) => k.rank).sort((a, b) => a - b)
    const floor = ranks[Math.floor(ranks.length / 2)]
    for (let seed = 0; seed < 40; seed++) {
      const t = goldenTask(node('w0-plus10-l1'), { ...ctx(), seed })!
      expect(t.kind).toBe('choice')
      expect(t.scaffold).toBe(false)
      expect(keys.find((k) => k.key === t.masteryKey)!.rank).toBeGreaterThanOrEqual(floor)
      expect(goldenTask(node('w0-plus10-l1'), { ...ctx(), seed })).toEqual(t)
    }
  })

  it('stays away when the node has nothing on cards', () => {
    expect(goldenTask({ skills: [{ skill: 'count10' }], houseKind: null }, { ...ctx(), seed: 1 })).toBeNull()
  })
})
