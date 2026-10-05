// Markedet (w3-penge-maal) in the map (SPEC §5.3–5.4): kronerOre and convertCmM beside the 3. klasse families
// of three 2. klasse skills — change from100, payExact fewestCoins and unitChoice weight — in rounds of 8,
// and the finale of Stjernefjeldet. regionSuite plays all five together (so the finale always holds one of
// them): a fresh child gets a playable round on every node, read with recorded clips, the trial asks only for
// production, and every clip of clips/skills/money3.ts is spoken and recorded in wave 3. The blocks below
// build every kind of every key on Markedet's stones and check that a child who has met the keys also gets
// the 2. klasse skills' 3. klasse families there.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { keysForNode } from '../../registry'
import { isCorrect } from '../../answer'
import { isProduction } from '../../kinds'
import { keyAt, newProfile } from '../../testing/profile'
import { hashSeed, makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { regionSuite } from '../algebra/testing/regions'
import type { SkillId } from '../../types'

const MARKET: ReadonlySet<SkillId> = new Set<SkillId>(['change', 'kronerOre', 'convertCmM', 'unitChoice', 'payExact'])
/** The 3. klasse families of the 2. klasse skills Markedet plays. */
const THIRD: Readonly<Partial<Record<SkillId, string>>> = { change: 'from100', payExact: 'fewestCoins', unitChoice: 'weight' }
const ctx = { day: '2026-10-05', sessionId: 's', audioVerified: true }
const nodes = NODES.filter((n) => n.region === 'w3-penge-maal')

regionSuite('Markedet (kronerOre beside change, payExact and unitChoice)', MARKET, 'money3.ts', 'money-3', { wave: 3, minClips: 9 })

describe('Markedet', () => {
  it('plays its five skills where SPEC §5.3 says, the 2. klasse skills only in their 3. klasse families', () => {
    const region = REGION_BY_ID['w3-penge-maal']
    expect(region.skills.map((s) => [s.skill, s.families ?? null])).toEqual([
      ['change', ['from100']], ['kronerOre', null], ['convertCmM', null], ['unitChoice', ['weight']], ['payExact', ['fewestCoins']],
    ])
    expect([region.roundSize, region.chain, region.requires]).toEqual([8, 'pengeMaal', ['w2-penge']])
    expect(nodes).toHaveLength(6)
    const keys = new Set(nodes.flatMap((n) => keysForNode(n, { states: {}, audioVerified: true }).map((k) => `${k.skill}/${k.family}`)))
    for (const key of keys) {
      const [skill, family] = key.split('/')
      if (THIRD[skill as SkillId]) expect(family, key).toBe(THIRD[skill as SkillId])
    }
    for (const [skill, family] of Object.entries(THIRD)) expect(keys, skill).toContain(`${skill}/${family}`)
    for (const family of ['readAmount', 'fiftiesInKroner', 'addHalves']) expect(keys).toContain(`kronerOre/${family}`)
    for (const family of ['mToCm', 'mCmToCm', 'cmToMCm', 'compareMixed']) expect(keys).toContain(`convertCmM/${family}`)
  })

  it('builds every kind of every key on every stone: recorded clips, no digits, right answers, three cards', () => {
    for (const node of nodes) {
      for (const k of keysForNode(node, { states: {}, audioVerified: true })) {
        for (const kind of k.kinds) {
          for (let i = 0; i < 6; i++) {
            const t = k.build(kind, makeRng(hashSeed(`${node.id}${k.key}${kind}${i}`)), i)
            const where = `${node.id} ${t.factId} ${kind}`
            const c = compile(t.speech)
            expect([c.missing, /\d/.test(c.text)], where).toEqual([[], false])
            expect(isCorrect(t, t.answer), where).toBe(true)
            if (kind === 'choice') expect(t.options, where).toHaveLength(3)
            if (t.optionClips) for (const clip of t.optionClips) expect(compile([{ clip }]).missing, where).toEqual([])
          }
        }
      }
    }
  })

  it('fills a whole round on every stone, the trial with production only', () => {
    for (const node of nodes) {
      for (const seed of [3, 9]) {
        const plan = planRound(node, newProfile({ grade: 3 }), { ...ctx, seed })
        expect(plan.tasks.length, `${node.id} seed ${seed}`).toBe(node.size)
        for (const t of plan.tasks) {
          expect(MARKET.has(t.skill), `${node.id} ${t.skill}`).toBe(true)
          if (node.production === 'only') expect(isProduction(t), `${node.id} ${t.factId} ${t.kind}`).toBe(true)
        }
      }
    }
  })

  it('plays the 3. klasse families of the 2. klasse skills on the stones that mix the region, when they are what the child needs', () => {
    for (const node of nodes.filter((n) => n.slot === 'friend' || n.slot === 'l3' || n.slot === 'mix')) {
      // kronerOre and convertCmM are sure (box 4); change from100, payExact fewestCoins and unitChoice weight wobble (box 1)
      const keys = keysForNode(node, { states: {}, audioVerified: true })
      const states = Object.fromEntries(keys.map((k) => [k.key, keyAt(THIRD[k.skill] ? 1 : 4, '2026-10-04', 10)]))
      const played = new Set<string>()
      for (let seed = 1; seed <= 6; seed++) for (const t of planRound(node, newProfile({ grade: 3, keys: states }), { ...ctx, seed }).tasks) played.add(`${t.skill}/${t.family}`)
      for (const [skill, family] of Object.entries(THIRD)) expect(played, `${node.id} ${skill}`).toContain(`${skill}/${family}`)
    }
  })
})
