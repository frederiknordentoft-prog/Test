import { describe, expect, it } from 'vitest'
import { BREEDS, MAGIC_COLORWAYS, MOODS, NATURAL_COLORWAYS, SET_IDS, SLOTS, SPECIES_IDS, STAGES, breedsOf } from './types'
import type { ItemDef, ItemId, Mood } from './types'

// Typetests: kompilerer kun, hvis `sad` ikke er et humør og ItemDef ikke har et `tier`-felt.
type NoSad = 'sad' extends Mood ? false : true
type NoTier = 'tier' extends keyof ItemDef ? false : true
const noSad: NoSad = true
const noTier: NoTier = true
// Genstands-id'er: `<sæt>-<slot>` og `milepael-<navn>`.
const ids: ItemId[] = ['hverdag-head', 'fest-head', 'hverdag-body', 'milepael-legendekronen']

describe('kontrakten', () => {
  it('der findes ingen sad-mood (etik: aldrig skyld)', () => {
    expect(noSad).toBe(true)
    expect(MOODS as readonly string[]).not.toContain('sad')
    expect([...MOODS]).toEqual(['idle', 'happy', 'cheer', 'think', 'oops', 'sleep', 'wave'])
  })

  it('ItemDef har intet tier-felt', () => {
    expect(noTier).toBe(true)
  })

  it('de bindende id-lister', () => {
    expect([...SPECIES_IDS]).toEqual([
      'rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'lamb', 'fox', 'hamster',
      'unicorn', 'panda', 'squirrel', 'owl', 'pegasus', 'dragon', 'penguin', 'polarbear',
    ])
    expect(BREEDS).toEqual({
      rabbit: ['upright', 'lop', 'lionhead'],
      cat: ['domestic', 'longhair', 'mainecoon'],
      horse: ['shetland', 'fjord', 'arabian'],
      unicorn: ['foal', 'wavy', 'starhorn'],
    })
    expect(breedsOf('panda')).toEqual(['std'])
    expect(breedsOf('pip')).toEqual(['std'])
    expect([...NATURAL_COLORWAYS]).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
    expect([...MAGIC_COLORWAYS]).toEqual(['gold', 'rainbow', 'starwhite'])
    expect([...STAGES]).toEqual([1, 2, 3])
    expect([...SLOTS]).toEqual(['head', 'face', 'neck', 'body', 'back', 'hand'])
    expect([...SET_IDS]).toEqual([
      'hverdag', 'opdager', 'rytter', 'kongelig', 'astronaut', 'ridder', 'talmagiker', 'pirat', 'fodbold', 'vinter', 'fest',
    ])
    expect(ids).toHaveLength(4)
  })
})
