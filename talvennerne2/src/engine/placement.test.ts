import { describe, expect, it } from 'vitest'
import {
  LADDER, PLACEMENT_MAX_TASKS, answerPlacement, passedOver, placementAvailable, placementResult, placementTask, saysSomething,
  seedFromPlacement, seedStage, startPlacement, stageOf, type PlacementRun,
} from './placement'
import { placedStart } from './ladder'
import { REGIONS, REGION_BY_ID, nodesOfRegion } from '../content/curriculum'
import { isRegionOpen, isWorldOpen } from '../meta/unlock'
import { factsOf, makeRegistry, skillKeys, skillRegistry } from './registry'
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
    // only the chain tal: Formhaven (figurer) is learned as normal (QA3b)
    expect(p.unlocked.regions).toEqual(['w0-tal10', 'w0-plus10', 'w0-tal20', 'w0-minus10', 'w0-tiervenner'])
    expect(p.nodes['w0-former-l1']).toBeUndefined()
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

  it('does not seed a rung the child did not pass, even below P, and keeps it in placement.failed (QA3b)', () => {
    // 3. klasse: L5 right, right → L7 a miss → a step down to L6: right, right; L7 is missed, so the ladder stops
    let run = startPlacement(3, 5, true)!
    for (const r of [true, true, false, true, true]) run = answerPlacement(run, r)
    expect([run.passed, run.failed, run.done, placementResult(run)]).toEqual([['L5', 'L6'], ['L7'], true, 'L6'])
    expect(seedStage('L6')).toBeGreaterThan(stageOf('L7'))
    const p = seedFromPlacement(newProfile(), 'L6', { skills: ladderReg, day: DAY, now: NOW }, run.failed)
    expect(p.placement).toEqual({ done: true, at: NOW, highest: 'L6', failed: ['L7'] })
    expect(skillKeys(ladderReg.get('hear100')!).some((id) => p.keys[id]), 'hear100').toBe(false)
    for (const skill of ['addTo20', 'subTo20', 'subTo10'] as const) {
      for (const id of skillKeys(ladderReg.get(skill)!)) expect(p.keys[id], id).toMatchObject({ box: 2, seeded: true })
    }
    // Hundredemarken is not passed over: its lessons wait, and the first round starts there
    expect(nodesOfRegion('w1-tal100').some((n) => p.nodes[n.id]?.skipped)).toBe(false)
    expect(p.unlocked.regions).not.toContain('w1-tal100')
    expect(placedStart(p.placement)).toMatchObject({ region: 'w1-tal100', world: 'bakke' })
    expect(isRegionOpen(p, 'w1-tal100')).toBe(true)
    // without one missed, as before: hear100 seeded and Hundredemarken passed over
    const before = seedFromPlacement(newProfile(), 'L6', { skills: ladderReg, day: DAY, now: NOW })
    expect(before.placement).toEqual({ done: true, at: NOW, highest: 'L6' })
    expect(skillKeys(ladderReg.get('hear100')!).every((id) => before.keys[id]?.seeded)).toBe(true)
    // a ladder that ended by itself with nothing passed: P = null, nothing seeded, the misses kept
    const none = seedFromPlacement(newProfile(), null, { skills: ladderReg, day: DAY, now: NOW }, ['L5', 'L4'])
    expect(none.placement).toEqual({ done: true, at: NOW, highest: null, failed: ['L5', 'L4'] })
    expect(placedStart(none.placement)).toMatchObject({ region: 'w0-tal10', world: 'eng' })
  })

  it('opens the start region and its world, without the grade\'s openings, for every P', () => {
    for (const c of LADDER) {
      const p = seedFromPlacement(newProfile(), c.id, { skills: fixtures, day: DAY, now: NOW })
      const start = placedStart(p.placement)!
      expect(isWorldOpen(p, start.world), c.id).toBe(true)
      expect(isRegionOpen(p, start.region), c.id).toBe(true)
      // the regions of the other chains are not opened by the placement: the grade opens their worlds
      expect(p.unlocked.regions.filter((r) => REGION_BY_ID[r].chain !== 'tal'), c.id).toEqual([])
    }
  })

  it('passes over exactly the regions it opens with their lessons skipped (passedOver, which the map reads)', () => {
    for (const c of LADDER) {
      const p = seedFromPlacement(newProfile(), c.id, { skills: fixtures, day: DAY, now: NOW })
      const skipped = [...new Set(Object.entries(p.nodes).filter(([, n]) => n?.skipped).map(([id]) => id.replace(/-(l1|l2|l3|mix)$/, '')))]
      expect(skipped, c.id).toEqual(passedOver(c.id))
      expect(p.unlocked.regions, c.id).toEqual(passedOver(c.id))
    }
    expect(passedOver(null)).toEqual([])
  })
})

