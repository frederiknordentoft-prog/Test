import { describe, expect, it } from 'vitest'
import { AVAILABLE_ITEMS } from '../art/items/registry'
import { ITEMS } from '../content/catalog'
import { nodesOfRegion } from '../content/curriculum'
import { PERLER, XP } from '../content/economy'
import { newProfile } from '../engine/testing/profile'
import type {
  Animal, FirstTry, LearningEvent, NodeId, ProfileDoc, SkillId, TrialState,
} from '../engine/types'
import { chooseEggSpecies, chooseMagic, chooseStarter, openEgg } from './actions'
import { eggOptions, friendOnCard, magicAnimal, pendingChoices, unlockedBreeds, unownedCombos } from './animals'
import {
  applyRoundResult, correctAnswers, dueItems, grantDueItems, itemDrawn, roundStars, type ItemDrawn, type MetaRound,
} from './progression'
import type { Reward } from './rewards'

const T = Date.parse('2026-10-01T15:00:00Z')
const DAY = '2026-10-01'

function child(over: Partial<ProfileDoc> = {}): ProfileDoc {
  const base = newProfile({ id: 'kid', roundIndex: 5, unlocked: { worlds: [], regions: [] } })
  return { ...chooseStarter(base, 'rabbit', { now: T })!.profile, rewardLog: [], ...over }
}

const tries = (right: number, wrong: number, typed = 0, skill: SkillId = 'count10'): FirstTry[] =>
  Array.from({ length: right + wrong }, (_, i) => ({ key: `k${i}`, skill, correct: i < right, production: i < typed, fast: true }))

function round(over: Partial<MetaRound> = {}): MetaRound {
  const firstTries = over.firstTries ?? tries(10, 0)
  return {
    roundId: 'r', mode: 'round', nodeId: 'w0-tal10-l1', total: firstTries.length, cleared: firstTries.length, firstTries,
    bestStreak: 3, goldenCaught: false, endedAt: T, ...over,
  }
}

/** The data layer has booked the round (roundIndex + 1) before the game layer runs. */
const play = (p: ProfileDoc, r: MetaRound, events: LearningEvent[] = [], day = DAY, now = T, drawn?: ItemDrawn) =>
  applyRoundResult({ ...p, roundIndex: p.roundIndex + 1 }, r, { events, day, now, drawn })

/** A fake item registry: every thing is drawn (the medal sets are drawn by another agent meanwhile). */
const allDrawn: ItemDrawn = () => true

const of = <K extends Reward['t']>(rs: readonly Reward[], t: K) => rs.filter((r): r is Extract<Reward, { t: K }> => r.t === t)

describe('answers, perler and XP', () => {
  it('pays one perle and 10 XP per right answer, retries included, and the golden egg on top', () => {
    const { profile, rewards } = play(child(), round({ firstTries: tries(7, 3), cleared: 10, goldenCaught: true }))
    expect(of(rewards, 'answers')[0]).toMatchObject({ correct: 10, perler: 10, xp: 100 })
    expect(of(rewards, 'golden')[0]).toMatchObject({ perler: 2, xp: 10, warmth: 10 })
    expect(profile.economy.eggWarmth).toBe(10 + 10)
  })

  it('counts a trial by its right first tries (there are no retries)', () => {
    expect(correctAnswers({ mode: 'trial', cleared: 10, firstTries: tries(7, 3, 10) })).toBe(7)
    expect(correctAnswers({ mode: 'placement', cleared: 10, firstTries: tries(10, 0) })).toBe(0)
  })

  it('leaves a placement round to the onboarding', () => {
    const p = child()
    expect(play(p, round({ mode: 'placement', nodeId: 'placement' })).profile.economy).toEqual(p.economy)
  })

  it('learns first: "Det lærte du" opens the rewards with the keys that moved, best first, and a goal', () => {
    const events: LearningEvent[] = [
      { t: 'keyPromoted', key: 'a', skill: 'count10', box: 2 },
      { t: 'keyPromoted', key: 'b', skill: 'count10', box: 3 },
      { t: 'familyFirstCorrect', skill: 'count10', family: 'scatter' },
    ]
    const { rewards } = play(child(), round(), events)
    expect(rewards[0]).toMatchObject({ t: 'learned', promoted: [{ key: 'b', box: 3 }, { key: 'a', box: 2 }], firsts: [{ family: 'scatter' }] })
    expect((rewards[0] as Extract<Reward, { t: 'learned' }>).next).not.toBeNull()
  })
})

