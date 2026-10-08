import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetNavForTests, useNav } from '../../../../../app/nav'
import { profileHome } from '../../../../../app/boot'
import { NODE_BY_ID } from '../../../../../content/curriculum'
import { answersBetween } from '../../../../../data/repo/answers'
import { getProfile } from '../../../../../data/repo/profiles'
import { freshDb } from '../../../../../data/testing/freshDb'
import { MemoryStorage, installStorage } from '../../../../../data/testing/memoryStorage'
import { LADDER, PLACEMENT_MAX_TASKS, placementResult } from '../../../../../engine/placement'
import { makeRegistry, skillKeys } from '../../../../../engine/registry'
import { FIXTURE_SKILLS } from '../../../../../engine/testing/fixtureSkills'
import { standIn } from '../../../../../engine/testing/ladderSkills'
import { WORLD_IDS, type Grade, type NodeId, type SkillId, type Task, type WorldId } from '../../../../../engine/types'
import { isWorldOpen } from '../../../../../meta/unlock'
import { useProfile } from '../../../../../state/useProfile'
import { resetSessionForTests, useSession } from '../../../../../state/useSession'
import { homeWorld, mapModel } from '../../map/model'
import { finishOnboarding, firstNode, hatchFirstFriend, resetOnboardingForTests } from '../flow'
import {
  PLACEMENT_GRADE, answerPlacementTask, beginPlacement, endPlacement, firstStone, placementOffered, placementQuestion,
  skipPlacement, startOnStone, type PlacementSession,
} from './flow'
import { usePlacement } from './store'

/**
 * "Vis Pip hvad du kan" in the onboarding (SPEC §8) against a real (fake) IndexedDB, with plain
 * stand-ins for the fourteen ladder skills (engine/testing/ladderSkills.ts), so the flow is tested
 * apart from the real skills. `built` stands in for worldBuilt: every world built is what a dev
 * server shows with ?worlds=all, and Stjernefjeldet not built is the release before it.
 */

const ladderSkills = makeRegistry(LADDER.map((c) => standIn(c.skill)))
const allBuilt = (): boolean => true
const beforeFjeld = (w: WorldId): boolean => w !== 'fjeld'
const env = { skills: ladderSkills, built: allBuilt }

let restore: (() => void)[] = []

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  resetSessionForTests()
  resetOnboardingForTests()
  usePlacement.getState().reset()
  restore = [installStorage('localStorage', new MemoryStorage()), installStorage('sessionStorage', new MemoryStorage())]
  await useSession.getState().boot({ pruneDelayMs: null })
  useSession.getState().setAudioVerified(true)
  resetNavForTests({ id: 'onboarding' })
})

afterEach(() => {
  restore.forEach((r) => r())
  restore = []
})

const child = () => hatchFirstFriend({ name: 'Ida', species: 'cat' })
const profile = () => useProfile.getState().profile!

/** Answer the question on screen: right, or one off. */
function answer(s: PlacementSession, right: boolean, at = 1000): { session: PlacementSession; task: Task; correct: boolean } {
  const task = placementQuestion(s, env)!
  const given = (task.answer as number) + (right ? 0 : 1)
  return { ...answerPlacementTask(s, task, given, { ms: 4000, replays: 0, ts: Date.now() + at }), task }
}

const seededSkill = (skill: SkillId) => skillKeys(ladderSkills.get(skill)!).every((k) => profile().keys[k]?.seeded && profile().keys[k]?.box === 2)

describe('when the ladder is offered (SPEC §8, the brief)', () => {
  it('offers it to 3. klasse only, and only once Stjernefjeldet is built', () => {
    expect(PLACEMENT_GRADE).toBe(3)
    expect(placementOffered(3, env)).toBe(true)
    expect(placementOffered(3, { ...env, built: beforeFjeld })).toBe(false)
    for (const g of [0, 1, 2] as Grade[]) expect(placementOffered(g, env), `${g}. kl.`).toBe(false)
    expect(placementOffered(null, env)).toBe(false)
    // and only when every ladder skill is registered
    expect(placementOffered(3, { ...env, skills: makeRegistry(FIXTURE_SKILLS) })).toBe(false)
  })

  it('leaves 0.–2. klasse as before: the grade, then the first round in Tællelunden', async () => {
    for (const g of [1, 2] as Grade[]) {
      await useProfile.getState().unload({ discard: true })
      resetOnboardingForTests()
      await child()
      expect(await finishOnboarding(g)).toBe('w0-tal10-l1')
      expect(useNav.getState().route).toEqual({ id: 'round', node: firstNode() })
      expect(profile().placement).toEqual({ done: false, at: null, highest: null })
      expect(Object.values(profile().keys).some((k) => k.seeded)).toBe(false)
    }
  })
})

