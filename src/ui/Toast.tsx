import { useEffect } from 'react'
import { useGameStore } from '../state/store'

/** Fortryd-toast: vises når "Ny udfordring" nulstiller en streak. */
export function StreakToast() {
  const toast = useGameStore((s) => s.streakToast)
  const undo = useGameStore((s) => s.undoStreakReset)
  const dismiss = useGameStore((s) => s.dismissStreakToast)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(dismiss, 6000)
    return () => window.clearTimeout(t)
  }, [toast, dismiss])

  if (!toast) return null

  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/90 py-1 pl-4 pr-1 text-sm text-amber-50 shadow-lg"
      role="status"
    >
      <span>🔥 {toast.message}</span>
      <button
        type="button"
        onClick={undo}
        className="min-h-[36px] rounded-full bg-amber-50/15 px-3 font-semibold text-amber-100 hover:bg-amber-50/25"
      >
        Fortryd
      </button>
    </div>
  )
}
