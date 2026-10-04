import { create } from 'zustand'
// export/import (and its validator) is only needed by the parent dashboard: loaded on demand
import type { ExportFile, ExportProfile, ImportTarget } from '../data/export'
import { newId } from '../data/ids'
import { DEFAULT_DEVICE, readBoot, writeBoot, type DeviceSettings } from '../data/namespace'
import { PRUNE_DELAY_MS, schedulePrune } from '../data/prune'
import {
  createProfile as storeCreate, deleteProfile as storeDelete, listProfiles, type CreateProfileInput,
} from '../data/repo/profiles'
import type { Animal, FrameColor, Grade, ProfileDoc, ProfileId } from '../engine/types'
import { useProfile } from './useProfile'
import { useRound } from './useRound'

/**
 * The app start and who is playing (SPEC §8). One session id per app start. Boot reads
 * `talvennerne2.boot` (device settings, the quick profile index, the last profile) and lists the
 * profiles in IndexedDB, which stays the truth. With exactly one child the app goes straight in;
 * with two or more the picker is shown at every start; with none, onboarding.
 *
 * A profile switch first pauses a running round (like the pause button: the round is stored),
 * writes what is pending, and only then loads the other child.
 */

export interface ProfileSummary {
  id: ProfileId
  name: string
  /** First letter for the card. */
  initial: string
  grade: Grade
  frameColor: FrameColor
  level: number
  /** The buddy (with its outfit) shown on the card; null before the first friend. */
  buddy: Animal | null
  createdAt: number
}

export interface BootOptions {
  /** Delay of the start-up prune; null skips it (tests). Default PRUNE_DELAY_MS (2 s). */
  pruneDelayMs?: number | null
}

export interface SessionStore {
  phase: 'idle' | 'booting' | 'ready'
  sessionId: string
  profiles: ProfileSummary[]
  /** The profile being played, or null (picker or onboarding). */
  activeId: ProfileId | null
  lastProfileId: ProfileId | null
  device: DeviceSettings
  /** False when `talvennerne2.boot` could not be written (private mode, blocked storage). */
  bootStored: boolean
  /** Set when IndexedDB could not be read at boot; the app then starts empty. */
  storageError: string | null

  boot(opts?: BootOptions): Promise<void>
  refreshProfiles(): Promise<ProfileSummary[]>
  /** Switch to a profile (saves the current one first). Null when it no longer exists. */
  selectProfile(id: ProfileId): Promise<ProfileDoc | null>
  /** Back to the picker: pause the round, write, unload. */
  leaveProfile(): Promise<void>
  /** Create a profile (at most six) and, by default, switch to it. */
  createProfile(input: CreateProfileInput, opts?: { select?: boolean }): Promise<ProfileDoc>
  deleteProfile(id: ProfileId): Promise<void>
  /** Flush, then read the profiles for export. */
  exportProfiles(ids: readonly ProfileId[]): Promise<ExportFile>
  importProfile(entry: ExportProfile, target: ImportTarget): Promise<ProfileDoc>
  setDevice(patch: Partial<DeviceSettings>): void
  /** Result of the sound check (SPEC §8: two wrong taps → false). */
  setAudioVerified(verified: boolean): void
}

const RUNNING = new Set(['asking', 'answered', 'teaching', 'golden'])

function summarize(doc: ProfileDoc): ProfileSummary {
  const buddy = doc.animals.find((a) => a.uid === doc.buddyUid) ?? doc.animals[0] ?? null
  return {
    id: doc.id,
    name: doc.name,
    initial: Array.from(doc.name.trim())[0]?.toLocaleUpperCase('da-DK') ?? '',
    grade: doc.grade,
    frameColor: doc.frameColor,
    level: doc.economy.level,
    buddy,
    createdAt: doc.createdAt,
  }
}

/** Like the pause button, before anything else happens: a running round is stored for the current child. */
function pauseRunningRound(): void {
  const round = useRound.getState()
  if (RUNNING.has(round.status)) round.pause()
}

let bootPromise: Promise<void> | null = null
let cancelPrune: (() => void) | null = null