describe('stars (SPEC §5.5)', () => {
  it('gives ★1 for a finished round, ★2 for at most 2 mistakes, ★3 for at most 1 and 3 typed answers', () => {
    expect(roundStars(round({ firstTries: tries(7, 3, 5) }))).toBe(1)
    expect(roundStars(round({ firstTries: tries(8, 2, 5) }))).toBe(2)
    expect(roundStars(round({ firstTries: tries(9, 1, 3) }))).toBe(3)
    expect(roundStars(round({ firstTries: tries(10, 0, 2) }))).toBe(2)
    expect(roundStars(round({ firstTries: tries(10, 0, 3), cleared: 9 }))).toBe(0)
  })

  it('pays each star level once per node: 1, 1 and 2 perler and 20 XP a star', () => {
    const first = play(child(), round({ firstTries: tries(8, 2, 0) }))
    expect(of(first.rewards, 'stars')[0]).toMatchObject({ from: 0, stars: 2, perler: 2, xp: 40 })
    const better = play(first.profile, round({ firstTries: tries(10, 0, 4) }))
    expect(of(better.rewards, 'stars')[0]).toMatchObject({ from: 2, stars: 3, perler: 2, xp: 20 })
    const again = play(better.profile, round({ firstTries: tries(10, 0, 4) }))
    expect(of(again.rewards, 'stars')).toEqual([])
    expect(again.profile.nodes['w0-tal10-l1']).toMatchObject({ plays: 3, stars: 3 })
  })

  it('gives no stars in Blandet øvelse or the hut', () => {
    expect(of(play(child(), round({ mode: 'practice', nodeId: 'practice' })).rewards, 'stars')).toEqual([])
    expect(of(play(child(), round({ mode: 'hut', nodeId: 'hut' })).rewards, 'stars')).toEqual([])
  })

  it('pays only the base rate when a three-star node is played again', () => {
    const p = child({ nodes: { 'w0-tal10-l1': { plays: 3, stars: 3, skipped: false, lastAt: 1 } } })
    const events: LearningEvent[] = [{ t: 'keyPromoted', key: 'b', skill: 'count10', box: 3 }, { t: 'medal', skill: 'count10', medal: 'bronze' }]
    const { rewards } = play(p, round({ goldenCaught: true }), events)
    expect(of(rewards, 'spark')[0]).toMatchObject({ perler: 0, xp: XP.spark3 })
    expect(of(rewards, 'medal')[0]).toMatchObject({ perler: 0, xp: XP.medal.bronze })
    // the round itself pays the base rate; level-ups and trophies are milestones on top
    const paid = rewards.filter((r) => r.t !== 'levelUp' && r.t !== 'trophy').reduce((s, r) => s + ('perler' in r ? r.perler : 0), 0)
    expect(paid).toBe(10 + PERLER.golden)
  })
})

describe('levels and items (SPEC §5.7, §7.2)', () => {
  it('reaches level 2 with the Hverdag hat', () => {
    const p = child({ economy: { ...child().economy, xp: 100 } })
    const { profile, rewards } = play(p, round())
    expect(profile.economy.level).toBe(2)
    expect(of(rewards, 'levelUp')).toEqual([{ t: 'levelUp', level: 2, title: null, perler: PERLER.levelUp }])
    expect(of(rewards, 'item')).toEqual([{ t: 'item', item: 'hverdag-head', source: { kind: 'level', level: 2 } }])
    expect(profile.inventory['hverdag-head']).toEqual({ at: T, colors: [0] })
  })

  it('gives every level crossed, its items and the new title', () => {
    const p = child({ economy: { ...child().economy, xp: 1100 } })
    const { profile, rewards } = play(p, round())
    expect(of(rewards, 'levelUp').map((r) => r.level)).toEqual([2, 3, 4, 5])
    expect(of(rewards, 'levelUp')[3].title).toBe('Opdager')
    expect(Object.keys(profile.inventory).sort()).toEqual(['hverdag-body', 'hverdag-head', 'hverdag-neck', 'milepael-hjertebriller'])
  })
})