describe('the ladder (SPEC §8)', () => {
  it('writes the grade before the first question, and asks one grade below the child (L5)', async () => {
    await child()
    const s = (await beginPlacement(3))!
    expect(s.run.ladder[s.run.index]).toBe('L5')
    expect(placementQuestion(s, env)).toMatchObject({ skill: 'addTo20', kind: 'keypad' })
    const stored = await getProfile(profile().id)
    expect(stored?.grade).toBe(3)
    expect(stored?.unlocked.worlds).toEqual(expect.arrayContaining(['bakke', 'skov']))
    expect(stored?.placement.done).toBe(false)
  })

  it('logs every answer as a placement answer, which moves no box', async () => {
    await child()
    let s = (await beginPlacement(3))!
    const { session, task, correct } = answer(s, true)
    s = session
    expect(correct).toBe(true)
    expect(s.run.asked).toBe(1)
    await useProfile.getState().flush()
    const log = await answersBetween(profile().id, 0)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ mode: 'placement', nodeId: 'placement', roundId: s.roundId, factId: task.factId, correct: true, production: true })
    expect(profile().keys[task.masteryKey]).toBeUndefined()
    expect(profile().recentFirstTries).toEqual([])
  })

  it('seeds what was shown after "Det er nok" and starts the first round on the map\'s next stone', async () => {
    await child()
    let s = (await beginPlacement(3))!
    // L5 both right → L7 both right → L9 one miss → a step down to L8; then "Det er nok"
    for (const right of [true, true, true, true, false]) s = answer(s, right).session
    expect(s.run.passed).toEqual(['L5', 'L7'])
    expect(s.run.ladder[s.run.index]).toBe('L8')
    expect(s.run.done).toBe(false)
    const stone = await endPlacement(s, env)

    const p = profile()
    expect(p.placement).toMatchObject({ done: true, highest: 'L7' })
    expect(placementResult(s.run)).toBe('L7')
    // box 2 and `seeded`, up to the highest stage on the ladder below L7 (subTo20, L6, is 1.6)
    for (const skill of ['addTo10', 'subTo10', 'addTo20', 'subTo20', 'hear100'] as SkillId[]) expect(seededSkill(skill), skill).toBe(true)
    expect(skillKeys(ladderSkills.get('add100Carry')!).some((k) => p.keys[k])).toBe(false)
    for (const k of Object.values(p.keys)) expect(k.box).toBeLessThanOrEqual(2)

    // the stone the map itself suggests in the child's home world, not Tællelunden
    const world = homeWorld(p, allBuilt)
    expect(stone).toBe(mapModel(p, world, allBuilt).next)
    expect(stone).not.toBe(firstNode())
    expect(NODE_BY_ID[stone].world).toBe(world)
    expect(world).not.toBe('eng')
    startOnStone(stone)
    expect(useNav.getState().route).toEqual({ id: 'round', node: stone })
    expect(useNav.getState().stack).toEqual([{ id: 'map' }])
    // written
    const stored = await getProfile(p.id)
    expect(stored?.placement).toMatchObject({ done: true, highest: 'L7' })
    expect(stored?.keys).toEqual(p.keys)
  })

  it('takes a child who knows it all into Stjernefjeldet', async () => {
    await child()
    let s = (await beginPlacement(3))!
    while (!s.run.done) s = answer(s, true).session
    expect(s.run.asked).toBeLessThanOrEqual(PLACEMENT_MAX_TASKS)
    expect(placementResult(s.run)).toBe('L14')
    const stone = await endPlacement(s, env)
    expect(profile().unlocked.worlds).toContain('fjeld')
    expect(homeWorld(profile(), allBuilt)).toBe('fjeld')
    expect(NODE_BY_ID[stone]).toMatchObject({ world: 'fjeld' })
    expect(stone).toBe(firstStone(profile(), allBuilt))
  })

  it('seeds nothing when "Det er nok" comes before the first answer', async () => {
    await child()
    const s = (await beginPlacement(3))!
    const stone = await endPlacement(s, env)
    expect(profile().placement.done).toBe(false)
    expect(Object.values(profile().keys).some((k) => k.seeded)).toBe(false)
    expect(stone).toBe(firstStone(profile(), allBuilt))
  })

  it('marks it done without seeding when nothing was passed', async () => {
    await child()
    let s = (await beginPlacement(3))!
    // L5 missed → L4 missed: the ladder stops
    s = answer(s, false).session
    s = answer(s, false).session
    expect(s.run.done).toBe(true)
    await endPlacement(s, env)
    expect(profile().placement).toMatchObject({ done: true, highest: null })
    expect(Object.values(profile().keys).some((k) => k.seeded)).toBe(false)
  })

  it('"Spring over" writes the grade only, and the first round is still the map\'s next stone', async () => {
    await child()
    const stone = await skipPlacement(3, env)
    const p = profile()
    expect(p.grade).toBe(3)
    expect(p.placement.done).toBe(false)
    expect(Object.values(p.keys).some((k) => k.seeded)).toBe(false)
    expect(stone).toBe(mapModel(p, homeWorld(p, allBuilt), allBuilt).next)
    expect(stone).not.toBe(firstNode())
    expect((await answersBetween(p.id, 0)).length).toBe(0)
  })

  it('lands on the map, as skipped, after a reload in the middle of the ladder', async () => {
    await child()
    let s = (await beginPlacement(3))!
    for (const right of [true, true, true]) s = answer(s, right).session
    await useProfile.getState().flush()
    // the page is gone: the child is loaded again from the database
    const id = profile().id
    await useProfile.getState().unload()
    const back = (await useProfile.getState().loadProfile(id))!
    expect(back).toMatchObject({ grade: 3, round: null, placement: { done: false } })
    expect(Object.values(back.keys).some((k) => k.seeded)).toBe(false)
    expect(profileHome(back)).toEqual({ id: 'map' })
  })
})

