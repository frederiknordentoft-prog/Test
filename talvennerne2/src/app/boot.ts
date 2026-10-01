// App start: the session boots (device settings, profiles), the settings reach the audio and motion
// layers and stay in sync, the voice preloads in idle time, and the first screen is chosen:
//   no profiles          → the grown-ups' intro (first start on the device)
//   one profile          → its map, or straight back into a stored round
//   two or more          → the picker
import { setFollowSilentSwitch } from '../audio/unlock'
import { setSfxEnabled } from '../audio/engine'
import { preloadVoice, setSpeechEnabled } from '../audio/voice'
import { setSkillKeyIndex } from '../data/aggregate'
import { loadAllClips } from '../speech/catalog'
import type { DeviceSettings } from '../data/namespace'
import type { ProfileDoc } from '../engine/types'
import { useProfile } from '../state/useProfile'
import { useSession } from '../state/useSession'
import { setCalm } from '../ui/design/motion'
import { useNav } from './nav'
import type { Route } from './routes'

/** Where a loaded profile starts: back into its stored round, else its map. */
export function profileHome(profile: ProfileDoc): Route {
  const r = profile.round
  if (r && r.nodeId !== 'placement') return { id: 'round', node: r.nodeId, resume: true }
  return { id: 'map' }
}

/** The first screen after boot (pure: tests feed it the stores' state). */
export function initialRoute(s: { profiles: readonly unknown[]; activeId: string | null }, profile: ProfileDoc | null): Route {
  if (s.profiles.length === 0) return { id: 'parentIntro' }
  if (s.activeId && profile) return profileHome(profile)
  return { id: 'profiles' }
}

/** Speech, effects and calm follow the loaded child's settings; the device's calm before that. */
export function applySettings(device: DeviceSettings, profile: ProfileDoc | null): void {
  const st = profile?.settings
  setSpeechEnabled(st ? st.speech : true)
  setSfxEnabled(st ? st.sfx : true)
  setCalm(st ? st.calm : device.calm)
}

let started: Promise<void> | null = null

/** Runs once per page: boot, wire the settings, pick the first screen. */
export function startApp(): Promise<void> {
  if (started) return started
  started = (async () => {
    // Procedure skills are aggregated per family key, which the skill registry knows. The registry
    // holds every skill module, so it stays out of the first load: a round needs it anyway.
    void import('../engine/registry').then(({ skillKeyIndex }) => {
      const index = skillKeyIndex()
      setSkillKeyIndex((skill) => index[skill])
    })
    // The game layer (rewards, ceremonies, unlocks) listens for finished rounds and notes what a
    // round started from. It needs the registry too, so it loads beside it, long before a first tap.
    void import('../state/useMeta').then(({ installMeta }) => installMeta())

    // the clip texts (screens show them, the voice speaks them) load beside the database
    await Promise.all([useSession.getState().boot(), loadAllClips()])

    let device = useSession.getState().device
    let profile = useProfile.getState().profile
    applySettings(device, profile)
    useSession.subscribe((s) => {
      if (s.device === device) return
      if (s.device.followSilentSwitch !== device.followSilentSwitch) setFollowSilentSwitch(s.device.followSilentSwitch)
      device = s.device
      applySettings(device, useProfile.getState().profile)
    })
    useProfile.subscribe((s) => {
      if (s.profile?.settings === profile?.settings && s.profile?.id === profile?.id) return
      profile = s.profile
      applySettings(useSession.getState().device, profile)
    })

    useNav.getState().root(initialRoute(useSession.getState(), useProfile.getState().profile), 'none')

    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
    const later = (cb: () => void) => (idle ? idle(cb) : setTimeout(cb, 300))
    later(() => void preloadVoice().catch(() => undefined))
  })()
  return started
}
