import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { profileHome } from '../../../../app/boot'
import { resetNavForTests, useNav } from '../../../../app/nav'
import { getDb } from '../../../../data/db'
import { createProfile } from '../../../../data/repo/profiles'
import { freshDb } from '../../../../data/testing/freshDb'
import { makeRegistry } from '../../../../engine/registry'
import { makeRng } from '../../../../engine/rng'
import { addFacts, buildAddTask } from '../../../../engine/testing/addFacts'
import { addTo10Fixture } from '../../../../engine/testing/fixtureSkills'
import type { SkillDef, Task } from '../../../../engine/types'
import { dropRoundStartMemory, installMeta, useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { useRound } from '../../../../state/useRound'
import { playable } from '../map/model'
import { exitRound, playFromMap, playNext, roundRoute } from './flow'
import { chooseStart, fastMsOf, hooksFor, roundStatements, type Start, type StartContext } from './prepare'

/**
 * PlayScreen's glue without a DOM: the start it chooses (a plan, the stored round, or closed), the
 * hooks it gives RoundScreen, the end of the round handing over to the ceremonies, a pause and a
 * reload in the middle, and the training hut after a reload.
 */

let uninstall: () => void = () => undefined

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  uninstall = installMeta()
  useMeta.setState({ ceremony: null, rewards: [], lastAction: [], hutKeys: {} })
  useRound.setState({ status: 'idle', plan: null, queue: [], current: null, goldenTask: null })
  resetNavForTests({ id: 'map' })
})

afterEach(() => {
  uninstall()
})

const ctx = (over: Partial<StartContext> = {}): StartContext => ({ sessionId: 's-test', audioVerified: false, now: Date.now(), ...over })

async function newChild(): Promise<string> {
  const p = await createProfile({ name: 'Ada', grade: 0 })
  await useProfile.getState().loadProfile(p.id)
  expect(useMeta.getState().chooseStarter('rabbit')).toBe(true)
  return p.id
}

const wrongFor = (t: Task) => (typeof t.answer === 'number' ? t.answer + 1 : `${t.answer}-ikke`)

/** Plays on through the round's own state machine; `wrong` lists first tries answered wrong. */
function answerAll(wrong: number[] = [], stopAfter = Infinity): number {
  let first = 0
  let answered = 0
  for (let guard = 0; guard < 200 && useRound.getState().status !== 'finished' && answered < stopAfter; guard++) {
    const s = useRound.getState()
    if (s.status === 'golden') {
      s.submit(s.goldenTask!.answer)
      useRound.getState().next()
      continue
    }
    const task = s.current!
    const isFirst = !task.retryOf
    const miss = isFirst && wrong.includes(first)
    if (isFirst) first++
    s.submit(miss ? wrongFor(task) : task.answer)
    answered++
    const st = useRound.getState().status
    if (st === 'teaching') useRound.getState().confirm()
    else if (st === 'answered') useRound.getState().next()
  }
  return answered
}

function startRound(start: Start): void {
  if (start.kind === 'closed') throw new Error('closed')
  const hooks = hooksFor(start, { audioVerified: false })
  if (start.kind === 'plan') useRound.getState().start(start.plan, hooks)
  else useRound.getState().resume(start.snapshot, hooks)
}

async function reload(id: string): Promise<void> {
  await useProfile.getState().flush()
  await useProfile.getState().unload()
  dropRoundStartMemory()
  useMeta.setState({ hutKeys: {} })
  await useProfile.getState().loadProfile(id)
}

