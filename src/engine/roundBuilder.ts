import type { Fact, FactStates, SkillId, Task, TaskKind } from './types'
import type { Rng } from './rng'
import { isDue } from './mastery'
import { buildTask } from './tasks'

/** Which presentations actually make sense for a skill. */
function validKinds(skill: SkillId): TaskKind[] {
  switch (skill) {
    case 'count':
      return ['choice', 'count']
    case 'neighbour':
      return ['choice', 'keypad', 'numberline']
    case 'tenFriends':
      return ['choice', 'pair']
    case 'doubles':
    case 'halves':
    case 'tensAndOnes':
      return ['choice', 'keypad', 'numberline']
    default:
      return ['choice', 'keypad']
  }
}

function pickKind(skill: SkillId, allowed: readonly TaskKind[], rng: Rng): TaskKind {
  const usable = validKinds(skill).filter((k) => allowed.includes(k))
  if (usable.length === 0) return 'choice'
  // the level's first listed kind is the house style; the others turn up often
  // enough to keep a round from feeling like a worksheet
  if (usable.length === 1 || rng.next() > 0.35) return usable[0]
  return rng.pick(usable.slice(1))
}

export interface RoundOptions {
  /** every fact this level is allowed to ask */
  facts: readonly Fact[]
  states: FactStates
  roundIndex: number
  size: number
  /** kinds this level may use, most characteristic first */
  kinds: readonly TaskKind[]
  rng: Rng
}

/**
 * Compose one round.
 *
 * Roughly 2 solid / 5 shaky / 3 new out of ten. The two solid ones are not
 * padding — a child who gets the first question right settles in, and a child
 * who gets the first question wrong is already deciding they are bad at maths.
 * The first task in the round is always one they can do.
 */
export function buildRound({ facts, states, roundIndex, size, kinds, rng }: RoundOptions): Task[] {
  const secure: Fact[] = []
  const shaky: Fact[] = []
  const fresh: Fact[] = []

  for (const f of facts) {
    const st = states[f.id]
    if (!st || st.seen === 0) fresh.push(f)
    else if (st.box >= 3) secure.push(f)
    else shaky.push(f)
  }
  // a solid fact that has rested long enough is worth revisiting
  const dueSecure = secure.filter((f) => isDue(states[f.id], roundIndex))
  const restingSecure = secure.filter((f) => !isDue(states[f.id], roundIndex))

  secure.sort((x, y) => states[y.id].box - states[x.id].box || states[x.id].lastRound - states[y.id].lastRound)
  shaky.sort((x, y) => states[x.id].box - states[y.id].box || states[x.id].lastRound - states[y.id].lastRound)
  fresh.sort((x, y) => x.rank - y.rank)

  const wantSecure = Math.max(1, Math.round(size * 0.2))
  const wantShaky = Math.round(size * 0.5)
  const wantFresh = size - wantSecure - wantShaky

  const chosen: Fact[] = []
  const taken = new Set<string>()
  const take = (pool: readonly Fact[], n: number) => {
    for (const f of pool) {
      if (n <= 0) break
      if (taken.has(f.id)) continue
      taken.add(f.id)
      chosen.push(f)
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
  take(facts, size - chosen.length)

  const secureIds = new Set(secure.map((f) => f.id))
  const opener =
    chosen.find((f) => secureIds.has(f.id)) ??
    chosen.slice().sort((x, y) => x.rank - y.rank)[0]

  const rest = rng.shuffle(chosen.filter((f) => f !== opener))
  const ordered = opener ? [opener, ...rest] : rest

  const tasks = ordered.map((f, i) => buildTask(f, pickKind(f.skill, kinds, rng), rng, i))
  return balanceAnswerPositions(tasks, rng)
}

/**
 * Stop the right answer from sitting in the same slot over and over. Children
 * spot that far faster than adults expect, and then they stop reading the sums.
 */
function balanceAnswerPositions(tasks: Task[], rng: Rng): Task[] {
  let run = 0
  let prevIndex = -1
  return tasks.map((task) => {
    if (task.options.length === 0) {
      run = 0
      prevIndex = -1
      return task
    }
    let index = task.options.indexOf(task.answer)
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
