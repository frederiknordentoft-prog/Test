// Tests for the money skills of 1.–2. klasse: coinNames, countCoins, payExact and change (SK2-CM). The
// shared contract (number/testing/harness.ts) runs every fact, 200 seeded instances per family and
// every kind through the real task builder; the blocks below add answers computed from the prompt,
// the coin sets (what the pay view hands in), the misconceptions and A9, production and ceilings per
// kind, hints rebuilt from the id, and the money regions.
import { describe, expect, it } from 'vitest'
import coinNamesModule from './coinNames'
import countCoinsModule from './countCoins'
import payExactModule from './payExact'
import changeModule from './change'
import { fewestPieces, pieceOf } from './kit'
import { factsUnderTest, flagsRaised, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from '../number/testing/harness'
import { isMisconception } from '../number/kit'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { keysForNode } from '../../registry'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { hashSeed, makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipInfo } from '../../../speech/catalog'
import { clips as MONEY_CLIPS } from '../../../speech/clips/skills/money'
import { NODES } from '../../../content/curriculum'
import type { AnswerValue, Fact, Prompt, SkillDef, Task, TaskKind } from '../../types'

const coinNames: SkillDef = coinNamesModule
const countCoins: SkillDef = countCoinsModule
const payExact: SkillDef = payExactModule
const change: SkillDef = changeModule
const ALL = [coinNames, countCoins, payExact, change] as const

const PIECES = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
const text = (t: Task) => compile(t.speech).text
const sumOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)
/** A coin set's pieces ('c2000|c500' → [2000, 500]); null when a token is no coin or note. */
const piecesOfSet = (v: AnswerValue): number[] | null => {
  const out = String(v).split('|').map((t) => (/^c\d+$/.test(t) ? Number(t.slice(1)) : NaN))
  return out.every((p) => PIECES.includes(p)) ? out : null
}
const shop = (p: Prompt) => {
  if (p.scene !== 'shop') throw new Error(`expected the shop, got ${p.scene}`)
  return p
}
/** Greedy fewest pieces with every Danish denomination, written apart from the skill's own kit. */
function greedy(ore: number, purse: readonly number[]): number[] {
  const out: number[] = []
  let left = ore
  for (const d of [...purse].sort((a, b) => b - a)) while (left >= d) (out.push(d), (left -= d))
  return left === 0 ? out : []
}

/** A fact by id: canonical, or an instance read back from the id the way the round rebuilds it. */
function factOf(def: SkillDef, id: string): Fact {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  return { id, skill: def.id, family: id.split(':')[1], operands: [], answer: 0, rank: 0 }
}
const build = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, factOf(def, id), kind, makeRng(seed), 0).task

describe('money skills of 1.–2. klasse: the contract', () => {
  globalIdCheck()

  skillContract(coinNames, {
    families: { coins: 6, notes: 4 },
    answerOf: (f, kind, task) => (kind === 'multiSelect' ? undefined : PIECES.find((p) => `mnt:${p}` === f.id) && task.answer),
  })
  skillContract(countCoins, {
    families: { sameCoins: 20, mixedTo20: 20, mixedTo100: 20, biggestFirst: 20 },
    answerOf: (_f, _kind, task) => (task.prompt.scene === 'coins' ? sumOf(task.prompt.ore) : -1),
  })
  skillContract(payExact, {
    families: { to20: 15, to50: 20, to100: 20, fewestCoins: 20 },
    answerOf(f, kind, task) {
      const { priceOre, purse } = shop(task.prompt)
      if (kind === 'pay' && f.family !== 'fewestCoins') return priceOre
      return greedy(priceOre, purse).map((p) => `c${p}`).join('|')
    },
  })
  skillContract(change, {
    families: { from10: 9, from20: 16, from50: 20, from100: 20 },
    answerOf: (_f, _kind, task) => {
      const s = shop(task.prompt)
      return (s.paidOre ?? Number.NaN) - s.priceOre
    },
  })
})

// ─── coinNames ──────────────────────────────────────────────────────────────