describe('the ladder on screen (store.ts)', () => {
  it('asks until the ladder is done, never more than 18 questions, then gives the first stone', async () => {
    await child()
    const store = usePlacement.getState()
    expect(await store.begin(3, env)).toBe(true)
    let asked = 0
    for (;;) {
      const task = usePlacement.getState().task!
      expect(usePlacement.getState().submit(task.answer, { ms: 3000, replays: 0, ts: Date.now() })).toBe(true)
      // a second answer to the same question does not count
      expect(usePlacement.getState().submit(task.answer, { ms: 3000, replays: 0, ts: Date.now() })).toBeNull()
      asked++
      if (!usePlacement.getState().next()) break
    }
    expect(asked).toBe(usePlacement.getState().session!.run.asked)
    expect(asked).toBeLessThanOrEqual(PLACEMENT_MAX_TASKS)
    const stone = await usePlacement.getState().finish()
    expect(usePlacement.getState()).toMatchObject({ status: 'over', stone })
    expect(profile().placement).toMatchObject({ done: true, highest: 'L14' })
  })

  it('"Det er nok" in the middle: what was shown counts', async () => {
    await child()
    await usePlacement.getState().begin(3, env)
    for (let i = 0; i < 2; i++) {
      const task = usePlacement.getState().task!
      usePlacement.getState().submit(task.answer, { ms: 3000, replays: 0, ts: Date.now() })
      usePlacement.getState().next()
    }
    const stone = await usePlacement.getState().finish()
    expect(profile().placement).toMatchObject({ done: true, highest: 'L5' })
    expect(seededSkill('addTo20')).toBe(true)
    // subTo20 (L6, stage 1.6) was never reached
    expect(seededSkill('subTo20')).toBe(false)
    expect(stone).toBe(firstStone(profile(), allBuilt))
    // the end is written once, however often it is asked for
    expect(await usePlacement.getState().finish()).toBe(stone)
  })

  it('"Spring over" from the store', async () => {
    await child()
    const stone = await usePlacement.getState().skip(3, env)
    expect(usePlacement.getState()).toMatchObject({ status: 'over', stone })
    expect(profile()).toMatchObject({ grade: 3, placement: { done: false } })
  })
})