describe('PlayScreen: map → round → ceremonies', () => {
  it('plans a round at a stone, plays it through the hooks and hands over to the ceremonies', async () => {
    const id = await newChild()
    playFromMap('w0-tal10-l1')
    expect(useNav.getState().route).toEqual({ id: 'round', node: 'w0-tal10-l1' })

    const before = useProfile.getState().profile!
    const start = chooseStart('w0-tal10-l1', before, ctx())
    expect(start.kind).toBe('plan')
    if (start.kind !== 'plan') return
    expect(start.plan).toMatchObject({ mode: 'round', nodeId: 'w0-tal10-l1', sessionId: 's-test' })
    expect(start.plan.tasks).toHaveLength(10)
    // without a passed sound check the hear* skills stay out
    for (const t of start.plan.tasks) expect(['count10', 'order20']).toContain(t.skill)
    expect(roundStatements(start).length).toBeGreaterThan(0)

    startRound(start)
    expect(useProfile.getState().profile!.round?.roundId).toBe(start.plan.roundId)
    answerAll([2])
    expect(useRound.getState().status).toBe('finished')
    exitRound('finished')
    expect(useNav.getState().route).toEqual({ id: 'ceremonies' })
    expect(useNav.getState().stack).toEqual([{ id: 'map' }])

    const after = useProfile.getState().profile!
    expect(after.round).toBeNull()
    expect(after.roundIndex).toBe(before.roundIndex + 1)
    expect(after.nodes['w0-tal10-l1']).toMatchObject({ plays: 1 })
    expect(after.nodes['w0-tal10-l1']!.stars).toBeGreaterThan(0)
    expect(useMeta.getState().ceremony?.steps[0].kind).toBe('learned')
    expect(useMeta.getState().rewards.find((r) => r.t === 'answers')).toBeDefined()
    // new keys are counted once, by the data layer, when they are first answered
    const fresh = Object.keys(after.keys).filter((k) => !before.keys[k] && after.keys[k].seen > 0)
    expect(after.newToday.total).toBe(fresh.length)
    await useProfile.getState().flush()
    expect((await getDb().profiles.get(id))?.nodes['w0-tal10-l1']?.plays).toBe(1)

    // "Næste" from the ceremonies starts the next stone with the map still underneath
    playNext('w0-tal10-l2')
    expect(useNav.getState().route).toEqual({ id: 'round', node: 'w0-tal10-l2' })
    expect(useNav.getState().stack).toEqual([{ id: 'map' }])
    expect(chooseStart('w0-tal10-l2', after, ctx()).kind).toBe('plan')
  })

  it('refuses what cannot be played now and sends the child back', async () => {
    await newChild()
    const p = useProfile.getState().profile!
    expect(chooseStart('w0-tal10-l2', p, ctx())).toEqual({ kind: 'closed' })
    expect(chooseStart('w0-minus10-l1', p, ctx())).toEqual({ kind: 'closed' })
    expect(chooseStart('hut', p, ctx())).toEqual({ kind: 'closed' })
    expect(chooseStart('eng-finale', p, ctx())).toEqual({ kind: 'closed' })
    playFromMap('w0-tal10-l2')
    exitRound('paused')
    expect(useNav.getState().route).toEqual({ id: 'map' })
  })

  it('plays Blandet øvelse from the first day', async () => {
    await newChild()
    const start = chooseStart('practice', useProfile.getState().profile!, ctx())
    expect(start.kind === 'plan' && start.plan.mode).toBe('practice')
    startRound(start)
    answerAll()
    expect(useMeta.getState().ceremony).not.toBeNull()
    expect(useMeta.getState().rewards.some((r) => r.t === 'stars')).toBe(false)
  })
})

