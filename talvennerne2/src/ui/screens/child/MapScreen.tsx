// The `map` route (SPEC §5.3–5.7): one world at a time as a path of regions with stepping stones,
// worked out from the profile by mapModel() so it always agrees with the unlock rules. `world` picks
// the world (default: the furthest open one with something left), `region` brings a region into view
// and lights it (the end of a round passes the region whose fog just lifted). While the child looks
// at the map, the round's code is fetched in idle time, so a tap on a stone starts at once.
import { useEffect, useMemo, useState } from 'react'
import { whenIdle } from '../../../app/idle'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import type { WorldId } from '../../../engine/types'
import { useProfile } from '../../../state/useProfile'
import { useSession } from '../../../state/useSession'
import { openAdult } from './map/adult'
import { MapView } from './map/MapView'
import { homeWorld, mapModel } from './map/model'
import { switchPlayer } from './map/switch'
import { playFromMap } from './play/flow'

export default function MapScreen({ route }: ScreenProps<RouteOf<'map'>>) {
  const profile = useProfile((s) => s.profile)
  const profiles = useSession((s) => s.profiles)
  const [world, setWorld] = useState<WorldId | null>(route.world ?? null)

  useEffect(() => {
    if (route.world) setWorld(route.world)
  }, [route.world])

  useEffect(() => {
    if (!profile) useNav.getState().root({ id: 'profiles' }, 'back')
  }, [profile])

  // the round's chunks, before the first tap
  useEffect(
    () =>
      whenIdle(() => {
        void import('./PlayScreen').catch(() => undefined)
        void import('./RoundScreen').catch(() => undefined)
        void import('./play/prepare').catch(() => undefined)
      }),
    [],
  )

  const shown: WorldId = world ?? (profile ? homeWorld(profile) : 'eng')
  const model = useMemo(() => (profile ? mapModel(profile, shown) : null), [profile, shown])
  if (!profile || !model) return null
  // Siblings switch without the gate (only adding and deleting a child need it).
  const me = profiles.length >= 2 ? profiles.find((p) => p.id === profile.id) : undefined

  return (
    <MapView
      model={model}
      frame={profile.frameColor}
      highlight={route.region ?? null}
      first={profile.roundIndex === 0 && !profile.round}
      onWorld={setWorld}
      onPlay={playFromMap}
      onBuddy={() => useNav.getState().go({ id: 'wardrobe', ...(profile.buddyUid ? { uid: profile.buddyUid } : {}) })}
      onAdult={openAdult}
      switcher={me ? { initial: me.initial, frame: me.frameColor, onSwitch: () => void switchPlayer() } : null}
    />
  )
}
