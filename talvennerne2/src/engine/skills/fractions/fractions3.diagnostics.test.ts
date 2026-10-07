// fractionOfSet and fractionCompare through the real diagnostics (SPEC §4.3), ORK3b. The tasks come from
// Brøkbageriet's keys as rounds plan them (ORK3a's simulate, addsub3.oracle.ts), and the child keeps one idea
// worked out from what it hears and sees by the oracle (fractions3.oracle.ts), not from the generator's tags:
// it answers with the denominator it hears (denominatorAsAnswer), or takes the bigger denominator for the
// bigger fraction (biggerDenominator). Such a child is flagged within 160 answers, and for nothing else; a
// child who answers right never is; a child who guesses 500 times never is, also when every card counts.
import { describe, expect, it } from 'vitest'
import { hashSeed, makeRng } from '../../rng'
import type { AnswerValue, Task } from '../../types'
import { answersRight, simulate, type Child } from '../addsub/addsub3.oracle'
import { spokenText } from '../number/number.oracle'
import { dealsOf, permutations } from '../shapes/shapes3.oracle'
import { byDenominator, cmpAsk, setAsk } from './fractions3.oracle'

const NODE = 'w3-broeker-l3'

/** Answers "n/d of the heap" with the d it hears; deals the share view right (dealing has no such idea). */
function answersTheDenominator(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3b-den:${seed}`))
  return (t: Task): AnswerValue => {
    const ask = setAsk(spokenText(t.speech))!
    if (t.kind === 'choice') return t.options.includes(ask.d) ? ask.d : rng.pick(t.options)
    if (t.kind === 'keypad') return ask.d
    return t.answer
  }
}

/** Takes the card with the biggest denominator for the biggest fraction (and so on), and sorts by denominator. */
const biggerDenominator: Child = (t) => {
  const ask = cmpAsk(spokenText(t.speech))!
  const order = byDenominator(t.options, ask.biggest)
  return t.kind === 'sortOrder' ? order.join('|') : order[0]
}

/** Taps a random card, types a number in range, lays the cards in a random order, deals at random. */
function guesses(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3b-guess:${seed}`))
  return (t: Task): AnswerValue => {
    if (t.kind === 'choice') return rng.pick(t.options)
    if (t.kind === 'sortOrder') return rng.pick(permutations(t.options)).join('|')
    if (t.kind === 'share' && t.prompt.scene === 'share') {
      if (t.answerType === 'set') return rng.pick(dealsOf(t.prompt.total, t.prompt.recipients))
      return rng.next() < 0.5 ? t.answer : -1
    }
    return rng.between(t.range[0], t.range[1])
  }
}

describe('fractionOfSet through the real diagnostics (SPEC §4.3)', () => {
  it('flags a child who answers with the denominator (denominatorAsAnswer) within 160 answers, and nothing else', () => {
    const { flagged } = simulate(NODE, 'fractionOfSet', answersTheDenominator('a'), 160)
    expect([...flagged.keys()]).toEqual(['denominatorAsAnswer'])
  })

  it('flags nothing for a child who answers right (160 answers)', () => {
    expect([...simulate(NODE, 'fractionOfSet', answersRight, 160).flagged.keys()]).toEqual([])
  })

  it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
    expect([...simulate(NODE, 'fractionOfSet', guesses('fos:a'), 500).flagged.keys()]).toEqual([])
    expect([...simulate(NODE, 'fractionOfSet', guesses('fos:b'), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
  })
})

describe('fractionCompare through the real diagnostics (SPEC §4.3)', () => {
  it('flags a child who takes the bigger denominator for the bigger fraction (biggerDenominator) within 160 answers, and nothing else', () => {
    const { flagged } = simulate(NODE, 'fractionCompare', biggerDenominator, 160)
    expect([...flagged.keys()]).toEqual(['biggerDenominator'])
  })

  it('flags nothing for a child who answers right (160 answers)', () => {
    expect([...simulate(NODE, 'fractionCompare', answersRight, 160).flagged.keys()]).toEqual([])
  })

  it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
    expect([...simulate(NODE, 'fractionCompare', guesses('fcm:a'), 500).flagged.keys()]).toEqual([])
    expect([...simulate(NODE, 'fractionCompare', guesses('fcm:b'), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
  })
})
