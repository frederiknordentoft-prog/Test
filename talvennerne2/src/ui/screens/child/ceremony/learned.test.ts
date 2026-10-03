import { describe, expect, it } from 'vitest'
import { factsOf, skillRegistry, skillKeys } from '../../../../engine/registry'
import type { SpeechPart } from '../../../../engine/types'
import { hasClip } from '../../../../speech/catalog'
import { compile, toDanishText } from '../../../../speech/compile'
import { NUMBER_IS_FACT, keyFace } from './describe'
import { clockText, phraseText } from './Steps'
import { clipText } from '../../../../speech/catalog'

/**
 * "Det lærte du" shows a fact whole (QA2 P1-1): every key of every skill in waves 1–2 (Engdalen,
 * Hestebakkerne, Regnbueskoven) is shown as something true — never as the minutes of a clock's
 * answer ("540" for kl. 9), the øre of a coin, a token, or a number without what it is about.
 */

const clips = (parts: readonly SpeechPart[]) => parts.flatMap((p) => ('clip' in p ? [p.clip] : []))
const reg = skillRegistry()
const waves12 = reg.all.filter((d) => d.grade <= 2)

describe('"Det lærte du" for every key of waves 1–2', () => {
  it('covers the skills of Engdalen, Hestebakkerne and Regnbueskoven', () => {
    expect(waves12.map((d) => d.id)).toEqual(expect.arrayContaining(['count10', 'clockHour', 'clockHalf', 'clockQuarter', 'coinNames', 'halves', 'groupsOf']))
    expect(waves12.length).toBeGreaterThanOrEqual(50)
  })

  it('never shows a bare minute count, øre amount or token, and says only recorded words', () => {
    const shown: string[] = []
    for (const def of waves12) {
      const facts = factsOf(def)
      for (const key of skillKeys(def)) {
        const got = keyFace(key, def.id, reg)
        if (!got) continue
        const { face, speech } = got
        shown.push(`${key}:${face.t}`)
        const fact = facts.find((f) => f.id === key)
        const type = fact ? def.answerType(fact) : null
        // a clock's answer is minutes and a coin's øre: never a number on the card
        if (type === 'minutes') expect(face.t, key).toBe('clock')
        if (type === 'ore') expect(face.t, key).toBe('money')
        // a number alone is only the number the child counted or heard
        if (face.t === 'number') {
          expect(NUMBER_IS_FACT.has(def.id), key).toBe(true)
          expect(type, key).toBe('int')
        } else {
          expect(clips(speech), key).not.toContain('s.reward.learned.number')
        }
        // nothing of a token's spelling reaches the card or the voice
        const text = toDanishText(speech)
        expect(text, key).not.toMatch(/[a-z]+:[a-z0-9]/i)
        expect(text, key).not.toMatch(/\d/)
        expect(compile(speech).missing, key).toEqual([])
        for (const c of clips(speech)) expect(hasClip(c), `${key}: ${c}`).toBe(true)
        if (face.t === 'phrase') {
          for (const c of clips(face.parts)) expect(hasClip(c), `${key}: ${c}`).toBe(true)
          expect(phraseText(face.parts, clipText), key).not.toMatch(/[a-z]+\.[a-z]+\./)
        }
        if (face.t === 'label') expect(hasClip(face.clip), key).toBe(true)
      }
    }
    // the clocks, the coins and the number facts of 1.–2. klasse are all shown
    for (const key of ['hel:540', 'halv:570', 'kvart:525', 'mnt:2000', 'hlf:8', 'grp:3x4', 'shr:6:3', 'sc:s:triangle:0', 'cps:m:hexagon:triangle']) {
      expect(shown.some((s) => s.startsWith(`${key}:`)), key).toBe(true)
    }
  })

  it('shows a time as the clock and says it as the clock does', () => {
    const nine = keyFace('hel:540', 'clockHour')!
    expect(nine.face).toEqual({ t: 'clock', minutes: 540 })
    expect(toDanishText(nine.speech)).toBe('Klokken er ni.')
    expect(clockText(540)).toBe('Klokken ni')
    expect(toDanishText(keyFace('halv:570', 'clockHalf')!.speech)).toBe('Klokken er halv ti.')
    const quarter = keyFace('kvart:525', 'clockQuarter')!
    expect(quarter.face).toEqual({ t: 'clock', minutes: 525 })
    expect(toDanishText(quarter.speech)).toBe('Klokken er kvart i ni.')
    expect(clockText(525)).toBe('Kvart i ni')
    expect(clockText(0)).toBe('Klokken tolv')
    expect(toDanishText(keyFace('hel:0', 'clockHour')!.speech)).toBe('Klokken er tolv.')
  })

  it('shows a coin as the coin and names it', () => {
    const coin = keyFace('mnt:2000', 'coinNames')!
    expect(coin.face).toEqual({ t: 'money', ore: 2000 })
    expect(toDanishText(coin.speech)).toBe('En tyvekrone.')
  })

  it('says a number fact whole: "halvdelen af 8 er 4", never "Tallet fire"', () => {
    const half = keyFace('hlf:8', 'halves')!
    expect(half.face.t).toBe('phrase')
    expect(toDanishText(half.speech)).toBe('Halvdelen af otte er fire.')
    expect(half.face.t === 'phrase' && phraseText(half.face.parts, clipText)).toBe('Halvdelen af 8 er 4')
    const groups = keyFace('grp:3x4', 'groupsOf')!
    expect(toDanishText(groups.speech)).toBe('Tre grupper med fire er tolv.')
    expect(groups.face.t === 'phrase' && phraseText(groups.face.parts, clipText)).toBe('3 grupper med 4 er 12')
    const shared = keyFace('shr:6:3', 'shareEqually')!
    expect(shared.face).toEqual({ t: 'eq', terms: [{ n: 6 }, { op: ':' }, { n: 3 }, { op: '=' }, { n: 2 }] })
    expect(toDanishText(shared.speech)).toBe('Seks delt med tre er lig med to.')
    const sides = keyFace('sc:s:triangle:0', 'sidesCorners')!
    expect(sides.face).toMatchObject({ t: 'phrase', figure: { shape: 'triangle', variant: 0, mark: 'sides' } })
    expect(toDanishText(sides.speech)).toBe('Figuren har tre sider.')
    expect(sides.face.t === 'phrase' && phraseText(sides.face.parts, clipText)).toBe('3 sider')
    expect(toDanishText(keyFace('cps:m:hexagon:triangle', 'composeShapes')!.speech)).toBe('Seks trekanter giver en sekskant.')
    expect(toDanishText(keyFace('cps:k:6:triangle:rhombus', 'composeShapes')!.speech)).toBe('Seks trekanter giver tre romber.')
    expect(toDanishText(keyFace('cps:m:big-square:square', 'composeShapes')!.speech)).toBe('Fire små kvadrater giver et stort kvadrat.')
  })

  it('keeps the counted and heard numbers as they were', () => {
    expect(keyFace('c10:dice:4', 'count10')!.face).toMatchObject({ t: 'number', n: 4 })
    expect(toDanishText(keyFace('h20:7', 'hear20')!.speech)).toBe('Tallet syv.')
  })
})
