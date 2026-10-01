// The wardrobe as data (SPEC §7, §8): who is dressed, what each of the six slots holds, what a tap on
// a thing or a colour does, which tab opens first, the guided dressing and "Sådan får du den" for
// every source. Pure functions over the profile: the screen renders them, the tests read them.
import { ITEMS, ITEM_BY_ID, SPECIES_BY_ID, type ItemMeta } from '../../../../content/catalog'
import { NODE_BY_ID, REGION_BY_ID, WORLD_BY_ID } from '../../../../content/curriculum'
import { RECOLOR_PRICE } from '../../../../content/economy'
import { nameClip } from '../../../../content/names'
import { SLOTS } from '../../../../engine/types'
import type { Animal, ClipId, ItemColor, ItemId, ItemSource, ProfileDoc, Slot, SpeechPart } from '../../../../engine/types'
import { clipForm } from '../../../../speech/catalog'

export { SLOTS }

export const SLOT_CLIP: Readonly<Record<Slot, ClipId>> = {
  head: 's.wardrobe.slot.head',
  face: 's.wardrobe.slot.face',
  neck: 's.wardrobe.slot.neck',
  body: 's.wardrobe.slot.body',
  back: 's.wardrobe.slot.back',
  hand: 's.wardrobe.slot.hand',
}

/** The three colours of every thing: 0 comes with it, 1 and 2 are bought in the shop. */
export const COLORS: readonly ItemColor[] = [0, 1, 2]

/** The thing of the first level-up (SPEC §8: level 2 brings the Hverdag hat and guided dressing). */
export const FIRST_ITEM: ItemId = 'hverdag-head'

type Owner = Pick<ProfileDoc, 'inventory'>

/** Every thing of a slot in catalogue order: the eleven sets, then the milestones. */
export function itemsOfSlot(slot: Slot): ItemMeta[] {
  return ITEMS.filter((i) => i.slot === slot)
}

export function ownedColors(p: Owner, item: ItemId): ItemColor[] {
  const entry = p.inventory[item]
  return entry ? COLORS.filter((c) => entry.colors.includes(c)) : []
}

export const owns = (p: Owner, item: ItemId): boolean => ownedColors(p, item).length > 0

// ─── Animals ────────────────────────────────────────────────────────────────

/** The animals in the picker: the buddy first, then in the order they were found. */
export function animalsInOrder(p: Pick<ProfileDoc, 'animals' | 'buddyUid'>): Animal[] {
  const buddy = p.animals.find((a) => a.uid === p.buddyUid)
  return buddy ? [buddy, ...p.animals.filter((a) => a !== buddy)] : [...p.animals]
}

/** Who is dressed: the route's animal when the child has it, else the buddy, else the first one. */
export function pickAnimal(p: Pick<ProfileDoc, 'animals' | 'buddyUid'>, uid?: string | null): Animal | null {
  return (uid ? p.animals.find((a) => a.uid === uid) : undefined) ?? p.animals.find((a) => a.uid === p.buddyUid) ?? p.animals[0] ?? null
}

/** Pegasus, dragon and owl keep their back for their own wings. */
export function slotLocked(animal: Pick<Animal, 'species'> | null | undefined, slot: Slot): boolean {
  return !!animal && !!SPECIES_BY_ID[animal.species]?.occupies?.includes(slot)
}

/** The animal's name read aloud: its recorded clip, or the device voice for a name the child typed. */
export function animalNameSpeech(animal: Pick<Animal, 'name'>): SpeechPart[] {
  const clip = nameClip(animal.name)
  return [clip ? { clip } : { free: animal.name }]
}

// ─── One slot ───────────────────────────────────────────────────────────────

export interface OwnedItem {
  meta: ItemMeta
  /** Owned colours, ascending (always with 0). */
  colors: ItemColor[]
}

export interface SlotModel {
  slot: Slot
  /** The animal's own wings fill the slot. */
  locked: boolean
  worn: { item: ItemId; color: ItemColor } | null
  /** Things the child has: only these can be chosen. */
  owned: OwnedItem[]
  /** Everything else, shown as an outline with "Sådan får du den". */
  others: ItemMeta[]
}

export function slotModel(p: Owner, animal: Pick<Animal, 'species' | 'outfit'> | null | undefined, slot: Slot): SlotModel {
  const owned: OwnedItem[] = []
  const others: ItemMeta[] = []
  for (const meta of itemsOfSlot(slot)) {
    const colors = ownedColors(p, meta.id)
    if (colors.length > 0) owned.push({ meta, colors })
    else others.push(meta)
  }
  const w = animal?.outfit[slot]
  return { slot, locked: slotLocked(animal, slot), worn: w ? { item: w.item, color: w.color } : null, owned, others }
}

// ─── Taps ───────────────────────────────────────────────────────────────────

export type TapAction =
  | { kind: 'wear'; item: ItemId; color: ItemColor }
  | { kind: 'takeOff'; slot: Slot }
  /** Nothing changes (the colour is already on). */
  | { kind: 'none' }
  /** Not the child's yet: say how to get it (`color` set for a colour the child does not have). */
  | { kind: 'how'; item: ItemId; color: ItemColor | null }
  /** The slot is taken by the animal's own wings. */
  | { kind: 'locked' }

type Dressed = Pick<Animal, 'species' | 'outfit'>

/**
 * A tap on a thing's card: an owned thing goes on at once in `color` (or its first owned colour),
 * the thing that is on comes off, and a thing the child does not have explains how to get it.
 */
