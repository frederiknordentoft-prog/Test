// Talvennerne 2 — core contracts (G-spec). See docs/SPEC.md §2–5, §9.2, §10.1.
//
// This file is owned by the integrator. Workers build against it and must not change it;
// ask for a change in your report instead. Ids declared here are snapshotted in
// src/content/ids.lock.json, and a test fails if the two drift apart.

import type { Rng } from './rng'

/** Seeded PRNG (V1's mulberry32, src/engine/rng.ts). Game logic never calls Math.random(). */
export type { Rng }

// ─── Ids ────────────────────────────────────────────────────────────────────

export const DOMAIN_IDS = [
  'number', 'place', 'addsub', 'muldiv', 'algebra', 'fractions',
  'shapes', 'clock', 'money', 'measure',
] as const
export type DomainId = (typeof DOMAIN_IDS)[number]

export const SKILL_IDS = [
  // number
  'count10', 'count20', 'hear20', 'order20', 'hear100', 'order100', 'numberLine100',
  'hear1000', 'order1000', 'numberLine1000',
  // place
  'tensOnes', 'placeValue1000',
  // addsub
  'addTo10', 'subTo10', 'tenFriends', 'doubles', 'halves', 'addSub20Simple', 'addTo20', 'subTo20',
  'tens100', 'add100NoCarry', 'sub100NoBorrow', 'add100Carry', 'sub100Borrow', 'addSub1000Round',
  'add1000', 'sub1000',
  // muldiv
  'groupsOf', 'mul2510', 'shareEqually', 'mul34', 'mul6to9', 'div2510', 'divAll', 'mulTens',
  // algebra
  'patterns', 'missingPart10', 'skipCount', 'missingPart100', 'inverseOps', 'equalSides',
  // shapes
  'shapes2D', 'sidesCorners', 'shapes3D', 'sortShapes', 'symmetry', 'composeShapes', 'area', 'gridCoords',
  // clock
  'clockHour', 'clockHalf', 'clockQuarter', 'clockFive', 'clockDigital', 'clockElapsed',
  // money
  'coinNames', 'countCoins', 'payExact', 'change', 'kronerOre',
  // measure
  'compareLength', 'weightCompare', 'measureUnits', 'rulerRead', 'unitChoice', 'readChart', 'convertCmM',
  // fractions
  'halfShape', 'fractionShape', 'fractionOfSet', 'fractionCompare',
] as const
export type SkillId = (typeof SKILL_IDS)[number]

/** The 15 task kinds. `rulerDraw` is reserved in ids.lock.json but not built in v2.0. */
export const TASK_KINDS = [
  'choice', 'keypad', 'countTap', 'pair', 'numberline', 'trueFalse', 'sortOrder', 'multiSelect',
  'fillSlots', 'buildBase', 'clockSet', 'pay', 'share', 'colorParts', 'grid',
] as const
export type TaskKind = (typeof TASK_KINDS)[number]

export const MISCONCEPTION_IDS = [
  // concept
  'concatNumberWords', 'zeroPlaceholder', 'faceValue', 'addsPlaceParts', 'forgotCarry',
  'smallerFromLarger', 'borrowNoDecrement', 'placeMisalign', 'mulAsAdd', 'equalsAsAnswer',
  'halfPastNext', 'quarterDirection', 'handsSwapped', 'firstDigitCompare', 'coinsAsCount',
  'rulerEnd', 'lengthByEnd', 'sizeIsWeight', 'unequalParts', 'prototypeOnly', 'biggerDenominator',
  'denominatorAsAnswer', 'areaAsPerimeter', 'tensZero', 'digitComplement10',
  // concept in hear*/tensOnes/placeValue1000, slip elsewhere (natureFor decides)
  'digitSwap',
  // slip
  'tableNeighbour', 'countFromFirst', 'hourHandMisread', 'skipStepOne', 'wrongOperation',
] as const
export type MisconceptionId = (typeof MISCONCEPTION_IDS)[number]

/** Perceptual misconceptions use the contrast rule (SPEC §4.3). */
export const PERCEPTUAL_MISCONCEPTIONS: readonly MisconceptionId[] = [
  'lengthByEnd', 'sizeIsWeight', 'unequalParts', 'prototypeOnly',
]