describe('mastery: sparks and medals', () => {
  it('pays a spark when a key reaches box 3 or 5, and gives the buddy three friendship for it', () => {
    const events: LearningEvent[] = [
      { t: 'keyPromoted', key: 'a', skill: 'count10', box: 3 },
      { t: 'keyPromoted', key: 'b', skill: 'count10', box: 4 },
      { t: 'keyPromoted', key: 'c', skill: 'count10', box: 5 },
    ]
    const p = child()
    const { profile, rewards } = play(p, round(), events)
    expect(of(rewards, 'spark').map((r) => [r.box, r.perler, r.xp])).toEqual([[3, 1, 25], [5, 2, 50]])
    expect(profile.animals[0].friendship - p.animals[0].friendship).toBe(10 + 2 * 3)
  })

  it('stores medals, pays every tier on the way, and never lowers one', () => {
    const { profile, rewards } = play(child(), round(), [{ t: 'medal', skill: 'count10', medal: 'silver' }])
    expect(profile.skillMedals.count10).toBe('silver')
    expect(of(rewards, 'medal').map((r) => [r.medal, r.perler, r.xp])).toEqual([['bronze', 3, 50], ['silver', PERLER.medal.silver, 100]])
    const lower = play(profile, round(), [{ t: 'medal', skill: 'count10', medal: 'bronze' }])
    expect(lower.profile.skillMedals.count10).toBe('silver')
    expect(of(lower.rewards, 'medal')).toEqual([])
  })

  it('brings the Stjernefølet with the first gold medal', () => {
    const { profile, rewards } = play(child(), round(), [{ t: 'medal', skill: 'tenFriends', medal: 'gold' }], DAY, T, allDrawn)
    const foal = profile.animals.find((a) => a.source === 'starFoal')!
    expect(foal).toMatchObject({ uid: 'starfoal-tenFriends', species: 'unicorn', breed: 'foal', colorway: 'starwhite', stage: 1 })
    expect(of(rewards, 'animal')[0].animal.uid).toBe('starfoal-tenFriends')
    expect(profile.achievements['first-gold']).toBe(T)
    expect(profile.inventory['talmagiker-head']).toBeDefined()
    // Stjernefølet does not unlock unicorn eggs
    expect(eggOptions(profile)).toEqual(['rabbit'])
  })

  it('lets later gold medals pick a golden animal of their world, then pays perler when all four are found', () => {
    let p = play(child(), round(), [{ t: 'medal', skill: 'tenFriends', medal: 'gold' }]).profile
    const goldIn = (skill: SkillId) => play(p, round(), [{ t: 'medal', skill, medal: 'gold' }])
    const second = goldIn('count10')
    expect(of(second.rewards, 'choice')).toEqual([{ t: 'choice', kind: 'gold', world: 'eng', options: ['rabbit', 'cat', 'puppy', 'hedgehog'] }])
    p = second.profile
    expect(pendingChoices(p)).toEqual([{ kind: 'gold', world: 'eng', count: 1, options: ['rabbit', 'cat', 'puppy', 'hedgehog'] }])
    expect(chooseMagic(p, 'gold', 'horse', { now: T })).toBeNull()
    p = chooseMagic(p, 'gold', 'cat', { now: T })!.profile
    expect(p.animals.find((a) => a.uid === 'gold-cat')).toMatchObject({ colorway: 'gold', breed: 'domestic', source: 'gold' })
    expect(pendingChoices(p)).toEqual([])
    for (const skill of ['count20', 'hear20', 'order20'] as SkillId[]) p = goldIn(skill).profile
    expect(pendingChoices(p)[0]).toMatchObject({ kind: 'gold', world: 'eng', count: 3, options: ['rabbit', 'puppy', 'hedgehog'] })
    const fifth = goldIn('addTo10')
    expect(of(fifth.rewards, 'allGolden')).toEqual([{ t: 'allGolden', skill: 'addTo10', world: 'eng', perler: PERLER.allGolden }])
    expect(of(fifth.rewards, 'choice')).toEqual([])
  })

  it('hands out Ridder and Talmagiker pieces by the number of silver and gold medals', () => {
    const p = child({ skillMedals: { count10: 'silver' } })
    const { profile } = play(p, round(), [{ t: 'medal', skill: 'count20', medal: 'silver' }], DAY, T, allDrawn)
    expect(profile.inventory['ridder-head']).toBeDefined()
    expect(profile.inventory['ridder-hand']).toBeUndefined()
  })
})

