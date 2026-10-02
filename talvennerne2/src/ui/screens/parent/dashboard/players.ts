// "Skift spiller" and "Ny spiller" at the top of the dashboard (SPEC §8, review P1-1). The grown-up
// has passed the gate to get here, so both work at once — also with a single child, which is how a
// family adds a sibling and how siblings share one iPad:
//
//   Skift spiller   the running round is stored and the child unloaded, then "Hvem skal spille?"
//                   (the picker shows every child, also a single one, and "+ Ny spiller")
//   Ny spiller      onboarding for a new child (at most six); "back" from its first step returns
//                   here with the child who was playing when the dashboard opened
//
// The screen hands in the navigation and the session, so the rules are tested without a DOM.
import type { Route } from '../../../../app/routes'
import { canAddProfile } from '../../child/profiles/rules'

export interface PlayersDeps {
  nav: { go(route: Route): void; root(route: Route, direction?: 'forward' | 'back' | 'none'): void }
  session: {
    profileCount(): number
    /** Store the round, write, unload (useSession.leaveProfile). */
    leaveProfile(): Promise<void>
  }
  /** Put back the child who was playing when the dashboard opened (a sibling may be on screen). */
  restoreOrigin(): Promise<void>
}

export interface PlayersActions {
  /** Room for one more child (at most six). */
  canAdd(): boolean
  /** To the picker, with nobody loaded. */
  switchPlayer(): Promise<void>
  /** Onboarding for a new child. False (and nothing happens) when six already play. */
  newPlayer(): Promise<boolean>
}

export function playersActions(d: PlayersDeps): PlayersActions {
  const canAdd = () => canAddProfile(d.session.profileCount())
  return {
    canAdd,
    async switchPlayer() {
      await d.session.leaveProfile()
      d.nav.root({ id: 'profiles' }, 'back')
    },
    async newPlayer() {
      if (!canAdd()) return false
      await d.restoreOrigin()
      d.nav.go({ id: 'onboarding' })
      return true
    },
  }
}
