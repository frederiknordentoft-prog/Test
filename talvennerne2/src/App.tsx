// The app frame: boot, the shell with its sky and dock, and the current screen. Screens load lazily
// and navigate with useNav; the frame never knows what a screen shows.
import { Suspense, useEffect } from 'react'
import { startApp } from './app/boot'
import { useNav } from './app/nav'
import { DOCK_OF, DOCK_ROUTES, routeKey } from './app/routes'
import { screenFor } from './app/screens'
import { useProfile } from './state/useProfile'
import { useSession } from './state/useSession'
import { AppShell } from './ui/shell/AppShell'
import { Dock } from './ui/shell/Dock'

export function App() {
  const ready = useSession((s) => s.phase === 'ready')
  const route = useNav((s) => s.route)
  const direction = useNav((s) => s.direction)
  const hasProfile = useProfile((s) => s.profile !== null)

  useEffect(() => {
    void startApp()
  }, [])

  if (!ready) return <AppShell screenKey="boot">{null}</AppShell>

  const Screen = screenFor(route.id)
  const dockId = hasProfile ? DOCK_OF[route.id] : undefined
  const dock = dockId ? <Dock active={dockId} onSelect={(id) => useNav.getState().root(DOCK_ROUTES[id])} /> : undefined

  return (
    <AppShell screenKey={routeKey(route)} direction={direction} dock={dock}>
      <Suspense fallback={null}>
        <Screen route={route} />
      </Suspense>
    </AppShell>
  )
}
