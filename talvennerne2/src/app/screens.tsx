// Route → screen component. Screens are lazy chunks found by file name (routes.ts SCREEN_FILES),
// so the first paint only loads the frame and the screen it starts on.
import { lazy } from 'react'
import type { ComponentType } from 'react'
import { IconButton } from '../ui/design/Button'
import { useNav } from './nav'
import { SCREEN_FILES } from './routes'
import type { Route, RouteId } from './routes'

export interface ScreenProps<R extends Route = Route> {
  route: R
}

interface ScreenModule {
  default: ComponentType<ScreenProps<never>>
}

const modules = import.meta.glob<ScreenModule>('../ui/screens/*/*Screen.tsx')

const cache = new Map<RouteId, ComponentType<ScreenProps>>()

/** True when the screen's module exists (the build has every one; work in progress may not). */
export function hasScreen(id: RouteId): boolean {
  return `../ui/screens/${SCREEN_FILES[id]}.tsx` in modules
}

export function screenFor(id: RouteId): ComponentType<ScreenProps> {
  let c = cache.get(id)
  if (!c) {
    const load = modules[`../ui/screens/${SCREEN_FILES[id]}.tsx`]
    c = load ? (lazy(load) as unknown as ComponentType<ScreenProps>) : MissingScreen
    cache.set(id, c)
  }
  return c
}

/** Development only: a screen whose module is not written yet. */
function MissingScreen({ route }: ScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" data-missing-screen={route.id}>
      <code className="text-lg">{SCREEN_FILES[route.id]}</code>
      <IconButton icon="back" clip="s.ui.back" variant="card" onClick={() => useNav.getState().back()} />
    </div>
  )
}
