// Catalogue data for animals, wardrobe, decor and trophies (SPEC §6–7, §5.7, §13).
// Art lives in src/art/**; this file holds ids, names, sources and prices only.
import {
  BREEDS, SET_IDS,
  type BreedId, type ClipId, type DecorId, type FrameColor, type ItemId, type ItemSource, type NodeId,
  type SetId, type Slot, type SpeciesId, type TrophyId, type WorldId,
} from '../engine/types'

// ─── Species ────────────────────────────────────────────────────────────────

export type BodyTemplate = 'round' | 'pear' | 'tall'

export interface SpeciesMeta {
  id: SpeciesId
  name: string
  /** Name of the baby form ("kaninunge"). */
  baby: string
  world: WorldId
  body: BodyTemplate
  /** Unlock order; the next breed opens when the child owns 2 animals of the previous one. */
  breeds: readonly BreedId[]
  /** Names of c1–c6 (natural colourways). */
  colors: readonly [string, string, string, string, string, string]
  /** Species with their own wings keep the back slot for themselves. */
  occupies?: Slot[]
  starter?: true
}

const breedsOf = (id: SpeciesId): readonly BreedId[] => (BREEDS as Partial<Record<SpeciesId, readonly BreedId[]>>)[id] ?? ['std']

const sp = (m: Omit<SpeciesMeta, 'breeds'>): SpeciesMeta => ({ ...m, breeds: breedsOf(m.id) })

export const SPECIES: readonly SpeciesMeta[] = [
  sp({ id: 'rabbit', name: 'Kanin', baby: 'kaninunge', world: 'eng', body: 'round', starter: true,
    colors: ['hvid', 'grå', 'brun', 'hollænder', 'karamel', 'rosa'] }),
  sp({ id: 'cat', name: 'Kat', baby: 'killing', world: 'eng', body: 'round', starter: true,
    colors: ['rød', 'sort', 'grå-stribet', 'calico', 'hvid', 'blå-grå'] }),
  sp({ id: 'puppy', name: 'Hvalp', baby: 'hvalp', world: 'eng', body: 'tall', starter: true,
    colors: ['golden', 'sort-hvid', 'brun', 'plettet', 'creme', 'rødbrun'] }),
  sp({ id: 'hedgehog', name: 'Pindsvin', baby: 'pindsvineunge', world: 'eng', body: 'pear',
    colors: ['brun', 'lys', 'mørk', 'rustrød', 'mandel', 'frost'] }),
  sp({ id: 'horse', name: 'Hest', baby: 'føl', world: 'bakke', body: 'tall', starter: true,
    colors: ['fuks', 'skimmel', 'sort', 'isabel', 'broget', 'palomino'] }),
  sp({ id: 'lamb', name: 'Lam', baby: 'lam', world: 'bakke', body: 'round',
    colors: ['hvid', 'creme', 'sort', 'grå', 'brun', 'lyserød uld'] }),
  sp({ id: 'fox', name: 'Ræv', baby: 'rævehvalp', world: 'bakke', body: 'tall',
    colors: ['rød', 'polar', 'sølv', 'brun', 'guldrød', 'mørk'] }),
  sp({ id: 'hamster', name: 'Hamster', baby: 'hamsterunge', world: 'bakke', body: 'round',
    colors: ['abrikos', 'hvid', 'grå', 'sort-hvid', 'karamel', 'plettet'] }),
  sp({ id: 'unicorn', name: 'Enhjørning', baby: 'føl', world: 'skov', body: 'tall',
    colors: ['hvid', 'rosa', 'lilla', 'mint', 'himmelblå', 'sølv'] }),
  sp({ id: 'panda', name: 'Panda', baby: 'pandaunge', world: 'skov', body: 'round',
    colors: ['klassisk', 'brun', 'rød', 'grå', 'creme', 'lilla'] }),
  sp({ id: 'squirrel', name: 'Egern', baby: 'egernunge', world: 'skov', body: 'pear',
    colors: ['rød', 'grå', 'sort', 'brun', 'lys', 'orange'] }),
  sp({ id: 'owl', name: 'Ugle', baby: 'ugleunge', world: 'skov', body: 'pear', occupies: ['back'],
    colors: ['brun', 'sne', 'grå', 'perlehvid', 'kanel', 'nat'] }),
  sp({ id: 'pegasus', name: 'Pegasus', baby: 'føl', world: 'fjeld', body: 'tall', occupies: ['back'],
    colors: ['hvid', 'sky', 'rosa', 'lavendel', 'sølv', 'perle'] }),
  sp({ id: 'dragon', name: 'Drage', baby: 'drageunge', world: 'fjeld', body: 'tall', occupies: ['back'],
    colors: ['grøn', 'rød', 'blå', 'lilla', 'sort', 'turkis'] }),
  sp({ id: 'penguin', name: 'Pingvin', baby: 'pingvinkylling', world: 'fjeld', body: 'pear',
    colors: ['klassisk', 'kejser', 'klippe', 'blå', 'grå', 'creme'] }),
  sp({ id: 'polarbear', name: 'Isbjørn', baby: 'isbjørneunge', world: 'fjeld', body: 'round',
    colors: ['hvid', 'creme', 'isblå', 'sølv', 'sne', 'perle'] }),
]