export function cardAction(p: Owner, animal: Dressed | null | undefined, item: ItemId, color: ItemColor = 0): TapAction {
  const meta = ITEM_BY_ID[item]
  if (!meta) return { kind: 'none' }
  const colors = ownedColors(p, item)
  if (colors.length === 0) return { kind: 'how', item, color: null }
  if (!animal) return { kind: 'none' }
  if (slotLocked(animal, meta.slot)) return { kind: 'locked' }
  if (animal.outfit[meta.slot]?.item === item) return { kind: 'takeOff', slot: meta.slot }
  return { kind: 'wear', item, color: colors.includes(color) ? color : colors[0] }
}

/** A tap on one of the three colours of a thing: an owned colour goes on, the others are in the shop. */
export function colorAction(p: Owner, animal: Dressed | null | undefined, item: ItemId, color: ItemColor): TapAction {
  const meta = ITEM_BY_ID[item]
  if (!meta) return { kind: 'none' }
  const colors = ownedColors(p, item)
  if (colors.length === 0) return { kind: 'how', item, color: null }
  if (!colors.includes(color)) return { kind: 'how', item, color }
  if (!animal) return { kind: 'none' }
  if (slotLocked(animal, meta.slot)) return { kind: 'locked' }
  const on = animal.outfit[meta.slot]
  if (on?.item === item && on.color === color) return { kind: 'none' }
  return { kind: 'wear', item, color }
}

// ─── Where the screen starts ────────────────────────────────────────────────

/** The tab that opens: the slot of the thing to show first, else the hat. */
export function startSlot(item?: ItemId | null): Slot {
  return (item && ITEM_BY_ID[item]?.slot) || 'head'
}

/**
 * The thing to point at (a soft ring and a hand, never a must): the new thing from the route, or —
 * the very first time — the Hverdag hat of level 2 while nobody wears anything yet.
 */
export function guideItem(p: Pick<ProfileDoc, 'inventory' | 'animals'>, routeItem: ItemId | null | undefined, guidedBefore: boolean): ItemId | null {
  if (routeItem) return owns(p, routeItem) ? routeItem : null
  if (guidedBefore || !owns(p, FIRST_ITEM)) return null
  if (p.animals.some((a) => Object.keys(a.outfit).length > 0)) return null
  return FIRST_ITEM
}

// ─── "Sådan får du den" ─────────────────────────────────────────────────────

/** How a thing is earned, read aloud (SPEC §7.2: every thing has exactly one source). */
export function howToGet(source: ItemSource): SpeechPart[] {
  switch (source.kind) {
    case 'level':
      return [{ clip: 's.wardrobe.how.level' }, { num: source.level, form: 'end' }]
    case 'chest': {
      const region = NODE_BY_ID[source.nodeId]?.region
      const name = region ? REGION_BY_ID[region]?.nameClip : undefined
      return name ? [{ clip: 's.wardrobe.how.chest' }, { clip: name }] : [{ clip: 's.wardrobe.how.chest.map' }]
    }
    case 'finale':
      return [{ clip: 's.wardrobe.how.finale' }, { clip: WORLD_BY_ID[source.world].nameClip }]
    case 'medal': {
      const one = source.count === 1
      const noun =
        source.tier === 'silver'
          ? one ? 's.wardrobe.how.silver.one.end' : 's.wardrobe.how.silver.end'
          : one ? 's.wardrobe.how.gold.one.end' : 's.wardrobe.how.gold.end'
      return [{ clip: 's.wardrobe.how.medal' }, { num: source.count, form: 'mid' }, { clip: noun }]
    }
    case 'shop':
      return [{ clip: 's.wardrobe.how.shop' }, { num: source.price, form: 'mid' }, { clip: 's.shop.perler.end' }]
  }
}

export const howToGetItem = (item: ItemId): SpeechPart[] => howToGet(ITEM_BY_ID[item].source)

/** A colour the child does not have yet. */
export const howToGetColor = (): SpeechPart[] => [{ clip: 's.wardrobe.how.color' }, { num: RECOLOR_PRICE, form: 'mid' }, { clip: 's.shop.perler.end' }]

export const itemNameSpeech = (item: ItemId): SpeechPart[] => [{ clip: ITEM_BY_ID[item].nameClip }]

/** Things whose wish bar can move (perler, XP or medals); a chest or a finale is just reached. */
export function canWishFor(p: Pick<ProfileDoc, 'inventory' | 'economy'>, item: ItemId): boolean {
  const kind = ITEM_BY_ID[item]?.source.kind
  return !owns(p, item) && p.economy.wish !== item && (kind === 'shop' || kind === 'level' || kind === 'medal')
}

/** The icon badge of a source on a thing's card (mastery gets the gold frame). */
export function sourceBadge(source: ItemSource): 'star' | 'chest' | 'flag' | 'medal' | 'shop' {
  return source.kind === 'level' ? 'star' : source.kind === 'chest' ? 'chest' : source.kind === 'finale' ? 'flag' : source.kind === 'medal' ? 'medal' : 'shop'
}

// ─── Shown text ─────────────────────────────────────────────────────────────

/**
 * What a spoken line shows: clip texts and numbers in digits, joined by spaces, with a full stop
 * after an end-form part (the voice reads the numbers as words).
 */
export function shownText(parts: readonly SpeechPart[], text: (id: ClipId) => string): string {
  let out = ''
  for (const p of parts) {
    const word = 'clip' in p ? text(p.clip) : 'num' in p ? String(p.num) : 'free' in p ? p.free : ''
    if (!word) continue
    out = out ? `${out} ${word}` : word
    const end = ('clip' in p && clipForm(p.clip) === 'end') || ('num' in p && p.form === 'end')
    if (end && !/[.?!]$/.test(out)) out += '.'
  }
  return out
}
