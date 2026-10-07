import { describe, expect, it } from 'vitest'
import {
  LADDER, PLACEMENT_MAX_TASKS, answerPlacement, placementAvailable, placementResult, placementTask, seedFromPlacement,
  seedStage, startPlacement, stageOf, type PlacementRun,
} from './placement'
import { makeRegistry, skillKeys } from './registry'
import { FIXTURE_SKILLS, addTo10Fixture, hear20Fixture } from './testing/fixtureSkills'
import { standIn } from './testing/ladderSkills'
import { newProfile } from './testing/profile'
import { isProduction } from './kinds'
import { emptyKey } from './mastery'
import type { Grade, Task } from './types'
import type { SkillModule } from './skills/types'

const ladderReg = makeRegistry(LADDER.map((c) => standIn(c.skill)))
const fixtures = makeRegistry(FIXTURE_SKILLS)
const kindOf = (id: string) => LADDER.find((c) => c.id === id)!.kind

/** Every way a child can answer, as a tree; calls `leaf` with each finished run. */
function walk(run: PlacementRun, seen: Task[], leaf: (run: PlacementRun, tasks: Task[]) => void) {
  if (run.done) return leaf(run, seen)
  const task = placementTask(run, ladderReg)
  expect(task).not.toBeNull()
  for (const correct of [true, false]) walk(answerPlacement(run, correct), [...seen, task!], leaf)
}

describe('placement ladder (SPEC §8, pædagogik-forslaget §4.2)', () => {
  it('has the fourteen checkpoints in order', () => {
    expect(LADDER.map((c) => c.id)).toEqual(Array.from({ length: 14 }, (_, i) => `L${i + 1}`))
    expect(LADDER.map((c) => c.skill)).toEqual([
      'count10', 'hear20', 'addTo10', 'subTo10', 'addTo20', 'subTo20', 'hear100', 'tensOnes', 'add100Carry',
      'sub100Borrow', 'hear1000', 'mul2510', 'add1000', 'mul6to9',
    ])
    expect(LADDER[0].kind).toBe('countTap')
    expect(LADDER.slice(1).every((c) => c.kind === 'keypad')).toBe(true)
  })

  it('starts one grade below the child, and not at all in 0. klasse', () => {
    expect(startPlacement(0, 1, true)).toBeNull()
    expect(startPlacement(1, 1, true)!.ladder[startPlacement(1, 1, true)!.index]).toBe('L1')
    expect(startPlacement(2, 1, true)!.ladder[startPlacement(2, 1, true)!.index]).toBe('L3')
    expect(startPlacement(3, 1, true)!.ladder[startPlacement(3, 1, true)!.index]).toBe('L5')
    expect(startPlacement(3, 1, false)!.ladder).not.toContain('L7')
  })

  for (const grade of [1, 2, 3] as Grade[]) {
    for (const audio of [true, false]) {
      it(`asks at most 18 typed questions for every answer pattern (${grade}. kl., ${audio ? 'with' : 'without'} sound)`, () => {
        let leaves = 0
        walk(startPlacement(grade, 42, audio)!, [], (run, tasks) => {
          leaves++
          expect(run.asked).toBe(tasks.length)
          expect(tasks.length).toBeLessThanOrEqual(PLACEMENT_MAX_TASKS)
          for (const t of tasks) {
            expect(isProduction(t)).toBe(true)
            expect(t.scaffold).toBe(false)
            if (!audio) expect(t.skill.startsWith('hear')).toBe(false)
          }
        })
        expect(leaves).toBeGreaterThan(10)
      })
    }
  }

  it('jumps two rungs on success, steps back one on the first miss, then climbs one at a time', () => {
    let run = startPlacement(1, 7, true)!
    const answer = (...results: boolean[]) => results.forEach((r) => (run = answerPlacement(run, r)))
    answer(true, true) // L1 passed → L3
    expect(run.ladder[run.index]).toBe('L3')
    answer(false) // L3 failed → step down to L2
    expect(run.ladder[run.index]).toBe('L2')
    expect(run.phase).toBe('step')
    answer(true, true) // L2 passed; L3 already failed → done
    expect(run.done).toBe(true)
    expect(placementResult(run)).toBe('L2')
    expect(run.asked).toBe(5)
  })

  it('climbs the whole ladder for a child who knows it all', () => {
    let run = startPlacement(1, 7, true)!
    while (!run.done) run = answerPlacement(run, true)
    expect(run.passed).toEqual(['L1', 'L3', 'L5', 'L7', 'L9', 'L11', 'L13', 'L14'])
    expect(placementResult(run)).toBe('L14')
    expect(run.asked).toBe(16)
  })

  it('asks the same question again after a reload, and two different ones per rung', () => {
    const run = startPlacement(2, 3, true)!
    const first = placementTask(run, ladderReg)!
    expect(placementTask(run, ladderReg)).toEqual(first)
    expect(first.kind).toBe(kindOf('L3'))
    expect(placementTask(answerPlacement(run, true), ladderReg)!.factId).not.toBe(first.factId)
  })

  it('only runs once every ladder skill is registered', () => {
    expect(placementAvailable(ladderReg)).toBe(true)
    expect(placementAvailable(fixtures)).toBe(false)
  })

  it('asks a rung in the kinds its fact is asked in (kindsFor): another production kind when the rung’s is not one of them', () => {
    // a stand-in rule: count10 never asked with the basket, so L1 is typed instead
    const noBasket: SkillModule = { ...standIn('count10'), kindsFor: () => ['choice', 'keypad'] }
    const reg = makeRegistry(LADDER.map((c) => (c.skill === 'count10' ? noBasket : standIn(c.skill))))
    const run = startPlacement(1, 7, true)!
    expect(placementTask(run, ladderReg)!.kind).toBe('countTap')
    const t = placementTask(run, reg)!
    expect([t.skill, t.kind, isProduction(t)]).toEqual(['count10', 'keypad', true])
  })
})