export const SPECIES_BY_ID: Readonly<Record<SpeciesId, SpeciesMeta>> = Object.fromEntries(
  SPECIES.map((m) => [m.id, m]),
) as Record<SpeciesId, SpeciesMeta>

export const BREED_NAMES: Readonly<Record<BreedId, string>> = {
  upright: 'stående ører', lop: 'vædderkanin', lionhead: 'løvehoved',
  domestic: 'huskat', longhair: 'langhåret kat', mainecoon: 'maine coon',
  shetland: 'shetlandspony', fjord: 'fjordhest', arabian: 'araber',
  foal: 'enhjørningeføl', wavy: 'bølgemanke', starhorn: 'stjernehorn',
  std: '',
}

/** Onboarding starters (the horse starts as the Shetland foal). */
export const STARTERS: readonly SpeciesId[] = ['rabbit', 'cat', 'puppy', 'horse']

// ─── Wardrobe ───────────────────────────────────────────────────────────────

export type ItemPrice = 80 | 120 | 180
export const PRICE_BY_SLOT: Readonly<Record<Slot, ItemPrice>> = {
  face: 80, neck: 80, head: 120, hand: 120, body: 180, back: 180,
}
export const RECOLOR_PRICE = 25

export interface ItemMeta {
  id: ItemId
  set: SetId | 'milepael'
  slot: Slot
  name: string
  nameClip: ClipId
  source: ItemSource
}

const SET_NAMES: Readonly<Record<SetId, string>> = {
  hverdag: 'Hverdag', opdager: 'Opdager', rytter: 'Rytter', kongelig: 'Kongelig', astronaut: 'Astronaut',
  ridder: 'Ridder', talmagiker: 'Talmagiker', pirat: 'Pirat', fodbold: 'Fodbold', vinter: 'Vinter', fest: 'Fest',
}
export const setName = (set: SetId) => SET_NAMES[set]

const ITEM_NAMES: Readonly<Record<SetId, Readonly<Record<Slot, string>>>> = {
  hverdag: { head: 'Hue', neck: 'Halstørklæde', body: 'Stribet trøje', hand: 'Ballon', face: 'Solbriller', back: 'Rygsæk' },
  opdager: { head: 'Opdagerhat', hand: 'Lup', face: 'Eventyrbriller', neck: 'Kompas', body: 'Opdagervest', back: 'Sommerfuglenet' },
  rytter: { head: 'Ridehjelm', face: 'Støvbriller', hand: 'Gulerod', neck: 'Rosette', body: 'Ridejakke', back: 'Sadeltaske' },
  kongelig: { head: 'Diadem', face: 'Monokel', neck: 'Perlekæde', hand: 'Scepter', body: 'Festdragt', back: 'Kongekåbe' },
  astronaut: { head: 'Rumhjelm', face: 'Rumbriller', hand: 'Legetøjsraket', neck: 'Stjernemedaljon', body: 'Rumdragt', back: 'Jetpack' },
  ridder: { head: 'Ridderhjelm', hand: 'Skjold', body: 'Rustning', back: 'Ridderkappe', neck: 'Ordenskæde', face: 'Heltemaske' },
  talmagiker: { head: 'Troldmandshat', hand: 'Tryllestav', back: 'Stjernekappe', body: 'Tryllekjortel', neck: 'Talamulet', face: 'Stjernebriller' },
  pirat: { head: 'Pirathat', face: 'Piratskæg', neck: 'Bandana', body: 'Pirattrøje', back: 'Skattekort', hand: 'Kikkert' },
  fodbold: { head: 'Kasket', face: 'Ansigtsmaling', neck: 'Fanhalstørklæde', body: 'Fodboldtrøje', back: 'Holdflag', hand: 'Fodbold' },
  vinter: { head: 'Pelshue', face: 'Skibriller', neck: 'Strikhalstørklæde', body: 'Vinterjakke', back: 'Kælk', hand: 'Varm kakao' },
  fest: { head: 'Festhat', face: 'Festbriller', neck: 'Butterfly', body: 'Festvest', back: 'Balloner', hand: 'Kage' },
}

