import type { AnswerValue, KeyState, MasteryKey, MisconceptionId, ProfileDoc, Rng, SkillId, Task, TaskKind } from './types'
import { isDue } from './mastery'
import type { Operation } from './tasks'

/**
 * Round composition, ported from V1 and extended to SPEC §5.4.
 *
 * The first task is always one the child can already do: a child who gets the first question right
 * settles in, and a child who gets it wrong is already deciding they are bad at maths. V1 mixed
 * roughly 2 solid / 5 shaky / 3 new in shuffled order; V2 fills named slots (opener, shaky, new,
 * review from another skill, a task aimed at a flagged misconception) and lays them out as an arc:
 * easy warm-up, new material and typed answers in the middle, and a likely success to finish on.
 *
 * Variety (review r1 P2-11: the first rounds asked "1" four or five times, mostly on cards). Inside
 * the slots and caps of SPEC §5.4 a round is spread three ways, all from the plan's seed:
 * - new keys take turns between the node's skills, each skill in its own rank order (Fact.rank is
 *   "easy → hard within the skill"), and a new key whose answer the round already has twice waits
 *   for a later round while another one can come;
 * - "35 % of the time one of the other kinds" is a share of each round, not a coin per task: of the
 *   tasks free to vary, that share is asked another way, the other kinds taking turns;
 * - the same answer is not asked twice in a row, and repeats go to the answers asked least.
 */

/** Asked "the hard way" (production) once guessable tasks have carried a key this far. */
export const GUESSABLE_CEILING = 3

/** New keys per skill and per learning day: long sessions turn to consolidation, not more new material. */
export const NEW_PER_SKILL = 8
export const NEW_PER_DAY = 20

/** At most this many tasks of a round share an answer while another key can be asked instead. */
export const SAME_ANSWER_MAX = 2

/**
 * With today's allowance of new keys used up (UI-fund 10, 16), a round asks no key more often than
 * this. The round is filled with the region's own seen keys, then the chain's, then review; a round
 * that runs out of those is shorter rather than "1 + ? = 2" five times.
 */
export const CAPPED_REPEAT_MAX = 2
/**
 * A node the child has never played, reached after the allowance is used up, gets a taste of its
 * first keys (TASTE_KEYS) in a round of review — at most TASTE_PER_DAY such keys a learning day, so
 * a long session still turns to consolidation and never into new material node after node.
 */
export const TASTE_KEYS = 2
export const TASTE_PER_DAY = 4
/** Share of the tasks free to vary that are asked in another kind than the node's house kind (SPEC §5.4). */
export const OTHER_KIND_SHARE = 0.35

/** One mastery key the round may ask, with how to present it. */
export interface KeyOption {
  key: MasteryKey
  skill: SkillId
  rank: number
  /** Usable kinds for this key, the node's house kind first. */
  kinds: readonly TaskKind[]
  /** The kinds among `kinds` that count as production for this skill. */
  production: readonly TaskKind[]
  build(kind: TaskKind, rng: Rng, occurrence: number, extra?: BuildExtra): Task
  family?: string
  /** Misconceptions this key's tasks can reveal (the targeted slot looks for flagged ones). */
  detectable?: readonly MisconceptionId[]
  /** Arithmetic operation, for "at most three in a row" in mixed nodes. */
  op?: Operation | null
  /** The region only uses this skill for review: never introduced as new here. */
  reviewOnly?: boolean
  /** The answer every task of this key has (a recall fact), so a round can spread over numbers. */
  answer?: AnswerValue
}

export interface BuildExtra {
  /** Targeted slot: show the flagged misconception's candidate as the diagnostic card. */
  target?: readonly MisconceptionId[]
}

/** How many tasks each slot gets (SPEC §5.4). The opener is one of the `secure` ones. */
export interface SlotPlan { secure: number; shaky: number; fresh: number; review: number; targeted: number }

/** normal · fatigue (under 50 % first tries over the last 10) · warm (after 10 quick right answers). */
export type RoundTone = 'normal' | 'fatigue' | 'warm'

/** New keys still allowed today. */
export interface NewCaps {
  total: number
  /** Per skill; a skill that is missing has the full NEW_PER_SKILL left. */
  perSkill: Partial<Record<SkillId, number>>
  /** Keys still allowed today as a taste of a node never played, past the allowance (default TASTE_PER_DAY). */
  taste?: number
}

