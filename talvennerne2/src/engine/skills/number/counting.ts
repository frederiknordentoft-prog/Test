// Shared by count10 and count20: the facts' pictures, the questions, the count-out task and hints.
//
// Prompt conventions (for the task UI):
//  - choice / keypad: { scene: 'objects', n, layout, thing } is the picture to count. dice, fingers and
//    tenframe draw their own marks (pips, fingers, counters); `thing` is then 'ball' and not drawn.
//    Flash facts carry flashMs: show the picture for 1,5 s, then hide it ("Hvor mange øjne så du?").
//  - countTap ("Læg syv gulerødder i kurven"): the scene is the pile to take from — always more
//    things than the target, so taking all of them is never the answer. The target is task.answer
//    and is spoken; the child's answer is the number of things in the basket.
import type { Candidate, Fact, HintSpec, HintVisual, Prompt, SpeechPart, TaskKind } from '../types'
import { THING_NOUNS, type CountThing } from '../../../speech/clips/skills/number'
import { hintOf, num, say, tagged } from './kit'

export type CountLayout = 'scatter' | 'dice' | 'fingers' | 'tenframe'

export interface CountData {
  layout: CountLayout
  /** What is drawn (scatter) and what is put in the basket (countTap). */
  thing: CountThing
}

export const countData = (f: Fact): CountData => f.data as unknown as CountData

/** Flash facts are shown for 1,5 s: "genkend 1–6 uden at tælle" (pædagogik §1.3). */
export const FLASH_MS = 1500

/** Picture of the fact for choice and keypad. */
export function countPicture(f: Fact, flash: boolean): Prompt {
  const { layout, thing } = countData(f)
  const n = f.answer as number
  return { scene: 'objects', n, layout, thing: drawn(layout, thing), ...(flash ? { flashMs: FLASH_MS } : {}) }
}

/** dice, fingers and tenframe draw their own marks; the scene still names a thing. */
const drawn = (layout: CountLayout, thing: CountThing): CountThing => (layout === 'scatter' ? thing : 'ball')

/** The pile for countTap: `supply` things in rows. */
export function countPile(f: Fact, supply: number): Prompt {
  return { scene: 'objects', n: supply, layout: 'row', thing: countData(f).thing }
}

/** "Læg syv gulerødder i kurven." / "Læg et æble i kurven." */
export function countOutSpeech(f: Fact): SpeechPart[] {
  const n = f.answer as number
  const { thing } = countData(f)
  const noun = THING_NOUNS[thing]
  return [say('frag.laeg'), num(n, 'mid', noun.gender), say(`noun.thing.${thing}.${n === 1 ? 'sg' : 'pl'}`), say('frag.i_kurven')]
}

/** "Hvor mange gulerødder er der?" for a picture, "Hvor mange øjne så du på terningen?" for a flash. */
export function howManySpeech(f: Fact, flash: boolean): SpeechPart[] {
  const { layout, thing } = countData(f)
  if (layout === 'scatter') return [say(`s.count.howMany.${thing}`)]
  if (!flash) return [say('s.count.howManyDots')]
  return [say(`s.count.flash.${layout}`)]
}

/** Counting errors are near misses: one or two too many or too few (and for 11–20 the forgotten ten). */
export function countCandidates(f: Fact, forgotTen: boolean): Candidate[] {
  const n = f.answer as number
  return tagged(n, [
    [n - 1, 'near'], [n + 1, 'near'], [n - 2, 'near'], [n + 2, 'near'],
    ...(forgotTen ? ([[n - 10, 'near']] as const) : []),
  ])
}

/** The picture again, without the flash, for the strategy hint. */
export function lookAgain(f: Fact): HintVisual {
  return countPicture(f, false)
}

/** count10: how to see the number at a glance, or how to count a picture one by one. */
export function count10Hint(f: Fact): HintSpec {
  const { layout, thing } = countData(f)
  const n = f.answer as number
  switch (layout) {
    case 'scatter':
      return hintOf([say('hint.count.pointEach')], { scene: 'objects', n, layout: 'row', thing })
    case 'dice':
      return hintOf([say(`hint.count.dice.${n}`)], lookAgain(f))
    case 'fingers':
      return hintOf([say(n === 5 ? 'hint.count.fullHand' : n === 6 ? 'hint.count.handAndOne' : 'hint.count.fingersUp')], lookAgain(f))
    case 'tenframe':
      return hintOf([say(n === 5 ? 'hint.count.fullRow' : n === 6 ? 'hint.count.rowAndOne' : 'hint.count.framePoints')], lookAgain(f))
  }
}

/** count20: the full ten-frame is ten, then count on; loose things: find ten first (bead string, 5 + 5). */
export function count20Hint(f: Fact): HintSpec {
  const n = f.answer as number
  if (countData(f).layout === 'tenframe') {
    return hintOf([say('hint.count20.fullFrame'), say('hint.count20.countOn')], { scene: 'objects', n, layout: 'tenframe', thing: 'ball' })
  }
  return hintOf([say('hint.count20.tenFirst')], { scene: 'objects', n, layout: 'beads', thing: 'ball' })
}

export const isFlash = (f: Fact) => countData(f).layout !== 'scatter'

/** choice and keypad show the picture; countTap shows the pile. */
export const usesPicture = (kind: TaskKind) => kind !== 'countTap'