const HVERDAG_LEVELS: Readonly<Record<Slot, number>> = { head: 2, neck: 3, body: 4, hand: 6, face: 7, back: 8 }
const RIDDER_SILVER: Readonly<Record<Slot, number>> = { head: 2, hand: 5, body: 9, back: 14, neck: 20, face: 27 }
const MAGIKER_GOLD: Readonly<Record<Slot, number>> = { head: 1, hand: 3, back: 6, body: 10, neck: 15, face: 21 }
const SHOP_SETS: readonly SetId[] = ['pirat', 'fodbold', 'vinter', 'fest']

/** Where chest and finale items come from (curriculum.ts is the source; kept in sync by a test). */
const CHEST_NODES: Partial<Record<ItemId, NodeId>> = {
  'opdager-head': 'w0-former-chest', 'opdager-hand': 'w0-tal20-chest',
  'rytter-head': 'w1-dobbelt-chest', 'rytter-face': 'w1-figurer-chest', 'rytter-hand': 'w1-tiere-chest',
  'kongelig-head': 'w2-veksling-chest', 'kongelig-face': 'w2-klokken-chest', 'kongelig-neck': 'w2-hundreder-chest',
  'kongelig-hand': 'w2-figurer-chest',
  'astronaut-head': 'w3-store-tal-chest', 'astronaut-face': 'w3-division-chest', 'astronaut-hand': 'w3-areal-chest',
}
const WORLD_SETS: Readonly<Partial<Record<SetId, WorldId>>> = { opdager: 'eng', rytter: 'bakke', kongelig: 'skov', astronaut: 'fjeld' }

function sourceOf(set: SetId, slot: Slot): ItemSource {
  const id = `${set}-${slot}` as ItemId
  if (set === 'hverdag') return { kind: 'level', level: HVERDAG_LEVELS[slot] }
  if (set === 'ridder') return { kind: 'medal', tier: 'silver', count: RIDDER_SILVER[slot] }
  if (set === 'talmagiker') return { kind: 'medal', tier: 'gold', count: MAGIKER_GOLD[slot] }
  if (SHOP_SETS.includes(set)) return { kind: 'shop', price: PRICE_BY_SLOT[slot] }
  const chest = CHEST_NODES[id]
  if (chest) return { kind: 'chest', nodeId: chest }
  return { kind: 'finale', world: WORLD_SETS[set]! }
}

const SLOT_ORDER: readonly Slot[] = ['head', 'face', 'neck', 'body', 'back', 'hand']

export const ITEMS: readonly ItemMeta[] = [
  ...SET_IDS.flatMap((set) =>
    SLOT_ORDER.map((slot): ItemMeta => {
      const id = `${set}-${slot}` as ItemId
      return { id, set, slot, name: ITEM_NAMES[set][slot], nameClip: `name.item.${id}`, source: sourceOf(set, slot) }
    }),
  ),
  ...([
    ['milepael-hjertebriller', 'face', 'Hjertebriller', 5],
    ['milepael-regnbuehue', 'head', 'Regnbuehue', 10],
    ['milepael-kappe', 'back', 'Superheltekappe', 15],
    ['milepael-medalje', 'neck', 'Medaljehalskæde', 20],
    ['milepael-glimmerbluse', 'body', 'Glimmerbluse', 25],
    ['milepael-slikkepind', 'hand', 'Kæmpeslikkepind', 30],
    ['milepael-fevinger', 'back', 'Fe-vinger', 40],
    ['milepael-krone', 'head', 'Legendekronen', 50],
  ] as const).map(([id, slot, name, level]): ItemMeta => ({
    id, set: 'milepael', slot, name, nameClip: `name.item.${id}`, source: { kind: 'level', level },
  })),
]