describe('a thing earned by medals waits for its drawing (review app-w2-r1 P2-6)', () => {
  /** A fake registry without the Ridder and Talmagiker sets. */
  const noMedalSets: ItemDrawn = (item) => !item.startsWith('ridder-') && !item.startsWith('talmagiker-')
  const silver = (skill: SkillId): LearningEvent => ({ t: 'medal', skill, medal: 'silver' })

  it('is not due while it is not drawn, and due as soon as it is', () => {
    const p = child({ skillMedals: { count10: 'silver', count20: 'silver', addTo10: 'gold' } })
    expect(dueItems(p, noMedalSets).filter((i) => i.startsWith('ridder-') || i.startsWith('talmagiker-'))).toEqual([])
    expect(dueItems(p, allDrawn)).toEqual(expect.arrayContaining(['ridder-head', 'talmagiker-head']))
    expect(grantDueItems(p, T, noMedalSets).profile.inventory['ridder-head']).toBeUndefined()
    expect(grantDueItems(p, T, allDrawn).rewards).toEqual(expect.arrayContaining([
      { t: 'item', item: 'ridder-head', source: { kind: 'medal', tier: 'silver', count: 2 } },
    ]))
  })

  it('gives the medal but no wrapped gift, then the thing with the first round after its drawing lands', () => {
    const p = child({ skillMedals: { count10: 'silver' } })
    const medalRound = play(p, round(), [silver('count20')], DAY, T, noMedalSets)
    expect(of(medalRound.rewards, 'medal').map((r) => r.medal)).toEqual(['bronze', 'silver'])
    expect(of(medalRound.rewards, 'item').map((r) => r.item)).not.toContain('ridder-head')
    expect(medalRound.profile.inventory['ridder-head']).toBeUndefined()
    // still not drawn: another round changes nothing
    const later = play(medalRound.profile, round(), [], DAY, T + 1, noMedalSets)
    expect(later.profile.inventory['ridder-head']).toBeUndefined()
    // the drawing lands: the next round (no medal in it) hands the thing out with its source
    const drawnNow = play(later.profile, round(), [], '2026-10-02', T + 86_400_000, allDrawn)
    expect(drawnNow.profile.inventory['ridder-head']).toEqual({ at: T + 86_400_000, colors: [0] })
    expect(of(drawnNow.rewards, 'item').filter((r) => r.item === 'ridder-head')).toEqual([
      { t: 'item', item: 'ridder-head', source: { kind: 'medal', tier: 'silver', count: 2 } },
    ])
    // nothing was lost on the way: the medals stand, and the thing comes only once
    expect(drawnNow.profile.skillMedals).toEqual({ count10: 'silver', count20: 'silver' })
    const again = play(drawnNow.profile, round(), [], '2026-10-02', T + 86_400_001, allDrawn)
    expect(of(again.rewards, 'item').filter((r) => r.item === 'ridder-head')).toEqual([])
  })

  it('keeps a thing the child already owns without a drawing (from an earlier version)', () => {
    const p = child({ skillMedals: { count10: 'silver', count20: 'silver' }, inventory: { 'ridder-head': { at: 1, colors: [0] } } })
    const { profile } = play(p, round(), [], DAY, T, noMedalSets)
    expect(profile.inventory['ridder-head']).toEqual({ at: 1, colors: [0] })
  })

  it('never holds back a drawn level thing, nor a chest', () => {
    const p = child({ economy: { ...child().economy, xp: 100 } })
    const { profile } = play(p, round({ nodeId: 'w0-former-chest' }), [], DAY, T, noMedalSets)
    expect(profile.inventory['opdager-head']).toBeDefined()
    expect(profile.inventory['hverdag-head']).toBeDefined()
  })

  it('reads the drawings of this build by default (the item registry)', () => {
    for (const item of ITEMS) expect(itemDrawn(item.id), item.id).toBe(AVAILABLE_ITEMS.includes(item.id))
  })
})