export type ErrorTag = MisconceptionId | 'near' | 'operand' | 'ambiguous' | 'other' | 'shareUnequal'

export const WORLD_IDS = ['eng', 'bakke', 'skov', 'fjeld'] as const
export type WorldId = (typeof WORLD_IDS)[number]

export const CHAIN_IDS = ['tal', 'figurer', 'klokken', 'pengeMaal'] as const
export type ChainId = (typeof CHAIN_IDS)[number]

/** Region ids look like `w0-tal10`; the full list lives in src/content/curriculum.ts. */
export type RegionId = `w${0 | 1 | 2 | 3}-${string}`
/** Node template per region: l1 → l2 → friend|chest → l3 → mix → trial (SPEC §5.3). */
export const REGION_NODE_SLOTS = ['l1', 'l2', 'friend', 'chest', 'l3', 'mix', 'trial'] as const
export type RegionNodeSlot = (typeof REGION_NODE_SLOTS)[number]
/** `${regionId}-${slot}` for region nodes (each region has either a friend or a chest node),
 *  `${worldId}-finale` for world finales. */
export type NodeId = `${RegionId}-${RegionNodeSlot}` | `${WorldId}-finale`

export type Grade = 0 | 1 | 2 | 3

export const SPECIES_IDS = [
  'rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'lamb', 'fox', 'hamster',
  'unicorn', 'panda', 'squirrel', 'owl', 'pegasus', 'dragon', 'penguin', 'polarbear',
] as const
export type SpeciesId = (typeof SPECIES_IDS)[number]
/** Pip the sparrow narrates and uses the rig, but is never a collectible. */
export type RigCharacterId = SpeciesId | 'pip'

export const BREEDS = {
  rabbit: ['upright', 'lop', 'lionhead'],
  cat: ['domestic', 'longhair', 'mainecoon'],
  horse: ['shetland', 'fjord', 'arabian'],
  unicorn: ['foal', 'wavy', 'starhorn'],
} as const satisfies Partial<Record<SpeciesId, readonly string[]>>
export type BreedId = (typeof BREEDS)[keyof typeof BREEDS][number] | 'std'

export const NATURAL_COLORWAYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const
export const MAGIC_COLORWAYS = ['gold', 'rainbow', 'starwhite'] as const
export type ColorwayId = (typeof NATURAL_COLORWAYS)[number] | (typeof MAGIC_COLORWAYS)[number]

export type Stage = 1 | 2 | 3
/** No `sad`: animals never express guilt, longing or hunger (SPEC §6.3, §13). */
export const MOODS = ['idle', 'happy', 'cheer', 'think', 'oops', 'sleep', 'wave'] as const
export type Mood = (typeof MOODS)[number]

export const SLOTS = ['head', 'face', 'neck', 'body', 'back', 'hand'] as const
export type Slot = (typeof SLOTS)[number]

export const SET_IDS = [
  'hverdag', 'opdager', 'rytter', 'kongelig', 'astronaut', 'ridder', 'talmagiker',
  'pirat', 'fodbold', 'vinter', 'fest',
] as const
export type SetId = (typeof SET_IDS)[number]
export const MILESTONE_ITEMS = [
  'milepael-hjertebriller', 'milepael-regnbuehue', 'milepael-kappe', 'milepael-medalje',
  'milepael-glimmerbluse', 'milepael-slikkepind', 'milepael-fevinger', 'milepael-krone',
] as const
/** Set items are `${set}-${slot}` (each set has exactly one item per slot), plus 8 milestones. */
export type ItemId = `${SetId}-${Slot}` | (typeof MILESTONE_ITEMS)[number]
export type ItemColor = 0 | 1 | 2

export const DECOR_IDS = [
  'pynt-baenk', 'pynt-blomsterbed', 'pynt-lygte', 'pynt-dam', 'pynt-gynge', 'pynt-traehus',
  'pynt-springvand', 'pynt-regnbuebue',
] as const
export type DecorId = (typeof DECOR_IDS)[number]