export interface RoundOptions {
  keys: readonly KeyOption[]
  states: Readonly<Record<MasteryKey, KeyState>>
  roundIndex: number
  /** Learning day, for due-ness. */
  day: string
  size: number
  rng: Rng
  /** 'fromBox1': the "Skriv selv" node asks for production from box 1. 'only': trials and placement. */
  production?: 'normal' | 'fromBox1' | 'only'
  /** SPEC §5.4 slots (see slotPlan). Without them the round is V1's 2/5/3 mix in shuffled order. */
  slots?: SlotPlan
  /** 'fatigue' asks on cards wherever a key allows it. */
  tone?: RoundTone
  /** Keys from other unlocked skills, for the review slot. */
  reviewKeys?: readonly KeyOption[]
  /**
   * With the allowance used up, the round is filled from these, in this order, before `reviewKeys`
   * (only their seen keys, each asked once): the keys of the node's region (its other nodes), the
   * keys of the regions in the same chain, and — after review — every key of the skills the child has
   * started, shaky ones too.
   */
  regionKeys?: readonly KeyOption[]
  chainKeys?: readonly KeyOption[]
  startedKeys?: readonly KeyOption[]
  /** Flagged misconceptions (concept or slip), for the targeted slot. */
  flagged?: readonly MisconceptionId[]
  /** New keys still allowed today; omitted means no cap. */
  newCaps?: NewCaps
  /** Keys to ask before anything else of their kind (Træningshytte: the families missed in the trial). */
  focus?: ReadonlySet<MasteryKey>
  /**
   * A map stone: its own keys (`keys` that are not review-only) are at least this share of a round
   * today's allowance did not stop, repeated where it has too few, before other skills' review fills
   * the rest (QA3c P2-1, SPEC A15). Omitted: no share is kept (Blandet øvelse, the hut).
   */
  ownShareMin?: number
  /** Filled in by buildRound: whether today's allowance of new keys stopped the round (A13). */
  report?: { capped: boolean }
}

export function pickKind(opt: KeyOption, state: KeyState | undefined, rng: Rng, mode: RoundOptions['production'] = 'normal'): TaskKind {
  if (opt.kinds.length === 0) return 'choice'
  const free = opt.kinds.filter((k) => opt.production.includes(k))
  if (mode === 'only') return free[0] ?? opt.kinds[0]

  // A key that has gone as far as guessable tasks can carry it gets asked the hard way, so the
  // child can show they know the answer rather than recognise it: cards while it is new, keypad
  // once it is nearly there.
  const threshold = mode === 'fromBox1' ? 1 : GUESSABLE_CEILING
  if ((state?.box ?? 0) >= threshold && free.length > 0) return free[0]

  // the house kind most of the time; the others often enough that a round never feels like a worksheet
  if (opt.kinds.length === 1 || rng.next() > 0.35) return opt.kinds[0]
  return rng.pick(opt.kinds.slice(1))
}

/**
 * Slot counts for a round of `size` (SPEC §5.4). `review` is the node's review share: 1 on normal
 * nodes, 3 on mix nodes ("7 fra regionen + 3 review").
 */
export function slotPlan(size: number, tone: RoundTone = 'normal', review = 1): SlotPlan {
  if (tone === 'fatigue') {
    const secure = Math.round(size * 0.4)
    return { secure, shaky: Math.max(0, size - secure - 1), fresh: 1, review: 0, targeted: 0 }
  }
  if (tone === 'warm') {
    const fresh = Math.round(size * 0.4)
    const r = Math.max(1, review)
    return { secure: 1, shaky: Math.max(0, size - 1 - fresh - r), fresh, review: r, targeted: 0 }
  }
  const fresh = review > 1 ? 1 : Math.max(1, Math.round(size * 0.2))
  return { secure: 1, shaky: Math.max(0, size - 2 - fresh - review), fresh, review, targeted: 1 }
}

/** What is left of today's allowance of new keys (profile.newToday resets on a new learning day). */
export function newCapsFor(newToday: ProfileDoc['newToday'], day: string): NewCaps {
  if (newToday.day !== day) return { total: NEW_PER_DAY, perSkill: {}, taste: TASTE_PER_DAY }
  const perSkill: Partial<Record<SkillId, number>> = {}
  for (const skill of Object.keys(newToday.perSkill) as SkillId[]) {
    perSkill[skill] = Math.max(0, NEW_PER_SKILL - (newToday.perSkill[skill] ?? 0))
  }
  // keys tasted past the allowance count on in newToday.total (20, 22, 24 …)
  const taste = Math.max(0, TASTE_PER_DAY - Math.max(0, newToday.total - NEW_PER_DAY))
  return { total: Math.max(0, NEW_PER_DAY - newToday.total), perSkill, taste }
}

