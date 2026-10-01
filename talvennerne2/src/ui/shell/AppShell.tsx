// App shell: full-viewport frame with safe-area insets, the sky (or a scene) behind everything,
// screen transitions and calm mode. The dock floats at the bottom in portrait and on iPad, and
// becomes a rail at the left edge on a phone held sideways.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { ScreenDirection } from '../design/motion'
import { setCalm } from '../design/motion'
import { cx } from '../design/cx'
import { ScreenStack } from './ScreenStack'
import { Sky } from './Sky'

export interface AppShellProps {
  /** Identity of the current screen; changing it plays the transition. */
  screenKey: string
  direction?: ScreenDirection
  /** 'sky' (default), 'paper', or a scene element drawn behind the screens. */
  background?: 'sky' | 'paper' | ReactNode
  /** Usually <Dock/>. Hidden during rounds. */
  dock?: ReactNode
  /** Calm mode from the profile settings: sets data-calm on <html>. */
  calm?: boolean
  className?: string
  children: ReactNode
}

export function AppShell({ screenKey, direction = 'forward', background = 'sky', dock, calm, className, children }: AppShellProps) {
  useEffect(() => {
    if (calm === undefined) return
    setCalm(calm)
  }, [calm])
  return (
    <div className={cx('tv-shell', 'tv-touch', className)} data-dock={dock ? '' : undefined}>
      <div className="tv-shell__bg" aria-hidden>
        {background === 'sky' ? <Sky /> : background === 'paper' ? <div className="tv-shell__paper" /> : background}
      </div>
      <ScreenStack screenKey={screenKey} direction={direction}>
        {children}
      </ScreenStack>
      {dock && <div className="tv-shell__dock">{dock}</div>}
    </div>
  )
}