describe('friend and chest nodes (SPEC §6.2)', () => {
  it('gives the first animal of the species and unlocks it for eggs; a second play gives nothing', () => {
    const p = child()
    const first = play(p, round({ nodeId: 'w0-plus10-friend' }))
    const cat = first.profile.animals.find((a) => a.uid === 'friend-w0-plus10-friend')!
    expect(cat).toMatchObject({ species: 'cat', breed: 'domestic', source: 'friend', stage: 1 })
    expect(of(first.rewards, 'animal')[0]).toMatchObject({ newSpecies: true })
    expect(eggOptions(first.profile)).toEqual(['rabbit', 'cat'])
    expect(of(play(first.profile, round({ nodeId: 'w0-plus10-friend' })).rewards, 'animal')).toEqual([])
  })

  it('gives a new colour or breed when the child already has the species', () => {
    const p = child()
    const { profile, rewards } = play(p, round({ nodeId: 'w0-tal10-friend' }))
    const [starter, friend] = profile.animals
    expect(friend.species).toBe('rabbit')
    expect(`${friend.breed}:${friend.colorway}`).not.toBe(`${starter.breed}:${starter.colorway}`)
    expect(of(rewards, 'animal')[0].newSpecies).toBe(false)
  })

  describe('the stone card shows the very animal the node gives (review app-w2-r1 P2-2)', () => {
    const IDS = ['kid', 'mie', 'otto', 'sara', 'bo', 'ada', 'p1', 'p2', 'p3', 'p4']
    const kid = (id: string): ProfileDoc =>
      ({ ...chooseStarter(newProfile({ id, roundIndex: 5, unlocked: { worlds: [], regions: [] } }), 'rabbit', { now: T })!.profile, rewardLog: [] })
    const look = (a: Animal | null | undefined) => a && { uid: a.uid, species: a.species, breed: a.breed, colorway: a.colorway, stage: a.stage, shown: a.shown }
    const given = (rewards: readonly Reward[], nodeId: string) => of(rewards, 'animal').find((r) => r.animal.uid === `friend-${nodeId}`)?.animal

    it('draws on the card what the round gives, for a new species and for one the child has', () => {
      const colours = new Set<string>()
      for (const id of IDS) {
        const p = kid(id)
        for (const [nodeId, species] of [['w0-plus10-friend', 'cat'], ['w0-tal10-friend', 'rabbit'], ['w1-klokken-friend', 'fox']] as const) {
          const card = friendOnCard(p, species, nodeId)
          expect(look(card), `${id} ${nodeId}`).toEqual(look(given(play(p, round({ nodeId })).rewards, nodeId)))
          colours.add(card!.colorway)
        }
      }
      // not always the species' first colour: the card has to draw, as the round does
      expect(colours.size).toBeGreaterThan(1)
    })

    it('shows the animal the child got once the node is played', () => {
      const p = kid('mie')
      const { profile } = play(p, round({ nodeId: 'w1-klokken-friend' }))
      const fox = profile.animals.find((a) => a.uid === 'friend-w1-klokken-friend')!
      expect(friendOnCard(profile, 'fox', 'w1-klokken-friend')).toBe(fox)
    })

    it('is not changed by a Stjernefølet the same round brings', () => {
      // a rainbow unicorn foal from three stars everywhere, no gold medal yet: the first gold medal comes
      // in the round that meets the unicorn friend, and two foals would open the next breed mid-round
      const nodeId = 'w2-tal1000-friend'
      for (const id of IDS) {
        const p0 = kid(id)
        const p = { ...p0, animals: [...p0.animals, magicAnimal(p0, 'rainbow', 'unicorn', T)] }
        const card = friendOnCard(p, 'unicorn', nodeId)
        const { rewards } = play(p, round({ nodeId }), [{ t: 'medal', skill: 'tenFriends', medal: 'gold' }], DAY, T, allDrawn)
        expect(of(rewards, 'animal').some((r) => r.animal.source === 'starFoal')).toBe(true)
        expect(look(card), id).toEqual(look(given(rewards, nodeId)))
      }
    })
  })

  it('opens the chest with the item shown on the map', () => {
    const { profile, rewards } = play(child(), round({ nodeId: 'w0-former-chest' }))
    expect(profile.inventory['opdager-head']).toBeDefined()
    expect(of(rewards, 'item')[0]).toMatchObject({ item: 'opdager-head', source: { kind: 'chest', nodeId: 'w0-former-chest' } })
  })
})

