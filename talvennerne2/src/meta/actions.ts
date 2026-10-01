// What the child does outside a round (SPEC §5.7, §6.2–6.3, §7): open the egg, pick its species,
// name an animal, choose the buddy and the form it shows, dress it, buy and recolour things, place
// decor, pin a wish, and pick the golden or rainbow animal a medal or three stars earned.
//
// Each action is a pure function: it returns the new document and its rewards, or null when the
// action is not allowed (not owned, not enough perler, nothing pending …). Perler only ever go down
// here, and only by buying; nothing is ever removed.
import { DECOR, ITEM_BY_ID, SPECIES_BY_ID } from '../content/catalog'
import { RECOLOR_PRICE, eggWarmthFor, xpForLevel } from '../content/economy'
import { cleanAnimalName } from '../content/names'
import { goldCount, silverCount } from '../content/achievements'
import type {
  Animal, DecorId, ItemColor, ItemId, ProfileDoc, Slot, SpeciesId, Stage,
} from '../engine/types'
import {
  eggAnimal, eggOptions, magicAnimal, pendingChoices, starterAnimal,
} from './animals'
import { grantTrophies } from './progression'
import { appendLog, logEntries, type Reward } from './rewards'

export interface ActionResult {
  profile: ProfileDoc
  rewards: Reward[]
}

export interface ActionContext {
  now: number
}

/** Trophies an action may complete (a set, five animals …), and the log rows for what it gave. */
function finish(p: ProfileDoc, rewards: Reward[], now: number, why: string): ActionResult {
  const trophies = grantTrophies(p, null, now)
  const all = [...rewards, ...trophies.rewards]
  const profile = { ...trophies.profile, rewardLog: appendLog(trophies.profile.rewardLog, logEntries(all, now, why)) }
  return { profile, rewards: all }
}

// ─── Animals ────────────────────────────────────────────────────────────────

/** Onboarding: the first friend (rabbit, cat, puppy or the Shetland foal) becomes the buddy. */
export function chooseStarter(p: ProfileDoc, species: SpeciesId, { now }: ActionContext): ActionResult | null {
  const animal = starterAnimal(p, species, now)
  if (!animal) return null
  return finish({ ...p, animals: [animal], buddyUid: animal.uid }, [{ t: 'animal', animal, newSpecies: true }], now, 'starter')
}

/** The species of the current egg, among the unlocked species that still have something to find. */
export function chooseEggSpecies(p: ProfileDoc, species: SpeciesId): ActionResult | null {
  if (!eggOptions(p).includes(species) || p.economy.eggSpecies === species) return null
  return { profile: { ...p, economy: { ...p.economy, eggSpecies: species } }, rewards: [] }
}

/**
 * Hatch the egg (the third tap). Needs the warmth and a species; with a single option the species
 * is taken for granted. Extra warmth carries over to the next egg; the species stays chosen while
 * there is more of it to find.
 */
export function openEgg(p: ProfileDoc, { now }: ActionContext, species?: SpeciesId): ActionResult | null {
  const egg = p.economy.eggsHatched + 1
  const need = eggWarmthFor(egg)
  if (p.economy.eggWarmth < need) return null
  const options = eggOptions(p)
  const pick = species ?? p.economy.eggSpecies ?? (options.length === 1 ? options[0] : null)
  if (!pick || !options.includes(pick)) return null
  const animal = eggAnimal(p, pick, egg, now)
  if (!animal) return null
  const next: ProfileDoc = {
    ...p,
    animals: [...p.animals, animal],
    economy: { ...p.economy, eggWarmth: p.economy.eggWarmth - need, eggsHatched: egg, eggSpecies: pick },
  }
  if (!eggOptions(next).includes(pick)) next.economy.eggSpecies = null
  return finish(next, [{ t: 'hatch', animal, egg }], now, `egg:${egg}`)
}

