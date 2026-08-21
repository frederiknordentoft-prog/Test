import type { Fact, Task, TaskKind } from './types'
import type { Rng } from './rng'
import { distractorsFor } from './distractors'

/** Sensible ceiling for answer buttons and number lines, per skill. */
function boundsFor(fact: Fact): [number, number] {
  switch (fact.skill) {
    case 'count':
      return [1, 10]
    case 'neighbour':
      return [0, 11]
    case 'addTo10':
    case 'subTo10':
    case 'halves':
      return [0, 12]
    case 'tenFriends':
      return [0, 20]
    case 'doubles':
      return [0, 22]
    case 'addTo20':
    case 'subTo20':
      return [0, 20]
    case 'tensAndOnes':
    case 'addTo100':
    case 'subTo100':
      return [0, 100]
  }
}

function opFor(fact: Fact): '+' | '−' | null {
  switch (fact.skill) {
    case 'addTo10':
    case 'addTo20':
    case 'addTo100':
    case 'tenFriends':
      return '+'
    case 'subTo10':
    case 'subTo20':
    case 'subTo100':
      return '−'
    case 'neighbour':
      return fact.b > 0 ? '+' : '−'
    default:
      return null
  }
}

/**
 * The Danish sentence read aloud. Most children in 0.–1. klasse cannot read the
 * question yet, so this is not a nicety — it is how the task is delivered.
 * Digits are left as digits: the da-DK voice says them correctly, and spelling
 * them out by hand would just add a place to be wrong.
 */
export function speechFor(fact: Fact, kind: TaskKind): string {
  const { a, b, answer, skill } = fact
  const base = (() => {
    switch (skill) {
      case 'count':
        return kind === 'count' ? `Læg ${answer} i kurven.` : 'Hvor mange er der?'
      case 'neighbour':
        return b > 0 ? `Hvilket tal kommer efter ${a}?` : `Hvilket tal kommer før ${a}?`
      case 'addTo10':
      case 'addTo20':
      case 'addTo100':
        return `Hvad er ${a} plus ${b}?`
      case 'subTo10':
      case 'subTo20':
      case 'subTo100':
        return `Hvad er ${a} minus ${b}?`
      case 'tenFriends':
        return `${a} plus hvad giver 10?`
      case 'doubles':
        return `Hvad er det dobbelte af ${a}?`
      case 'halves':
        return `Hvad er halvdelen af ${a}?`
      case 'tensAndOnes':
        return `${a} tiere og ${b} enere. Hvilket tal er det?`
    }
  })()
  if (kind === 'numberline') return `${base} Sæt tallet på talrækken.`
  return base
}

/** Turn a fact into one on-screen task. Pure: same fact + kind + seed → same task. */
export function buildTask(fact: Fact, kind: TaskKind, rng: Rng, occurrence: number): Task {
  const range = boundsFor(fact)
  const optionCount = kind === 'choice' ? 3 : kind === 'pair' ? 4 : 0

  let options: number[] = []
  if (optionCount > 0) {
    const wrong = distractorsFor(fact, optionCount - 1, rng, range)
    options = rng.shuffle([fact.answer, ...wrong])
  }

  return {
    id: `${fact.id}#${occurrence}`,
    factId: fact.id,
    skill: fact.skill,
    kind,
    a: fact.a,
    b: fact.b,
    op: opFor(fact),
    answer: fact.answer,
    options,
    range,
    speech: speechFor(fact, kind),
  }
}