describe('coinNames', () => {
  const tasks = tasksUnderTest(coinNames, 4)

  it('names the six coins and four notes, and asks for the piece by its name', () => {
    expect(coinNames.enumerate().map((f) => f.id).sort()).toEqual(PIECES.map((p) => `mnt:${p}`).sort())
    expect(text(build(coinNames, 'mnt:500', 'choice'))).toBe('Tryk på femkronen.')
    expect(text(build(coinNames, 'mnt:500', 'multiSelect'))).toBe('Tryk på alle femkroner.')
    expect(text(build(coinNames, 'mnt:50', 'choice'))).toBe('Tryk på halvtredsøren.')
    expect(text(build(coinNames, 'mnt:10000', 'choice'))).toBe('Tryk på hundredkronesedlen.')
  })

  it('deals pieces of the fact\'s own family on the cards', () => {
    for (const { fact, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'hear' })
      expect(task.optionView).toBe('coin')
      const coin = (p: number) => p <= 2000
      if (kind === 'choice') {
        expect(task.answerType).toBe('ore')
        for (const o of task.options) expect(coin(Number(o)), fact.id).toBe(coin(Number(task.answer)))
      }
    }
  })

  it('lays out seven pieces for "Tryk på alle …": two or three asked, each its own token that still reads as the piece', () => {
    for (const { fact, kind, task } of tasks) {
      if (kind !== 'multiSelect') continue
      const asked = Number(fact.id.split(':')[1])
      expect(task.answerType).toBe('set')
      expect(task.options).toHaveLength(7)
      for (const o of task.options) {
        expect(String(o)).toMatch(/^c\d+$/)
        expect(PIECES).toContain(pieceOf(String(o)))
        expect(pieceOf(String(o)) <= 2000).toBe(asked <= 2000)
      }
      const members = String(task.answer).split('|')
      expect(members.length).toBeGreaterThanOrEqual(2)
      expect(members.length).toBeLessThanOrEqual(3)
      expect(members.every((m) => pieceOf(m) === asked)).toBe(true)
      expect(task.options.filter((o) => pieceOf(String(o)) === asked)).toHaveLength(members.length)
      expect(isCorrect(task, [...members].reverse().join('|'))).toBe(true)
      expect(isProduction(task)).toBe(true)
    }
  })

  it('takes the look-alikes for near misses', () => {
    const t = build(coinNames, 'mnt:500', 'choice')
    expect(classifyAnswer(t, 200)).toBe('near')
    expect(classifyAnswer(t, 1000)).toBe('other')
    const n = build(coinNames, 'mnt:10000', 'choice')
    expect(classifyAnswer(n, 5000)).toBe('near')
    expect(classifyAnswer(n, 50000)).toBe('other')
  })

  it('tells what stands on the piece and how it looks', () => {
    const said = (id: string, kind?: TaskKind) => compile(coinNames.hint(factOf(coinNames, id), null, kind).speech).text
    expect(said('mnt:500')).toBe('Der står fem kroner på femkronen. Den er sølvfarvet med et hul og den største af sølvmønterne.')
    expect(said('mnt:100', 'multiSelect')).toBe('Find alle de mønter, hvor der står en krone. Den er sølvfarvet med et hul og den mindste af sølvmønterne.')
    expect(said('mnt:20000')).toBe('Der står to hundrede kroner på tohundredkronesedlen.')
    expect(coinNames.hint(factOf(coinNames, 'mnt:500'), null).visual).toEqual({ scene: 'coins', ore: [500] })
  })
})

// ─── countCoins ─────────────────────────────────────────────────────────────

