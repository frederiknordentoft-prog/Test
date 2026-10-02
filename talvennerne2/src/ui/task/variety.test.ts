import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { SkillId } from '../../engine/types'
import { demoTopic } from './demo/topic'
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