export function buildRound(opts: RoundOptions): Task[] {
  if (opts.slots) return buildArcRound(opts, opts.slots)
  const { keys, states, roundIndex, day, size, rng, production = 'normal' } = opts
  const secure: KeyOption[] = []
  const shaky: KeyOption[] = []
  const fresh: KeyOption[] = []

  for (const k of keys) {
    const st = states[k.key]
    if (!st || st.seen === 0) fresh.push(k)
    else if (st.box >= 3) secure.push(k)
    else shaky.push(k)
  }
  // a solid key that has rested long enough is worth revisiting
  const dueSecure = secure.filter((k) => isDue(states[k.key], roundIndex, day))
  const restingSecure = secure.filter((k) => !isDue(states[k.key], roundIndex, day))

  const st = (k: KeyOption) => states[k.key]
  secure.sort((x, y) => st(y).box - st(x).box || st(x).lastRound - st(y).lastRound)
  shaky.sort((x, y) => st(x).box - st(y).box || st(x).lastRound - st(y).lastRound)
  fresh.sort((x, y) => x.rank - y.rank)

  const wantSecure = Math.max(1, Math.round(size * 0.2))
  const wantShaky = Math.round(size * 0.5)
  const wantFresh = size - wantSecure - wantShaky

  const chosen: KeyOption[] = []
  const taken = new Set<string>()
  const take = (pool: readonly KeyOption[], n: number) => {
    for (const k of pool) {
      if (n <= 0) break
      if (taken.has(k.key)) continue
      taken.add(k.key)
      chosen.push(k)
      n--
    }
  }

  take(secure, wantSecure)
  take(shaky.concat(dueSecure), wantShaky)
  take(fresh, wantFresh)
  // backfill in order of usefulness if a bucket ran dry
  take(shaky, size - chosen.length)
  take(fresh, size - chosen.length)
  take(dueSecure, size - chosen.length)
  take(restingSecure, size - chosen.length)
  take(keys, size - chosen.length)

  const secureKeys = new Set(secure.map((k) => k.key))
  const opener = chosen.find((k) => secureKeys.has(k.key)) ?? chosen.slice().sort((x, y) => x.rank - y.rank)[0]

  const rest = rng.shuffle(chosen.filter((k) => k !== opener))
  const ordered = opener ? [opener, ...rest] : rest

  // Early nodes hold only a handful of keys — counting to five is five facts. Repeating them inside
  // one round is the practice, not padding. Never back to back, though: that reads as a glitch.
  padToSize(ordered, keys, size, rng)

  const tasks = ordered.map((k, i) => k.build(pickKind(k, states[k.key], rng, production), rng, i))
  return balanceAnswerPositions(tasks, rng)
}

function padToSize(ordered: KeyOption[], keys: readonly KeyOption[], size: number, rng: Rng): void {
  if (keys.length === 0) return
  let guard = size * 8
  while (ordered.length < size && guard-- > 0) {
    for (const k of rng.shuffle(keys)) {
      if (ordered.length >= size) break
      if (ordered[ordered.length - 1]?.key === k.key) continue
      ordered.push(k)
    }
  }
  // last resort for a single-key pool: allow the repeat rather than a short round
  while (ordered.length < size) ordered.push(keys[0])
}

// ─── V2: slots and the arc (SPEC §5.4) ──────────────────────────────────────

type Slot = 'opener' | 'secure' | 'shaky' | 'fresh' | 'review' | 'targeted' | 'repeat'
interface Pick { opt: KeyOption; slot: Slot; kind: TaskKind }