describe('trials and the finale (SPEC §5.4)', () => {
  const trialRound = (right: number) => round({ mode: 'trial', nodeId: 'w0-plus10-trial', firstTries: tries(right, 10 - right, 10, 'addTo10'), cleared: 10 })

  /** Tællelunden half played: the other regions of Engdalen are open, Minusbækken waits for Plusengen. */
  const tal10 = Object.fromEntries(nodesOfRegion('w0-tal10').slice(0, 4).map((n) => [n.id, { plays: 1, stars: 1 as const, skipped: false, lastAt: 1 }]))

  it('passes at 8 of 10, pays the first pass, marks unplayed lessons skipped and lifts the fog', () => {
    const p = child({ nodes: tal10 })
    const { profile, rewards } = play(p, trialRound(9))
    expect(profile.trials['w0-plus10']).toMatchObject({ attempts: 1, failed: 0, best: 9, passedAt: T, lastAttemptRound: 5 })
    expect(of(rewards, 'trial')[0]).toMatchObject({ passed: true, first: true, score: 9, perler: PERLER.trial, xp: XP.trial })
    expect(of(rewards, 'trial')[0].skipped.sort()).toEqual(['w0-plus10-l1', 'w0-plus10-l2', 'w0-plus10-l3', 'w0-plus10-mix'])
    expect(profile.nodes['w0-plus10-friend']).toBeUndefined()
    expect(of(rewards, 'stars')[0].stars).toBe(2)
    expect(of(rewards, 'opened')).toEqual([{ t: 'opened', worlds: [], regions: ['w0-minus10'] }])
    // passing again pays nothing more
    expect(of(play(profile, trialRound(10)).rewards, 'trial')[0]).toMatchObject({ passed: true, first: false, perler: 0 })
  })

  it('a failed trial costs nothing: best score kept, the hut lit, the help bridge after three', () => {
    let p = child({ nodes: tal10 })
    const results: Reward[][] = []
    for (const score of [7, 5, 6]) {
      const out = play(p, trialRound(score))
      p = out.profile
      results.push(out.rewards)
    }
    expect(p.trials['w0-plus10']).toMatchObject({ attempts: 3, failed: 3, best: 7, passedAt: null })
    expect(results.map((rs) => of(rs, 'hut').length)).toEqual([1, 1, 1])
    expect(results.map((rs) => of(rs, 'helpBridge').length)).toEqual([0, 0, 1])
    expect(results[2].some((r) => r.t === 'opened' && r.regions.includes('w0-minus10'))).toBe(true)
    // perler for the right answers, never less
    expect(of(results[0], 'answers')[0].perler).toBe(7)
  })

  it('keeps the training hut keys with the failed trial, and clears them when the trial is passed', () => {
    const missedTries = (right: number): FirstTry[] =>
      Array.from({ length: 10 }, (_, i) => ({ key: `add:${i}+1`, skill: 'addTo10', correct: i < right, production: true, fast: true }))
    const failed = play(child({ nodes: tal10 }), round({ mode: 'trial', nodeId: 'w0-plus10-trial', firstTries: missedTries(6), cleared: 10 }))
    expect(failed.profile.trials['w0-plus10']?.missed).toEqual(['add:6+1', 'add:7+1', 'add:8+1', 'add:9+1'])
    // a second failed attempt replaces the keys with its own
    const again = play(failed.profile, round({ mode: 'trial', nodeId: 'w0-plus10-trial', firstTries: missedTries(7), cleared: 10 }))
    expect(again.profile.trials['w0-plus10']?.missed).toEqual(['add:7+1', 'add:8+1', 'add:9+1'])
    const passed = play(again.profile, round({ mode: 'trial', nodeId: 'w0-plus10-trial', firstTries: missedTries(9), cleared: 10 }))
    expect(passed.profile.trials['w0-plus10']).toMatchObject({ passedAt: T, failed: 2 })
    expect(passed.profile.trials['w0-plus10']).not.toHaveProperty('missed')
    // a finale lights no hut
    const finale = play(child(), round({ mode: 'finale', nodeId: 'eng-finale', firstTries: tries(5, 7, 12, 'addTo10'), cleared: 12 }))
    expect(finale.profile.trials.eng).not.toHaveProperty('missed')
  })

  it('pays the finale, its items and the world trophy', () => {
    const p = child()
    const finale = round({ mode: 'finale', nodeId: 'eng-finale', firstTries: tries(11, 1, 12, 'addTo10'), cleared: 12 })
    const { profile, rewards } = play(p, finale)
    expect(of(rewards, 'trial')[0]).toMatchObject({ trial: 'eng', finale: true, passed: true, perler: PERLER.finale, xp: XP.finale })
    for (const item of ['opdager-face', 'opdager-neck', 'opdager-body', 'opdager-back'] as const) expect(profile.inventory[item]).toBeDefined()
    expect(profile.achievements['world-eng']).toBe(T)
  })

  it('celebrates a perfect trial', () => {
    expect(play(child(), trialRound(10)).profile.achievements['trial-perfect']).toBe(T)
  })
})

