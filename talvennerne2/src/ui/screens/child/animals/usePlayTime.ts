// Time with the animals and the books counts as play time for the grown-ups' overview (SPEC §13.13,
// useProfile.trackPlay): measured while the page is visible, reported every minute and on leaving.
import { useEffect } from 'react'
import { useProfile } from '../../../../state/useProfile'

const REPORT_MS = 60_000

export function usePlayTime(): void {
  useEffect(() => {
    let since = document.visibilityState === 'visible' ? performance.now() : null
    const report = () => {
      if (since === null) return
      const now = performance.now()
      const ms = now - since
      since = now
      if (ms >= 1000) useProfile.getState().trackPlay(ms)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') since ??= performance.now()
      else {
        report()
        since = null
      }
    }
    const timer = window.setInterval(report, REPORT_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      report()
    }
  }, [])
}
