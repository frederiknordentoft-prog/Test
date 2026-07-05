import { useEffect } from 'react'
import { unlockAudio } from './audio/sound'
import { engine } from './engine/instance'
import { effectiveReducedMotion, useGameStore } from './state/store'
import { MassReadout } from './ui/MassReadout'
import { ModeBar } from './ui/ModeBar'
import { ScaleCanvas } from './ui/ScaleCanvas'
import { SettingsPanel } from './ui/SettingsPanel'
import { Tray } from './ui/Tray'
import { VictoryOverlay } from './ui/VictoryOverlay'

export default function App() {
  const init = useGameStore((s) => s.init)
  const settings = useGameStore((s) => s.settings)
  const progress = useGameStore((s) => s.progress)

  useEffect(() => {
    init()
    // iOS Safari: lyd låses op ved allerførste berøring, uanset hvor
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [init])

  useEffect(() => {
    const apply = () => engine.setReducedMotion(effectiveReducedMotion(settings))
    apply()
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings])

  const totalSolved = Object.values(progress.perMode).reduce(
    (s, m) => s + m.solvedCount,
    0,
  )
  const bestFewest = progress.perMode.ram.bestFewest

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-parchment text-ink">
      <header className="flex items-center gap-2 border-b border-amber-900/15 bg-parchment-dark/60 px-3 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-xl font-bold tracking-wide text-ink">
          ⚖️ Vægtskålen
        </h1>
        <div className="ml-auto flex items-center gap-3 text-sm text-ink/80">
          <span title="Streak — løste udfordringer i træk">🔥 {progress.streak}</span>
          <span title="Løste udfordringer i alt">✓ {totalSolved}</span>
          {bestFewest !== null && (
            <span title="Færreste brikker i en løst 'færrest brikker'-udfordring">
              ⭐ {bestFewest}
            </span>
          )}
          <SettingsPanel />
        </div>
      </header>

      <ModeBar />

      <main className="relative min-h-[260px] flex-1">
        <ScaleCanvas />
        <MassReadout />
        <VictoryOverlay />
      </main>

      <Tray />
    </div>
  )
}