describe('where the first round starts (SPEC A24, review app-w3-r1 P2-4)', () => {
  /** A new child's ladder answered right or wrong, in order, then ended ("Det er nok", or by itself): the first stone. */
  async function placeWith(answers: boolean[]): Promise<{ stone: NodeId; done: boolean }> {
    if (!useProfile.getState().profile) await child()
    let s = (await beginPlacement(3))!
    for (const right of answers) s = answer(s, right).session
    return { stone: await endPlacement(s, env), done: s.run.done }
  }
  const home = () => homeWorld(profile(), allBuilt)
  const mapNext = () => mapModel(profile(), home(), allBuilt).next
  /** Without a placement: the furthest world the grade opened (Stjernefjeldet once it is ready, as in the release). */
  const furthest = (): WorldId => [...WORLD_IDS].reverse().find((w) => isWorldOpen(profile(), w))!

  it('all right (P = L14): Tabeltoppen in Stjernefjeldet, as before', async () => {
    await child()
    let s = (await beginPlacement(3))!
    while (!s.run.done) s = answer(s, true).session
    const stone = await endPlacement(s, env)
    expect(profile().placement.highest).toBe('L14')
    expect([stone, home(), mapNext()]).toEqual(['w3-tabellen-l1', 'fjeld', 'w3-tabellen-l1'])
  })

  it('two misses (P = L5): Hundredemarken in Hestebakkerne', async () => {
    // L5 right, right → L7 a miss → a step down to L6: right, a miss, and the ladder stops
    const { stone, done } = await placeWith([true, true, false, true, false])
    expect(done).toBe(true)
    expect(profile().placement.highest).toBe('L5')
    expect([stone, home(), mapNext()]).toEqual(['w1-tal100-l1', 'bakke', 'w1-tal100-l1'])
  })

  it('"Det er nok" after a miss (P = L4): Minusbækken in Engdalen, not the friends of the places passed over', async () => {
    // L5 right, a miss → a step down to L4: right, right
    const { stone } = await placeWith([true, false, true, true])
    expect(profile().placement.highest).toBe('L4')
    expect([stone, home(), mapNext()]).toEqual(['w0-minus10-l1', 'eng', 'w0-minus10-l1'])
    startOnStone(stone)
    expect(useNav.getState().route).toEqual({ id: 'round', node: 'w0-minus10-l1' })
  })

  it('nothing passed (P = null): Tællelunden', async () => {
    const { stone } = await placeWith([false, false])
    expect(profile().placement).toMatchObject({ done: true, highest: null })
    expect([stone, home()]).toEqual(['w0-tal10-l1', 'eng'])
  })

  it('"Spring over", or "Det er nok" before the first answer: the child\'s own world, as before', async () => {
    await child()
    const skipped = await skipPlacement(3, env)
    expect([home(), skipped]).toEqual([furthest(), mapNext()])
    expect(NODE_BY_ID[skipped]).toMatchObject({ world: furthest(), slot: 'l1' })
    expect(['skov', 'fjeld']).toContain(home())
    await useProfile.getState().unload({ discard: true })
    resetOnboardingForTests()
    const { stone } = await placeWith([])
    expect(profile().placement.done).toBe(false)
    expect(stone).toBe(skipped)
  })

  // QA3b: a placement counts once a rung is decided (passed or failed). One right answer decides nothing.
  it('L5 right once, then "Det er nok": no placement, the child\'s own world, nothing seeded', async () => {
    await child()
    const skipped = await skipPlacement(3, env)
    await useProfile.getState().unload({ discard: true })
    resetOnboardingForTests()
    await child()
    let s = (await beginPlacement(3))!
    const { session, correct } = answer(s, true)
    s = session
    expect(correct).toBe(true)
    expect([s.run.asked, s.run.passed, s.run.failed]).toEqual([1, [], []])
    const stone = await endPlacement(s, env)
    expect(profile().placement).toEqual({ done: false, at: null, highest: null })
    expect(Object.values(profile().keys).some((k) => k.seeded)).toBe(false)
    expect([home(), stone]).toEqual([furthest(), skipped])
    expect(stone).not.toBe(firstNode())
    // the answer is still logged, as a placement answer
    await useProfile.getState().flush()
    const log = await answersBetween(profile().id, 0)
    expect(log.map((a) => a.mode)).toEqual(['placement'])
    expect((await getProfile(profile().id))?.placement.done).toBe(false)
  })

  it('L5 right, L5 missed, L4 right once, then "Det er nok": L5 failed, nothing passed (P = null), Tællelunden', async () => {
    const { stone } = await placeWith([true, false, true])
    expect(profile().placement).toMatchObject({ done: true, highest: null })
    expect(Object.values(profile().keys).some((k) => k.seeded)).toBe(false)
    expect([stone, home()]).toEqual(['w0-tal10-l1', 'eng'])
  })

  it('L5 missed, then "Det er nok": Tællelunden, as before', async () => {
    const { stone, done } = await placeWith([false])
    expect(done).toBe(false)
    expect(profile().placement).toMatchObject({ done: true, highest: null })
    expect([stone, home()]).toEqual(['w0-tal10-l1', 'eng'])
  })

  it('after a reload: the map of the world the child was placed in, with the same stone next', async () => {
    const { stone } = await placeWith([true, false, true, true])
    await useProfile.getState().flush()
    const id = profile().id
    await useProfile.getState().unload()
    const back = (await useProfile.getState().loadProfile(id))!
    expect(profileHome(back)).toEqual({ id: 'map' })
    expect(homeWorld(back, allBuilt)).toBe('eng')
    expect(mapModel(back, 'eng', allBuilt).next).toBe(stone)
  })

  it('keeps siblings apart: each child\'s map follows its own ladder', async () => {
    const ida = (await child(), profile().id)
    await placeWith([true, false, true, true])
    resetOnboardingForTests()
    usePlacement.getState().reset()
    await hatchFirstFriend({ name: 'Bo', species: 'rabbit' })
    const bo = profile().id
    expect(bo).not.toBe(ida)
    const boStone = await skipPlacement(3, env)
    const boWorld = home()
    expect([boWorld, mapNext()]).toEqual([furthest(), boStone])
    // a third child, in 1. klasse: Tællelunden, no placement
    resetOnboardingForTests()
    await hatchFirstFriend({ name: 'Cy', species: 'cat' })
    expect(await finishOnboarding(1)).toBe('w0-tal10-l1')
    // back to each one: their own worlds
    await useSession.getState().selectProfile(ida)
    expect([profile().id, home(), mapNext()]).toEqual([ida, 'eng', 'w0-minus10-l1'])
    await useSession.getState().selectProfile(bo)
    expect([profile().id, home(), mapNext()]).toEqual([bo, boWorld, boStone])
  })
})