describe('the egg (SPEC §5.7, §6.2)', () => {
  it('is ready at 15 warmth for the first egg and hatches an unowned combination on the third tap', () => {
    let p = play(child(), round({ firstTries: tries(10, 0) })).profile
    expect(p.economy.eggWarmth).toBe(10)
    const out = play(p, round({ firstTries: tries(10, 0) }))
    expect(of(out.rewards, 'eggReady')[0]).toMatchObject({ species: null, options: ['rabbit'], fresh: true })
    p = out.profile
    const hatched = openEgg(p, { now: T })!
    const animal = of(hatched.rewards, 'hatch')[0].animal
    expect(animal).toMatchObject({ uid: 'egg-1', species: 'rabbit', source: 'egg' })
    expect(`${animal.breed}:${animal.colorway}`).not.toBe(`${p.animals[0].breed}:${p.animals[0].colorway}`)
    expect(hatched.profile.economy).toMatchObject({ eggsHatched: 1, eggWarmth: 20 - 15 })
    expect(openEgg(hatched.profile, { now: T })).toBeNull()
  })

  it('never hatches a combination the child owns, and unlocks each breed after two of the one before', () => {
    let p = child()
    p = { ...p, economy: { ...p.economy, eggSpecies: 'rabbit' } }
    const seen = new Set(p.animals.map((a) => `${a.breed}:${a.colorway}`))
    const order: string[] = []
    for (let egg = 1; egg <= 17; egg++) {
      const breeds = unlockedBreeds(p, 'rabbit')
      const upright = p.animals.filter((a) => a.breed === 'upright').length
      const lop = p.animals.filter((a) => a.breed === 'lop').length
      expect(breeds.includes('lop')).toBe(upright >= 2)
      expect(breeds.includes('lionhead')).toBe(upright >= 2 && lop >= 2)
      p = { ...p, economy: { ...p.economy, eggWarmth: 200 } }
      const hatched = openEgg(p, { now: T })!
      const a = of(hatched.rewards, 'hatch')[0].animal
      const combo = `${a.breed}:${a.colorway}`
      expect(seen.has(combo), combo).toBe(false)
      seen.add(combo)
      order.push(combo)
      p = hatched.profile
    }
    // 3 breeds × 6 colours, all found: rabbit is grey in the picker
    expect(seen.size).toBe(18)
    expect(unownedCombos(p, 'rabbit')).toEqual([])
    expect(eggOptions(p)).toEqual([])
    expect(chooseEggSpecies(p, 'rabbit')).toBeNull()
  })

  it('turns the warmth into friendship when there is nothing left to find', () => {
    let p = child()
    for (let egg = 1; egg <= 17; egg++) {
      p = { ...p, economy: { ...p.economy, eggSpecies: 'rabbit', eggWarmth: 500 } }
      p = openEgg(p, { now: T })!.profile
    }
    p = { ...p, economy: { ...p.economy, eggWarmth: 90 } }
    const before = p.animals[0].friendship
    const { profile, rewards } = play(p, round())
    expect(of(rewards, 'eggFriendship')).toEqual([{ t: 'eggFriendship', uid: 'starter-rabbit', amount: 50 }])
    expect(profile.animals[0].friendship).toBe(before + 10 + 50)
  })
})

describe('friendship and growth (SPEC §6.3)', () => {
  const withFriendship = (f: number) => {
    const p = child()
    return { ...p, animals: [{ ...p.animals[0], friendship: f }] as Animal[] }
  }

  it('grows the buddy at friendship level 5 and 8, and gives star form at 10', () => {
    const young = play(withFriendship(165), round())
    expect(young.profile.animals[0]).toMatchObject({ friendship: 175, stage: 2, shown: 2, star: false })
    expect(of(young.rewards, 'growth')).toEqual([{ t: 'growth', uid: 'starter-rabbit', stage: 2, star: false }])
    const grown = play(withFriendship(495), round())
    expect(grown.profile.animals[0]).toMatchObject({ stage: 3, shown: 3 })
    const star = play(withFriendship(815), round())
    expect(star.profile.animals[0]).toMatchObject({ star: true, shown: 'star' })
    expect(star.profile.achievements['first-star-form']).toBe(T)
  })

  it('teaches tricks on the other levels', () => {
    expect(of(play(withFriendship(15), round()).rewards, 'friendship')).toEqual([{ t: 'friendship', uid: 'starter-rabbit', level: 2, unlock: 'hop' }])
  })

  it('befriends only the buddy', () => {
    const p = play(child(), round({ nodeId: 'w0-plus10-friend' })).profile
    const after = play(p, round()).profile
    expect(after.animals[1].friendship).toBe(0)
    expect(after.animals[0].friendship).toBe(p.animals[0].friendship + 10)
  })
})

