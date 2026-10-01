// The `books` route (SPEC §1, §6.1, §13): the shelf with Samlebogen, Kan-bogen, Stempelbogen and
// Trofæerne; `book` opens one of them.
import { useEffect } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { playSfx } from '../../../audio/sfx'
import { useProfile } from '../../../state/useProfile'
import { usePlayTime } from './animals/usePlayTime'
import { BooksView } from './books/BooksView'
import './books/books.css'

export default function BooksScreen({ route }: ScreenProps<RouteOf<'books'>>) {
  const profile = useProfile((s) => s.profile)
  usePlayTime()

  useEffect(() => {
    if (!profile) useNav.getState().root({ id: 'profiles' }, 'back')
  }, [profile])

  if (!profile) return null
  return (
    <BooksView
      profile={profile}
      book={route.book ?? null}
      onOpen={(book) => {
        playSfx('side')
        useNav.getState().go({ id: 'books', book })
      }}
      onBack={() => useNav.getState().back()}
      onVisit={(uid) => useNav.getState().go({ id: 'animals', uid })}
    />
  )
}
