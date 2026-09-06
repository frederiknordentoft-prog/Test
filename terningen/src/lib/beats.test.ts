import { describe, expect, it } from 'vitest'
import {
  BEAT_COUNT,
  BEAT_ORDER,
  FIRST_BEAT,
  LAST_BEAT,
  beatForComponent,
  beatForState,
  clampBeat,
  componentForBeat,
  nextBeat,
  prevBeat,
  resolveBeat,
  stageForBeat,
} from './beats'

describe('beat-sekvensering', () => {
  it('har 9 beats: samlet, eksploderet og syv komponenter', () => {
    expect(FIRST_BEAT).toBe(0)
    expect(LAST_BEAT).toBe(8)
    expect(BEAT_COUNT).toBe(9)
    expect(BEAT_ORDER).toHaveLength(7)
  })

  it('næste klemmer i den øvre ende', () => {
    expect(nextBeat(0)).toBe(1)
    expect(nextBeat(7)).toBe(8)
    expect(nextBeat(8)).toBe(8)
    expect(nextBeat(99)).toBe(8)
  })

  it('forrige klemmer i den nedre ende', () => {
    expect(prevBeat(8)).toBe(7)
    expect(prevBeat(1)).toBe(0)
    expect(prevBeat(0)).toBe(0)
    expect(prevBeat(-5)).toBe(0)
  })

  it('kan køre hele fortællingen frem og tilbage med piletaster', () => {
    let b = 0
    const forward: number[] = []
    for (let i = 0; i < 12; i++) {
      b = nextBeat(b)
      forward.push(b)
    }
    expect(forward).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8])
    const backward: number[] = []
    for (let i = 0; i < 12; i++) {
      b = prevBeat(b)
      backward.push(b)
    }
    expect(backward).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0])
  })

  it('clampBeat håndterer ugyldige tal', () => {
    expect(clampBeat(Number.NaN)).toBe(0)
    expect(clampBeat(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampBeat(3.4)).toBe(3)
    expect(clampBeat(-1)).toBe(0)
    expect(clampBeat(100)).toBe(8)
  })

  it('mapper beats til komponenter og tilbage', () => {
    expect(componentForBeat(0)).toBeNull()
    expect(componentForBeat(1)).toBeNull()
    for (let i = 0; i < BEAT_ORDER.length; i++) {
      const id = BEAT_ORDER[i]!
      expect(componentForBeat(2 + i)).toBe(id)
      expect(beatForComponent(id)).toBe(2 + i)
    }
    expect(stageForBeat(0)).toBe('assembled')
    expect(stageForBeat(1)).toBe('exploded')
    expect(stageForBeat(8)).toBe('exploded')
  })

  it('resolveBeat og beatForState er hinandens modsætning', () => {
    for (let b = FIRST_BEAT; b <= LAST_BEAT; b++) {
      const r = resolveBeat(b)
      expect(beatForState(r.stage, r.openComponent)).toBe(b)
    }
    expect(beatForState('assembled', null)).toBe(0)
    expect(beatForState('exploded', null)).toBe(1)
    expect(beatForState('assembled', 'kunde')).toBe(2)
  })
})
