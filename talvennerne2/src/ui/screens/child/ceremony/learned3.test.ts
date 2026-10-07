import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../../../content/curriculum'
import { factsOf, skillKeys, skillRegistry } from '../../../../engine/registry'
import { hashSeed, makeRng } from '../../../../engine/rng'
import type { Fact, SkillDef, SpeechPart } from '../../../../engine/types'
import { clipText, hasClip } from '../../../../speech/catalog'
import { dialMinutes } from '../../../../speech/clock'
import { compile, toDanishText } from '../../../../speech/compile'
import { formatMoney, formatNumber } from '../../../task/answers'
import { isFjeldFamily, keyFace, learnedItems, type LearnedFace } from './describe'
import { phraseText } from './Steps'

/**
 * "Det lærte du" in Stjernefjeldet (QA3a P2-1): every family of its regions — also the 3. klasse
 * families of wave 2 skills — shows a concrete card, made from the instance the child answered right
 * ("403 − 158 = 245", a dial at "fem minutter over tre", "(3, 2)", "3/4 af 12 er 9", "1 m er 100 cm").
 * Families of 0.–2. klasse are unchanged.
 */

const reg = skillRegistry()
const clips = (parts: readonly SpeechPart[]) => parts.flatMap((p) => ('clip' in p ? [p.clip] : []))

/** Every (skill, family) of Stjernefjeldet's regions. */
const FJELD: { def: SkillDef; family: string }[] = REGIONS.filter((r) => r.world === 'fjeld').flatMap((r) =>
  r.skills.flatMap((rs) => {
    const def = reg.get(rs.skill)!
    return (rs.families ?? def.families.map((f) => f.id)).map((family) => ({ def, family }))
  }),
)

const keyOf = (def: SkillDef, fact: Fact) => (def.mode === 'recall' ? fact.id : `${def.id}/${fact.family}`)

/** What the card writes, whatever its kind. */
function cardText(face: LearnedFace): string {
  if (face.t === 'eq') return face.terms.map((t) => ('n' in t ? formatNumber(t.n) : 'op' in t ? t.op : '')).join(' ')
  if (face.t === 'fact') return phraseText(face.parts, clipText)
  return ''
}

/** Facts of a family to try: its canonical facts and, for a procedure, fresh instances. */
function factsOfFamily(def: SkillDef, family: string): Fact[] {
  const canon = factsOf(def).filter((f) => f.family === family)
  if (def.mode === 'recall' || !def.instance) return canon.slice(0, 20)
  const fam = def.families.find((f) => f.id === family)!
  const rng = makeRng(hashSeed(`learned3:${def.id}:${family}`))
  return [...canon.slice(0, 5), ...Array.from({ length: 25 }, () => def.instance!(fam, rng, new Set()))]
}

/** The answer a card must show for a fact (null when it is not a number). */
function answerShown(def: SkillDef, fact: Fact, face: LearnedFace): boolean | null {
  if (typeof fact.answer !== 'number') return null
  const type = def.answerType(fact)
  if (type === 'minutes') {
    if (face.t !== 'fact' || !face.pic || (face.pic.t !== 'dial' && face.pic.t !== 'digital')) return false
    return face.pic.t === 'dial' ? face.pic.minutes === dialMinutes(fact.answer) : face.pic.minutes === fact.answer
  }
  const text = cardText(face)
  if (type === 'ore') return text.includes(formatMoney(fact.answer))
  return new RegExp(`(^|[^0-9])${formatNumber(fact.answer)}([^0-9]|$)`).test(text)
}

