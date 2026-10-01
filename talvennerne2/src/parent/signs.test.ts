import { describe, expect, it } from 'vitest'
import { MISCONCEPTION_TEXTS } from '../content/misconceptionTexts'
import { ago, answers, dailyFrom, misconception, NOW, profile, TODAY } from './fixtures'
import { lastSentence } from './format'
import { afterAt, evidenceOf, personal, signs } from './signs'

describe('misconceptions for parents', () => {
  it('shows flagged concepts as signs (at most two) and slips apart', () => {
    const p = profile({
      misconceptions: {
        forgotCarry: misconception('flagged', 4), zeroPlaceholder: misconception('flagged', 3), mulAsAdd: misconception('flagged', 6),
        tableNeighbour: misconception('flagged', 3), countFromFirst: misconception('watching', 2),
      },
    })
    const s = signs({ profile: p, answers: [], daily: [], today: TODAY })
    expect(s.concepts.map((x) => x.id)).toEqual(['mulAsAdd', 'forgotCarry'])
    expect(s.slips.map((x) => x.id)).toEqual(['tableNeighbour'])
    expect(s.resolved).toEqual([])
    expect(s.concepts[0].homeTip.length).toBeGreaterThan(20)
  })

  it('lists lifted flags under "Ser ud til at være på plads", newest first', () => {
    const p = profile({ misconceptions: { faceValue: misconception('resolved', 0, NOW - 5), halfPastNext: misconception('resolved', 0, NOW) } })
    expect(signs({ profile: p, answers: [], daily: [], today: TODAY }).resolved.map((x) => x.id)).toEqual(['halfPastNext', 'faceValue'])
  })

  it('names where a slip shows up, down to the times table', () => {
    const log = [
      ...answers('mul6to9', ago(1), 6, { correct: 2, family: 't7', errorTag: 'tableNeighbour' }),
      ...answers('mul6to9', ago(2), 3, { correct: 2, family: 't8', errorTag: 'tableNeighbour' }),
      ...answers('mul2510', ago(2), 2, { correct: 1, family: 't5', errorTag: 'tableNeighbour' }),
    ]
    const e = evidenceOf('tableNeighbour', log, [], TODAY)
    expect(e.skills).toEqual(['mul6to9', 'mul2510'])
    expect(e.where).toEqual(['7-tabellen', '5-tabellen'])
  })

  it('falls back to the daily error counts when the answers are gone', () => {
    const old = answers('addTo10', ago(20), 4, { correct: 1, errorTag: 'countFromFirst' })
    const e = evidenceOf('countFromFirst', [], dailyFrom(old), TODAY)
    expect(e.where).toEqual(['Plus til 10'])
    expect(evidenceOf('countFromFirst', [], dailyFrom(answers('addTo10', ago(40), 4, { correct: 1, errorTag: 'countFromFirst' })), TODAY).skills).toEqual([])
  })

  it('decides digitSwap by where it happened: a concept when hearing numbers, a slip elsewhere', () => {
    const p = profile({ misconceptions: { digitSwap: misconception('flagged') } })
    const heard = answers('hear20', ago(1), 4, { correct: 0, errorTag: 'digitSwap' })
    expect(signs({ profile: p, answers: heard, daily: [], today: TODAY }).concepts.map((x) => x.id)).toEqual(['digitSwap'])
    const typed = answers('add100Carry', ago(1), 4, { correct: 0, errorTag: 'digitSwap' })
    expect(signs({ profile: p, answers: typed, daily: [], today: TODAY }).slips.map((x) => x.id)).toEqual(['digitSwap'])
  })

  it('ends every slip with a calm remark of its own (shown under "Typiske fejl lige nu")', () => {
    for (const t of Object.values(MISCONCEPTION_TEXTS).filter((x) => x.nature !== 'concept')) {
      const last = lastSentence(t.parent)
      expect(last.length).toBeGreaterThan(15)
      expect(last).not.toBe(t.parent)
    }
  })

  it('moves "kun" before the verb after "at …" (Danish word order in a subordinate clause)', () => {
    expect(afterAt('ser kun på den ene ende, når ting sammenlignes')).toBe('kun ser på den ene ende, når ting sammenlignes')
    expect(afterAt('sammenligner kun det første ciffer')).toBe('kun sammenligner det første ciffer')
    expect(afterAt('tror, at store ting altid er tungest')).toBe('tror, at store ting altid er tungest')
    expect(afterAt('glemmer tieren, der skal med')).toBe('glemmer tieren, der skal med')
  })

  it('puts the child\'s name into the parent text where a sentence starts with "Barnet"', () => {
    expect(personal('Barnet tæller. Når barnet hører det, Barnet skriver.', 'Ada')).toBe('Ada tæller. Når barnet hører det, Barnet skriver.')
    expect(personal('Barnet tæller.', '  ')).toBe('Barnet tæller.')
  })
})