function buildArcRound(o: RoundOptions, plan: SlotPlan): Task[] {
  const { keys, states, roundIndex, day, size, rng } = o
  const production = o.production ?? 'normal'
  const focus = o.focus ?? new Set<MasteryKey>()
  const st = (k: KeyOption) => states[k.key]
  // a key seeded by placement has not been answered, but it is not new material either
  const seen = (k: KeyOption) => {
    const s = st(k)
    return !!s && (s.seen > 0 || s.seeded)
  }
  const box = (k: KeyOption) => st(k)?.box ?? 0
  const due = (k: KeyOption) => seen(k) && isDue(st(k), roundIndex, day)
  const first = (a: KeyOption, b: KeyOption) => Number(focus.has(b.key)) - Number(focus.has(a.key))
  const dueFirst = (a: KeyOption, b: KeyOption) => Number(due(b)) - Number(due(a))

  // In a node that mixes operations, each bucket alternates plus and minus within its priority tier,
  // so the round is mixed in what it asks, not only in the order it asks it.
  const tierOf = (k: KeyOption) => `${Number(focus.has(k.key))}${Number(due(k))}`
  const secure = alternateOps(keys.filter((k) => seen(k) && box(k) >= 3)
    .sort((a, b) => first(a, b) || dueFirst(a, b) || box(b) - box(a) || st(a).lastRound - st(b).lastRound), tierOf)
  const shaky = alternateOps(keys.filter((k) => seen(k) && box(k) < 3)
    .sort((a, b) => first(a, b) || dueFirst(a, b) || box(a) - box(b) || st(a).lastRound - st(b).lastRound), tierOf)
  // New keys in rank order within their skill (Fact.rank is "easy → hard within the skill"); the
  // node's skills take turns (takeFresh), and plus and minus alternate inside a skill.
  const freshTier = (k: KeyOption) => String(Number(focus.has(k.key)))
  const freshSorted = keys.filter((k) => !seen(k) && !k.reviewOnly).sort((a, b) => first(a, b) || a.rank - b.rank)
  const fresh = alternateOps(alternateBy(freshSorted, freshTier, (k) => k.skill), freshTier)
  const freshBySkill = [...new Set(freshSorted.map((k) => k.skill))]
    .map((skill) => alternateOps(freshSorted.filter((k) => k.skill === skill), freshTier))
  const dueSecure = secure.filter(due)

  // today's allowance of new keys
  let totalLeft = o.newCaps ? o.newCaps.total : Number.POSITIVE_INFINITY
  const skillLeft = new Map<SkillId, number>()
  const capOf = (skill: SkillId) =>
    o.newCaps ? skillLeft.get(skill) ?? o.newCaps.perSkill[skill] ?? NEW_PER_SKILL : Number.POSITIVE_INFINITY

  const picks: Pick[] = []
  const taken = new Set<MasteryKey>()
  // how many tasks of the round have each answer so far
  const answers = new Map<AnswerValue, number>()
  const uses = (k: KeyOption) => (k.answer === undefined ? 0 : answers.get(k.answer) ?? 0)
  const take = (k: KeyOption | undefined, slot: Slot, ignoreCaps = false): boolean => {
    if (!k || taken.has(k.key)) return false
    if (!seen(k)) {
      if (k.reviewOnly) return false
      if (!ignoreCaps && (totalLeft <= 0 || capOf(k.skill) <= 0)) return false
      totalLeft--
      skillLeft.set(k.skill, capOf(k.skill) - 1)
      slot = slot === 'opener' ? slot : 'fresh'
    }
    taken.add(k.key)
    picks.push({ opt: k, slot, kind: 'choice' })
    if (k.answer !== undefined) answers.set(k.answer, uses(k) + 1)
    return true
  }
  // Keys in the pool's order, but one whose answer the round already has twice waits while another
  // key of the pool can come instead.
  const takeN = (pool: readonly KeyOption[], n: number, slot: Slot): number => {
    let got = 0
    for (const spread of [true, false]) {
      for (const k of pool) {
        if (got >= n) break
        if (spread && uses(k) >= SAME_ANSWER_MAX) continue
        if (take(k, slot)) got++
      }
    }
    return got
  }
  // New keys: the skills take turns, each with its next key in order — but a key whose answer the
  // round already has twice waits for a later round while another new key can come (the first
  // rounds asked "1" four or five times).
  const takeFresh = (n: number): number => {
    let got = 0
    for (const spread of [true, false]) {
      for (let moved = true; moved && got < n;) {
        moved = false
        for (const queue of freshBySkill) {
          if (got >= n) break
          const k = queue.find((x) => !taken.has(x.key) && (!spread || uses(x) < SAME_ANSWER_MAX))
          if (k && take(k, 'fresh')) {
            got++
            moved = true
          }
        }
      }
    }
    return got
  }

  // review: keys from other skills the child has met (the review slot and the last backfill)
  const nodeSkills = new Set(keys.filter((k) => !k.reviewOnly).map((k) => k.skill))
  const others = [...(o.reviewKeys ?? []), ...keys.filter((k) => k.reviewOnly)].filter((k) => !nodeSkills.has(k.skill) && seen(k))

  // Today's allowance of new keys is used up when every new key the node has left is blocked by it
  // (UI-fund 10, 16). Only a round that wants new keys can be stopped by it (not practice or the hut).
  const blocked = (k: KeyOption) => totalLeft <= 0 || capOf(k.skill) <= 0
  const isCapped = (): boolean => {
    const left = fresh.filter((k) => !taken.has(k.key))
    return !!o.newCaps && plan.fresh > 0 && left.length > 0 && left.every(blocked)
  }
  // then the round is filled from the region's own seen keys and the chain's, most needed first
  const nodeKeySet = new Set(keys.map((k) => k.key))
  const byNeed = (a: KeyOption, b: KeyOption) => Number(due(b)) - Number(due(a)) || box(a) - box(b) || st(a).lastRound - st(b).lastRound
  const seenOf = (pool: readonly KeyOption[] | undefined) => (pool ?? []).filter((k) => seen(k) && !nodeKeySet.has(k.key)).sort(byNeed)
  // read only when the allowance is used up (plan.ts builds these pools on demand)
  let regionSeen: KeyOption[] | null = null
  let chainSeen: KeyOption[] | null = null
  const fromRegion = () => (regionSeen ??= seenOf(o.regionKeys))
  const fromChain = () => (chainSeen ??= seenOf(o.chainKeys))
  // A node never played, reached with the allowance used up, is not a round of other regions'
  // review only: it gets a taste of its first keys (TASTE_KEYS, within the day's TASTE_PER_DAY)
  const tasteLeft = o.newCaps?.taste ?? TASTE_PER_DAY
  const tasting = isCapped() && !keys.some(seen) && tasteLeft > 0
  const taste = tasting ? fresh.slice(0, Math.min(TASTE_KEYS, tasteLeft)) : []
  // today's allowance stops the round before it starts (or once it has taken what was left, below)
  const cappedAtStart = isCapped()
  // the stone's own keys: its skills, not the ones it only reviews (PlannedRound.ownShare)
  const isOwn = (k: KeyOption) => nodeKeySet.has(k.key) && !k.reviewOnly
  const ownOf = () => picks.filter((p) => isOwn(p.opt)).length

  /**
   * Picks the round's keys, from the opener to the repeats; false for an empty round. `ownFirst`
   * (QA3c P2-1, SPEC A15): the stone's own keys come before other skills' review — the keys a node
   * only reviews wait with the rest of review, and the own keys are repeated until they are
   * `ownShareMin` of the round before review fills it. Only a round that came out under that share
   * without today's allowance stopping it is picked again this way; every other round is as before.
   */
  function pickKeys(ownFirst: boolean): { capped: boolean } | false {
    totalLeft = o.newCaps ? o.newCaps.total : Number.POSITIVE_INFINITY
    skillLeft.clear()
    picks.length = 0
    taken.clear()
    answers.clear()
    const mine = (pool: readonly KeyOption[]) => (ownFirst ? pool.filter((k) => !k.reviewOnly) : pool)
    const shakyKeys = mine(shaky)
    const secureKeys = mine(secure)
    const dueSecureKeys = mine(dueSecure)

    // opener: the most secure key, else the lowest rank (a taste opens on the surest key around)
    const opener = secure.length > 0
      ? [...secure].sort((a, b) => box(b) - box(a) || st(b).correct - st(a).correct || a.rank - b.rank)[0]
      : [...keys].filter((k) => seen(k) || (!k.reviewOnly && totalLeft > 0 && capOf(k.skill) > 0)).sort((a, b) => a.rank - b.rank)[0]
        ?? (tasting ? [...fromRegion(), ...fromChain(), ...others].filter((k) => box(k) >= 3).sort((a, b) => box(b) - box(a) || st(b).correct - st(a).correct)[0] ?? taste[0] : undefined)
    take(opener, 'opener', !!opener && taste.includes(opener))
    for (const k of taste) take(k, 'fresh', true)
    // A child who has met nothing here yet ends the round on the opener again (the last task is never
    // a first meeting): its answer is asked twice.
    const nothingSeen = !keys.some(seen) && !(o.reviewKeys ?? []).some(seen)
    if (nothingSeen && opener?.answer !== undefined) answers.set(opener.answer, uses(opener) + 1)

    // the keys the round is for (the hut's missed families) come first, weakest first
    let shakyWant = plan.shaky
    if (focus.size > 0) shakyWant -= takeN(keys.filter((k) => focus.has(k.key) && seen(k)).sort((a, b) => box(a) - box(b)), shakyWant, 'shaky')

    // targeted: a task that can show a flagged misconception, else one more shaky key
    if (plan.targeted > 0) {
      const flagged = o.flagged ?? []
      const aim = flagged.length > 0 ? [...shakyKeys, ...secureKeys].filter((k) => k.detectable?.some((m) => flagged.includes(m))) : []
      shakyWant += plan.targeted - takeN(aim, plan.targeted, 'targeted')
    }

    const got = takeN(shakyKeys, shakyWant, 'shaky')
    takeN(dueSecureKeys, shakyWant - got, 'secure')
    takeFresh(plan.fresh)

    // review: a due key the child is sure of, from another skill — spacing across the curriculum
    const reviewPool = others.filter((k) => box(k) >= 3 && due(k)).sort((a, b) => st(a).lastRound - st(b).lastRound || box(b) - box(a))
    takeN(reviewPool, plan.review, 'review')
    takeN(secureKeys, plan.secure - 1, 'secure')

    // backfill in order of usefulness; a tired child gets the sure things first
    const backfill: [readonly KeyOption[], Slot][] = o.tone === 'fatigue'
      ? [[secureKeys, 'secure'], [shakyKeys, 'shaky'], [fresh, 'fresh']]
      : [[shakyKeys, 'shaky'], [fresh, 'fresh'], [dueSecureKeys, 'secure'], [secureKeys, 'secure']]
    for (const [pool, slot] of backfill) {
      if (pool === fresh) takeFresh(size - picks.length)
      else takeN(pool, size - picks.length, slot)
    }
    // With the allowance used up, the region's own seen keys come next, then the chain's; review after
    // them, and last every seen key of the started skills (consolidation, shaky ones too).
    const capped = isCapped()
    if (capped) {
      takeN(fromRegion().filter((k) => box(k) < 3), size - picks.length, 'shaky')
      takeN(fromRegion().filter((k) => box(k) >= 3), size - picks.length, 'secure')
      takeN(fromChain(), size - picks.length, 'review')
    }
    const repeated = new Map<MasteryKey, number>()
    const again = (p: Pick) => repeated.get(p.opt.key) ?? 0
    const repeat = (cycle: readonly Pick[], more: () => boolean = () => true) => {
      while (picks.length < size && more()) {
        // with the allowance used up a key is asked at most CAPPED_REPEAT_MAX times: a shorter round
        // rather than the same question again and again (UI-fund 16)
        // (every key of the cycle is in the round once, plus its repeats)
        const open = capped ? cycle.filter((p) => 1 + again(p) < CAPPED_REPEAT_MAX) : cycle
        if (open.length === 0) break
        // the answer asked least so far, then the key repeated least, then the cycle's order
        const opt = open.reduce((best, p) => (uses(p.opt) < uses(best.opt) || (uses(p.opt) === uses(best.opt) && again(p) < again(best)) ? p : best)).opt
        picks.push({ opt, slot: 'repeat', kind: 'choice' })
        repeated.set(opt.key, (repeated.get(opt.key) ?? 0) + 1)
        if (opt.answer !== undefined) answers.set(opt.answer, uses(opt) + 1)
      }
    }
    if (ownFirst) {
      // a stone with few keys of its own asks them again (each time another way where it can)
      const want = Math.ceil((o.ownShareMin ?? 0) * size)
      const own = picks.filter((p) => isOwn(p.opt))
      repeat([...rng.shuffle(own.filter((p) => p.slot !== 'opener')), ...own.filter((p) => p.slot === 'opener')], () => ownOf() < want)
    }
    takeN([...others].sort((a, b) => Number(due(b)) - Number(due(a)) || box(b) - box(a)), size - picks.length, 'review')
    if (capped) takeN(seenOf(o.startedKeys), size - picks.length, 'review')

    // A round is never empty: with today's allowance used up and nothing else to ask, the node's
    // first keys are introduced anyway.
    if (picks.length === 0) for (const k of fresh.slice(0, Math.min(2, size))) take(k, picks.length ? 'fresh' : 'opener', true)
    if (picks.length === 0) return false

    // Early nodes hold only a handful of keys. Repeating them inside one round is the practice, not
    // padding; a repeat is shown another way where the key allows it, and the answers asked least
    // are repeated first. (A round with repeats ends on one of them, not on the opener again.)
    if (nothingSeen && picks.length < size && opener?.answer !== undefined) answers.set(opener.answer, uses(opener) - 1)
    const originals = rng.shuffle(picks.filter((p) => p.slot !== 'opener' && p.slot !== 'repeat'))
    repeat(originals.length > 0 ? [...originals, picks[0]] : [picks[0]])
    return { capped }
  }

  let picked = pickKeys(false)
  if (!picked) return []
  // A stone's own keys are at least half of a round today's allowance did not stop (QA3c P2-1, A15)
  if (o.ownShareMin !== undefined && !cappedAtStart && !picked.capped && keys.some((k) => !k.reviewOnly) && ownOf() < o.ownShareMin * picks.length) {
    picked = pickKeys(true)
    if (!picked) return []
  }
  if (o.report) o.report.capped = cappedAtStart || picked.capped

  // Kinds. Some are given: trials and the opener on cards, a tired child on cards, a key far enough
  // asked the hard way. Of the rest, OTHER_KIND_SHARE are asked in one of the node's other kinds,
  // which take turns; a repeat is asked another way than the key's first task.
  const threshold = production === 'fromBox1' ? 1 : GUESSABLE_CEILING
  const usedKinds = new Map<TaskKind, number>()
  const firstKind = new Map<MasteryKey, TaskKind>()
  const settle = (p: Pick, kind: TaskKind) => {
    p.kind = kind
    usedKinds.set(kind, (usedKinds.get(kind) ?? 0) + 1)
    if (!firstKind.has(p.opt.key)) firstKind.set(p.opt.key, kind)
  }
  const leastUsed = (kinds: readonly TaskKind[]): TaskKind =>
    rng.shuffle(kinds).reduce((best, k) => ((usedKinds.get(k) ?? 0) < (usedKinds.get(best) ?? 0) ? k : best))
  const varying: Pick[] = []
  for (const p of picks) {
    if (p.slot === 'repeat') continue
    const given = givenKind(p)
    if (given) settle(p, given)
    else varying.push(p)
  }
  const other = new Set(rng.shuffle(varying).slice(0, Math.round(varying.length * OTHER_KIND_SHARE)))
  for (const p of varying) settle(p, other.has(p) ? leastUsed(p.opt.kinds.slice(1)) : p.opt.kinds[0])
  for (const p of picks) if (p.slot === 'repeat') settle(p, repeatKind(p))

  const mixed = new Set(picks.map((p) => p.opt.op).filter(Boolean)).size >= 2
  const seq = interleave(arrange(picks, box), mixed)
  repair(seq, mixed)

  const tasks = seq.map((p, i) => p.opt.build(p.kind, rng, i, p.slot === 'targeted' ? { target: o.flagged ?? [] } : undefined))
  return balanceAnswerPositions(tasks, rng)

  /** The kind a task must have, or null when it is free to vary. */
  function givenKind(p: Pick): TaskKind | null {
    const kinds = p.opt.kinds
    if (kinds.length === 0) return 'choice'
    if (production === 'only') return pickKind(p.opt, st(p.opt), rng, 'only')
    if (p.slot === 'opener' && kinds.includes('choice')) return 'choice'
    if (o.tone === 'fatigue' && kinds.includes('choice')) return 'choice'
    const hard = kinds.filter((k) => p.opt.production.includes(k))
    if (box(p.opt) >= threshold && hard.length > 0) return hard[0]
    return kinds.length === 1 ? kinds[0] : null
  }

  /** A repeat is shown another way than the key's first task (the least used way that is allowed). */
  function repeatKind(p: Pick): TaskKind {
    const kinds = p.opt.kinds
    if (kinds.length === 0) return 'choice'
    if (production === 'only') return pickKind(p.opt, st(p.opt), rng, 'only')
    if (o.tone === 'fatigue' && kinds.includes('choice')) return 'choice'
    const hard = kinds.filter((k) => p.opt.production.includes(k))
    const allowed = box(p.opt) >= threshold && hard.length > 0 ? hard : kinds
    const earlier = firstKind.get(p.opt.key)
    const others = allowed.filter((k) => k !== earlier)
    return others.length > 0 ? leastUsed(others) : allowed[0]
  }
}

