// Hand-written validation of imported data (SPEC §9.2: no schema library). An export file comes from
// outside the app, so everything the app later reads without checking is checked here: types,
// ranges and id sets. Errors carry a path and a Danish message for the parent-facing detail view.
import { ITEM_BY_ID } from '../content/catalog'
import {
  BREEDS, DECOR_IDS, DOMAIN_IDS, FRAME_COLORS, MAGIC_COLORWAYS, MISCONCEPTION_IDS, NATURAL_COLORWAYS, SKILL_IDS, SLOTS,
  SPECIES_IDS, TASK_KINDS, TROPHY_IDS, WORLD_IDS,
} from '../engine/types'

export type Check = (v: unknown, path: string, errs: string[]) => void

export const MAX_ERRORS = 20

function fail(errs: string[], path: string, msg: string): void {
  if (errs.length < MAX_ERRORS) errs.push(`${path}: ${msg}`)
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const str = (o: { min?: number; max?: number; re?: RegExp } = {}): Check => (v, p, e) => {
  if (typeof v !== 'string') return fail(e, p, 'skal være tekst')
  if (o.min !== undefined && v.length < o.min) return fail(e, p, 'er for kort')
  if (o.max !== undefined && v.length > o.max) return fail(e, p, 'er for lang')
  if (o.re && !o.re.test(v)) fail(e, p, 'har et ugyldigt format')
}

export const num = (o: { int?: boolean; min?: number; max?: number } = {}): Check => (v, p, e) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(e, p, 'skal være et tal')
  if (o.int && !Number.isInteger(v)) return fail(e, p, 'skal være et heltal')
  if (o.min !== undefined && v < o.min) return fail(e, p, `skal være mindst ${o.min}`)
  if (o.max !== undefined && v > o.max) fail(e, p, `må højst være ${o.max}`)
}

export const bool: Check = (v, p, e) => {
  if (typeof v !== 'boolean') fail(e, p, 'skal være sand/falsk')
}

export const oneOf = (values: readonly unknown[]): Check => (v, p, e) => {
  if (!values.includes(v)) fail(e, p, 'har en ukendt værdi')
}

export const nullable = (c: Check): Check => (v, p, e) => {
  if (v !== null) c(v, p, e)
}

