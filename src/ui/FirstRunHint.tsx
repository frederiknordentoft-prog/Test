import { useGameStore } from '../state/store'

/**
 * Førstegangs-hint: viser gestussen i stedet for at forklare den.
 * Forsvinder ved første brik i en skål; animation respekterer reduced motion.
 */
export function FirstRunHint() {
  const showHint = useGameStore((s) => s.showHint)
  if (!showHint) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-ink/80 px-4 py-2.5 text-amber-50 shadow-lg">
        <span className="hint-bounce text-2xl leading-none">👆</span>
        <span className="text-sm font-semibold">
          Træk et grundstof op i en skål — eller tap på det
        </span>
      </div>
    </div>
  )
}