describe('countCoins', () => {
  const facts = factsUnderTest(countCoins)
  const tasks = tasksUnderTest(countCoins)
  const coins = (f: Fact) => f.id.split(':')[2].split('+').map(Number)

  it('draws every family inside its own coins and amounts', () => {
    for (const f of facts) {
      const c = coins(f)
      const total = sumOf(c)
      expect(c.every((v) => [1, 2, 5, 10, 20].includes(v)), f.id).toBe(true)
      switch (f.family) {
        case 'sameCoins':
          expect(new Set(c).size, f.id).toBe(1)
          expect(total).toBeLessThanOrEqual(20)
          break
        case 'mixedTo20':
          expect(new Set(c).size, f.id).toBeGreaterThanOrEqual(2)
          expect(total).toBeLessThanOrEqual(20)
          expect(c, f.id).toEqual([...c].sort((a, b) => b - a))
          break
        case 'mixedTo100':
          expect(total).toBeGreaterThan(20)
          expect(total).toBeLessThanOrEqual(100)
          expect(c, f.id).toEqual([...c].sort((a, b) => b - a))
          break
        case 'biggestFirst': {
          expect(total).toBeGreaterThan(20)
          expect(total).toBeLessThanOrEqual(100)
          expect(new Set(c).size, f.id).toBeGreaterThanOrEqual(3)
          // a jumble: neither largest nor smallest first
          expect(c, f.id).not.toEqual([...c].sort((a, b) => b - a))
          expect(c, f.id).not.toEqual([...c].sort((a, b) => a - b))
          break
        }
      }
    }
  })

  it('shows the coins as they lie and takes whole kroner on the keypad', () => {
    for (const { fact, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'coins', ore: coins(fact).map((c) => c * 100) })
      expect(text(task)).toBe('Hvor mange penge er der?')
      expect(Number(task.answer) % 100).toBe(0)
      if (kind === 'keypad') {
        expect(task.entryScale).toBe(100)
        expect(task.unit).toBe('kr')
        expect(task.maxDigits).toBe(fact.family === 'sameCoins' || fact.family === 'mixedTo20' ? 2 : 3)
        expect(isProduction(task)).toBe(true)
        expect(ceilingFor(task)).toBe(5)
        // one in the kroner the keypad can take, not one in every øre
        expect(guessP(task)).toBeCloseTo(fact.family === 'sameCoins' || fact.family === 'mixedTo20' ? 1 / 21 : 1 / 101)
      } else {
        expect(task.optionView).toBe('amount')
        expect(ceilingFor(task)).toBe(3)
      }
    }
  })

  it('reads the number of coins as coinsAsCount, and as ambiguous when a coin says that number too (A9)', () => {
    const t = build(countCoins, 'tael:mixedTo20:10+5+2', 'keypad')
    expect(classifyAnswer(t, 300)).toBe('coinsAsCount')
    expect(classifyAnswer(t, 1000)).toBe('operand')
    expect(classifyAnswer(t, 1600)).toBe('near')
    expect(classifyAnswer(t, 1500)).toBe('near')
    expect(classifyAnswer(t, 2700)).toBe('other')
    // two 2-krone coins answered 2: counted the coins, or read the coin? Never evidence.
    expect(classifyAnswer(build(countCoins, 'tael:sameCoins:2+2', 'keypad'), 200)).toBe('ambiguous')
    expect(classifyAnswer(build(countCoins, 'tael:mixedTo20:5+2', 'keypad'), 200)).toBe('ambiguous')
    expect(classifyAnswer(build(countCoins, 'tael:mixedTo100:10+5+5+1+1', 'keypad'), 500)).toBe('ambiguous')
    for (const f of facts) {
      const n = coins(f).length
      const c = countCoins.candidates(f).find((x) => x.value === n * 100)
      if (n === sumOf(coins(f))) expect(c, f.id).toBeUndefined()
      else expect(c?.tag, f.id).toBe(coins(f).includes(n) ? 'ambiguous' : 'coinsAsCount')
    }
  })

  it('shows coinsAsCount as the diagnostic card wherever it can be evidence', () => {
    for (const { fact, kind, task } of tasks) {
      if (kind !== 'choice') continue
      const n = coins(fact).length * 100
      if (task.distractorTags[String(n)] === 'coinsAsCount' && n >= task.range[0] && n <= task.range[1]) expect(task.options, fact.id).toContain(n)
    }
  })

  it('flags a child who counts the coins, and never a child who guesses', () => {
    const pool = facts.filter((f) => f.family !== 'sameCoins')
    const keypad = (i: number) => buildTask(countCoins, pool[i % pool.length], 'keypad', makeRng(i), i).task
    expect(flagsRaised(keypad, 40, (t) => (t.prompt.scene === 'coins' ? t.prompt.ore.length * 100 : 0))).toContain('coinsAsCount')
    const rng = makeRng(5)
    const mixed = (i: number) => buildTask(countCoins, facts[i % facts.length], i % 2 ? 'choice' : 'keypad', makeRng(i), i).task
    const guess = (t: Task): AnswerValue => (t.kind === 'choice' ? rng.pick(t.options) : rng.between(0, t.range[1] / 100) * 100)
    expect([...flagsRaised(mixed, 500, guess)]).toEqual([])
  })

  it('counts on from the biggest coins, or in steps of one kind', () => {
    const said = (id: string, tag: string | null = null) => compile(countCoins.hint(factOf(countCoins, id), tag as never).speech).text
    expect(said('tael:biggestFirst:2+20+5+20')).toBe('Start med de største mønter. Tyve fyrre femogfyrre syvogfyrre. Det er syvogfyrre kroner.')
    expect(said('tael:sameCoins:2+2+2+2')).toBe('Tæl i spring med to. To fire seks otte. Det er otte kroner.')
    expect(said('tael:sameCoins:1+1+1')).toBe('Hver mønt er en krone. En to tre. Det er tre kroner.')
    expect(said('tael:mixedTo20:10+5+2', 'coinsAsCount')).toBe('Tæl ikke, hvor mange mønter der er, men hvad der står på dem. Start med de største mønter. Ti femten sytten. Det er sytten kroner.')
    expect(countCoins.hint(factOf(countCoins, 'tael:mixedTo20:10+5+2'), 'coinsAsCount')).toMatchObject({ misconception: 'coinsAsCount', visual: { scene: 'coinsSum', ore: [1000, 500, 200] } })
  })
})