/** Pick a golden or rainbow animal the child has earned (see pendingChoices). */
export function chooseMagic(p: ProfileDoc, kind: 'gold' | 'rainbow', species: SpeciesId, { now }: ActionContext): ActionResult | null {
  const world = SPECIES_BY_ID[species]?.world
  const pending = pendingChoices(p).find((c) => c.kind === kind && c.world === world)
  if (!pending || !pending.options.includes(species)) return null
  const animal = magicAnimal(p, kind, species, now)
  return finish({ ...p, animals: [...p.animals, animal] }, [{ t: 'animal', animal, newSpecies: !p.animals.some((a) => a.species === species) }], now, kind)
}

function updateAnimal(p: ProfileDoc, uid: string, fn: (a: Animal) => Animal | null): ProfileDoc | null {
  const i = p.animals.findIndex((a) => a.uid === uid)
  if (i < 0) return null
  const changed = fn(p.animals[i])
  if (!changed || changed === p.animals[i]) return null
  const animals = p.animals.slice()
  animals[i] = changed
  return { ...p, animals }
}

/** A name from the suggestions or typed by the child (at most 14 characters). Renaming is always allowed. */
export function nameAnimal(p: ProfileDoc, uid: string, name: string): ActionResult | null {
  const clean = cleanAnimalName(name)
  if (!clean) return null
  const next = updateAnimal(p, uid, (a) => (a.name === clean ? null : { ...a, name: clean }))
  return next ? { profile: next, rewards: [] } : null
}

/** The buddy can be changed freely; friendship stays with each animal. */
export function setBuddy(p: ProfileDoc, uid: string): ActionResult | null {
  if (p.buddyUid === uid || !p.animals.some((a) => a.uid === uid)) return null
  return { profile: { ...p, buddyUid: uid }, rewards: [] }
}

/** Show the animal in any form it has reached (baby, young, grown or star). */
export function setShownForm(p: ProfileDoc, uid: string, form: Stage | 'star'): ActionResult | null {
  const next = updateAnimal(p, uid, (a) => {
    const reached = form === 'star' ? a.star : form <= a.stage
    return reached && a.shown !== form ? { ...a, shown: form } : null
  })
  return next ? { profile: next, rewards: [] } : null
}

// ─── Wardrobe ───────────────────────────────────────────────────────────────

/** Put an owned item on an animal, in an owned colour. Wings of their own keep the back slot free. */
export function wear(p: ProfileDoc, uid: string, item: ItemId, color: ItemColor = 0): ActionResult | null {
  const meta = ITEM_BY_ID[item]
  const entry = p.inventory[item]
  if (!meta || !entry || !entry.colors.includes(color)) return null
  const next = updateAnimal(p, uid, (a) => {
    if (SPECIES_BY_ID[a.species].occupies?.includes(meta.slot)) return null
    const cur = a.outfit[meta.slot]
    if (cur && cur.item === item && cur.color === color) return null
    return { ...a, outfit: { ...a.outfit, [meta.slot]: { item, color } } }
  })
  return next ? { profile: next, rewards: [] } : null
}

export function takeOff(p: ProfileDoc, uid: string, slot: Slot): ActionResult | null {
  const next = updateAnimal(p, uid, (a) => {
    if (!a.outfit[slot]) return null
    const outfit = { ...a.outfit }
    delete outfit[slot]
    return { ...a, outfit }
  })
  return next ? { profile: next, rewards: [] } : null
}

// ─── Shop (the only place perler go down) ───────────────────────────────────

/** Buy a shop item at its fixed price. A wish pinned on it is fulfilled and unpinned. */
export function buyItem(p: ProfileDoc, item: ItemId, { now }: ActionContext): ActionResult | null {
  const meta = ITEM_BY_ID[item]
  if (!meta || meta.source.kind !== 'shop' || p.inventory[item]) return null
  const price = meta.source.price
  if (p.economy.perler < price) return null
  const next: ProfileDoc = {
    ...p,
    inventory: { ...p.inventory, [item]: { at: now, colors: [0] } },
    economy: { ...p.economy, perler: p.economy.perler - price, wish: p.economy.wish === item ? null : p.economy.wish },
  }
  return finish(next, [{ t: 'item', item, source: meta.source }], now, 'shop')
}