describe('where a placed child starts (SPEC A24, review app-w3-r1 P2-4)', () => {
  const done = (highest: string | null) => ({ done: true, at: 1, highest })

  it('in the first region of the chain tal the placement did not pass over, and its world', () => {
    const starts = Object.fromEntries(LADDER.map((c) => [c.id, placedStart(done(c.id))!.region]))
    expect(starts).toEqual({
      L1: 'w0-tal10', L2: 'w0-tal10', L3: 'w0-tal10', L4: 'w0-minus10',
      L5: 'w1-tal100', L6: 'w1-tieren', L7: 'w1-tieren', L8: 'w1-tieren',
      L9: 'w2-tal1000', L10: 'w2-tal1000', L11: 'w2-tal1000', L12: 'w2-gange',
      L13: 'w3-tabellen', L14: 'w3-tabellen',
    })
    expect(placedStart(done('L4'))).toMatchObject({ world: 'eng', over: new Set(['w0-tal10', 'w0-plus10', 'w0-tal20']) })
    expect(placedStart(done('L5'))!.world).toBe('bakke')
    // all of it (L14): Tabeltoppen, where the grade starts a child in 3. klasse anyway
    expect(placedStart(done('L14'))).toMatchObject({ region: 'w3-tabellen', world: 'fjeld' })
    // Markedet (pengeMaal) is never passed over: the ladder asks about numbers only (QA3b)
    expect(placedStart(done('L14'))!.over).toEqual(new Set([...passedOver('L13'), 'w3-store-tal']))
    // nothing passed: nothing passed over
    expect(placedStart(done(null))).toMatchObject({ region: 'w0-tal10', world: 'eng', over: new Set() })
  })

  it('passes over regions of the chain tal only, and starts in one (QA3b: never in Engdalen\'s shapes)', () => {
    const tal = new Set(REGIONS.filter((r) => r.chain === 'tal').map((r) => r.id))
    for (const c of LADDER) {
      const over = passedOver(c.id)
      expect(over.filter((r) => !tal.has(r)), c.id).toEqual([])
      expect(over, c.id).not.toContain('w3-penge-maal')
      const start = placedStart(done(c.id))!
      expect(REGION_BY_ID[start.region].chain, c.id).toBe('tal')
      expect(start.world, c.id).toBe(REGION_BY_ID[start.region].world)
      // the first region of the chain tal not passed over
      const i = REGIONS.findIndex((r) => r.id === start.region)
      expect(start.over.has(start.region), c.id).toBe(false)
      expect(REGIONS.slice(0, i).filter((r) => tal.has(r.id) && !start.over.has(r.id)), c.id).toEqual([])
    }
    for (const r of ['w0-former', 'w1-figurer', 'w1-klokken', 'w1-maal-penge', 'w2-klokken', 'w2-penge', 'w2-maal-data', 'w2-figurer', 'w3-penge-maal']) {
      expect(LADDER.some((c) => passedOver(c.id).includes(r as never)), r).toBe(false)
    }
  })

  it('never passes over the region of a rung the child did not pass (QA3b: L6 with L7 missed)', () => {
    expect(passedOver('L6')).toContain('w1-tal100')
    expect(passedOver('L6', ['L7'])).not.toContain('w1-tal100')
    expect(placedStart({ done: true, at: 1, highest: 'L6', failed: ['L7'] })).toMatchObject({ region: 'w1-tal100', world: 'bakke' })
    // without sound L8 (tensOnes, Hundredemarken too) is the rung above L6
    expect(placedStart({ done: true, at: 1, highest: 'L6', failed: ['L8'] })!.region).toBe('w1-tal100')
    // a rung missed above P changes nothing below it
    expect(passedOver('L5', ['L7', 'L6'])).toEqual(passedOver('L5').filter((r) => r !== 'w1-tal100'))
    expect(placedStart({ done: true, at: 1, highest: 'L5', failed: ['L7', 'L6'] })!.region).toBe('w1-tal100')
    expect(placedStart({ done: true, at: 1, highest: 'L4', failed: ['L5'] })!.region).toBe('w0-minus10')
    // a stored placement from before the field: as with none missed
    expect(placedStart({ done: true, at: 1, highest: 'L6' })!.region).toBe('w1-tieren')
  })

  it('only after a finished placement: skipped, stopped before the first answer, or never offered', () => {
    expect(placedStart({ done: false, at: null, highest: null })).toBeNull()
    expect(placedStart(undefined)).toBeNull()
  })
})

describe('the questions of a rung say something about it (review app-w3-r1 P3-8)', () => {
  const reg = skillRegistry()
  const pairs = (rung: string, seeds = 200) =>
    Array.from({ length: seeds }, (_, seed) => {
      const start = startPlacement(3, seed + 1, true)!
      const run = { ...start, index: start.ladder.indexOf(rung) }
      return [placementTask(run, reg)!, placementTask({ ...run, results: [true] }, reg)!] as const
    })

  it('never asks "10 − 0", "5 − 0", "9 + 1", "8 − 8" or "1 · 9"', () => {
    const trivial = /^(add:(0|1)\+|add:\d+\+(0|1)$|sub:\d+-(0|1)$|sub:(\d+)-\5$|mul:1x)/
    for (const c of LADDER) {
      for (const [a, b] of pairs(c.id, 60)) {
        for (const t of [a, b]) expect(t.factId, `${c.id}: ${t.factId}`).not.toMatch(trivial)
        expect(a.factId, c.id).not.toBe(b.factId)
      }
    }
    expect(saysSomething({ id: 'sub:10-0', skill: 'subTo10', family: 'big', operands: [10, 0], answer: 10, rank: 64 })).toBe(false)
    expect(saysSomething({ id: 'sub:9-8', skill: 'subTo10', family: 'big', operands: [9, 8], answer: 1, rank: 47 })).toBe(true)
  })

  it('asks minus inden for 10 (L4) with two real differences, not the same second question every time', () => {
    const seconds = new Set<string>()
    for (const [a, b] of pairs('L4')) {
      for (const t of [a, b]) {
        const [x, y] = t.factId.slice(4).split('-').map(Number)
        expect(y, t.factId).toBeGreaterThan(1)
        expect(x - y, t.factId).toBeGreaterThan(0)
      }
      seconds.add(b.factId)
    }
    expect(seconds.size).toBeGreaterThan(5)
  })

  it('keeps enough questions on every rung', () => {
    for (const c of LADDER) {
      const def = reg.get(c.skill)!
      expect(factsOf(def).filter(saysSomething).length, c.id).toBeGreaterThanOrEqual(2)
    }
  })
})