// ─── payExact ───────────────────────────────────────────────────────────────

describe('payExact', () => {
  const facts = factsUnderTest(payExact)
  const tasks = tasksUnderTest(payExact)
  const price = (f: Fact) => Number(f.id.split(':')[2])

  it('draws prices inside each family', () => {
    const bounds = { to20: [3, 19], to50: [21, 49], to100: [51, 99], fewestCoins: [6, 99] } as const
    for (const f of facts) {
      const kr = price(f) / 100
      const [lo, hi] = bounds[f.family as keyof typeof bounds]
      expect(kr, f.id).toBeGreaterThanOrEqual(lo)
      expect(kr, f.id).toBeLessThanOrEqual(hi)
      expect(Number.isInteger(kr)).toBe(true)
    }
  })

  it('pays in the shop: any exact tray is right, fewestCoins only the fewest pieces', () => {
    for (const { fact, kind, task } of tasks) {
      const s = shop(task.prompt)
      expect(s.priceOre).toBe(price(fact))
      expect(s.paidOre).toBeUndefined()
      if (kind === 'pay') {
        expect(isProduction(task)).toBe(true)
        expect(ceilingFor(task)).toBe(5)
        if (fact.family === 'fewestCoins') {
          expect(task.answerType).toBe('set')
          const pieces = piecesOfSet(task.answer)!
          expect(pieces).toEqual(greedy(price(fact), s.purse))
          // the tray's order does not matter, the pieces do
          expect(isCorrect(task, [...String(task.answer).split('|')].reverse().join('|'))).toBe(true)
        } else {
          expect(task.answerType).toBe('ore')
          expect(task.answer).toBe(price(fact))
          // the purse can pay it (the pay view checks the same)
          expect(fewestPieces(price(fact), s.purse)).not.toBeNull()
        }
        expect(text(task)).toMatch(/^Betal /)
      } else {
        expect(task.answerType).toBe('set')
        expect(task.optionView).toBe('coins')
        expect(ceilingFor(task)).toBe(3)
        for (const o of task.options) {
          const pieces = piecesOfSet(o)
          expect(pieces, `${fact.id} ${String(o)}`).not.toBeNull()
          expect(pieces!.every((p) => s.purse.includes(p)), `${fact.id} ${String(o)}`).toBe(true)
          expect(String(o)).toBe(pieces!.map((p) => `c${p}`).join('|'))
          // a wrong card never pays the price, except the same money in more pieces in fewestCoins
          if (o !== task.answer) {
            if (fact.family === 'fewestCoins') {
              if (sumOf(pieces!) === price(fact)) expect(pieces!.length).toBeGreaterThan(piecesOfSet(task.answer)!.length)
            } else {
              expect(sumOf(pieces!), `${fact.id} ${String(o)}`).not.toBe(price(fact))
            }
          }
        }
        expect(sumOf(piecesOfSet(task.answer)!)).toBe(price(fact))
        expect(text(task)).toMatch(/^Hvilke penge er præcis /)
      }
    }
  })

  it('says the price and, for fewestCoins, how to pay', () => {
    expect(text(build(payExact, 'pay:to20:1700', 'pay'))).toBe('Betal sytten kroner.')
    expect(text(build(payExact, 'pay:to20:1700', 'choice'))).toBe('Hvilke penge er præcis sytten kroner?')
    expect(text(build(payExact, 'pay:fewestCoins:2700', 'pay'))).toBe('Betal syvogtyve kroner med så få mønter og sedler som muligt.')
    expect(text(build(payExact, 'pay:fewestCoins:2700', 'choice'))).toBe('Hvilke penge er præcis syvogtyve kroner med færrest mønter og sedler?')
  })

  it('classifies a krone off as near and the same money in more pieces as near in fewestCoins', () => {
    const t = build(payExact, 'pay:to20:1700', 'pay')
    expect(classifyAnswer(t, 1700)).toBeNull()
    expect(classifyAnswer(t, 1600)).toBe('near')
    expect(classifyAnswer(t, 700)).toBe('other')
    const few = build(payExact, 'pay:fewestCoins:2700', 'pay')
    expect(few.answer).toBe('c2000|c500|c200')
    expect(classifyAnswer(few, 'c2000|c500|c200')).toBeNull()
    expect(classifyAnswer(few, 'c1000|c1000|c500|c200')).toBe('near')
    expect(classifyAnswer(few, 'c2000|c500|c200|c100')).toBe('near')
    expect(classifyAnswer(few, 'c500|c500')).toBe('other')
  })

  it('starts with the biggest pieces that fit', () => {
    const said = (id: string, tag: string | null = null) => compile(payExact.hint(factOf(payExact, id), tag as never).speech).text
    expect(said('pay:to20:1700')).toBe('Start med de største penge, der passer. Ti femten sytten. Det er sytten kroner.')
    expect(said('pay:to100:7500', 'near')).toBe('Tæl pengene efter. Start med de største penge, der passer. Halvtreds halvfjerds femoghalvfjerds. Det er femoghalvfjerds kroner.')
    expect(payExact.hint(factOf(payExact, 'pay:to100:7500'), null).visual).toEqual({ scene: 'coinsSum', ore: [5000, 2000, 500] })
  })
})

