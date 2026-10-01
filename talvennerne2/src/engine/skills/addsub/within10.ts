// Shared by addTo10, subTo10 and tenFriends: the equation prompt and the number-line hop hints.
// The strategy for 0. klasse is counting on and back from a number: "Start på fem. Hop tre gange
// frem." The line shows the hops; the child's own count is what the hint trains.
import type { HintSpec, MisconceptionId, Prompt, SpeechPart } from '../../types'
import { hintOf, num, say, walk } from '../number/kit'

/** a + b = □ / a − b = □ */
export function equation(a: number, op: '+' | '−', b: number): Prompt {
  return { scene: 'equation', terms: [{ n: a }, { op }, { n: b }, { op: '=' }, { blank: true }] }
}

export interface HopOptions {
  /** A sentence before the strategy (plus means more …). */
  lead?: SpeechPart[]
  /** Say where the first hop lands: the remedy for counting the start number. */
  firstHop?: boolean
  misconception?: MisconceptionId
}

/** "Start på fem. Hop tre gange frem." with the hops drawn on a 0–10 line. */
export function hopHint(start: number, steps: number, dir: 1 | -1, o: HopOptions = {}): HintSpec {
  const speech: SpeechPart[] = [
    ...(o.lead ?? []),
    say('hint.addsub.startOn'),
    num(start),
    say(`hint.addsub.${dir > 0 ? 'hopForward' : 'hopBack'}.${steps}`),
    ...(o.firstHop ? [say('hint.addsub.firstHop'), num(start + dir)] : []),
  ]
  return hintOf(speech, { scene: 'line', min: 0, max: 10, hops: walk(start, start + dir * steps) }, o.misconception)
}

/** The answer as counters in a ten-frame (for + 0 and − 0, where there is nothing to hop). */
export const frameOf = (n: number): Prompt => ({ scene: 'objects', n, layout: 'tenframe', thing: 'ball' })
