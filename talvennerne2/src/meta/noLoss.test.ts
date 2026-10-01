import { describe, expect, it } from 'vitest'
import { DECOR, ITEMS } from '../content/catalog'
import { makeRng, type Rng } from '../engine/rng'
import type { DecorId, ItemColor, ItemId, Medal, ProfileDoc, Slot, SpeciesId } from '../engine/types'
import { lostEarnings } from '../state/useProfile'
import * as actions from './actions'
import { pendingChoices } from './animals'
import { CHILD_85, GUESSER, Sim } from './testing/sim'

/**
 * SPEC §13.11: nothing earned can be lost. The inventory and the animals never shrink, colours,
 * decor, trophies, medals, stamps, days, XP and hatched eggs never go down, and perler fall only
 * when the child buys something — by exactly its price.
 */

const RANK: Readonly<Record<Medal, number>> = { bronze: 1, silver: 2, gold: 3 }

function check(prev: ProfileDoc, next: ProfileDoc, where: string, spent = 0): void {
  expect(lostEarnings(prev, next), where).toBeNull()
  for (const a of prev.animals) expect(next.animals.some((b) => b.uid === a.uid), `${where}: animal ${a.uid}`).toBe(true)
  for (const id of Object.keys(prev.inventory)) expect(next.inventory[id as ItemId], `${where}: ${id}`).toBeDefined()
  for (const [skill, medal] of Object.entries(prev.skillMedals)) {
    expect(RANK[next.skillMedals[skill as keyof ProfileDoc['skillMedals']]!], `${where}: medal ${skill}`).toBeGreaterThanOrEqual(RANK[medal!])
  }
  for (const a of prev.animals) {
    const b = next.animals.find((x) => x.uid === a.uid)!
    expect(b.friendship, `${where}: friendship ${a.uid}`).toBeGreaterThanOrEqual(a.friendship)
    expect(b.stage, `${where}: stage ${a.uid}`).toBeGreaterThanOrEqual(a.stage)
    if (a.star) expect(b.star).toBe(true)
  }
  expect(next.economy.perler, `${where}: perler`).toBeGreaterThanOrEqual(prev.economy.perler - spent)
  expect(next.economy.xp).toBeGreaterThanOrEqual(prev.economy.xp)
  expect(next.economy.eggsHatched).toBeGreaterThanOrEqual(prev.economy.eggsHatched)
  expect(next.stamps).toBeGreaterThanOrEqual(prev.stamps)
  expect(next.daysPlayed).toBeGreaterThanOrEqual(prev.daysPlayed)
  for (const [id, n] of Object.entries(prev.nodes)) expect(next.nodes[id as keyof ProfileDoc['nodes']]!.stars, `${where}: ${id}`).toBeGreaterThanOrEqual(n!.stars)
}

describe('nothing earned is ever lost (SPEC §13.11)', () => {
  it('holds for every round and every action of a simulated child', () => {
    for (const child of [CHILD_85, GUESSER]) {
      const sim = new Sim({ ...child, shopper: 'cheapest' }, 99)
      for (let session = 1; session <= 30; session++) {
        for (let r = 0; r < 5; r++) {
          let prev = sim.profile
          sim.playRound(r === 4 ? { kind: 'practice' } : sim.next())
          check(prev, sim.profile, `session ${session} round ${r}`)
          prev = sim.profile
          const before = prev.economy.perler
          sim.afterRound()
          // the shop is the only way down, and only by what was bought
          const bought = spentBetween(prev, sim.profile)
          check(prev, sim.profile, `session ${session} actions`, bought)
          expect(sim.profile.economy.perler).toBeGreaterThanOrEqual(before - bought)
        }
      }
    }
  })

  it('holds for random actions on a rich profile, and every refused action changes nothing', () => {
    const rng = makeRng(4242)
    let p = new Sim(CHILD_85, 5).playSessions(25).profile
    p = { ...p, economy: { ...p.economy, perler: 2000 } }
    let applied = 0
    let purchases = 0
    for (let i = 0; i < 1500; i++) {
      const prev = p
      const { result, price } = randomAction(p, rng)
      if (!result) continue
      applied++
      if (price > 0) purchases++
      p = result.profile
      check(prev, p, `action ${i}`, price)
      if (price > 0) expect(p.economy.perler).toBe(prev.economy.perler - price)
    }
    expect(applied).toBeGreaterThan(300)
    expect(purchases).toBeGreaterThan(20)
  })

  it('refuses to buy what the child cannot afford or already owns, and never sells', () => {
    const p = new Sim(CHILD_85, 6).playSessions(3).profile
    const shop = ITEMS.find((i) => i.source.kind === 'shop' && !p.inventory[i.id])!
    expect(actions.buyItem({ ...p, economy: { ...p.economy, perler: 10 } }, shop.id, { now: 1 })).toBeNull()
    const bought = actions.buyItem({ ...p, economy: { ...p.economy, perler: 500 } }, shop.id, { now: 1 })!
    expect(actions.buyItem(bought.profile, shop.id, { now: 2 })).toBeNull()
    // earned things are never for sale
    const earned = ITEMS.find((i) => i.source.kind !== 'shop')!
    expect(actions.buyItem({ ...p, economy: { ...p.economy, perler: 9999 } }, earned.id, { now: 1 })).toBeNull()
  })
})