// ─── change ─────────────────────────────────────────────────────────────────

describe('change', () => {
  const facts = factsUnderTest(change)
  const tasks = tasksUnderTest(change)

  it('pays with the family\'s coin or note and gives change in whole kroner', () => {
    const paid = { from10: 1000, from20: 2000, from50: 5000, from100: 10000 } as const
    for (const { fact, kind, task } of tasks) {
      const s = shop(task.prompt)
      expect(s.paidOre).toBe(paid[fact.family as keyof typeof paid])
      expect(s.priceOre).toBeLessThan(s.paidOre!)
      expect(Number(task.answer) % 100).toBe(0)
      expect(task.answerType).toBe('ore')
      expect(s.purse.every((p) => p < s.paidOre!)).toBe(true)
      expect(fewestPieces(Number(task.answer), s.purse)).not.toBeNull()
      expect(task.range).toEqual([0, 2 * s.paidOre!])
      if (kind === 'keypad') {
        expect(task.entryScale).toBe(100)
        expect(isProduction(task)).toBe(true)
      }
      if (kind === 'pay') expect(isProduction(task)).toBe(true)
      if (kind === 'choice') expect(ceilingFor(task)).toBe(3)
    }
    for (const f of facts.filter((x) => x.family === 'from20')) expect(Number(f.id.split(':')[2])).not.toBe(1000)
  })

  it('tells the price, what was paid, and asks for the change', () => {
    expect(text(build(change, 'byt:from20:1300', 'choice'))).toBe('Det koster tretten kroner. Du betaler med en tyvekrone. Hvor mange penge får du tilbage?')
    expect(text(build(change, 'byt:from50:2300', 'keypad'))).toBe('Det koster treogtyve kroner. Du betaler med en halvtredskroneseddel. Hvor mange penge får du tilbage?')
    expect(text(build(change, 'byt:from100:3700', 'pay'))).toBe('Det koster syvogtredive kroner. Du betaler med en hundredkroneseddel. Læg byttepengene i bakken.')
  })

  it('reads the price added as wrongOperation, the price and the coin as operands', () => {
    const t = build(change, 'byt:from20:1300', 'keypad')
    expect(t.answer).toBe(700)
    expect(classifyAnswer(t, 3300)).toBe('wrongOperation')
    expect(classifyAnswer(t, 1300)).toBe('operand')
    expect(classifyAnswer(t, 2000)).toBe('operand')
    expect(classifyAnswer(t, 600)).toBe('near')
    expect(classifyAnswer(t, 1700)).toBe('near')
    expect(classifyAnswer(t, 900)).toBe('other')
    const card = build(change, 'byt:from20:1300', 'choice')
    expect(card.options).toContain(3300)
  })

  it('reads 100 − 37 made up digit by digit (73) as digitComplement10, and as ambiguous when that is the price (A9)', () => {
    const t = build(change, 'byt:from100:3700', 'keypad')
    expect(t.answer).toBe(6300)
    expect(classifyAnswer(t, 7300)).toBe('digitComplement10')
    expect(classifyAnswer(t, 13700)).toBe('wrongOperation')
    // 100 − 55 made up digit by digit is 55: the price itself
    expect(classifyAnswer(build(change, 'byt:from100:5500', 'keypad'), 5500)).toBe('ambiguous')
    // only from a hundred
    expect(change.candidates(factOf(change, 'byt:from50:2300')).some((c) => c.tag === 'digitComplement10')).toBe(false)
    expect(detectableOf(build(change, 'byt:from100:3700', 'keypad')).sort()).toEqual(['digitComplement10', 'wrongOperation'])
  })

  it('flags a child who adds instead of taking away, and never a child who guesses', () => {
    const keypad = (i: number) => buildTask(change, facts[i % facts.length], 'keypad', makeRng(i), i).task
    expect(flagsRaised(keypad, 40, (t) => {
      const s = shop(t.prompt)
      return s.priceOre + (s.paidOre ?? 0)
    })).toContain('wrongOperation')
    const rng = makeRng(8)
    const kinds: TaskKind[] = ['choice', 'keypad', 'pay']
    const mixed = (i: number) => buildTask(change, facts[i % facts.length], kinds[i % 3], makeRng(i), i).task
    const guess = (t: Task): AnswerValue => (t.kind === 'choice' ? rng.pick(t.options) : rng.between(0, shop(t.prompt).paidOre! / 100) * 100)
    expect([...flagsRaised(mixed, 500, guess)]).toEqual([])
  })

  it('counts up from the price, on a number line to what was paid', () => {
    const h = change.hint(factOf(change, 'byt:from20:1300'), 'near')
    expect(compile(h.speech).text).toBe('Tæl op fra prisen til det, du betaler med. Fra tretten til tyve er syv kroner.')
    expect(h.visual).toEqual({ scene: 'line', min: 0, max: 20, hops: [13, 20] })
    expect(change.hint(factOf(change, 'byt:from20:600'), 'other').visual).toEqual({ scene: 'line', min: 0, max: 20, hops: [6, 10, 20] })
    const wrong = change.hint(factOf(change, 'byt:from20:1300'), 'wrongOperation')
    expect(compile(wrong.speech).text).toBe('Du skal have penge tilbage, så du skal trække fra. Tyve minus tretten giver syv.')
    expect(wrong.misconception).toBe('wrongOperation')
    const digits = change.hint(factOf(change, 'byt:from100:3700'), 'digitComplement10')
    expect(compile(digits.speech).text).toBe('Tæl op til den næste tier først. Fra syvogtredive til fyrre er tre. Fra fyrre til et hundrede er tres. Det er treogtres kroner.')
    expect(digits.visual).toEqual({ scene: 'line', min: 0, max: 100, hops: [37, 40, 100] })
  })

  it('starts a new key with a line that marks the price and the coin, never the hops that add up to the change', () => {
    for (const f of facts) {
      const s = { price: Number(f.id.split(':')[2]) / 100, paid: ({ from10: 10, from20: 20, from50: 50, from100: 100 } as const)[f.family as 'from10'] }
      const v = change.hint(f, null).visual
      expect(v, f.id).toEqual({ scene: 'line', min: 0, max: s.paid, arrowAt: s.price, target: s.paid })
    }
  })
})