export const TROPHY_IDS = [
  // Flid: days played in total (never a streak)
  'days-3', 'days-7', 'days-14', 'days-30', 'days-100',
  // Stil: complete sets
  'set-hverdag', 'set-opdager', 'set-rytter', 'set-kongelig', 'set-astronaut', 'set-ridder',
  'set-talmagiker', 'set-pirat', 'set-fodbold', 'set-vinter', 'set-fest',
  // Rejse
  'world-eng', 'world-bakke', 'world-skov', 'world-fjeld', 'trials-10',
  // Læring
  'first-gold', 'gold-10', 'keys5-100', 'keys5-500', 'perfect-round', 'trial-perfect', 'table-complete',
  // Venner
  'animals-5', 'animals-15', 'animals-30', 'first-star-form', 'all-species', 'first-rainbow',
] as const
export type TrophyId = (typeof TROPHY_IDS)[number]

export const FRAME_COLORS = ['coral', 'sun', 'leaf', 'sky', 'grape', 'rose'] as const
export type FrameColor = (typeof FRAME_COLORS)[number]

/**
 * Pre-recorded voice clip id. Patterns (SPEC §10.2):
 * `n.mid.N` / `n.end.N` (0–100, 1000), `n.mid.1.et` / `n.end.1.et`, `h.mid.H` / `h.end.H` / `hog.H`,
 * `t.end.M` / `t.half.M` / `t.part.*`, `op.*`, `frag.*`, `noun.*`, `q.<factId>`, `s.*`, `hint.*`, `name.*`.
 */
export type ClipId = string
export type MasteryKey = string
export type ProfileId = string

// ─── Speech ─────────────────────────────────────────────────────────────────

export type SpeechForm = 'mid' | 'end'
/** One spoken element. `compile()` in src/speech turns a list into clip ids + digit-free text. */
export type SpeechPart =
  | { clip: ClipId }
  | { num: number; form: SpeechForm; gender?: 'c' | 'n' }
  | { clock: { minutes: number; style: 'analog' | 'analogHalfForm' | 'digital'; form: SpeechForm } }
  | { money: { ore: number; form: SpeechForm } }
  | { measure: { value: number; unit: 'cm' | 'm' | 'g' | 'kg'; form: SpeechForm } }
  | { frac: { n: number; d: 2 | 3 | 4 | 5 | 6 | 8; form: SpeechForm } }
  | { free: string }

// ─── Answers and prompts ────────────────────────────────────────────────────

export type AnswerValue = number | string
/**
 * int: numbers, counts, cm, whole kroner as numbers · minutes: 0–1439 (Task.modulo 720 analog, 1440 24h)
 * ore: money in øre · token: 'shape:triangle' | 'solid:cube' | 'frac:3/4' | 'cmp:<' | 'unit:cm' | 'yes' | 'no' | 'pat:red' …
 * set: sorted tokens joined by '|': 's0|s3|s5', grid cells '3|7|12', coins 'c2000|c500|c200'
 */
export type AnswerType = 'int' | 'minutes' | 'ore' | 'token' | 'set'

export type OptionView =
  | 'numeral' | 'amount' | 'clock' | 'clockDigital' | 'coin' | 'coins' | 'shape' | 'solid'
  | 'fraction' | 'unitWord' | 'relation' | 'picture' | 'patternToken' | 'chartBar' | 'token' | 'yesNo'

/** Option views whose cards carry a pictogram and are read aloud (SPEC §3.4). */
export const SPOKEN_OPTION_VIEWS: readonly OptionView[] = ['unitWord', 'relation', 'token']

export type Op = '+' | '−' | '·' | ':' | '=' | '<' | '>'
export type Term = { n: number } | { blank: true } | { op: Op } | { text: ClipId }

/** Countable things drawn by the materials library (carrots, apples, animals …). */
export type ThingId = string
/** Measurable objects (pencil, rope, teddy …). */
export type ObjectId = string
export type ShapeId =
  | 'circle' | 'triangle' | 'quadrilateral' | 'square' | 'rectangle' | 'pentagon' | 'hexagon'
  | 'octagon' | 'semicircle' | 'rhombus' | 'trapezoid'
export type SolidId = 'sphere' | 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'pyramid'
export type StoryId = string