/**
 * The arc (SPEC §5.4): 1 the opener · 2–4 warm-up · 5–7 new keys and typed answers · 8–9 build-up ·
 * last the second most secure key, never a first meeting — the round ends on a likely success.
 */
function arrange(picks: readonly Pick[], box: (k: KeyOption) => number): Pick[] {
  const n = picks.length
  if (n <= 1) return [...picks]
  const opener = picks[0]
  const rest = picks.slice(1)
  const order: Record<Slot, number> = { secure: 0, review: 1, opener: 2, shaky: 3, targeted: 4, repeat: 5, fresh: 6 }
  const closers = rest.filter((p) => p.slot !== 'fresh')
    .sort((a, b) => box(b.opt) - box(a.opt) || order[a.slot] - order[b.slot] || a.opt.rank - b.opt.rank)
  const last = closers[0] ?? { ...opener, slot: 'repeat' as const }
  const middle = closers[0] ? rest.filter((p) => p !== last) : rest.slice(0, -1)

  // new keys keep the order they were taken in (each skill in rank order, the skills taking turns)
  const taken = (p: Pick) => picks.indexOf(p)
  const isTop = (p: Pick) => p.slot === 'fresh' || p.slot === 'targeted' || p.opt.production.includes(p.kind)
  const top = middle.filter(isTop).sort((a, b) => Number(b.slot === 'fresh') - Number(a.slot === 'fresh') ||
    (a.slot === 'fresh' && b.slot === 'fresh' ? taken(a) - taken(b) : a.opt.rank - b.opt.rank))
  const warm = middle.filter((p) => !isTop(p)).sort((a, b) => box(b.opt) - box(a.opt))
  const m = middle.length
  const warmN = Math.round((m * 3) / 8)
  const topN = Math.round((m * 3) / 8)
  const seq: Pick[] = [opener]
  for (let i = 0; i < m; i++) {
    let p: Pick | undefined
    if (i < warmN) {
      const j = top.findIndex((x) => x.slot !== 'fresh')
      p = warm.shift() ?? (j >= 0 ? top.splice(j, 1)[0] : top.shift())
    } else if (i < warmN + topN) p = top.shift() ?? warm.shift()
    else p = top.shift() ?? warm.shift()
    seq.push(p!)
  }
  seq.push(last)
  return seq
}