// ─── All four ───────────────────────────────────────────────────────────────

describe('the money skills together', () => {
  const built = new Map(ALL.map((def) => [def.id, tasksUnderTest(def)]))

  it('give the misconception hint for the misconception, and speak every hint for every tag', () => {
    for (const def of ALL) {
      for (const { fact, kind, task } of built.get(def.id)!.filter((_, i) => i % 3 === 0)) {
        for (const tag of [null, 'near', 'operand', 'other', ...new Set(Object.values(task.distractorTags))]) {
          const h = def.hint(fact, tag as never, kind)
          expect(speechProblems(h.speech), `${fact.id} ${kind} ${String(tag)}`).toEqual([])
          expect(h.misconception ?? null, `${fact.id} ${String(tag)}`).toBe(isMisconception(tag as never) ? tag : null)
        }
      }
    }
  })

  it('builds the same hint from a fact the round screen rebuilds from the task (id only)', () => {
    for (const def of [countCoins, payExact, change]) {
      for (const { fact, kind, task } of built.get(def.id)!.filter((_, i) => i % 5 === 0)) {
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        for (const tag of [null, ...new Set(Object.values(task.distractorTags))]) {
          expect(def.hint(rebuilt, tag, kind)).toEqual(def.hint(fact, tag, kind))
        }
      }
    }
  })

  it('only ever names the coins and notes that exist, and the 1000-krone note never', () => {
    for (const def of ALL) {
      for (const { task } of built.get(def.id)!) {
        const p = task.prompt
        const shown = p.scene === 'coins' ? p.ore : p.scene === 'shop' ? [...p.purse, ...(p.paidOre ? [p.paidOre] : [])] : []
        for (const v of shown) expect(PIECES).toContain(v)
      }
    }
  })

  it('has one prefix per skill', () => {
    const prefixes = ALL.map((def) => new Set(factsUnderTest(def, 20).map((f) => f.id.split(':')[0])))
    expect(prefixes.map((s) => [...s])).toEqual([['mnt'], ['tael'], ['pay'], ['byt']])
  })

  it('has clips without digits, wave 2 except what only 3. klasse uses, and every one used', () => {
    const used = new Set<string>()
    for (const def of ALL) {
      used.add(def.canDo)
      for (const f of factsUnderTest(def, 30)) {
        for (const kind of def.kinds) for (const p of def.speech(f, kind)) if ('clip' in p) used.add(p.clip)
        for (const tag of [null, ...def.candidates(f).map((c) => c.tag)]) {
          for (const kind of def.kinds) for (const p of def.hint(f, tag, kind).speech) if ('clip' in p) used.add(p.clip)
        }
      }
    }
    const third = new Set(['s.payExact.asFewAsPossible', 's.payExact.withFewest', 'hint.pay.fewest', 'hint.change.nextTenFirst'])
    for (const [id, words] of Object.entries(MONEY_CLIPS)) {
      expect(words).not.toMatch(/\d/)
      expect(clipInfo(id)?.wave, id).toBe(third.has(id) ? 3 : 2)
      expect(used.has(id), id).toBe(true)
    }
  })

  it('keeps the 3. klasse families on the third wave: wave 2 speech never needs a wave 3 clip of mine', () => {
    for (const def of ALL) {
      for (const { fact, task } of built.get(def.id)!) {
        if (['fewestCoins', 'from100'].includes(fact.family)) continue
        for (const id of compile(task.speech).clips) if (id in MONEY_CLIPS) expect(clipInfo(id)?.wave, `${fact.id} ${id}`).toBe(2)
      }
    }
  })
})

