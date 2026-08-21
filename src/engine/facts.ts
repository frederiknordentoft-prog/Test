import type { Fact, SkillId } from './types'

/**
 * Every fact the app can ever ask, enumerated per skill. Nothing is generated at
 * random here — the pool is fixed and finite, which is what lets the mastery model
 * track real progress and lets tests check every single fact for correctness.
 */

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** Easiest-first orders that match how the facts are actually taught. */
const TEN_FRIEND_ORDER = [5, 10, 0, 9, 1, 8, 2, 6, 4, 7, 3]
const DOUBLE_ORDER = [1, 2, 5, 10, 3, 4, 6, 7, 8, 9]

function enumerate(skill: SkillId): Fact[] {
  const facts: Fact[] = []
  const push = (a: number, b: number, answer: number, rank: number, id: string) =>
    facts.push({ id, skill, a, b, answer, rank })

  switch (skill) {
    case 'count':
      for (const n of range(1, 10)) push(n, 0, n, n - 1, `count:${n}`)
      break

    case 'neighbour':
      // b = +1 (what comes after) or −1 (what comes before)
      for (const n of range(0, 10)) push(n, 1, n + 1, n, `nb:${n}+1`)
      for (const n of range(1, 10)) push(n, -1, n - 1, n + 1, `nb:${n}-1`)
      break

    case 'addTo10':
      for (const a of range(0, 10))
        for (const b of range(0, 10 - a)) push(a, b, a + b, a + b, `add:${a}+${b}`)
      break

    case 'subTo10':
      for (const a of range(0, 10))
        for (const b of range(0, a)) push(a, b, a - b, a, `sub:${a}-${b}`)
      break

    case 'tenFriends':
      for (const a of range(0, 10))
        push(a, 10 - a, 10 - a, TEN_FRIEND_ORDER.indexOf(a), `ten:${a}`)
      break

    case 'doubles':
      for (const a of range(1, 10)) push(a, a, a * 2, DOUBLE_ORDER.indexOf(a), `dbl:${a}`)
      break

    case 'halves':
      for (const a of range(1, 10)) push(a * 2, 2, a, DOUBLE_ORDER.indexOf(a), `hlf:${a * 2}`)
      break

    case 'addTo20':
      // only the ones that cross the ten — that is the actual skill
      for (const a of range(2, 9))
        for (const b of range(2, 9))
          if (a + b > 10 && a + b <= 20) push(a, b, a + b, a + b - 11, `add:${a}+${b}`)
      break

    case 'subTo20':
      // only the ones that cross back down over the ten
      for (const a of range(11, 18))
        for (const b of range(2, 9))
          if (a - b < 10 && a - b >= 2) push(a, b, a - b, a - 11, `sub:${a}-${b}`)
      break

    case 'tensAndOnes':
      for (const t of range(1, 9))
        for (const o of range(1, 9)) push(t, o, t * 10 + o, t, `tno:${t}_${o}`)
      break

    case 'addTo100':
      for (const a of range(1, 9)) // whole tens: 20 + 30
        for (const b of range(1, 10 - a)) push(a * 10, b * 10, (a + b) * 10, a + b, `add:${a * 10}+${b * 10}`)
      for (const a of range(11, 89)) // two-digit + one-digit, no carry
        for (const b of range(2, 9))
          if ((a % 10) + b <= 9) push(a, b, a + b, 11 + Math.floor(a / 10), `add:${a}+${b}`)
      break

    case 'subTo100':
      for (const a of range(2, 10)) // whole tens: 50 − 20
        for (const b of range(1, a - 1)) push(a * 10, b * 10, (a - b) * 10, a, `sub:${a * 10}-${b * 10}`)
      for (const a of range(12, 99)) // two-digit − one-digit, no borrow
        for (const b of range(2, 9))
          if (a % 10 >= b) push(a, b, a - b, 11 + Math.floor(a / 10), `sub:${a}-${b}`)
      break
  }
  return facts
}

const cache = new Map<SkillId, Fact[]>()

/** All facts for a skill, easiest first. Cached — the pool never changes. */
export function factsFor(skill: SkillId): Fact[] {
  let got = cache.get(skill)
  if (!got) {
    got = enumerate(skill).sort((x, y) => x.rank - y.rank || x.id.localeCompare(y.id))
    cache.set(skill, got)
  }
  return got
}

/** All facts for several skills, merged and de-duplicated by id, easiest first. */
export function factsForSkills(skills: readonly SkillId[]): Fact[] {
  const byId = new Map<string, Fact>()
  for (const skill of skills) for (const f of factsFor(skill)) if (!byId.has(f.id)) byId.set(f.id, f)
  return [...byId.values()].sort((x, y) => x.rank - y.rank || x.id.localeCompare(y.id))
}
