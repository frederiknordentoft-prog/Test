import type { Fact } from './types'
import type { Rng } from './rng'

/**
 * Wrong answers a child would plausibly give.
 *
 * This matters more than it looks: distractors that are obviously silly (a huge
 * number, a negative) can be sorted out without doing the maths, so the child
 * "wins" without practising. Every candidate here is a real mistake — the
 * opposite operation, forgetting to carry, being one off, answering with one of
 * the numbers in the question.
 */

function candidatesFor(fact: Fact): number[] {
  const { skill, a, b, answer } = fact
  const near = [answer + 1, answer - 1, answer + 2, answer - 2]

  switch (skill) {
    case 'count':
      return [answer + 1, answer - 1, answer + 2, answer - 2]

    case 'neighbour':
      // took the step the other way, or answered with the number itself
      return [a - b, a, ...near]

    case 'addTo10':
    case 'addTo20':
    case 'addTo100':
      return [a - b, b - a, a, b, answer + 10, answer - 10, ...near]

    case 'subTo10':
    case 'subTo20':
    case 'subTo100':
      return [a + b, b - a, a, b, answer + 10, answer - 10, ...near]

    case 'tenFriends':
      // answered with the number itself, with ten, or overshot the ten
      return [a, 10, 10 + a, ...near]

    case 'doubles':
      // forgot to double, doubled the wrong thing, added one instead
      return [a, a + 1, a + 2, answer + 10, ...near]

    case 'halves':
      // forgot to halve, or halved to the wrong place
      return [a, a + 1, answer + 1, answer - 1, answer * 2, ...near]

    case 'tensAndOnes':
      // swapped the tens and the ones — the classic
      return [b * 10 + a, answer + 10, answer - 10, ...near]
  }
}

/**
 * `count` wrong answers for a fact, inside [lo, hi]. Never negative, never equal
 * to the right answer, never a duplicate. At least one is a near miss (±1 or ±2)
 * so the child has to actually discriminate rather than eyeball the odd one out.
 */
export function distractorsFor(
  fact: Fact,
  count: number,
  rng: Rng,
  bounds: [number, number],
): number[] {
  const [lo, hi] = bounds
  const valid = (v: number) => Number.isInteger(v) && v >= lo && v <= hi && v !== fact.answer

  const pool: number[] = []
  for (const v of candidatesFor(fact)) if (valid(v) && !pool.includes(v)) pool.push(v)

  const isNear = (v: number) => Math.abs(v - fact.answer) <= 2
  const near = pool.filter(isNear)
  const rest = pool.filter((v) => !isNear(v))

  const chosen: number[] = []
  if (near.length > 0) chosen.push(rng.pick(near))
  // fill from the whole pool, shuffled, skipping what we already took
  for (const v of rng.shuffle([...rest, ...near])) {
    if (chosen.length >= count) break
    if (!chosen.includes(v)) chosen.push(v)
  }
  // last resort: widen outwards from the answer until we have enough. Only bites
  // for tiny ranges (e.g. answers near 0 with a 0–10 ceiling).
  for (let d = 1; chosen.length < count && d <= hi - lo + 1; d++) {
    for (const v of [fact.answer + d, fact.answer - d]) {
      if (chosen.length >= count) break
      if (valid(v) && !chosen.includes(v)) chosen.push(v)
    }
  }
  return chosen
}