// ─── Regions ────────────────────────────────────────────────────────────────

describe('Målebakken (w1-maal-penge), Købmandsgården (w2-penge) and Markedet (w3-penge-maal)', () => {
  const mine = new Set(['coinNames', 'countCoins', 'payExact', 'change'])
  // Målebakken's l1 is its measure skills only (measureUnits, rulerRead, weightCompare): not ours
  const regionNodes = NODES.filter((n) => (n.region === 'w1-maal-penge' || n.region === 'w2-penge') && n.skills.some((s) => mine.has(s.skill)))
  const profile = newProfile({ grade: 2, unlocked: { worlds: ['eng', 'bakke', 'skov'], regions: ['w1-maal-penge', 'w2-penge'] } })
  const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }

  it('has keys on every node that build every kind, inside the region\'s families', () => {
    expect(regionNodes.map((n) => n.id)).not.toContain('w1-maal-penge-l1')
    expect(regionNodes).toHaveLength(11)
    for (const node of regionNodes) {
      const keys = keysForNode(node, { states: {}, audioVerified: true }).filter((k) => mine.has(k.skill))
      expect(keys.length, node.id).toBeGreaterThan(0)
      for (const k of keys) {
        const families = node.skills.find((s) => s.skill === k.skill)?.families
        if (families) expect(families, k.key).toContain(k.family)
        for (const kind of k.kinds) {
          for (let i = 0; i < 4; i++) {
            const t = k.build(kind, makeRng(hashSeed(`${k.key}${i}`)), i)
            expect(speechProblems(t.speech), `${t.factId} ${kind}`).toEqual([])
          }
        }
      }
    }
  })

  it('leaves the 3. klasse families (fewestCoins, from100) out of Købmandsgården', () => {
    for (const node of NODES.filter((n) => n.region === 'w2-penge')) {
      for (const k of keysForNode(node, { states: {}, audioVerified: true })) {
        expect(['payExact/fewestCoins', 'change/from100']).not.toContain(k.key)
      }
    }
    const market = NODES.filter((n) => n.region === 'w3-penge-maal')
    const keys = market.flatMap((n) => keysForNode(n, { states: {}, audioVerified: true }).map((k) => k.key))
    expect(keys).toContain('payExact/fewestCoins')
    expect(keys).toContain('change/from100')
  })

  it('plans a whole round on every node, and a production-only trial', () => {
    for (const node of regionNodes) {
      for (let r = 0; r < 3; r++) {
        const plan = planRound(node, { ...profile, roundIndex: 20 + r }, ctx)
        expect(plan.tasks.length, node.id).toBe(node.size)
        for (const t of plan.tasks) {
          expect(speechProblems(t.speech), t.factId).toEqual([])
          if (node.slot === 'trial') expect(isProduction(t), `${node.id} ${t.factId} ${t.kind}`).toBe(true)
        }
      }
    }
  })
})