describe('rainbow animals (SPEC §6.2)', () => {
  it('lets the child pick one when every node of a region has three stars', () => {
    const ids = nodesOfRegion('w0-tal10').map((n) => n.id)
    const nodes: ProfileDoc['nodes'] = Object.fromEntries(ids.map((id) => [id, { plays: 1, stars: 3, skipped: false, lastAt: 1 }]))
    nodes['w0-tal10-mix'] = { plays: 1, stars: 2, skipped: false, lastAt: 1 }
    const { profile, rewards } = play(child({ nodes }), round({ nodeId: 'w0-tal10-mix', firstTries: tries(10, 0, 4) }))
    expect(of(rewards, 'choice')).toEqual([{ t: 'choice', kind: 'rainbow', world: 'eng', options: ['rabbit', 'cat', 'puppy', 'hedgehog'] }])
    const picked = chooseMagic(profile, 'rainbow', 'puppy', { now: T })!
    expect(picked.profile.animals.at(-1)).toMatchObject({ uid: 'rainbow-puppy', colorway: 'rainbow', source: 'rainbow' })
    expect(picked.profile.achievements['first-rainbow']).toBe(T)
  })
})

describe('goals, days and the log', () => {
  it('sets three goals and stamps the ones a round completes', () => {
    const { profile, rewards } = play(child(), round({ mode: 'practice', nodeId: 'practice' }))
    expect(profile.goals.list.map((g) => g.kind)).toEqual(['mix', expect.any(String), 'streak5'])
    expect(of(rewards, 'goal').map((r) => [r.goal.kind, r.stamp])).toEqual([['mix', 1]])
    expect(profile.stamps).toBe(1)
  })

  it('counts days played in total, never in a row', () => {
    let p = child()
    p = play(p, round(), [], '2026-10-01').profile
    p = play(p, round(), [], '2026-10-01').profile
    expect(p.daysPlayed).toBe(1)
    p = play(p, round(), [], '2026-10-09').profile
    p = play(p, round(), [], '2026-11-20').profile
    expect(p.daysPlayed).toBe(3)
    expect(p.achievements['days-3']).toBeDefined()
  })

  it('logs what was earned and how, keeping the last 200', () => {
    const { profile } = play(child(), round({ nodeId: 'w0-former-chest' }))
    expect(profile.rewardLog).toContainEqual({ ts: T, kind: 'item', what: 'opdager-head', why: 'node:w0-former-chest' })
    expect(profile.rewardLog).toContainEqual({ ts: T, kind: 'perler', what: expect.any(String), why: 'round:w0-former-chest' })
    let p = child()
    for (let i = 0; i < 250; i++) p = play(p, round({ nodeId: `w0-tal10-l1` as NodeId })).profile
    expect(p.rewardLog.length).toBe(200)
    expect(p.rewardLog.at(-1)?.why).toBe('round:w0-tal10-l1')
  })

  it('is deterministic', () => {
    const p = child()
    const events: LearningEvent[] = [{ t: 'medal', skill: 'count10', medal: 'gold' }, { t: 'keyPromoted', key: 'x', skill: 'count10', box: 3 }]
    expect(play(p, round({ nodeId: 'w0-tal10-friend' }), events)).toEqual(play(p, round({ nodeId: 'w0-tal10-friend' }), events))
  })
})

describe('the trial state the next attempt reads', () => {
  it('records the round the trial was played in, so a retry needs one normal round', () => {
    const p = child({ roundIndex: 41 })
    const t: TrialState = play(p, round({ mode: 'trial', nodeId: 'w0-tal10-trial', firstTries: tries(5, 5, 10) })).profile.trials['w0-tal10']!
    expect(t.lastAttemptRound).toBe(41)
  })
})