/**
 * Reorder a sorted list so that, inside each run of equal `tier`, the operations take turns
 * (+, −, +, − …) while each operation keeps its own order. Lists with one operation are unchanged.
 */
function alternateOps(sorted: readonly KeyOption[], tier: (k: KeyOption) => string): KeyOption[] {
  return alternateBy(sorted, tier, (k) => k.op ?? '')
}

/**
 * Reorder a sorted list so that, inside each run of equal `tier`, the groups take turns (+, −, +, −
 * …; one skill, the next skill …) while each group keeps its own order. One group: unchanged.
 */
function alternateBy(sorted: readonly KeyOption[], tier: (k: KeyOption) => string, groupOf: (k: KeyOption) => string): KeyOption[] {
  if (new Set(sorted.map(groupOf)).size < 2) return [...sorted]
  const out: KeyOption[] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j < sorted.length && tier(sorted[j]) === tier(sorted[i])) j++
    const groups = new Map<string, KeyOption[]>()
    for (const k of sorted.slice(i, j)) {
      const g = groups.get(groupOf(k))
      if (g) g.push(k)
      else groups.set(groupOf(k), [k])
    }
    const queues = [...groups.values()]
    for (let taken = 0; taken < j - i;) {
      for (const q of queues) {
        const k = q.shift()
        if (k) {
          out.push(k)
          taken++
        }
      }
    }
    i = j
  }
  return out
}