export type Prompt =
  | { scene: 'equation'; terms: Term[] }
  | { scene: 'objects'; n: number; layout: 'scatter' | 'dice' | 'fingers' | 'tenframe' | 'row' | 'beads'; thing: ThingId; flashMs?: number }
  | { scene: 'hear' }
  | { scene: 'base'; h: number; t: number; o: number; order: 'hto' | 'oth' }
  | { scene: 'row'; cells: (number | string | null)[]; step?: number }
  | { scene: 'line'; min: number; max: number; arrowAt?: number; target?: number; hops?: number[] }
  | { scene: 'board'; highlight: number[]; blank?: number }
  | { scene: 'groups'; groups: number; size: number; thing: ThingId }
  | { scene: 'array'; rows: number; cols: number; split?: number }
  | { scene: 'share'; total: number; recipients: number; thing: ThingId }
  | { scene: 'balance'; left: Term[]; right: Term[] }
  | { scene: 'shape'; shape: ShapeId; variant: number; mark?: 'corners' | 'sides'; cut?: 'equal' | 'unequal' }
  | { scene: 'shapes'; items: { id: string; shape: ShapeId; variant: number }[] }
  | { scene: 'solid'; solid: SolidId; asObject?: ObjectId }
  | { scene: 'symmetry'; picture: string; line: 'v' | 'h' | 'd' }
  | { scene: 'grid'; w: number; h: number; filled: number[]; axis?: 'v' | 'h'; coords?: boolean; point?: [number, number] }
  | { scene: 'clock'; minutes: number | null; digital?: boolean; h24?: boolean; step: 60 | 30 | 15 | 5; to?: number }
  | { scene: 'coins'; ore: number[] }
  | { scene: 'shop'; thing: ThingId; priceOre: number; paidOre?: number; purse: number[] }
  | { scene: 'ruler'; object: ObjectId; startCm: number; lengthCm: number | null }
  | { scene: 'unitsRow'; object: ObjectId; unit: 'cube' | 'clip'; length: number }
  | { scene: 'compareObjects'; objects: ObjectId[]; sizes: number[]; aligned: boolean; mode: 'length' | 'weight' }
  | { scene: 'chart'; kind: 'picto' | 'bar'; data: { cat: SpeciesId; n: number }[] }
  | { scene: 'fraction'; shape: 'circle' | 'rect' | 'bar'; parts: number; colored: number; equal: boolean }
  | { scene: 'fractionBars'; fracs: string[] }
  | { scene: 'area'; w: number; h: number; cells: number[] }
  | { scene: 'amount'; ore: number }
  | { scene: 'story'; frame: StoryId; species: SpeciesId; nums: number[] }

export type PromptScene = Prompt['scene']

// ─── Facts, skills, hints ──────────────────────────────────────────────────

/** Skill-private extra data (shape variant, coin set, data set …). Only the owning SkillDef reads it. */
export type FactData = Readonly<Record<string, unknown>>

export interface Fact {
  /** 'add:38+45', 'mul:3x7' (smallest factor first), 'clk:150', 'pay:1700' … V1 conventions kept. */
  id: string
  skill: SkillId
  family: string
  operands: readonly number[]
  answer: AnswerValue
  /** Easy → hard within the skill; new keys are introduced in rank order. */
  rank: number
  data?: FactData
}

export interface FamilyDef {
  id: string
  label: string
  rank: number
  /** Overrides the skill grade, e.g. `round10` in numberLine1000 is 3. kl. */
  grade?: Grade
  fastMs?: Partial<Record<TaskKind, number>>
}

export interface Candidate {
  value: AnswerValue
  tag: ErrorTag
}

/** Visual part of a strategy hint. Hint scenes extend the prompt scenes. */
export type HintVisual =
  | Prompt
  | { scene: 'makeTen'; a: number; b: number }
  | { scene: 'backToTen'; a: number; b: number }
  | { scene: 'columns'; a: number; b: number; op: '+' | '−'; carry?: boolean }
  | { scene: 'clockMove'; from: number; to: number }
  | { scene: 'splitArray'; rows: number; cols: number; split: number }
  | { scene: 'coinsSum'; ore: number[] }
  | { scene: 'none' }

