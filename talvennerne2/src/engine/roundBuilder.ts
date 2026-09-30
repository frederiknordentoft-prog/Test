import type { KeyState, MasteryKey, Rng, SkillId, Task, TaskKind } from './types'
import { isDue } from './mastery'

/**
 * Round composition, ported from V1 (SPEC §5.4 extends it with review, targeted and new-key caps).
 *
 * Roughly 2 solid / 5 shaky / 3 new out of ten, and the first task is always one the child can
 * already do: a child who gets the first question right settles in, and a child who gets it wrong
 * is already deciding they are bad at maths.
 */

/** Asked "the hard way" (production) once guessable tasks have carried a key this far. */
export const GUESSABLE_CEILING = 3

/** One mastery key the round may ask, with how to present it. */
export interface KeyOption {
  key: MasteryKey
  skill: SkillId
  rank: number
  /** Usable kinds for this key, the node's house kind first. */
  kinds: readonly TaskKind[]
  /** The kinds among `kinds` that count as production for this skill. */
  production: readonly TaskKind[]
  build(kind: TaskKind, rng: Rng, occurrence: number): Task
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

export function buildRound({ keys, states, roundIndex, day, size, rng, production = 'normal' }: RoundOptions): Task[] {
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