describe('seeding from placement', () => {
  const DAY = '2026-09-15'
  const NOW = Date.parse('2026-09-15T10:00:00Z')

  it('puts every key of the core skills up to stage(P) in box 2, marked seeded', () => {
    expect(stageOf('L5')).toBe(1.4)
    const p = seedFromPlacement(newProfile({ roundIndex: 3 }), 'L5', { skills: fixtures, day: DAY, now: NOW })
    for (const id of [...skillKeys(addTo10Fixture), ...skillKeys(hear20Fixture)]) {
      expect(p.keys[id]).toMatchObject({ box: 2, seeded: true, seen: 0, boxDay: DAY, lastRound: 3 })
    }
    // a procedure skill that is not registered yet still gets its family keys; stage 2.1 is above P
    expect(p.keys['order20/after']).toMatchObject({ box: 2, seeded: true })
    expect(p.keys['add100Carry/nearTen']).toBeUndefined()
    // not a core domain
    expect(Object.keys(p.keys).some((k) => k.startsWith('shapes2D'))).toBe(false)
    expect(p.placement).toEqual({ done: true, at: NOW, highest: 'L5' })
  })

  it('keeps what the child already earned', () => {
    const earned = { ...emptyKey(), box: 4 as const, seen: 9, correct: 9 }
    const p = seedFromPlacement(newProfile({ keys: { 'add:2+3': earned } }), 'L5', { skills: fixtures, day: DAY, now: NOW })
    expect(p.keys['add:2+3']).toEqual(earned)
  })

  it('opens the regions below P with their lessons skipped, and the worlds around them', () => {
    const p = seedFromPlacement(newProfile(), 'L5', { skills: fixtures, day: DAY, now: NOW })
    expect(p.unlocked.regions).toEqual(['w0-tal10', 'w0-former', 'w0-plus10', 'w0-tal20', 'w0-minus10', 'w0-tiervenner'])
    expect(p.unlocked.worlds).toEqual(['eng', 'bakke'])
    expect(p.nodes['w0-plus10-l1']).toMatchObject({ skipped: true, plays: 0 })
    expect(p.nodes['w0-plus10-mix']).toMatchObject({ skipped: true })
    expect(p.nodes['w0-plus10-friend']).toBeUndefined()
    expect(p.nodes['w0-plus10-trial']).toBeUndefined()
    expect(p.nodes['w1-tieren-l1']).toBeUndefined() // addTo20 (1.4) is not below P
  })

  it('reaches as far as the highest rung up to P: hear100 (L7) is a lower stage than addTo20 (L5)', () => {
    expect(seedStage('L5')).toBe(stageOf('L5'))
    expect(stageOf('L7')).toBe(1.2)
    expect(seedStage('L7')).toBe(1.6)
    expect(seedStage('L8')).toBe(1.6)
    expect(seedStage('L11')).toBe(2.3)
    expect(seedStage('L14')).toBe(stageOf('L14'))
    for (const c of LADDER) expect(seedStage(c.id), c.id).toBeGreaterThanOrEqual(stageOf(c.id))
    // a 3. klasse child who passed L5 and L7 and then stepped down to L8: addTo20 and subTo20 are seeded
    let run = startPlacement(3, 5, true)!
    for (const r of [true, true, true, true, false, true, true]) run = answerPlacement(run, r)
    expect(run.passed).toEqual(['L5', 'L7', 'L8'])
    expect(placementResult(run)).toBe('L8')
    const p = seedFromPlacement(newProfile(), placementResult(run), { skills: ladderReg, day: DAY, now: NOW })
    for (const skill of ['addTo20', 'subTo20', 'hear100', 'tensOnes'] as const) {
      for (const id of skillKeys(ladderReg.get(skill)!)) expect(p.keys[id], id).toMatchObject({ box: 2, seeded: true })
    }
    expect(skillKeys(ladderReg.get('add100Carry')!).some((id) => p.keys[id])).toBe(false)
  })

  it('records a placement that passed nothing without seeding', () => {
    const before = newProfile()
    const p = seedFromPlacement(before, null, { skills: fixtures, day: DAY, now: NOW })
    expect(p.keys).toBe(before.keys)
    expect(p.placement).toEqual({ done: true, at: NOW, highest: null })
  })
})
