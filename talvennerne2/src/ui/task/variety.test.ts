import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { SkillId } from '../../engine/types'
import { SKILL_BY_ID } from '../../content/skills'
import { NUMBER_TOPICS, demoTopic } from './demo/topic'
import { moduleFor } from './registry'
import { shelfCells, sortOrderOwnsPrompt } from './sortOrder/View'

const reg = skillRegistry()
const keys = (skill: SkillId, max?: number) =>
  keysForSkills([{ skill, ...(max ? { max } : {}) }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })

describe('demo films that look like the child\'s own task (review r1 P2-8)', () => {
  it('shows counting in Tællelunden and sums only where the sums are', () => {
    const topicOf = (skill: SkillId) => {
      const k = keys(skill)[0]
      return demoTopic(k.build(k.kinds[0], makeRng(1), 0))
    }
    expect(topicOf('count10')).toBe('count')
    expect(topicOf('count20')).toBe('count')
    expect(topicOf('hear20')).toBe('hear')
    expect(topicOf('order20')).toBe('order')
    expect(topicOf('shapes2D')).toBe('shape')
    expect(topicOf('patterns')).toBe('pattern')
    expect(topicOf('compareLength')).toBe('length')
    expect(topicOf('addTo10')).toBe('add')
    expect(topicOf('tenFriends')).toBe('add')
    expect(topicOf('subTo10')).toBe('sub')
    // without a task (the design harness) the film counts
    expect(demoTopic(null)).toBe('count')
  })

  it('shows a clock in Urtårnet, coins in Købmandsgården and tables in Gangegrotten (UI-fund 20)', () => {
    const topicOf = (skill: SkillId) => {
      const k = keys(skill)[0]
      return demoTopic(k.build(k.kinds[0], makeRng(1), 0))
    }
    expect(topicOf('clockHour')).toBe('clock')
    expect(topicOf('clockQuarter')).toBe('clock')
    expect(topicOf('coinNames')).toBe('coin')
    expect(topicOf('countCoins')).toBe('money')
    expect(topicOf('payExact')).toBe('money')
    expect(topicOf('change')).toBe('money')
    expect(topicOf('shapes3D')).toBe('solid')
    expect(topicOf('sidesCorners')).toBe('corners')
    expect(topicOf('fractionShape')).toBe('fraction')
    expect(topicOf('measureUnits')).toBe('measure')
    expect(topicOf('unitChoice')).toBe('unit')
    expect(topicOf('weightCompare')).toBe('weight')
    expect(topicOf('mul2510')).toBe('mul')
    expect(topicOf('groupsOf')).toBe('groups')
    expect(topicOf('shareEqually')).toBe('share')
    expect(topicOf('tensOnes')).toBe('base')
  })

  it('never shows apples or a heard number for clocks, money, shapes, fractions, measuring or times tables', () => {
    const offTopic: string[] = []
    for (const def of reg.all) {
      const domain = SKILL_BY_ID[def.id].domain
      if (!['clock', 'money', 'shapes', 'fractions', 'measure', 'muldiv'].includes(domain)) continue
      for (const k of keys(def.id, 4)) {
        for (const kind of k.kinds) {
          const topic = demoTopic(k.build(kind, makeRng(1), 0))
          // the keypad film turns a topic without a number into counting; it must not be needed here
          const shown = kind === 'keypad' && !NUMBER_TOPICS.includes(topic) && topic !== 'solid' && topic !== 'shape' ? 'count' : topic
          if (shown === 'count' || shown === 'hear') offTopic.push(`${def.id}/${kind}: ${shown}`)
        }
      }
    }
    expect(offTopic).toEqual([])
  })
})

describe('sortOrder on a row of stones (review r1 P2-6)', () => {
  it('draws the row itself: one place for every card, the given numbers as stones', () => {
    for (const k of keys('order20', 10)) {
      for (let seed = 0; seed < 30; seed++) {
        const t = k.build('sortOrder', makeRng(seed), 0)
        expect(t.prompt.scene).toBe('row')
        expect(sortOrderOwnsPrompt(t)).toBe(true)
        expect(moduleFor(t).ownsPrompt?.(t)).toBe(true)
        const cells = shelfCells(t)
        expect(cells.filter((c) => c === null)).toHaveLength(t.options.length)
        // at most six stones, so the row fits one line on a phone
        expect(cells.length).toBeLessThanOrEqual(6)
      }
    }
  })

  it('leaves other sortOrder prompts to the round (the pencils to put in order)', () => {
    const k = keys('compareLength')[0]
    const t = k.build('sortOrder', makeRng(1), 0)
    expect(sortOrderOwnsPrompt(t)).toBe(false)
    expect(shelfCells(t).every((c) => c === null)).toBe(true)
  })
})
