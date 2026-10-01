// One child on the picker (SPEC §8): the fixed frame colour, the first letter, the buddy in its
// outfit as a static picture (or the stand-in before the first friend and for undrawn species) and
// the name. The whole card is one big button; the screen decides what a tap does.
import type { CSSProperties } from 'react'
import { FRAME_HEX } from '../../../../content/catalog'
import type { ProfileSummary } from '../../../../state/useSession'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { AnimalArt, Critter, lookOf } from '../onboarding/art'

export interface ProfileCardProps {
  profile: ProfileSummary
  onTap?: () => void
  /** Delete mode: a bin badge and a gentle wiggle. */
  deleting?: boolean
  /** A small, still copy (the delete confirmation). */
  mini?: boolean
  disabled?: boolean
}

export function ProfileCard({ profile, onTap, deleting, mini, disabled }: ProfileCardProps) {
  const { pressProps } = usePress(disabled || !onTap)
  const style = { '--frame': FRAME_HEX[profile.frameColor] } as CSSProperties
  const face = (
    <span className="tv-pcard__face">
      <span className="tv-pcard__stage">
        {profile.buddy ? (
          <AnimalArt look={lookOf(profile.buddy)} mode="static" crop="fit" mood="happy" className="tv-pcard__buddy" />
        ) : (
          <span className="tv-pcard__buddy">
            <Critter mood="happy" />
          </span>
        )}
      </span>
      <span className="tv-pcard__initial" aria-hidden>
        {profile.initial}
      </span>
      <SpokenText silent parts={[{ free: profile.name }]} text={profile.name} className="tv-pcard__name" />
      {deleting && (
        <span className="tv-pcard__bin" aria-hidden>
          <Icon name="trash" size={26} strokeWidth={2.4} />
        </span>
      )}
    </span>
  )
  if (mini) {
    return (
      <span className="tv-pcard tv-pcard--mini" style={style}>
        {face}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={cx('tv-pcard', deleting && 'is-deleting', 'tv-touch')}
      style={style}
      onClick={onTap}
      disabled={disabled}
      aria-label={profile.name}
      data-profile={profile.id}
      {...pressProps}
    >
      {face}
    </button>
  )
}

/** "+ Ny spiller": a dashed card in the same grid. */
export function AddPlayerCard({ label, onTap }: { label: string; onTap: () => void }) {
  const { pressProps } = usePress()
  return (
    <button type="button" className="tv-pcard tv-pcard--add tv-touch" onClick={onTap} aria-label={label} data-add-player="" {...pressProps}>
      <span className="tv-pcard__face">
        <span className="tv-pcard__plus" aria-hidden>
          <Icon name="userPlus" size={44} strokeWidth={2.2} />
        </span>
        <SpokenText silent clip="s.profiles.add" className="tv-pcard__name" />
      </span>
    </button>
  )
}