function spentBetween(prev: ProfileDoc, next: ProfileDoc): number {
  let spent = 0
  for (const i of ITEMS) {
    const a = prev.inventory[i.id]
    const b = next.inventory[i.id]
    if (!a && b && i.source.kind === 'shop') spent += i.source.price
    if (a && b) spent += (b.colors.length - a.colors.length) * 25
  }
  for (const d of DECOR) if (!prev.decor[d.id] && next.decor[d.id]) spent += d.price
  return spent
}

function randomAction(p: ProfileDoc, rng: Rng): { result: actions.ActionResult | null; price: number } {
  const now = 1_800_000_000_000
  const animal = rng.pick(p.animals)
  const owned = Object.keys(p.inventory) as ItemId[]
  const item = rng.pick(ITEMS).id
  const slots: Slot[] = ['head', 'face', 'neck', 'body', 'back', 'hand']
  switch (rng.int(12)) {
    case 0: {
      const meta = ITEMS.find((i) => i.id === item)!
      const r = actions.buyItem(p, item, { now })
      return { result: r, price: r && meta.source.kind === 'shop' ? meta.source.price : 0 }
    }
    case 1: {
      const target = owned.length ? rng.pick(owned) : item
      const r = actions.buyRecolor(p, target, (1 + rng.int(2)) as ItemColor, { now })
      return { result: r, price: r ? 25 : 0 }
    }
    case 2: {
      const d = rng.pick(DECOR)
      const r = actions.buyDecor(p, d.id as DecorId, { now })
      return { result: r, price: r ? d.price : 0 }
    }
    case 3: return { result: actions.wear(p, animal.uid, owned.length ? rng.pick(owned) : item, rng.int(3) as ItemColor), price: 0 }
    case 4: return { result: actions.takeOff(p, animal.uid, rng.pick(slots)), price: 0 }
    case 5: return { result: actions.setBuddy(p, animal.uid), price: 0 }
    case 6: return { result: actions.nameAnimal(p, animal.uid, rng.pick(['Mille', 'Bobo', '  ', 'Et meget langt navn til et dyr'])), price: 0 }
    case 7: return { result: actions.setWish(p, rng.next() < 0.2 ? null : item), price: 0 }
    case 8: return { result: actions.placeDecor(p, rng.pick(DECOR).id, rng.next() * 1.4 - 0.2, rng.next()), price: 0 }
    case 9: return { result: actions.setShownForm(p, animal.uid, rng.pick([1, 2, 3, 'star'] as const)), price: 0 }
    case 10: {
      const pending = pendingChoices(p)[0]
      return { result: pending ? actions.chooseMagic(p, pending.kind, rng.pick(pending.options), { now }) : null, price: 0 }
    }
    default: {
      const egg = { ...p, economy: { ...p.economy, eggWarmth: p.economy.eggWarmth + 120 } }
      return { result: actions.openEgg(egg, { now }, rng.pick(p.animals).species as SpeciesId), price: 0 }
    }
  }
}