describe('"Det lærte du" in Stjernefjeldet', () => {
  it('covers the seven regions, also the 3. klasse families of wave 2 skills', () => {
    expect(FJELD.length).toBeGreaterThanOrEqual(45)
    for (const { def, family } of FJELD) expect(isFjeldFamily(def, family), `${def.id}/${family}`).toBe(true)
    const names = FJELD.map(({ def, family }) => `${def.id}/${family}`)
    expect(names).toEqual(expect.arrayContaining(['change/from100', 'numberLine1000/round10', 'placeValue1000/regroup', 'inverseOps/mulToDiv', 'fractionShape/nonUnit', 'unitChoice/weight']))
  })

  it('gives every family a concrete card from the instance answered right, with its answer', () => {
    for (const { def, family } of FJELD) {
      for (const fact of factsOfFamily(def, family)) {
        const key = keyOf(def, fact)
        const got = keyFace(key, def.id, reg, def.mode === 'recall' ? undefined : fact.id)
        const at = `${key} (${fact.id})`
        expect(got, at).not.toBeNull()
        const { face, speech } = got!
        expect(['eq', 'fact'], at).toContain(face.t)
        // the card is the instance itself: its answer is on it
        const shown = answerShown(def, fact, face)
        if (shown !== null) expect(shown, `${at}: ${cardText(face)}`).toBe(true)
        // said in recorded words, without a digit or a token's spelling
        const said = toDanishText(speech)
        expect(said, at).not.toMatch(/\d/)
        expect(said, at).not.toMatch(/[a-z]+:[a-z0-9]/i)
        expect(compile(speech).missing, at).toEqual([])
        for (const c of clips(speech)) expect(hasClip(c), `${at}: ${c}`).toBe(true)
        if (face.t === 'fact') {
          for (const c of clips(face.parts)) expect(hasClip(c), `${at}: ${c}`).toBe(true)
          expect(cardText(face), at).not.toMatch(/[a-z]+\.[a-z]+\./)
          expect(cardText(face).length, at).toBeGreaterThan(0)
        }
      }
    }
  })

  it('shows the examples of the review', () => {
    const text = (key: string, skill: string, instance?: string) => cardText(keyFace(key, skill as never, reg, instance)!.face)
    expect(keyFace('sub1000/acrossZero', 'sub1000', reg, 's1000:403-158')!.face).toEqual({
      t: 'eq', terms: [{ n: 403 }, { op: '−' }, { n: 158 }, { op: '=' }, { n: 245 }],
    })
    expect(toDanishText(keyFace('sub1000/acrossZero', 'sub1000', reg, 's1000:403-158')!.speech)).toBe(
      'Fire hundrede og tre minus et hundrede og otteoghalvtreds er lig med to hundrede og femogfyrre.',
    )
    const five = keyFace('clockFive/over', 'clockFive', reg, 'fem:over:185')!
    expect(five.face).toMatchObject({ t: 'fact', pic: { t: 'dial', minutes: 185 } })
    expect(cardText(five.face)).toBe('Fem minutter over tre')
    expect(toDanishText(five.speech)).toBe('Klokken er fem minutter over tre.')
    expect(text('gridCoords/readPoint', 'gridCoords', 'crd:r:3,2')).toBe('(3, 2)')
    expect(toDanishText(keyFace('gridCoords/readPoint', 'gridCoords', reg, 'crd:r:3,2')!.speech)).toBe('Gå tre hen og så to op. Der er punktet.')
    expect(text('fractionOfSet/threeQuartersOf', 'fractionOfSet', 'fos:3/4:12:apple')).toBe('3/4 af 12 er 9')
    expect(toDanishText(keyFace('fractionOfSet/threeQuartersOf', 'fractionOfSet', reg, 'fos:3/4:12:apple')!.speech)).toBe('Tre fjerdedele af tolv er ni.')
    expect(text('convertCmM/mToCm', 'convertCmM', 'cmm:mToCm:1')).toBe('1 m er 100 cm')
    expect(text('change/from100', 'change', 'byt:from100:7400')).toBe('Fra 74 til 100 er 26,00 kr.'.replace(',00', ''))
    expect(text('kronerOre/addHalves', 'kronerOre', 'kro:addHalves:1450')).toBe('14,50 kr. plus 14,50 kr. giver 29 kr.')
    expect(text('clockElapsed/plusHalf', 'clockElapsed', 'tid:plusHalf:585')).toBe('En halv time efter kvart i ti er klokken kvart over ti')
    expect(text('skipCount/step25', 'skipCount', 'skc:step25:25:4')).toBe('25, 50, 75, 100, 125')
    expect(text('fractionCompare/order4', 'fractionCompare', 'fcm:o:1:2,3,4,5')).toBe('Fra den mindste er de 1/5, 1/4, 1/3 og 1/2')
    expect(text('equalSides/balanceSub', 'equalSides', 'eqs:sub:13-_=15-4:11')).toBe('13 − 2 = 15 − 4')
    expect(text('numberLine1000/round10', 'numberLine1000', 'nl1000:round10:463')).toBe('463 ligger tættest på 460')
    expect(text('placeValue1000/regroup', 'placeValue1000', 'pv:regroup:ht:7:11')).toBe('7 hundreder og 11 tiere er 810')
    expect(text('enh:weight:feather', 'unitChoice')).toBe('En fjer vejer man i gram')
  })

  it('takes the instance from the round (KeyState.recent) and falls back to the family', () => {
    const r = { t: 'learned' as const, promoted: [{ key: 'sub1000/acrossZero', skill: 'sub1000' as const, box: 1 as const }], firsts: [], statuses: [], practiced: [], next: null }
    const items = learnedItems(r, { instanceOf: (key) => (key === 'sub1000/acrossZero' ? 's1000:512-278' : undefined) })
    expect(items[0].face).toEqual({ t: 'eq', terms: [{ n: 512 }, { op: '−' }, { n: 278 }, { op: '=' }, { n: 234 }] })
    // no instance known (or one this card cannot read): the family's first fact
    for (const instanceOf of [() => undefined, () => 'nonsense']) {
      const face = learnedItems(r, { instanceOf })[0].face
      expect(face.t).toBe('eq')
    }
  })
})

describe('"Det lærte du" for 0.–2. klasse is unchanged', () => {
  it('ignores the instance for every family below 3. klasse', () => {
    for (const def of reg.all) {
      for (const key of skillKeys(def)) {
        const family = key.includes('/') ? key.slice(def.id.length + 1) : factsOf(def).find((f) => f.id === key)?.family
        if (!family || isFjeldFamily(def, family)) continue
        expect(keyFace(key, def.id, reg, 'add:1+1'), key).toEqual(keyFace(key, def.id, reg))
      }
    }
  })
})
