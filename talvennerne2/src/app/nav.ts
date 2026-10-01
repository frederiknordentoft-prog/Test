// Navigation: one current route and a back stack. The dock jumps between its five roots (the
// stack is cleared), `go` pushes, `back` pops (or falls back to the map). Directions drive the
// screen transition. No URL routing: the app is one page on the home screen, and a reload starts
// from boot (which resumes a stored round).
import { create } from 'zustand'
import type { ScreenDirection } from '../ui/design/motion'
import type { Route } from './routes'

export interface NavStore {
  route: Route
  /** Earlier routes, oldest first. */
  stack: Route[]
  direction: ScreenDirection
  /** Push a route (forward). */
  go(route: Route): void
  /** Swap the current route without a back entry. */
  replace(route: Route, direction?: ScreenDirection): void
  /** Start over from a root route (the dock, the picker, after onboarding). */
  root(route: Route, direction?: ScreenDirection): void
  /** Pop; with an empty stack, go to the map. */
  back(): void
}

const BOOT_ROUTE: Route = { id: 'profiles' }

export const useNav = create<NavStore>((set, get) => ({
  route: BOOT_ROUTE,
  stack: [],
  direction: 'none',

  go(route) {
    const { route: current, stack } = get()
    set({ route, stack: [...stack, current], direction: 'forward' })
  },

  replace(route, direction = 'forward') {
    set({ route, direction })
  },

  root(route, direction = 'forward') {
    set({ route, stack: [], direction })
  },

  back() {
    const { stack } = get()
    const prev = stack[stack.length - 1]
    if (prev) set({ route: prev, stack: stack.slice(0, -1), direction: 'back' })
    else set({ route: { id: 'map' }, stack: [], direction: 'back' })
  },
}))

/** Tests only. */
export function resetNavForTests(route: Route = BOOT_ROUTE): void {
  useNav.setState({ route, stack: [], direction: 'none' })
}