export const arr = (c: Check, o: { max?: number; len?: number } = {}): Check => (v, p, e) => {
  if (!Array.isArray(v)) return fail(e, p, 'skal være en liste')
  if (o.len !== undefined && v.length !== o.len) return fail(e, p, `skal have ${o.len} elementer`)
  if (o.max !== undefined && v.length > o.max) return fail(e, p, 'har for mange elementer')
  for (let i = 0; i < v.length && e.length < MAX_ERRORS; i++) c(v[i], `${p}[${i}]`, e)
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export const rec = (c: Check, key?: (k: string) => boolean): Check => (v, p, e) => {
  if (!isObj(v)) return fail(e, p, 'skal være et objekt')
  for (const [k, x] of Object.entries(v)) {
    if (e.length >= MAX_ERRORS) return
    if (UNSAFE_KEYS.has(k) || (key && !key(k))) {
      fail(e, `${p}.${k}`, 'ukendt nøgle')
      continue
    }
    c(x, `${p}.${k}`, e)
  }
}

/** Required fields (all present), plus optional ones checked when present; other fields are allowed. */
export const obj = (fields: Record<string, Check>, optional: Record<string, Check> = {}): Check => (v, p, e) => {
  if (!isObj(v)) return fail(e, p, 'skal være et objekt')
  for (const [k, c] of Object.entries(fields)) {
    if (e.length >= MAX_ERRORS) return
    if (!(k in v)) fail(e, `${p}.${k}`, 'mangler')
    else c(v[k], `${p}.${k}`, e)
  }
  for (const [k, c] of Object.entries(optional)) if (k in v && v[k] !== undefined) c(v[k], `${p}.${k}`, e)
}

const setOf = (xs: readonly string[]) => {
  const s = new Set<string>(xs)
  return (k: string) => s.has(k)
}

export const isSkillKey = setOf(SKILL_IDS)
export const isMisconceptionKey = setOf(MISCONCEPTION_IDS)
const isTaskKindKey = setOf(TASK_KINDS)
const isItemKey = (k: string) => k in ITEM_BY_ID
const isDecorKey = setOf(DECOR_IDS)
const isTrophyKey = setOf(TROPHY_IDS)
const isSlotKey = setOf(SLOTS)

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const REGION_RE = /^w[0-3]-[a-z0-9-]+$/
const NODE_RE = /^(w[0-3]-[a-z0-9-]+-(l1|l2|friend|chest|l3|mix|trial)|(eng|bakke|skov|fjeld)-finale)$/
const isTrialKey = (k: string) => REGION_RE.test(k) || (WORLD_IDS as readonly string[]).includes(k)
const trialId: Check = (v, p, e) => {
  if (typeof v !== 'string' || !isTrialKey(v)) fail(e, p, 'er ikke en mesterprøve')
}

const day = str({ re: DAY_RE })
const dayOrEmpty = str({ re: /^(\d{4}-\d{2}-\d{2})?$/ })
const id = str({ min: 1, max: 200 })
const count = num({ int: true, min: 0 })
const time = num({ min: 0 })
const answerValue: Check = (v, p, e) => {
  if (typeof v === 'string') return
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(e, p, 'skal være et tal eller en tekst')
}
const box = num({ int: true, min: 0, max: 5 })
const skill = oneOf(SKILL_IDS)
const kind = oneOf(TASK_KINDS)
const misconception = oneOf(MISCONCEPTION_IDS)
const errorTag = oneOf([...MISCONCEPTION_IDS, 'near', 'operand', 'ambiguous', 'other', 'shareUnequal'])
const breeds = [...new Set(Object.values(BREEDS).flat()), 'std']

export const keyState = obj({
  box, seen: count, correct: count, lastRound: num({ int: true }), lastDay: dayOrEmpty, boxDay: dayOrEmpty, boxAt: time,
  avgMs: time, recent: arr(str({ max: 200 })), pendingInstance: nullable(str({ max: 200 })), seeded: bool,
})

const promptLike = obj({ scene: str({ min: 1 }) })

export const task = obj(
  {
    id, factId: id, masteryKey: id, skill, family: str({ max: 100 }), kind, prompt: promptLike, answer: answerValue,
    answerType: oneOf(['int', 'minutes', 'ore', 'token', 'set']), accept: arr(answerValue), tolerance: num({ min: 0 }),
    modulo: oneOf([0, 720, 1440]), options: arr(answerValue), optionView: str({ min: 1 }), distractorTags: rec(errorTag),
    optionClips: nullable(arr(str())), unit: oneOf([null, 'kr', 'cm', 'm']), entryScale: oneOf([1, 100]),
    range: arr(num(), { len: 2 }), maxDigits: count, scaffold: bool, speech: arr(obj({})), retryOf: nullable(str()),
  },
  { contrast: oneOf(['conflict', 'congruent']) },
)

export const roundSnapshot = obj({
  v: oneOf([1]), roundId: id, sessionId: id, mode: oneOf(['round', 'trial', 'finale', 'placement', 'practice', 'hut']),
  nodeId: id, seed: num({ int: true }), queue: arr(task), current: nullable(task), phase: oneOf(['asking', 'teaching', 'golden']),
  answered: count, total: count,
  firstTries: arr(obj({ key: id, skill, correct: bool, production: bool, fast: bool })),
  streak: count, bestStreak: count, mistakes: count, goldenUsed: bool, goldenCaught: bool, planks: count, startedAt: time,
})

const animal = obj({
  uid: id, species: oneOf(SPECIES_IDS), breed: oneOf(breeds), colorway: oneOf([...NATURAL_COLORWAYS, ...MAGIC_COLORWAYS]),
  name: str({ max: 40 }), friendship: num({ min: 0 }), stage: oneOf([1, 2, 3]), star: bool, shown: oneOf([1, 2, 3, 'star']),
  outfit: rec(obj({ item: oneOf(Object.keys(ITEM_BY_ID)), color: oneOf([0, 1, 2]) }), isSlotKey), foundAt: time,
  source: oneOf(['starter', 'friend', 'egg', 'gold', 'rainbow', 'starFoal']),
})

const misconceptionState = obj({
  status: oneOf(['watching', 'flagged', 'resolved']),
  hits: arr(obj({ day, factId: str(), w: num({ min: 0 }), production: bool })),
  opps: arr(obj({ day, pGuess: num({ min: 0, max: 1 }), hit: bool, correct: bool })),
  flaggedAt: nullable(time),
  resolvedAt: nullable(time),
})

export const profileDoc = obj({
  id,
  version: num({ int: true, min: 1 }),
  name: str({ max: 40 }),
  grade: oneOf([0, 1, 2, 3]),
  frameColor: oneOf(FRAME_COLORS),
  createdAt: time,
  settings: obj({ sfx: bool, speech: bool, autoSpeak: bool, calm: bool, domainsOff: arr(oneOf(DOMAIN_IDS)) }),
  placement: obj({ done: bool, at: nullable(time), highest: nullable(str({ re: /^L([1-9]|1[0-4])$/ })) }),
  keys: rec(keyState),
  skillStats: rec(obj({ prodCorrect: count, prodDays: arr(day) }), isSkillKey),
  skillMedals: rec(oneOf(['bronze', 'silver', 'gold']), isSkillKey),
  nodes: rec(obj({ plays: count, stars: oneOf([0, 1, 2, 3]), skipped: bool, lastAt: time }), (k) => NODE_RE.test(k)),
  trials: rec(obj({ attempts: count, failed: count, best: count, passedAt: nullable(time), lastAttemptRound: num({ int: true }) }), isTrialKey),
  unlocked: obj({ worlds: arr(oneOf(WORLD_IDS)), regions: arr(str({ re: REGION_RE })) }),
  roundIndex: count,
  newToday: obj({ day: dayOrEmpty, total: count, perSkill: rec(count, isSkillKey) }),
  offeredTags: rec(count, isMisconceptionKey),
  misconceptions: rec(misconceptionState, isMisconceptionKey),
  economy: obj({
    perler: count, xp: count, level: num({ int: true, min: 1 }), eggWarmth: num({ min: 0 }), eggsHatched: count,
    eggSpecies: nullable(oneOf(SPECIES_IDS)), wish: nullable(oneOf(Object.keys(ITEM_BY_ID))),
  }),
  animals: arr(animal),
  buddyUid: nullable(id),
  inventory: rec(obj({ at: time, colors: arr(oneOf([0, 1, 2]), { max: 3 }) }), isItemKey),
  decor: rec(obj({ at: time, x: num(), y: num() }), isDecorKey),
  achievements: rec(time, isTrophyKey),
  goals: obj({
    day: dayOrEmpty,
    list: arr(obj({ kind: oneOf(['mix', 'revisit', 'streak5', 'write10', 'stars3']), need: count, progress: count, done: bool }, { region: str({ re: REGION_RE }) })),
  }),
  stamps: count,
  daysPlayed: count,
  lastLearningDay: nullable(day),
  demosSeen: rec(count, isTaskKindKey),
  instructionsHeard: rec(count, isTaskKindKey),
  recentFirstTries: arr(bool),
  round: nullable(roundSnapshot),
  rewardLog: arr(obj({
    ts: time, kind: oneOf(['animal', 'item', 'perler', 'stars', 'medal', 'trophy', 'level', 'growth', 'decor', 'recolor']),
    what: str({ max: 200 }), why: str({ max: 200 }),
  })),
})

export const answerLogEntry = obj(
  {
    profileId: id, ts: time, day, sessionId: id, roundId: id, nodeId: id,
    mode: oneOf(['round', 'trial', 'placement', 'golden', 'practice', 'hut', 'retry']),
    skill, family: str({ max: 100 }), factId: id, masteryKey: id, kind, optionsCount: count, production: bool,
    given: answerValue, answer: answerValue, correct: bool, ms: num({ min: 0, max: 120_000 }), fast: bool,
    errorTag: nullable(errorTag), detectable: arr(misconception), boxBefore: box, boxAfter: box, scaffold: bool,
    replays: count, retryOf: nullable(str()), assisted: bool, audioUnverified: bool,
  },
  { seq: count },
)

export const dailyAggregate = obj({
  profileId: id, day, learnMs: time, playMs: time, sessions: count, rounds: count, answers: count, firstTryCorrect: count,
  bySkill: rec(obj({ n: count, correct: count, fast: count, nProd: count, msHist: arr(count, { len: 7 }), errors: rec(count, isMisconceptionKey) }), isSkillKey),
  snapshot: rec(obj({
    meanBox: num({ min: 0, max: 5 }), share2: num({ min: 0, max: 1 }), share4: num({ min: 0, max: 1 }),
    status: oneOf(['notStarted', 'practising', 'support', 'silver', 'independent']),
  }), isSkillKey),
  trialsPassed: arr(trialId),
})