const opOf = (p: Pick): Operation | null => p.opt.op ?? null

/** Length of the run of `p`'s operation if it followed `list` (0 when it has none). */
function runWith(list: readonly Pick[], p: Pick): number {
  const op = opOf(p)
  if (op === null) return 0
  let run = 1
  for (let i = list.length - 1; i >= 0 && opOf(list[i]) === op; i--) run++
  return run
}

/**
 * Can `rest` still follow `list` with at most three of an operation in a row? Each other item is a
 * gap that holds up to three, and the gap right after `list` holds less if `list` already ends on a run.
 */
function canFinish(list: readonly Pick[], rest: readonly Pick[]): boolean {
  const tailOp = list.length > 0 ? opOf(list[list.length - 1]) : null
  let tail = 0
  for (let i = list.length - 1; i >= 0 && tailOp !== null && opOf(list[i]) === tailOp; i--) tail++
  const counts = new Map<Operation, number>()
  for (const p of rest) {
    const op = opOf(p)
    if (op !== null) counts.set(op, (counts.get(op) ?? 0) + 1)
  }
  for (const [op, m] of counts) {
    if (m > 3 * (rest.length - m) + (op === tailOp ? 3 - tail : 3)) return false
  }
  return true
}

/**
 * Lay the middle of the arc out again, in its own order, taking at each place the first item that
 * keeps the key from repeating, keeps an operation to three in a row, and still leaves a way to place
 * the rest (the opener and the closer stay where they are). Stepping through in order keeps the arc;
 * looking ahead is what a swap-by-swap repair cannot do.
 */
