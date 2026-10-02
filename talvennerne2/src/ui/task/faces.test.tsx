// Numbers on cards (UI-fund 6): five digits are written as a child writes them (30045, not 30.045)
// and set smaller, so the whole number stays on a phone's card.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import { OptionFace } from './faces'

describe('long numbers on cards', () => {
  const reg = skillRegistry()
  const keys = keysForSkills([{ skill: 'hear1000', families: ['hTO'] }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
  const task = keys.map((k) => k.build('choice', makeRng(3), 0)).find((t) => t.options.some((o) => typeof o === 'number' && o > 9999))!

  it('writes a five-digit card without a separator, in the smaller size', () => {
    expect(task).toBeDefined()
    const five = task.options.find((o) => typeof o === 'number' && o > 9999) as number
    const html = renderToStaticMarkup(<OptionFace task={task} value={five} size="md" />)
    expect(html).toContain(`>${five}<`)
    expect(html).toContain('tv-face__num--xlong')
  })

  it('sets every card of the task in the same size, so the long one does not stand out', () => {
    for (const o of task.options) expect(renderToStaticMarkup(<OptionFace task={task} value={o} size="md" />)).toContain('tv-face__num--xlong')
  })

  it('keeps three digits at full size and sets four a little smaller', () => {
    const short = { ...task, options: [672, 772, 627] }
    expect(renderToStaticMarkup(<OptionFace task={short} value={672} size="md" />)).not.toMatch(/tv-face__num--x?long/)
    expect(renderToStaticMarkup(<OptionFace task={{ ...short, options: [] }} value={1004} size="md" />)).toContain('tv-face__num--long')
  })
})
