// Independent oracles for compareLength. The answer is read off the scene the child sees — the
// things, how long each is drawn and where each starts — and the spoken question ("længst" or
// "kortest", one thing or all of them in order). lengthByEnd (pædagogik §3.2, "tingen der stikker
// længst ud") is what an eye that only looks at the far ends would answer. The registry skips
// *.oracle.ts files, so none of this reaches the app.
import type { Prompt } from '../../types'
import type { Explanation } from '../number/number.oracle'

export interface Lineup {
  objects: string[]
  sizes: number[]
  /** Where each thing begins (0 for all when they are lined up). */
  starts: number[]
  aligned: boolean
}

/** The compareObjects scene as a line-up of things. */
export function lineupOf(p: Prompt): Lineup {
  if (p.scene !== 'compareObjects' || p.mode !== 'length') throw new Error(`expected a length comparison, got ${p.scene}`)
  return { objects: [...p.objects], sizes: [...p.sizes], starts: p.starts ? [...p.starts] : p.objects.map(() => 0), aligned: p.aligned }
}

export type Question = { longest: boolean; order: boolean }

/** "Hvilken ting er længst?" / "… kortest?" and "Sæt tingene i rækkefølge. Start med den længste/korteste." */
export function questionOf(text: string): Question | null {
  switch (text) {
    case 'Hvilken ting er længst?':
      return { longest: true, order: false }
    case 'Hvilken ting er kortest?':
      return { longest: false, order: false }
    case 'Sæt tingene i rækkefølge. Start med den længste.':
      return { longest: true, order: true }
    case 'Sæt tingene i rækkefølge. Start med den korteste.':
      return { longest: false, order: true }
    default:
      return null
  }
}

export const objToken = (object: string): string => `obj:${object}`

/** The things in the order asked for: longest first, or shortest first. */
export function byLength(l: Lineup, longest: boolean): number[] {
  return l.objects.map((_, i) => i).sort((a, b) => (longest ? l.sizes[b] - l.sizes[a] : l.sizes[a] - l.sizes[b]))
}

/** The things as an eye that only sees the far ends orders them: furthest first, or nearest first. */
export function byEnd(l: Lineup, longest: boolean): number[] {
  const end = (i: number) => l.starts[i] + l.sizes[i]
  return l.objects.map((_, i) => i).sort((a, b) => (longest ? end(b) - end(a) : end(a) - end(b)))
}

/** The answer a child gives who compares the lengths: one thing, or all four in order. */
export function rightAnswer(l: Lineup, q: Question): string {
  const order = byLength(l, q.longest)
  return q.order ? order.map((i) => objToken(l.objects[i])).join('|') : objToken(l.objects[order[0]])
}

/** The answer of an eye that only looks at the far ends. */
export function endsAnswer(l: Lineup, q: Question): string {
  const order = byEnd(l, q.longest)
  return q.order ? order.map((i) => objToken(l.objects[i])).join('|') : objToken(l.objects[order[0]])
}

/** A conflict item (SPEC §4.3): following the far ends gives a wrong answer to this question. */
export const misleads = (l: Lineup, q: Question): boolean => endsAnswer(l, q) !== rightAnswer(l, q)

/**
 * Where a wrong answer comes from: the far-end answer is lengthByEnd; on the cards, the remaining
 * thing closest in length to the answer is the near miss; anything else is plainly wrong.
 */
export function explainLength(l: Lineup, q: Question, given: string): Explanation {
  if (misleads(l, q) && given === endsAnswer(l, q)) return { mis: ['lengthByEnd'] }
  if (q.order) return { mis: [] }
  const [answer] = byLength(l, q.longest)
  const misleading = misleads(l, q) ? byEnd(l, q.longest)[0] : -1
  const rest = l.objects.map((_, i) => i).filter((i) => i !== answer && i !== misleading)
  const nearest = rest.sort((a, b) => Math.abs(l.sizes[a] - l.sizes[answer]) - Math.abs(l.sizes[b] - l.sizes[answer]))[0]
  return { mis: [], near: given === objToken(l.objects[nearest]) }
}
