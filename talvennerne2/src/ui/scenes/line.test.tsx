// The number line in the prompt (UI-fund 1, 2): a choice keeps the arrow it asks about, and a line
// can be empty (only its ends numbered).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Prompt, Task } from '../../engine/types'
import { lineGeometry } from '../task/numberline/View'
import { PromptScene } from './PromptScene'

const choiceOn = (prompt: Prompt): Task =>
  ({ id: 't', kind: 'choice', options: [340, 350, 300], prompt, answer: 350, answerType: 'int' }) as unknown as Task
/** Numbers written under the line (the materials draw them as <text>). */
const labels = (html: string) => [...html.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]))

describe('the line scene', () => {
  it('keeps the arrow on a choice ("Hvilket tal peger pilen på?") and leaves the cards unmarked', () => {
    const prompt: Prompt = { scene: 'line', min: 300, max: 400, arrowAt: 347 }
    const html = renderToStaticMarkup(<PromptScene prompt={prompt} task={choiceOn(prompt)} />)
    expect(html).not.toContain('tv-markedline')
    const plain = renderToStaticMarkup(<PromptScene prompt={{ scene: 'line', min: 300, max: 400 }} />)
    // the arrow is drawn: the scene with arrowAt has more paths than the bare line
    expect((html.match(/<path/g) ?? []).length).toBeGreaterThan((plain.match(/<path/g) ?? []).length)
  })

  it('still marks the cards\' numbers when no arrow asks (review r1 P2-7)', () => {
    const prompt: Prompt = { scene: 'line', min: 300, max: 400 }
    const html = renderToStaticMarkup(<PromptScene prompt={prompt} task={choiceOn(prompt)} />)
    expect(html).toContain('data-marks="340,350,300"')
  })

  it('draws an empty line with only its ends numbered when the prompt asks for it', () => {
    const full = renderToStaticMarkup(<PromptScene prompt={{ scene: 'line', min: 0, max: 100 }} />)
    const empty = renderToStaticMarkup(<PromptScene prompt={{ scene: 'line', min: 0, max: 100, endsOnly: true } as Prompt} />)
    expect(labels(full).length).toBeGreaterThan(2)
    expect(labels(empty)).toEqual([0, 100])
  })

  it('numbers only the ends of the answer line too', () => {
    expect(lineGeometry(0, 100, 340, false, true).labels).toEqual([0, 100])
    expect(lineGeometry(0, 100, 340).labels.length).toBeGreaterThan(2)
  })
})