export interface HintSpec {
  /** Spoken explanation (also rendered as text). */
  speech: SpeechPart[]
  visual: HintVisual
  /** Set when this is the misconception-specific hint for the child's current error. */
  misconception?: MisconceptionId
  /** Animated hint (8 misconceptions, SPEC §4.3). */
  animated?: boolean
}

export interface SkillDef {
  id: SkillId
  domain: DomainId
  grade: Grade
  /** 0.0–3.9 position in the curriculum; used by placement and the grade estimate. */
  stage: number
  mode: 'recall' | 'procedure'
  /** Parent-facing Danish label. */
  label: string
  /** Kan-bogen: "Jeg kan …" */
  canDo: ClipId
  families: FamilyDef[]
  /** Valid presentations. At least one must be production for ≥ 90 % of instances (test). */
  kinds: TaskKind[]
  /** Recall: every fact. Procedure: 20 canonical facts per family (tests and ranking). */
  enumerate(): Fact[]
  /** Procedure only: a fresh seeded instance of a family, avoiding the given fact ids. */
  instance?(family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact
  answerType(fact: Fact): AnswerType
  prompt(fact: Fact, kind: TaskKind, rng: Rng): Prompt
  optionView(fact: Fact, kind: TaskKind): OptionView
  range(fact: Fact, kind: TaskKind): [number, number]
  speech(fact: Fact, kind: TaskKind): SpeechPart[]
  /** Tagged wrong answers used as distractors and for error classification. */
  candidates(fact: Fact): Candidate[]
  hint(fact: Fact, tag: ErrorTag | null): HintSpec
  fastMs?(fact: Fact, kind: TaskKind): number | undefined
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  factId: string
  masteryKey: MasteryKey
  skill: SkillId
  family: string
  kind: TaskKind
  prompt: Prompt
  answer: AnswerValue
  answerType: AnswerType
  /** Equivalent answers, e.g. 'frac:2/4' when '1/2' is coloured on a 4-part shape. */
  accept: AnswerValue[]
  /** 0; number line 0–100: 5; 0–1000: 50. */
  tolerance: number
  modulo: 0 | 720 | 1440
  /** choice/pair/multiSelect/sortOrder options, fillSlots palette. */
  options: AnswerValue[]
  optionView: OptionView
  /** String(option) → error tag, for logging. */
  distractorTags: Record<string, ErrorTag>
  /** Required for unitWord/relation/token views. */
  optionClips: ClipId[] | null
  unit: 'kr' | 'cm' | 'm' | null
  entryScale: 1 | 100
  range: [number, number]
  maxDigits: number
  /** Manipulative scaffold visible in the prompt (box 0 only). */
  scaffold: boolean
  speech: SpeechPart[]
  /** Set on the re-queued task after a mistake; a retry never changes the box. */
  retryOf: string | null
  /**
   * Perceptual misconceptions (lengthByEnd, sizeIsWeight, unequalParts, prototypeOnly) are only
   * concluded from contrast: 'conflict' items where perception misleads vs 'congruent' items.
   */
  contrast?: 'conflict' | 'congruent'
}

// ─── Mastery ────────────────────────────────────────────────────────────────

export type Box = 0 | 1 | 2 | 3 | 4 | 5

export interface KeyState {
  box: Box
  seen: number
  correct: number
  lastRound: number
  /** Learning day ('YYYY-MM-DD', local time minus 4 h) of the last answer. */
  lastDay: string
  /** Learning day the current box was reached. */
  boxDay: string
  /** Epoch ms the current box was reached. */
  boxAt: number
  avgMs: number
  /** Procedure: the last 5 correct instance ids. */
  recent: string[]
  /** Procedure: first fast correct instance on the way to the next box. */
  pendingInstance: string | null
  /** Set by placement; the dashboard shows "Sprunget over ved start" until confirmed. */
  seeded: boolean
}

export type SkillStatus = 'notStarted' | 'practising' | 'support' | 'silver' | 'independent'
export type Medal = 'bronze' | 'silver' | 'gold'

// ─── Rounds ─────────────────────────────────────────────────────────────────

export type RoundMode = 'round' | 'trial' | 'finale' | 'placement' | 'practice' | 'hut'
export type AnswerMode = 'round' | 'trial' | 'placement' | 'golden' | 'practice' | 'hut' | 'retry'

export interface FirstTry {
  key: MasteryKey
  skill: SkillId
  correct: boolean
  production: boolean
  fast: boolean
}

/** Written with every answer so a reload resumes the same task and queue (SPEC §5.4). */
export interface RoundSnapshot {
  v: 1
  roundId: string
  sessionId: string
  mode: RoundMode
  /** A map node, or 'practice' (Blandet øvelse), 'hut' (Træningshytte) or 'placement'. */
  nodeId: NodeId | 'practice' | 'hut' | 'placement'
  seed: number
  queue: Task[]
  current: Task | null
  /** Where the round stood: asking, showing the strategy after a mistake, or the golden egg. */
  phase: 'asking' | 'teaching' | 'golden'
  answered: number
  total: number
  firstTries: FirstTry[]
  streak: number
  bestStreak: number
  mistakes: number
  goldenUsed: boolean
  goldenCaught: boolean
  /** Mastery trials: correct first tries so far. */
  planks: number
  startedAt: number
}

// ─── Game layer ─────────────────────────────────────────────────────────────

export interface Animal {
  uid: string
  species: SpeciesId
  breed: BreedId
  colorway: ColorwayId
  name: string
  friendship: number
  /** Highest stage reached; the child may show any reached form. */
  stage: Stage
  star: boolean
  shown: Stage | 'star'
  outfit: Partial<Record<Slot, { item: ItemId; color: ItemColor }>>
  foundAt: number
  source: 'starter' | 'friend' | 'egg' | 'gold' | 'rainbow' | 'starFoal'
}

export type ItemSource =
  | { kind: 'level'; level: number }
  | { kind: 'chest'; nodeId: NodeId }
  | { kind: 'finale'; world: WorldId }
  | { kind: 'medal'; tier: 'silver' | 'gold'; count: number }
  | { kind: 'shop'; price: 80 | 120 | 180 }

export interface InventoryEntry {
  at: number
  /** Owned colours; 0 is always owned, 1–2 are bought recolours. */
  colors: ItemColor[]
}

export type GoalKind = 'mix' | 'revisit' | 'streak5' | 'write10' | 'stars3'
export interface Goal {
  kind: GoalKind
  /** For 'revisit': the region to visit. */
  region?: RegionId
  need: number
  progress: number
  done: boolean
}

export interface NodeProgress {
  plays: number
  stars: 0 | 1 | 2 | 3
  /** Passed by skipping ahead with the region trial. */
  skipped: boolean
  lastAt: number
}

export interface TrialState {
  attempts: number
  failed: number
  best: number
  passedAt: number | null
  /** profile.roundIndex at the last attempt; a retry needs one normal round since. */
  lastAttemptRound: number
}

export interface MisconceptionState {
  status: 'watching' | 'flagged' | 'resolved'
  /** Evidence inside the 30-learning-day window, newest last (max 40). */
  hits: { day: string; factId: string; w: number; production: boolean }[]
  /** Opportunities inside the window, newest last (max 80). */
  opps: { day: string; pGuess: number; hit: boolean; correct: boolean }[]
  flaggedAt: number | null
  resolvedAt: number | null
}

export interface RewardLogEntry {
  ts: number
  kind: 'animal' | 'item' | 'perler' | 'stars' | 'medal' | 'trophy' | 'level' | 'growth' | 'decor' | 'recolor'
  /** What was earned (id or amount). */
  what: string
  /** How it was earned, e.g. 'node:w0-plus10-node3', 'level:2', 'medal:gold:addTo10', 'shop'. */
  why: string
}

export interface ProfileSettings {
  sfx: boolean
  speech: boolean
  autoSpeak: boolean
  calm: boolean
  domainsOff: DomainId[]
}

export interface PlacementState {
  done: boolean
  at: number | null
  /** Highest passed checkpoint 'L1'–'L14', or null. */
  highest: string | null
}

export interface Economy {
  perler: number
  xp: number
  level: number
  eggWarmth: number
  eggsHatched: number
  eggSpecies: SpeciesId | null
  wish: ItemId | null
}

export interface ProfileDoc {
  id: ProfileId
  version: number
  name: string
  grade: Grade
  frameColor: FrameColor
  createdAt: number
  settings: ProfileSettings
  placement: PlacementState
  keys: Record<MasteryKey, KeyState>
  skillStats: Partial<Record<SkillId, { prodCorrect: number; prodDays: string[] }>>
  skillMedals: Partial<Record<SkillId, Medal>>
  nodes: Partial<Record<NodeId, NodeProgress>>
  /** Region trials and world finales. */
  trials: Partial<Record<RegionId | WorldId, TrialState>>
  /** Opened by a parent or by placement. */
  unlocked: { worlds: WorldId[]; regions: RegionId[] }
  roundIndex: number
  newToday: { day: string; total: number; perSkill: Partial<Record<SkillId, number>> }
  offeredTags: Partial<Record<MisconceptionId, number>>
  misconceptions: Partial<Record<MisconceptionId, MisconceptionState>>
  economy: Economy
  animals: Animal[]
  buddyUid: string | null
  inventory: Partial<Record<ItemId, InventoryEntry>>
  decor: Partial<Record<DecorId, { at: number; x: number; y: number }>>
  achievements: Partial<Record<TrophyId, number>>
  goals: { day: string; list: Goal[] }
  stamps: number
  daysPlayed: number
  lastLearningDay: string | null
  demosSeen: Partial<Record<TaskKind, number>>
  instructionsHeard: Partial<Record<TaskKind, number>>
  /** Last first-try results across rounds (newest last, max 10) for fatigue/warm mode. */
  recentFirstTries: boolean[]
  round: RoundSnapshot | null
  /** The last 200 rewards, newest last. */
  rewardLog: RewardLogEntry[]
}

// ─── Logs and aggregates ────────────────────────────────────────────────────

export interface AnswerLogEntry {
  seq?: number
  profileId: ProfileId
  ts: number
  /** Learning day. */
  day: string
  sessionId: string
  roundId: string
  nodeId: string
  mode: AnswerMode
  skill: SkillId
  family: string
  factId: string
  masteryKey: MasteryKey
  kind: TaskKind
  optionsCount: number
  production: boolean
  given: AnswerValue
  answer: AnswerValue
  correct: boolean
  /** From max(shown, speech end), capped at 120 000. */
  ms: number
  fast: boolean
  errorTag: ErrorTag | null
  /** Misconceptions this task could reveal (opportunities). */
  detectable: MisconceptionId[]
  boxBefore: Box
  boxAfter: Box
  scaffold: boolean
  replays: number
  retryOf: string | null
  assisted: boolean
  audioUnverified: boolean
}

export type MsHistogram = [number, number, number, number, number, number, number]

export interface DailySkillAggregate {
  n: number
  correct: number
  fast: number
  nProd: number
  /** Production answer times: <2, <4, <7, <12, <20, <35, ≥35 s. */
  msHist: MsHistogram
  errors: Partial<Record<MisconceptionId, number>>
}

export interface DailyAggregate {
  profileId: ProfileId
  day: string
  /** Time between first and last input per round, gaps > 90 s subtracted. */
  learnMs: number
  /** Time with animals, wardrobe, shop and books (reported by the UI). */
  playMs: number
  sessions: number
  rounds: number
  answers: number
  firstTryCorrect: number
  bySkill: Partial<Record<SkillId, DailySkillAggregate>>
  /** At the day's last round. */
  snapshot: Partial<Record<SkillId, { meanBox: number; share2: number; share4: number; status: SkillStatus }>>
  trialsPassed: (RegionId | WorldId)[]
}

// ─── Events ─────────────────────────────────────────────────────────────────

/** Emitted by the engine; the game layer turns them into rewards and ceremonies. */
export type LearningEvent =
  | { t: 'keyPromoted'; key: MasteryKey; skill: SkillId; box: Box }
  | { t: 'skillStatus'; skill: SkillId; status: SkillStatus }
  | { t: 'medal'; skill: SkillId; medal: Medal }
  | { t: 'trialPassed'; trial: RegionId | WorldId; score: number; perfect: boolean }
  | { t: 'familyFirstCorrect'; skill: SkillId; family: string }
  | { t: 'misconceptionResolved'; id: MisconceptionId }
