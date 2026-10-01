// What the profile picker may do (SPEC §8 "Profiler"), apart from how it looks: at most six players,
// "+ Ny spiller", "Slet" and the grown-ups' area only behind the gate, a tap on a child plays as that
// child. The screen hands in the gate, the navigation and the session, so the rules are tested
// without a DOM (rules.test.ts).
import { MAX_PROFILES } from '../../../../content/catalog'
import type { ProfileDoc, ProfileId } from '../../../../engine/types'
import type { Route } from '../../../../app/routes'

export const canAddProfile = (count: number): boolean => count < MAX_PROFILES

export interface PickerDeps {
  gate: { open(onPass: () => void): void }
  nav: { go(route: Route): void; root(route: Route, direction?: 'forward' | 'back' | 'none'): void }
  session: {
    profileCount(): number
    selectProfile(id: ProfileId): Promise<ProfileDoc | null>
    deleteProfile(id: ProfileId): Promise<void>
  }
  /** Where a loaded child starts (boot.ts profileHome: its map or its stored round). */
  home(profile: ProfileDoc): Route
}

export interface PickerActions {
  /** Play as this child. False when the profile is gone (the list refreshes itself). */
  choose(id: ProfileId): Promise<boolean>
  /** "+ Ny spiller": the gate, then onboarding. False (and no gate) when six already play. */
  add(): boolean
  /** "Slet": the gate first; `unlocked` runs after a right answer (the screen enters delete mode). */
  unlockDelete(unlocked: () => void): void
  /** Delete after the confirmation; with nobody left the grown-ups' intro starts over. */
  remove(id: ProfileId): Promise<void>
  /** The grown-ups' button: the gate, then the dashboard. */
  adult(): void
}

export function pickerActions(d: PickerDeps): PickerActions {
  return {
    async choose(id) {
      const doc = await d.session.selectProfile(id)
      if (!doc) return false
      d.nav.root(d.home(doc))
      return true
    },
    add() {
      if (!canAddProfile(d.session.profileCount())) return false
      d.gate.open(() => d.nav.go({ id: 'onboarding' }))
      return true
    },
    unlockDelete(unlocked) {
      d.gate.open(unlocked)
    },
    async remove(id) {
      await d.session.deleteProfile(id)
      if (d.session.profileCount() === 0) d.nav.root({ id: 'parentIntro' }, 'back')
    },
    adult() {
      d.gate.open(() => d.nav.go({ id: 'parent' }))
    },
  }
}
