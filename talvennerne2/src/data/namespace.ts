// Web Storage for Talvennerne 2 (SPEC §9.2 "Navnerum"). The origin is shared with about ten other
// apps, so every key this app touches starts with `talvennerne2.` and all access goes through here:
//
//   localStorage    talvennerne2.boot, talvennerne2.lyt-flags
//   sessionStorage  talvennerne2.*
//
// Storage can be missing or throw (private mode, blocked site data, quota), so every access is wrapped:
// reads fall back to defaults and writes report false. The game keeps running either way.
import type { ProfileId } from '../engine/types'

export const KEY_PREFIX = 'talvennerne2.'
export const BOOT_KEY = 'talvennerne2.boot'
export const LYT_FLAGS_KEY = 'talvennerne2.lyt-flags'

/** The only two localStorage keys the app may use. */
export const LOCAL_KEYS = [BOOT_KEY, LYT_FLAGS_KEY] as const
export type LocalKey = (typeof LOCAL_KEYS)[number]

type StorageKind = 'localStorage' | 'sessionStorage'

function store(kind: StorageKind): Storage | null {
  try {
    // the getter itself throws a SecurityError when site data is blocked
    return (globalThis as Partial<Record<StorageKind, Storage>>)[kind] ?? null
  } catch {
    return null
  }
}

const isLocalKey = (key: string): key is LocalKey => (LOCAL_KEYS as readonly string[]).includes(key)

function get(kind: StorageKind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function put(kind: StorageKind, key: string, value: string): boolean {
  const s = store(kind)
  if (!s) return false
  try {
    s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function remove(kind: StorageKind, key: string): void {
  try {
    store(kind)?.removeItem(key)
  } catch {
    // nothing to do: the key is gone or storage is unavailable
  }
}

// ─── localStorage ───────────────────────────────────────────────────────────

export function localGet(key: LocalKey): string | null {
  return isLocalKey(key) ? get('localStorage', key) : null
}

export function localSet(key: LocalKey, value: string): boolean {
  return isLocalKey(key) ? put('localStorage', key, value) : false
}

export function localRemove(key: LocalKey): void {
  if (isLocalKey(key)) remove('localStorage', key)
}

/** Parsed JSON, or `fallback` when missing, unreadable or rejected by `accept`. */
export function localGetJson<T>(key: LocalKey, fallback: T, accept?: (v: unknown) => v is T): T {
  const raw = localGet(key)
  if (raw === null) return fallback
  try {
    const v: unknown = JSON.parse(raw)
    return accept ? (accept(v) ? v : fallback) : (v as T)
  } catch {
    return fallback
  }
}

export function localSetJson(key: LocalKey, value: unknown): boolean {
  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    return false
  }
  return localSet(key, text)
}

// ─── sessionStorage ─────────────────────────────────────────────────────────

/** `talvennerne2.<name>`; the name must be non-empty and must not repeat the prefix. */
export function sessionKey(name: string): string | null {
  if (!name || name.startsWith(KEY_PREFIX) || /\s/.test(name)) return null
  return KEY_PREFIX + name
}

export function sessionGet(name: string): string | null {
  const key = sessionKey(name)
  return key ? get('sessionStorage', key) : null
}

export function sessionSet(name: string, value: string): boolean {
  const key = sessionKey(name)
  return key ? put('sessionStorage', key, value) : false
}

export function sessionRemove(name: string): void {
  const key = sessionKey(name)
  if (key) remove('sessionStorage', key)
}

// ─── talvennerne2.boot ──────────────────────────────────────────────────────

/** Per-device settings (not per child). */
export interface DeviceSettings {
  /** Parent setting "Følg lydløs-knappen" (off by default: the app plays through the silent switch). */
  followSilentSwitch: boolean
  /** Result of the first-start sound check: true heard, false failed twice, null not checked yet. */
  audioVerified: boolean | null
  /** Calm animation before a profile is chosen (the profile's own setting wins once loaded). */
  calm: boolean
}

export interface BootState {
  v: 1
  /** Profile ids on this device, a quick index for the picker (IndexedDB stays the truth). */
  profileIds: ProfileId[]
  lastProfileId: ProfileId | null
  device: DeviceSettings
}

export const DEFAULT_DEVICE: Readonly<DeviceSettings> = { followSilentSwitch: false, audioVerified: null, calm: false }

export function defaultBoot(): BootState {
  return { v: 1, profileIds: [], lastProfileId: null, device: { ...DEFAULT_DEVICE } }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Tolerant parse: anything unreadable falls back to the default, field by field. */
export function parseBoot(raw: string | null): BootState {
  const base = defaultBoot()
  if (!raw) return base
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return base
  }
  if (!isObj(v)) return base
  const ids = Array.isArray(v.profileIds) ? v.profileIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
  const d = isObj(v.device) ? v.device : {}
  return {
    v: 1,
    profileIds: [...new Set(ids)],
    lastProfileId: typeof v.lastProfileId === 'string' && v.lastProfileId ? v.lastProfileId : null,
    device: {
      followSilentSwitch: typeof d.followSilentSwitch === 'boolean' ? d.followSilentSwitch : DEFAULT_DEVICE.followSilentSwitch,
      audioVerified: typeof d.audioVerified === 'boolean' ? d.audioVerified : DEFAULT_DEVICE.audioVerified,
      calm: typeof d.calm === 'boolean' ? d.calm : DEFAULT_DEVICE.calm,
    },
  }
}

export function readBoot(): BootState {
  return parseBoot(localGet(BOOT_KEY))
}

export function writeBoot(boot: BootState): boolean {
  return localSetJson(BOOT_KEY, boot)
}

/** Read, change and write the boot object; returns the new value even when it could not be stored. */
export function updateBoot(fn: (boot: BootState) => BootState): BootState {
  const next = fn(readBoot())
  writeBoot(next)
  return next
}
