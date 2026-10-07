// area and gridCoords through the real diagnostics (SPEC §4.3), ORK3b. The tasks come from Arealhaven's keys
// as rounds plan them (ORK3a's simulate, addsub3.oracle.ts), and the child keeps one idea worked out from the
// drawing by the oracle (shapes3.oracle.ts), not from the generator's tags. A child who counts the edge
// instead of the squares is flagged for areaAsPerimeter within 160 answers, and for nothing else; a child
// who answers right never is; a child who guesses 500 times never is, also when every tapped card counts.
// gridCoords' one misconception is coordSwap (SPEC A23; updated by GENFIX3 with the integrator's approval, before
// A23 the swap was plain): a child who always swaps the two numbers is flagged for it within 160 answers, and
// for nothing else; a child who answers right or guesses never is.
import { describe, expect, it } from 'vitest'
import { hashSeed, makeRng } from '../../rng'
import type { AnswerValue, Task } from '../../types'
import { answersRight, simulate, type Child } from '../addsub/addsub3.oracle'
import { areaQuestion, drawnOf, gridAnswers, pointIdOf, type AreaFamily } from './shapes3.oracle'

const NODE = 'w3-areal-l3'
const FAMILY: Readonly<Record<string, AreaFamily>> = { n: 'countSquares', r: 'rowsCols', l: 'lShape', c: 'compareArea' }

/** Counts the edge round the figure (compareArea: the difference of the two edges), on the keys and the cards. */
function countsTheEdge(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3b-edge:${seed}`))
  return (t: Task): AnswerValue => {
    const q = areaQuestion(FAMILY[t.factId.split(':')[1]], drawnOf(t.prompt)!)!
    if (t.kind === 'choice') return t.options.includes(q.edge) ? q.edge : rng.pick(t.options)
    return q.edge < 10 ** t.maxDigits ? q.edge : t.answer
  }
}

/** Taps a random card, types a number in range, sets or reads a random point of the net (49). */
function guesses(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3b-guess:${seed}`))
  return (t: Task): AnswerValue => {
    if (t.kind === 'choice') return rng.pick(t.options)
    if (t.kind === 'grid' && typeof t.answer === 'string') return rng.pick(gridAnswers({ family: t.answer.startsWith('pt:') ? 'placePoint' : 'readPoint' }))
    return rng.between(t.range[0], t.range[1])
  }
}

/** Sets and reads every point with its two numbers swapped; on the cards the point's other number. */
const swapsTheNumbers: Child = (t) => {
  const q = pointIdOf(t.factId)!
  if (t.kind === 'grid') return q.family === 'readPoint' ? `x:${q.y}|y:${q.x}` : `pt:${q.y},${q.x}`
  return t.answer === q.x ? q.y : q.x
}

describe('area through the real diagnostics (SPEC §4.3)', () => {
  it('flags a child who counts the edge instead of the squares (areaAsPerimeter) within 160 answers, and nothing else', () => {
    const { flagged } = simulate(NODE, 'area', countsTheEdge('a'), 160)
    expect([...flagged.keys()]).toEqual(['areaAsPerimeter'])
    expect(flagged.get('areaAsPerimeter')).toBeLessThanOrEqual(160)
  })

  it('flags nothing for a child who answers right (160 answers)', () => {
    expect([...simulate(NODE, 'area', answersRight, 160).flagged.keys()]).toEqual([])
  })

  it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
    expect([...simulate(NODE, 'area', guesses('area:a'), 500).flagged.keys()]).toEqual([])
    expect([...simulate(NODE, 'area', guesses('area:b'), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
  })
})

describe('gridCoords through the real diagnostics (SPEC §4.3, A23): coordSwap', () => {
  it('flags a child who swaps the two numbers of every point (coordSwap) within 160 answers, and nothing else', () => {
    const { flagged } = simulate(NODE, 'gridCoords', swapsTheNumbers, 160)
    expect([...flagged.keys()]).toEqual(['coordSwap'])
    expect(flagged.get('coordSwap')).toBeLessThanOrEqual(160)
  })

  it('flags nothing for a child who answers right, or guesses 500 times', () => {
    expect([...simulate(NODE, 'gridCoords', answersRight, 160).flagged.keys()]).toEqual([])
    expect([...simulate(NODE, 'gridCoords', guesses('grid:a'), 500).flagged.keys()]).toEqual([])
    expect([...simulate(NODE, 'gridCoords', guesses('grid:b'), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
  })
})