/** Unlock colour 1 or 2 of an owned item. */
export function buyRecolor(p: ProfileDoc, item: ItemId, color: ItemColor, { now }: ActionContext): ActionResult | null {
  const entry = p.inventory[item]
  if (!entry || color === 0 || entry.colors.includes(color) || p.economy.perler < RECOLOR_PRICE) return null
  const next: ProfileDoc = {
    ...p,
    inventory: { ...p.inventory, [item]: { ...entry, colors: [...entry.colors, color].sort() as ItemColor[] } },
    economy: { ...p.economy, perler: p.economy.perler - RECOLOR_PRICE },
  }
  const profile = { ...next, rewardLog: appendLog(next.rewardLog, [{ ts: now, kind: 'recolor', what: `${item}:${color}`, why: 'shop' }]) }
  return { profile, rewards: [] }
}

/** Default spot for new decor in the animal garden (0–1 of its width and height). */
const DECOR_HOME = { x: 0.5, y: 0.7 }

export function buyDecor(p: ProfileDoc, id: DecorId, { now }: ActionContext): ActionResult | null {
  const meta = DECOR.find((d) => d.id === id)
  if (!meta || p.decor[id] || p.economy.perler < meta.price) return null
  const next: ProfileDoc = {
    ...p,
    decor: { ...p.decor, [id]: { at: now, ...DECOR_HOME } },
    economy: { ...p.economy, perler: p.economy.perler - meta.price },
  }
  const profile = { ...next, rewardLog: appendLog(next.rewardLog, [{ ts: now, kind: 'decor', what: id, why: 'shop' }]) }
  return { profile, rewards: [] }
}

/** Move owned decor (x and y are 0–1 of the garden). */
export function placeDecor(p: ProfileDoc, id: DecorId, x: number, y: number): ActionResult | null {
  const cur = p.decor[id]
  if (!cur || !Number.isFinite(x) || !Number.isFinite(y)) return null
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  if (cur.x === clamp(x) && cur.y === clamp(y)) return null
  return { profile: { ...p, decor: { ...p.decor, [id]: { ...cur, x: clamp(x), y: clamp(y) } } }, rewards: [] }
}

// ─── The wish ───────────────────────────────────────────────────────────────

/** Pin one item the child does not own yet (null unpins). */
export function setWish(p: ProfileDoc, item: ItemId | null): ActionResult | null {
  if (item !== null && (!ITEM_BY_ID[item] || p.inventory[item])) return null
  if (p.economy.wish === item) return null
  return { profile: { ...p, economy: { ...p.economy, wish: item } }, rewards: [] }
}

/**
 * How close the wish is (0–1), for the HUD bar that shows no numbers: perler for a shop item, XP for
 * a level item, medals for a mastery item; chests and finales fill when they are reached.
 */
export function wishProgress(p: ProfileDoc): number | null {
  const item = p.economy.wish
  if (!item) return null
  if (p.inventory[item]) return 1
  const s = ITEM_BY_ID[item].source
  switch (s.kind) {
    case 'shop': return Math.min(1, p.economy.perler / s.price)
    case 'level': return p.economy.level >= s.level ? 1 : Math.min(1, p.economy.xp / xpForLevel(s.level))
    case 'medal': return Math.min(1, (s.tier === 'silver' ? silverCount(p) : goldCount(p)) / s.count)
    default: return 0
  }
}

/** Price of a shop item or decor (for the shop screen). */
export const priceOf = (item: ItemId): number | null => {
  const s = ITEM_BY_ID[item]?.source
  return s?.kind === 'shop' ? s.price : null
}
