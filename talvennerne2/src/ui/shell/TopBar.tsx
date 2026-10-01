// Top bar: ✕ (pauses and saves a round) or ← on the left, free centre (the stone path in a round,
// meters on the map), "Hør igen" and the grown-ups' button on the right. All targets ≥ 60 px.
import type { ReactNode } from 'react'
import { IconButton } from '../design/Button'
import { cx } from '../design/cx'

export interface TopBarProps {
  /** ✕ closes/pauses (rounds), ← goes back (sub-screens), any element (e.g. the profile), or none. */
  leading?: 'close' | 'back' | ReactNode
  onLeading?: () => void
  center?: ReactNode
  /** Shows the ear button ("Hør igen") that replays the current prompt. */
  onReplay?: () => void
  /** Shows the grown-ups' button (opens the adult gate). */
  onAdult?: () => void
  /** Extra buttons before the ear (e.g. "Vis mig"). */
  extra?: ReactNode
  className?: string
}

export function TopBar({ leading = null, onLeading, center, onReplay, onAdult, extra, className }: TopBarProps) {
  return (
    <header className={cx('tv-topbar', className)}>
      <div className="tv-topbar__side">
        {leading === 'close' ? (
          <IconButton icon="close" clip="s.ui.close" variant="glass" onClick={onLeading} />
        ) : leading === 'back' ? (
          <IconButton icon="back" clip="s.ui.back" variant="glass" onClick={onLeading} />
        ) : (
          leading
        )}
      </div>
      <div className="tv-topbar__center">{center}</div>
      <div className="tv-topbar__side tv-topbar__side--end">
        {extra}
        {onReplay && <IconButton icon="ear" clip="s.ui.replay" variant="primary" onClick={onReplay} />}
        {onAdult && <IconButton icon="parent" clip="s.ui.adult" variant="glass" onClick={onAdult} />}
      </div>
    </header>
  )
}
