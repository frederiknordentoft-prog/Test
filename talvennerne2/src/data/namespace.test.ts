import { afterEach, describe, expect, it } from 'vitest'
import {
  BOOT_KEY, KEY_PREFIX, LOCAL_KEYS, LYT_FLAGS_KEY, defaultBoot, localGet, localGetJson, localRemove, localSet, localSetJson,
  parseBoot, readBoot, sessionGet, sessionKey, sessionRemove, sessionSet, updateBoot, writeBoot, type LocalKey,
} from './namespace'
import { MemoryStorage, ThrowingStorage, installStorage } from './testing/memoryStorage'

/**
 * The origin is shared with other apps: this app may only ever touch `talvennerne2.*` keys, and a
 * blocked or missing store must never crash it.
 */

let restore: (() => void)[] = []
afterEach(() => {
  restore.forEach((r) => r())
  restore = []
})

function withStores(local: Storage | 'getter-throws' | null, session: Storage | 'getter-throws' | null = new MemoryStorage()) {
  restore.push(installStorage('localStorage', local), installStorage('sessionStorage', session))
}

describe('the storage namespace', () => {
  it('only knows keys with the talvennerne2. prefix', () => {
    for (const key of LOCAL_KEYS) expect(key.startsWith(KEY_PREFIX)).toBe(true)
    expect(BOOT_KEY).toBe('talvennerne2.boot')
    expect(LYT_FLAGS_KEY).toBe('talvennerne2.lyt-flags')
    expect(sessionKey('hint-seen')).toBe('talvennerne2.hint-seen')
    expect(sessionKey('')).toBeNull()
    expect(sessionKey('talvennerne2.x')).toBeNull()
    expect(sessionKey('a b')).toBeNull()
  })

  it('round-trips the boot object and the lyt flags', () => {
    const local = new MemoryStorage()
    withStores(local)
    expect(readBoot()).toEqual(defaultBoot())
    const boot = { v: 1 as const, profileIds: ['p_a', 'p_b'], lastProfileId: 'p_b', device: { followSilentSwitch: true, audioVerified: false, calm: true } }
    expect(writeBoot(boot)).toBe(true)
    expect(readBoot()).toEqual(boot)
    expect(updateBoot((b) => ({ ...b, lastProfileId: 'p_a' })).lastProfileId).toBe('p_a')
    expect(readBoot().lastProfileId).toBe('p_a')
    expect(localSetJson(LYT_FLAGS_KEY, { 'q.add:3+4': true })).toBe(true)
    expect(localGetJson(LYT_FLAGS_KEY, {})).toEqual({ 'q.add:3+4': true })
    expect(Object.keys(local.dump()).sort()).toEqual([BOOT_KEY, LYT_FLAGS_KEY])
  })

  it('never touches other apps’ keys', () => {
    const local = new MemoryStorage()
    const session = new MemoryStorage()
    // V1 and a neighbour app on the same origin
    local.setItem('talvennerne' + '.save', '{"version":2,"facts":{"add:1+1":{"box":3}}}')
    local.setItem('x:y', 'naboens data')
    session.setItem('hint-seen', '1')
    const before = { local: local.dump(), session: session.dump() }
    withStores(local, session)

    writeBoot({ ...defaultBoot(), profileIds: ['p_1'] })
    updateBoot((b) => ({ ...b, lastProfileId: 'p_1' }))
    localSet(LYT_FLAGS_KEY, '{}')
    localRemove(LYT_FLAGS_KEY)
    sessionSet('hint-seen', 'ja')
    sessionGet('hint-seen')
    sessionRemove('hint-seen')
    sessionSet('round-tip', '1')
    // a key outside the allow-list is refused even if a caller casts its way past the type
    expect(localSet('x:y' as LocalKey, 'overskrevet')).toBe(false)
    expect(localGet('x:y' as LocalKey)).toBeNull()
    localRemove('x:y' as LocalKey)

    const afterLocal = local.dump()
    const afterSession = session.dump()
    for (const [k, v] of Object.entries(before.local)) expect(afterLocal[k]).toBe(v)
    for (const [k, v] of Object.entries(before.session)) expect(afterSession[k]).toBe(v)
    const added = [...Object.keys(afterLocal), ...Object.keys(afterSession)].filter((k) => !(k in before.local) && !(k in before.session))
    expect(added.every((k) => k.startsWith(KEY_PREFIX))).toBe(true)
  })

  it('keeps working without storage (Node, blocked site data)', () => {
    withStores(null, null)
    expect(readBoot()).toEqual(defaultBoot())
    expect(writeBoot(defaultBoot())).toBe(false)
    expect(sessionSet('x', '1')).toBe(false)
    expect(sessionGet('x')).toBeNull()
    expect(() => localRemove(BOOT_KEY)).not.toThrow()
  })

  it('keeps working when storage throws (private mode, quota, SecurityError getter)', () => {
    withStores(new ThrowingStorage(), 'getter-throws')
    expect(readBoot()).toEqual(defaultBoot())
    expect(writeBoot(defaultBoot())).toBe(false)
    expect(localSetJson(LYT_FLAGS_KEY, { a: 1 })).toBe(false)
    expect(localGetJson(LYT_FLAGS_KEY, { none: true })).toEqual({ none: true })
    expect(() => localRemove(BOOT_KEY)).not.toThrow()
    expect(sessionSet('x', '1')).toBe(false)
    expect(sessionGet('x')).toBeNull()
    expect(() => sessionRemove('x')).not.toThrow()
  })

  it('reads a damaged boot object field by field', () => {
    expect(parseBoot('not json')).toEqual(defaultBoot())
    expect(parseBoot('[1,2]')).toEqual(defaultBoot())
    expect(parseBoot(JSON.stringify({ profileIds: ['p_a', 3, '', 'p_a'], lastProfileId: 7, device: { calm: true, audioVerified: 'ja' } }))).toEqual({
      v: 1, profileIds: ['p_a'], lastProfileId: null, device: { followSilentSwitch: false, audioVerified: null, calm: true },
    })
  })
})