describe('the three goals follow the grade and the ladder (QA3 P3-6)', () => {
  const revisit = () => profile().goals.list.find((g) => g.kind === 'revisit')?.region ?? null

  it('0.–2. klasse: made for the grade (1. klasse no longer sent to Tællelunden)', async () => {
    const goals: Record<number, string | null> = {}
    for (const g of [0, 1, 2] as Grade[]) {
      await useProfile.getState().unload({ discard: true })
      resetOnboardingForTests()
      await child()
      await finishOnboarding(g)
      expect(profile().goals.list).toHaveLength(3)
      expect(profile().goals.list[0].kind).toBe('mix')
      goals[g] = revisit()
    }
    expect(goals).toEqual({ 0: 'w0-tal10', 1: 'w1-tal100', 2: 'w2-tal1000' })
  })

  it('3. klasse: where the ladder starts the child, or the child\'s own world after "Spring over"', async () => {
    await child()
    let s = (await beginPlacement(3))!
    // the grade first: the child's own world (Stjernefjeldet once it is ready), never Tællelunden
    const own = homeWorld(profile(), allBuilt)
    expect(['skov', 'fjeld']).toContain(own)
    expect(revisit()).toBe(own === 'fjeld' ? 'w3-tabellen' : 'w2-tal1000')
    for (const right of [true, false, true, true]) s = answer(s, right).session
    await endPlacement(s, env)
    expect(revisit()).toBe('w0-minus10')
    const stored = await getProfile(profile().id)
    expect(stored?.goals).toEqual(profile().goals)
  })
})
