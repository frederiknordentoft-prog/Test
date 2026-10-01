import type { KeyState, MasteryKey, MisconceptionId, ProfileDoc, Rng, SkillId, Task, TaskKind } from './types'
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
 */

/** Asked "the hard way" (production) once guessable tasks have carried a key this far. */
export const GUESSABLE_CEILING = 3

/** New keys per skill and per learning day: long sessions turn to consolidation, not more new material. */
export const NEW_PER_SKILL = 8
export const NEW_PER_DAY = 20

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
  /** Flagged misconceptions (concept or slip), for the targeted slot. */
  flagged?: readonly MisconceptionId[]
  /** New keys still allowed today; omitted means no cap. */
  newCaps?: NewCaps
  /** Keys to ask before anything else of their kind (Træningshytte: the families missed in the trial). */
  focus?: ReadonlySet<MasteryKey>
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
  if (newToday.day !== day) return { total: NEW_PER_DAY, perSkill: {} }
  const perSkill: Partial<Record<SkillId, number>> = {}
  for (const skill of Object.keys(newToday.perSkill) as SkillId[]) {
    perSkill[skill] = Math.max(0, NEW_PER_SKILL - (newToday.perSkill[skill] ?? 0))
  }
  return { total: Math.max(0, NEW_PER_DAY - newToday.total), perSkill }
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
  const fresh = alternateOps(keys.filter((k) => !seen(k) && !k.reviewOnly).sort((a, b) => first(a, b) || a.rank - b.rank),
    (k) => String(Number(focus.has(k.key))))
  const dueSecure = secure.filter(due)

  // today's allowance of new keys
  let totalLeft = o.newCaps ? o.newCaps.total : Number.POSITIVE_INFINITY
  const skillLeft = new Map<SkillId, number>()
  const capOf = (skill: SkillId) =>
    o.newCaps ? skillLeft.get(skill) ?? o.newCaps.perSkill[skill] ?? NEW_PER_SKILL : Number.POSITIVE_INFINITY

  const picks: Pick[] = []
  const taken = new Set<MasteryKey>()
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
    return true
  }
  const takeN = (pool: readonly KeyOption[], n: number, slot: Slot): number => {
    let got = 0
    for (const k of pool) {
      if (got >= n) break
      if (take(k, slot)) got++
    }
    return got
  }

  // opener: the most secure key, else the lowest rank
  const opener = secure.length > 0
    ? [...secure].sort((a, b) => box(b) - box(a) || st(b).correct - st(a).correct || a.rank - b.rank)[0]
    : [...keys].filter((k) => seen(k) || (!k.reviewOnly && totalLeft > 0 && capOf(k.skill) > 0)).sort((a, b) => a.rank - b.rank)[0]
  take(opener, 'opener')

  // the keys the round is for (the hut's missed families) come first, weakest first
  let shakyWant = plan.shaky
  if (focus.size > 0) shakyWant -= takeN(keys.filter((k) => focus.has(k.key) && seen(k)).sort((a, b) => box(a) - box(b)), shakyWant, 'shaky')

  // targeted: a task that can show a flagged misconception, else one more shaky key
  if (plan.targeted > 0) {
    const flagged = o.flagged ?? []
    const aim = flagged.length > 0 ? [...shaky, ...secure].filter((k) => k.detectable?.some((m) => flagged.includes(m))) : []
    shakyWant += plan.targeted - takeN(aim, plan.targeted, 'targeted')
  }

  const got = takeN(shaky, shakyWant, 'shaky')
  takeN(dueSecure, shakyWant - got, 'secure')
  takeN(fresh, plan.fresh, 'fresh')

  // review: a due key the child is sure of, from another skill — spacing across the curriculum
  const nodeSkills = new Set(keys.filter((k) => !k.reviewOnly).map((k) => k.skill))
  const others = [...(o.reviewKeys ?? []), ...keys.filter((k) => k.reviewOnly)].filter((k) => !nodeSkills.has(k.skill) && seen(k))
  const reviewPool = others.filter((k) => box(k) >= 3 && due(k)).sort((a, b) => st(a).lastRound - st(b).lastRound || box(b) - box(a))
  takeN(reviewPool, plan.review, 'review')
  takeN(secure, plan.secure - 1, 'secure')

  // backfill in order of usefulness; a tired child gets the sure things first
  const backfill: [readonly KeyOption[], Slot][] = o.tone === 'fatigue'
    ? [[secure, 'secure'], [shaky, 'shaky'], [fresh, 'fresh']]
    : [[shaky, 'shaky'], [fresh, 'fresh'], [dueSecure, 'secure'], [secure, 'secure']]
  for (const [pool, slot] of backfill) takeN(pool, size - picks.length, slot)
  takeN([...others].sort((a, b) => Number(due(b)) - Number(due(a)) || box(b) - box(a)), size - picks.length, 'review')

  // A round is never empty: with today's allowance used up and nothing else to ask, the node's
  // first keys are introduced anyway.
  if (picks.length === 0) for (const k of fresh.slice(0, Math.min(2, size))) take(k, picks.length ? 'fresh' : 'opener', true)
  if (picks.length === 0) return []

  // Early nodes hold only a handful of keys. Repeating them inside one round is the practice, not
  // padding; a repeat is shown another way where the key allows it.
  const originals = rng.shuffle(picks.filter((p) => p.slot !== 'opener'))
  const cycle = originals.length > 0 ? [...originals, picks[0]] : [picks[0]]
  for (let i = 0; picks.length < size; i++) picks.push({ opt: cycle[i % cycle.length].opt, slot: 'repeat', kind: 'choice' })

  // kinds
  const firstKind = new Map<MasteryKey, TaskKind>()
  for (const p of picks) {
    p.kind = kindFor(p, st(p.opt), firstKind.get(p.opt.key))
    if (!firstKind.has(p.opt.key)) firstKind.set(p.opt.key, p.kind)
  }

  const mixed = new Set(picks.map((p) => p.opt.op).filter(Boolean)).size >= 2
  const seq = interleave(arrange(picks, box), mixed)
  repair(seq, mixed)

  const tasks = seq.map((p, i) => p.opt.build(p.kind, rng, i, p.slot === 'targeted' ? { target: o.flagged ?? [] } : undefined))
  return balanceAnswerPositions(tasks, rng)

  function kindFor(p: Pick, state: KeyState | undefined, earlier: TaskKind | undefined): TaskKind {
    const kinds = p.opt.kinds
    if (production === 'only') return pickKind(p.opt, state, rng, 'only')
    if (p.slot === 'opener' && kinds.includes('choice')) return 'choice'
    if (o.tone === 'fatigue' && kinds.includes('choice')) return 'choice'
    const kind = pickKind(p.opt, state, rng, production)
    if (p.slot !== 'repeat' || kind !== earlier) return kind
    const threshold = production === 'fromBox1' ? 1 : GUESSABLE_CEILING
    const allowed = (state?.box ?? 0) >= threshold ? kinds.filter((k) => p.opt.production.includes(k)) : kinds
    const other = allowed.filter((k) => k !== earlier)
    return other.length > 0 ? rng.pick(other) : kind
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

  const isTop = (p: Pick) => p.slot === 'fresh' || p.slot === 'targeted' || p.opt.production.includes(p.kind)
  const top = middle.filter(isTop).sort((a, b) => Number(b.slot === 'fresh') - Number(a.slot === 'fresh') || a.opt.rank - b.opt.rank)
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
  if (new Set(sorted.map((k) => k.op ?? null)).size < 2) return [...sorted]
  const out: KeyOption[] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j < sorted.length && tier(sorted[j]) === tier(sorted[i])) j++
    const groups = new Map<string, KeyOption[]>()
    for (const k of sorted.slice(i, j)) {
      const g = groups.get(k.op ?? '')
      if (g) g.push(k)
      else groups.set(k.op ?? '', [k])
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
    let idx = pool.findIndex((p, i) => fine(p, i, true))
    if (idx < 0) idx = pool.findIndex((p, i) => fine(p, i, false) && (!mixed || runWith(out, p) <= 3))
    if (idx < 0) idx = pool.findIndex((p, i) => fine(p, i, false))
    out.push(pool.splice(Math.max(0, idx), 1)[0])
  }
  out.push(last)
  return out
}

/** Same key back to back reads as a glitch; four sums of one kind in a row invite wrongOperation. */
function badness(seq: readonly Pick[], mixed: boolean): number {
  let bad = 0
  let run = 0
  let prev: Operation | null | undefined
  for (let i = 0; i < seq.length; i++) {
    if (i > 0 && seq[i].opt.key === seq[i - 1].opt.key) bad += 10
    const op = seq[i].opt.op ?? null
    run = op !== null && op === prev ? run + 1 : 1
    prev = op
    if (mixed && op !== null && run > 3) bad += 1
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