function interleave(seq: readonly Pick[], mixed: boolean): Pick[] {
  const n = seq.length
  if (n <= 2) return [...seq]
  const last = seq[n - 1]
  const pool = seq.slice(1, n - 1)
  const out: Pick[] = [seq[0]]
  while (pool.length > 0) {
    const prev = out[out.length - 1]
    const fine = (p: Pick, i: number, strict: boolean): boolean => {
      if (p.opt.key === prev.opt.key) return false
      if (!strict) return true
      if (mixed && runWith(out, p) > 3) return false
      if (pool.length === 1) return p.opt.key !== last.opt.key && (!mixed || runWith([...out, p], last) <= 3)
      return !mixed || canFinish([...out, p], [...pool.filter((_, j) => j !== i), last])
    }
    // a different answer from the task before (and, for the last place, the one after) where it can be
    const varied = (p: Pick, i: number) =>
      fine(p, i, true) && !sameAnswer(p, prev) && (pool.length > 1 || !sameAnswer(p, last))
    let idx = pool.findIndex(varied)
    if (idx < 0) idx = pool.findIndex((p, i) => fine(p, i, true))
    if (idx < 0) idx = pool.findIndex((p, i) => fine(p, i, false) && (!mixed || runWith(out, p) <= 3))
    if (idx < 0) idx = pool.findIndex((p, i) => fine(p, i, false))
    out.push(pool.splice(Math.max(0, idx), 1)[0])
  }
  out.push(last)
  return out
}

/** Two tasks with the same answer (keys with a fixed answer only). */
const sameAnswer = (a: Pick, b: Pick) => a.opt.answer !== undefined && a.opt.answer === b.opt.answer

/**
 * Same key back to back reads as a glitch; four sums of one kind in a row invite wrongOperation; the
 * same answer twice in a row reads as a repeat (the lightest of the three).
 */
function badness(seq: readonly Pick[], mixed: boolean): number {
  let bad = 0
  let run = 0
  let prev: Operation | null | undefined
  for (let i = 0; i < seq.length; i++) {
    if (i > 0 && seq[i].opt.key === seq[i - 1].opt.key) bad += 20
    if (i > 0 && sameAnswer(seq[i], seq[i - 1])) bad += 1
    const op = seq[i].opt.op ?? null
    run = op !== null && op === prev ? run + 1 : 1
    prev = op
    if (mixed && op !== null && run > 3) bad += 2
  }
  return bad
}

/** Local repair by swaps, nearest first; the opener stays first and the last never becomes a first meeting. */
function repair(seq: Pick[], mixed: boolean): void {
  const n = seq.length
  let bad = badness(seq, mixed)
  for (let pass = 0; pass < 4 * n && bad > 0; pass++) {
    let improved = false
    for (let p = 1; p < n && bad > 0; p++) {
      const partners = Array.from({ length: n - 1 }, (_, i) => i + 1)
        .filter((j) => j !== p)
        .sort((a, b) => Math.abs(a - p) - Math.abs(b - p))
      for (const j of partners) {
        if ((j === n - 1 && seq[p].slot === 'fresh') || (p === n - 1 && seq[j].slot === 'fresh')) continue
        ;[seq[p], seq[j]] = [seq[j], seq[p]]
        const b = badness(seq, mixed)
        if (b < bad) {
          bad = b
          improved = true
          break
        }
        ;[seq[p], seq[j]] = [seq[j], seq[p]]
      }
    }
    if (!improved) break
  }
}

/**
 * Stop the right answer from sitting in the same slot over and over. Children spot that far faster
 * than adults expect, and then they stop reading the sums.
 */
export function balanceAnswerPositions(tasks: Task[], rng: Rng): Task[] {
  let run = 0
  let prevIndex = -1
  return tasks.map((task) => {
    const index0 = task.options.indexOf(task.answer)
    if (task.options.length === 0 || index0 < 0 || task.kind !== 'choice') {
      run = 0
      prevIndex = -1
      return task
    }
    let index = index0
    if (index === prevIndex) run++
    else run = 1

    if (run >= 3) {
      const others = task.options.map((_, i) => i).filter((i) => i !== index)
      const swapWith = rng.pick(others)
      const options = task.options.slice()
      ;[options[index], options[swapWith]] = [options[swapWith], options[index]]
      task = { ...task, options }
      index = swapWith
      run = 1
    }
    prevIndex = index
    return task
  })
}
