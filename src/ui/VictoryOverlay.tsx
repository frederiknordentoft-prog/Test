import { useGameStore } from '../state/store'

export function VictoryOverlay() {
  const victory = useGameStore((s) => s.victory)
  const dismissVictory = useGameStore((s) => s.dismissVictory)
  const newChallenge = useGameStore((s) => s.newChallenge)
  const progress = useGameStore((s) => s.progress)

  if (!victory) return null

  const headline =
    victory.mode === 'molekyle'
      ? 'Molekylet er bygget!'
      : victory.mode === 'ram'
        ? 'Du ramte vægten!'
        : 'I balance!'

  const fewestLine =
    victory.optimal !== null
      ? victory.tilesUsed <= victory.optimal
        ? `⭐ Optimalt — ${victory.tilesUsed} brik${victory.tilesUsed === 1 ? '' : 'ker'} er det færrest mulige!`
        : `Du brugte ${victory.tilesUsed} brikker — det kan gøres med ${victory.optimal}.`
      : null

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
    >
      <div className="w-full max-w-sm rounded-2xl border-2 border-amber-700/40 bg-parchment p-5 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden="true">
          ⚖️✨
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">{headline}</h2>
        {victory.breakdown && (
          <p className="mt-2 rounded-lg bg-amber-900/10 px-3 py-2 font-display text-sm text-ink">
            {victory.breakdown}
          </p>
        )}
        {fewestLine && <p className="mt-2 text-sm text-ink/85">{fewestLine}</p>}
        <p className="mt-2 text-sm text-ink/70">
          🔥 Streak: <strong>{progress.streak}</strong> · Løst i alt:{' '}
          <strong>
            {Object.values(progress.perMode).reduce((s, m) => s + m.solvedCount, 0)}
          </strong>
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => newChallenge()}
            className="min-h-[44px] rounded-lg bg-amber-700 px-4 font-semibold text-amber-50 shadow hover:bg-amber-800"
          >
            Ny udfordring
          </button>
          <button
            type="button"
            onClick={dismissVictory}
            className="min-h-[44px] rounded-lg bg-amber-900/10 px-4 font-semibold text-ink hover:bg-amber-900/20"
          >
            Leg videre
          </button>
        </div>
      </div>
    </div>
  )
}