export const ITEM_BY_ID: Readonly<Record<ItemId, ItemMeta>> = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, ItemMeta>

// ─── Decor ──────────────────────────────────────────────────────────────────

export interface DecorMeta { id: DecorId; name: string; price: 40 | 80 | 150 }

export const DECOR: readonly DecorMeta[] = [
  { id: 'pynt-blomsterbed', name: 'Blomsterbed', price: 40 },
  { id: 'pynt-lygte', name: 'Lygte', price: 40 },
  { id: 'pynt-baenk', name: 'Bænk', price: 80 },
  { id: 'pynt-gynge', name: 'Gynge', price: 80 },
  { id: 'pynt-dam', name: 'Andedam', price: 80 },
  { id: 'pynt-traehus', name: 'Træhus', price: 150 },
  { id: 'pynt-springvand', name: 'Springvand', price: 150 },
  { id: 'pynt-regnbuebue', name: 'Regnbuebue', price: 150 },
]

// ─── Trophies ───────────────────────────────────────────────────────────────

export type TrophyCategory = 'flid' | 'stil' | 'rejse' | 'laering' | 'venner'
export interface TrophyMeta { id: TrophyId; category: TrophyCategory; name: string; perler: 5 | 10 | 15 }

const t = (id: TrophyId, category: TrophyCategory, name: string, perler: 5 | 10 | 15): TrophyMeta => ({ id, category, name, perler })

export const TROPHIES: readonly TrophyMeta[] = [
  t('days-3', 'flid', 'Tre dage med regning', 5),
  t('days-7', 'flid', 'Syv dage med regning', 5),
  t('days-14', 'flid', 'Fjorten dage med regning', 10),
  t('days-30', 'flid', 'Tredive dage med regning', 10),
  t('days-100', 'flid', 'Hundrede dage med regning', 15),
  ...SET_IDS.map((set) => t(`set-${set}` as TrophyId, 'stil', `Hele ${SET_NAMES[set]}-sættet`, 10)),
  t('world-eng', 'rejse', 'Engdalens finale', 10),
  t('world-bakke', 'rejse', 'Hestebakkernes finale', 10),
  t('world-skov', 'rejse', 'Regnbueskovens finale', 15),
  t('world-fjeld', 'rejse', 'Stjernefjeldets finale', 15),
  t('trials-10', 'rejse', 'Ti mesterprøver', 10),
  t('first-gold', 'laering', 'Første guldmedalje', 10),
  t('gold-10', 'laering', 'Ti guldmedaljer', 15),
  t('keys5-100', 'laering', 'Hundrede ting sidder helt fast', 10),
  t('keys5-500', 'laering', 'Fem hundrede ting sidder helt fast', 15),
  t('perfect-round', 'laering', 'En perfekt tur', 5),
  t('trial-perfect', 'laering', 'En mesterprøve uden fejl', 10),
  t('table-complete', 'laering', 'Hele gangetabellen', 15),
  t('animals-5', 'venner', 'Fem dyrevenner', 5),
  t('animals-15', 'venner', 'Femten dyrevenner', 10),
  t('animals-30', 'venner', 'Tredive dyrevenner', 15),
  t('first-star-form', 'venner', 'En ven i stjerneform', 10),
  t('all-species', 'venner', 'Alle seksten slags dyr', 15),
  t('first-rainbow', 'venner', 'Første regnbuedyr', 10),
]

// ─── Profiles ───────────────────────────────────────────────────────────────

export const FRAME_HEX: Readonly<Record<FrameColor, string>> = {
  coral: '#FF8A65', sun: '#FFC83D', leaf: '#4CC38A', sky: '#4FA3F7', grape: '#9B7BF7', rose: '#F27BB5',
}
export const MAX_PROFILES = 6
