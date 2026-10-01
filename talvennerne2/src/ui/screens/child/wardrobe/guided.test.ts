import { afterEach, describe, expect, it } from 'vitest'
import { MemoryStorage, ThrowingStorage, installStorage } from '../../../../data/testing/memoryStorage'
import { GUIDED_KEY, markGuided, wasGuided } from './guided'

/** "The first time" of the guided dressing is remembered per child, under the app's own key only. */

let restore: () => void = () => undefined
afterEach(() => restore())

describe('the guided dressing is remembered', () => {
  it('per child, under a talvennerne2. key', () => {
    const store = new MemoryStorage()
    restore = installStorage('localStorage', store)
    expect(GUIDED_KEY.startsWith('talvennerne2.')).toBe(true)
    expect(wasGuided('ada')).toBe(false)
    markGuided('ada')
    markGuided('ada')
    expect(wasGuided('ada')).toBe(true)
    expect(wasGuided('bo')).toBe(false)
    expect(Object.keys(store.dump())).toEqual([GUIDED_KEY])
    expect(JSON.parse(store.getItem(GUIDED_KEY)!)).toEqual(['ada'])
  })

  it('never breaks without storage, or with storage that throws or holds junk', () => {
    restore = installStorage('localStorage', new ThrowingStorage())
    expect(() => markGuided('ada')).not.toThrow()
    expect(wasGuided('ada')).toBe(false)
    restore()
    restore = installStorage('localStorage', 'getter-throws')
    expect(() => markGuided('ada')).not.toThrow()
    expect(wasGuided('ada')).toBe(false)
    restore()
    const junk = new MemoryStorage()
    junk.setItem(GUIDED_KEY, '{nope')
    restore = installStorage('localStorage', junk)
    expect(wasGuided('ada')).toBe(false)
    markGuided('ada')
    expect(wasGuided('ada')).toBe(true)
  })
})