describe('PlayScreen: pause, reload, resume', () => {
  it('resumes a paused round at the same task, also after a reload', async () => {
    const id = await newChild()
    playFromMap('w0-tal10-l1')
    const start = chooseStart('w0-tal10-l1', useProfile.getState().profile!, ctx())
    startRound(start)
    answerAll([], 3)
    // three right in a row may have called the golden egg: pausing moves past it without asking it
    expect(useRound.getState().pause()).toBe('paused')
    const stored = useProfile.getState().profile!.round!
    const current = stored.current!.id
    const cleared = stored.answered
    expect(cleared).toBe(3)
    exitRound('paused')
    expect(useNav.getState().route).toEqual({ id: 'map' })

    await reload(id)
    const p = useProfile.getState().profile!
    // the app starts straight back in the stored round
    expect(profileHome(p)).toEqual({ id: 'round', node: 'w0-tal10-l1', resume: true })
    const again = chooseStart('w0-tal10-l1', p, ctx())
    expect(again.kind).toBe('resume')
    startRound(again)
    expect(useRound.getState().current!.id).toBe(current)
    expect(useRound.getState().cleared).toBe(cleared)
    answerAll()
    expect(useProfile.getState().profile!.nodes['w0-tal10-l1']?.plays).toBe(1)
    expect(useMeta.getState().ceremony).not.toBeNull()
  })

  it('a reload in the middle of a round comes back to the same task and the same queue', async () => {
    const id = await newChild()
    startRound(chooseStart('w0-tal10-l1', useProfile.getState().profile!, ctx()))
    answerAll([1], 4)
    const { current, queue } = useRound.getState()
    // no pause: the page simply goes away; the snapshot written with the last answer is what is left
    await reload(id)
    const again = chooseStart('w0-tal10-l1', useProfile.getState().profile!, ctx())
    expect(again.kind === 'resume' && again.snapshot.current?.id).toBe(current!.id)
    expect(again.kind === 'resume' && again.snapshot.queue.map((t) => t.id)).toEqual(queue.map((t) => t.id))
  })

  it('a stored round is replaced only by playing another stone', async () => {
    await newChild()
    startRound(chooseStart('w0-tal10-l1', useProfile.getState().profile!, ctx()))
    answerAll([], 2)
    useRound.getState().pause()
    const p = useProfile.getState().profile!
    expect(chooseStart('w0-tal10-l1', p, ctx()).kind).toBe('resume')
    expect(chooseStart('practice', p, ctx()).kind).toBe('plan')
  })
})

describe('PlayScreen: the training hut', () => {
  it('plans the hut from the saved trial after a reload', async () => {
    const id = await newChild()
    const trial = chooseStart('w0-tal10-trial', useProfile.getState().profile!, ctx())
    expect(trial.kind === 'plan' && trial.plan.mode).toBe('trial')
    startRound(trial)
    answerAll([0, 1, 2, 3])
    const failed = useProfile.getState().profile!
    const missed = failed.trials['w0-tal10']?.missed ?? []
    expect(missed.length).toBeGreaterThan(0)
    // the bridge rests until a normal round; the hut is lit
    expect(playable(failed, 'w0-tal10-trial')).toBe(false)
    expect(playable(failed, 'hut', 'w0-tal10')).toBe(true)

    await reload(id)
    const p = useProfile.getState().profile!
    expect(useMeta.getState().hutKeys['w0-tal10']).toEqual(missed)
    expect(roundRoute('hut', { region: 'w0-tal10' })).toEqual({ id: 'round', node: 'hut', region: 'w0-tal10' })
    const hut = chooseStart('hut', p, ctx({ hutRegion: 'w0-tal10' }))
    expect(hut.kind).toBe('plan')
    if (hut.kind !== 'plan') return
    expect(hut).toMatchObject({ hutRegion: 'w0-tal10', plan: { mode: 'hut', nodeId: 'hut' } })
    for (const key of missed) expect(hut.plan.tasks.some((t) => t.masteryKey === key)).toBe(true)
    // without a region the hut of the latest failed trial is played
    const any = chooseStart('hut', p, ctx())
    expect(any.kind === 'plan' && any.hutRegion).toBe('w0-tal10')
  })
})

describe('the skills speed thresholds', () => {
  it('asks the SkillDef, then the family, then leaves it to the kind', () => {
    const fact = addFacts(10)[12]
    const task = buildAddTask(fact, 'keypad', makeRng(7), 0)
    const plain = makeRegistry([addTo10Fixture as unknown as SkillDef])
    expect(fastMsOf(task, plain)).toBeUndefined()
    const own = makeRegistry([{ ...(addTo10Fixture as unknown as SkillDef), fastMs: (_f, kind) => (kind === 'keypad' ? 4321 : undefined) }])
    expect(fastMsOf(task, own)).toBe(4321)
    const fam = makeRegistry([{
      ...(addTo10Fixture as unknown as SkillDef),
      families: (addTo10Fixture as unknown as SkillDef).families.map((f) => ({ ...f, fastMs: { keypad: 3210 } })),
    }])
    expect(fastMsOf(task, fam)).toBe(3210)
  })
})
