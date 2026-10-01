// "Hvem skal spille?" (SPEC §8 "Profiler"), shown at every start with two or more children: cards in
// two columns and three rows (three columns on a wide screen) with each child's frame colour, first
// letter and buddy. A tap says the name and plays as that child, from its map or its stored round.
// "+ Ny spiller" (at most six), "Slet" and the grown-ups' area sit behind the gate; a deletion is
// confirmed once more.
import { useMemo, useRef, useState } from 'react'
import { profileHome } from '../../../app/boot'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import type { ProfileId } from '../../../engine/types'
import type { ProfileSummary } from '../../../state/useSession'
import { useSession } from '../../../state/useSession'
import { Button, IconButton } from '../../design/Button'
import { Sheet } from '../../design/Sheet'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { useAdultGate } from '../../overlays/AdultGate'
import { TopBar } from '../../shell/TopBar'
import { AddPlayerCard, ProfileCard } from './profiles/ProfileCard'
import { canAddProfile, pickerActions } from './profiles/rules'
import './onboarding/first-start.css'
import './profiles/profiles.css'

export default function ProfilePickerScreen(_: ScreenProps<RouteOf<'profiles'>>) {
  const profiles = useSession((s) => s.profiles)
  const speech = useSpeech()
  const gate = useAdultGate()
  const [deleting, setDeleting] = useState(false)
  /** The child the confirmation is about (kept while the sheet slides away). */
  const [target, setTarget] = useState<ProfileSummary | null>(null)
  const [confirming, setConfirming] = useState(false)
  const busy = useRef(false)

  const actions = useMemo(
    () =>
      pickerActions({
        gate: { open: gate.open },
        nav: useNav.getState(),
        session: {
          profileCount: () => useSession.getState().profiles.length,
          selectProfile: (id) => useSession.getState().selectProfile(id),
          deleteProfile: (id) => useSession.getState().deleteProfile(id),
        },
        home: profileHome,
      }),
    [gate.open],
  )

  const tap = (p: ProfileSummary) => {
    if (deleting) {
      setTarget(p)
      setConfirming(true)
      return
    }
    if (busy.current) return
    busy.current = true
    speech.speak([{ free: p.name }])
    void actions.choose(p.id).finally(() => {
      busy.current = false
    })
  }

  const remove = async (id: ProfileId) => {
    setConfirming(false)
    setDeleting(false)
    await actions.remove(id)
  }

  const count = profiles.length
  // Nobody to pick: the intro takes over (boot may render the picker for a moment before it does).
  if (count === 0) return <div className="tv-first tv-picker" data-empty="" />
  return (
    <div className="tv-first tv-picker" data-deleting={deleting ? '' : undefined}>
      <TopBar
        extra={
          deleting ? (
            <IconButton icon="check" clip="s.ui.check" variant="good" sayLabel onClick={() => setDeleting(false)} data-done-delete="" />
          ) : (
            <IconButton icon="trash" clip="s.profiles.delete" variant="glass" onClick={() => actions.unlockDelete(() => setDeleting(true))} data-delete="" />
          )
        }
        onAdult={actions.adult}
      />
      <div className="tv-first__body tv-picker__body">
        <div className="tv-picker__group">
          <SpokenText as="h1" clip={deleting ? 's.profiles.delete.pick' : 's.profiles.title'} className="tv-picker__title" />
          <div className="tv-picker__grid" data-count={count + (canAddProfile(count) && !deleting ? 1 : 0)}>
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} deleting={deleting} onTap={() => tap(p)} />
            ))}
            {!deleting && canAddProfile(count) && <AddPlayerCard label={speech.text('s.profiles.add')} onTap={() => actions.add()} />}
          </div>
        </div>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="s.profiles.delete.title" closeClip="s.profiles.delete.cancel">
        {target && (
          <div className="tv-picker__confirm">
            <ProfileCard profile={target} mini />
            <SpokenText as="p" clip="s.profiles.delete.body" className="tv-picker__warn" />
            <div className="tv-first__actions">
              <Button variant="secondary" clip="s.profiles.delete.cancel" onClick={() => setConfirming(false)} />
              <Button icon="trash" clip="s.ui.delete" onClick={() => void remove(target.id)} data-confirm-delete="" />
            </div>
          </div>
        )}
      </Sheet>
      {gate.element}
    </div>
  )
}