export const useSession = create<SessionStore>((set, get) => {
  function persistBoot(): void {
    const s = get()
    // without a readable database the stored index is better than an empty list
    const profileIds = s.storageError ? readBoot().profileIds : s.profiles.map((p) => p.id)
    const stored = writeBoot({ v: 1, profileIds, lastProfileId: s.lastProfileId, device: s.device })
    if (stored !== s.bootStored) set({ bootStored: stored })
  }

  return {
    phase: 'idle',
    sessionId: newId('s'),
    profiles: [],
    activeId: null,
    lastProfileId: null,
    device: { ...DEFAULT_DEVICE },
    bootStored: true,
    storageError: null,

    boot(opts = {}) {
      if (bootPromise) return bootPromise
      bootPromise = (async () => {
        set({ phase: 'booting' })
        const saved = readBoot()
        set({ device: saved.device })
        useProfile.getState().setContext({ sessionId: get().sessionId, audioVerified: saved.device.audioVerified === true })

        try {
          const profiles = (await listProfiles()).map(summarize)
          const ids = profiles.map((p) => p.id)
          const last = saved.lastProfileId && ids.includes(saved.lastProfileId) ? saved.lastProfileId : null
          set({ profiles, lastProfileId: last })
          persistBoot()
          if (profiles.length === 1) await get().selectProfile(profiles[0].id)
        } catch (err) {
          // IndexedDB unusable: start empty in memory, and leave the boot index as it was
          set({ storageError: err instanceof Error ? err.message : String(err), lastProfileId: saved.lastProfileId })
        }

        const delay = opts.pruneDelayMs === undefined ? PRUNE_DELAY_MS : opts.pruneDelayMs
        if (delay !== null && !get().storageError) cancelPrune = schedulePrune(delay)
        set({ phase: 'ready' })
      })()
      return bootPromise
    },

    async refreshProfiles() {
      const profiles = (await listProfiles()).map(summarize)
      const ids = profiles.map((p) => p.id)
      const s = get()
      set({
        profiles,
        activeId: s.activeId && ids.includes(s.activeId) ? s.activeId : null,
        lastProfileId: s.lastProfileId && ids.includes(s.lastProfileId) ? s.lastProfileId : null,
      })
      persistBoot()
      return profiles
    },

    async selectProfile(id) {
      const current = useProfile.getState().profile
      if (current?.id === id && get().activeId === id) return current
      pauseRunningRound()
      const doc = await useProfile.getState().loadProfile(id)
      if (!doc) {
        set({ activeId: null })
        await get().refreshProfiles()
        return null
      }
      set({ activeId: id, lastProfileId: id })
      persistBoot()
      return doc
    },

    async leaveProfile() {
      pauseRunningRound()
      await useProfile.getState().unload()
      set({ activeId: null })
    },

    async createProfile(input, opts = {}) {
      const doc = await storeCreate(input)
      await get().refreshProfiles()
      if (opts.select !== false) await get().selectProfile(doc.id)
      return doc
    },

    async deleteProfile(id) {
      if (useProfile.getState().profile?.id === id) {
        // the round belongs to the child being deleted: drop it, and drop the pending writes
        if (useRound.getState().status !== 'idle') useRound.getState().quit()
        await useProfile.getState().unload({ discard: true })
        set({ activeId: null })
      }
      await storeDelete(id)
      await get().refreshProfiles()
    },

    async exportProfiles(ids) {
      await useProfile.getState().flush()
      const { buildExport } = await import('../data/export')
      return buildExport(ids)
    },

    async importProfile(entry, target) {
      const replacingActive = target.mode === 'replace' && useProfile.getState().profile?.id === target.profileId
      if (replacingActive && useRound.getState().status !== 'idle') useRound.getState().quit()
      const { importProfile: storeImport } = await import('../data/export')
      // the active child stays loaded while its document is replaced, and is then reloaded in place
      const doc = replacingActive
        ? await useProfile.getState().replaceLoaded(() => storeImport(entry, target))
        : await storeImport(entry, target)
      await get().refreshProfiles()
      if (replacingActive && useProfile.getState().profile?.id === doc.id) {
        set({ activeId: doc.id, lastProfileId: doc.id })
        persistBoot()
      }
      return doc
    },

    setDevice(patch) {
      const device = { ...get().device, ...patch }
      set({ device })
      if ('audioVerified' in patch) useProfile.getState().setContext({ audioVerified: device.audioVerified === true })
      persistBoot()
    },

    setAudioVerified(verified) {
      get().setDevice({ audioVerified: verified })
    },
  }
})

/** Tests only: forget the boot so the next boot() runs again. */
export function resetSessionForTests(): void {
  cancelPrune?.()
  cancelPrune = null
  bootPromise = null
  useSession.setState({
    phase: 'idle', sessionId: newId('s'), profiles: [], activeId: null, lastProfileId: null,
    device: { ...DEFAULT_DEVICE }, bootStored: true, storageError: null,
  })
}
