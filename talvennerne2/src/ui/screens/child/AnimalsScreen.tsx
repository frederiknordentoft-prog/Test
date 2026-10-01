// The `animals` route: Dyrehaven (SPEC §6), where the child sees and enjoys its animals. `uid` opens
// that animal's card at once (from the map's buddy, the end of a round or the books).
import { useEffect } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { useProfile } from '../../../state/useProfile'
import { usePlayTime } from './animals/usePlayTime'
import { ZooView } from './animals/ZooView'
import './animals/zoo.css'

export default function AnimalsScreen({ route }: ScreenProps<RouteOf<'animals'>>) {
  const profile = useProfile((s) => s.profile)
  usePlayTime()

  useEffect(() => {
    if (!profile) useNav.getState().root({ id: 'profiles' }, 'back')
  }, [profile])

  if (!profile) return null
  return <ZooView profile={profile} openUid={route.uid ?? null} onDress={(uid) => useNav.getState().go({ id: 'wardrobe', uid })} />
}
