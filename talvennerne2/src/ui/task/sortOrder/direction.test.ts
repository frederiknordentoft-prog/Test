import { describe, expect, it } from 'vitest'
import { factsOf, skillRegistry } from '../../../engine/registry'
import { hashSeed, makeRng } from '../../../engine/rng'
import { buildTask } from '../../../engine/tasks'
import type { Task } from '../../../engine/types'
import { clipText } from '../../../speech/catalog'
import { toDanishText } from '../../../speech/compile'
import { shelfDirection, sortOrderOwnsPrompt } from './View'

/**
 * Brøker i rækkefølge (QA3a P2-3): the screen says which end to start from. fractionCompare's row of
 * places goes down (the biggest first) or up (the smallest first), and the view writes "Størst" and
 * "Mindst" at its ends. Every other sortOrder, all of 0.–2. klasse, draws no direction.
 */

const reg = skillRegistry()
const value = (token: string) => {
  const [n, d] = token.replace('frac:', '').split('/').map(Number)
  return n / d
}

function sortTasks(skill: string): Task[] {
  const def = reg.get(skill as never)!
  return factsOf(def).map((f, i) => buildTask(def, f, 'sortOrder', makeRng(hashSeed(`${f.id}:${i}`)), 0).task)
}

describe('sortOrder shows its direction', () => {
  it('fractions: down from the biggest when the biggest is asked first, else up from the smallest', () => {
    const tasks = sortTasks('fractionCompare')
    expect(tasks.length).toBeGreaterThan(40)
    for (const t of tasks) {
      expect(sortOrderOwnsPrompt(t), t.factId).toBe(true)
      const dir = shelfDirection(t)
      const order = String(t.answer).split('|').map(value)
      // the answer runs the way the ends say
      expect(dir, t.factId).toBe(order[0] > order[order.length - 1] ? -1 : 1)
      // and the way the question says
      expect(toDanishText(t.speech), t.factId).toContain(dir < 0 ? 'den største' : 'den mindste')
    }
    expect(tasks.some((t) => shelfDirection(t) < 0) && tasks.some((t) => shelfDirection(t) > 0)).toBe(true)
    expect(clipText('s.kind.sortOrder.biggest')).toBe('Størst')
    expect(clipText('s.kind.sortOrder.smallest')).toBe('Mindst')
  })

  it('draws no direction for any other sortOrder (0.–2. klasse unchanged)', () => {
    for (const def of reg.all) {
      if (def.id === 'fractionCompare' || !def.kinds.includes('sortOrder')) continue
      for (const t of sortTasks(def.id)) expect(shelfDirection(t), t.factId).toBe(0)
    }
  })
})
