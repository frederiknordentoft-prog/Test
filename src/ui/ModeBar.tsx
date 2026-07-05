import { formatU } from '../data/elements'
import { challengeTargetMicro } from '../game/challenge'
import type { Mode } from '../game/types'
import { useGameStore } from '../state/store'

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'fri', label: 'Fri leg' },
  { mode: 'balancer', label: 'Balancér' },
  { mode: 'ram', label: 'Ram vægten' },
  { mode: 'molekyle', label: 'Molekyle' },
]

export function ModeBar() {
  const mode = useGameStore((s) => s.mode)
  const fewest = useGameStore((s) => s.fewest)
  const challenge = useGameStore((s) => s.challenge)
  const setMode = useGameStore((s) => s.setMode)
  const setFewest = useGameStore((s) => s.setFewest)
  const newChallenge = useGameStore((s) => s.newChallenge)

  let description: string
  switch (challenge.mode) {
    case 'fri':
      description = 'Fri leg — udforsk hvor meget atomerne vejer.'
      break
    case 'balancer':
      description = `Gør højre side lige så tung som venstre (${formatU(challengeTargetMicro(challenge))} u).`
      break
    case 'ram':
      description = `Byg højre skål op til ${formatU(challengeTargetMicro(challenge))} u${challenge.fewestMode ? ' — med færrest mulige brikker!' : '.'}`
      break
    case 'molekyle':
      description = challenge.molecule
        ? `Balancér ${challenge.molecule.navn} (${challenge.molecule.formula}) med de rigtige atomer.`
        : ''
      break
  }

  return (
    <div className="border-b border-amber-900/15 bg-parchment-dark/60 px-2 py-1.5">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Spiltilstand">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="tab"
              aria-selected={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold transition ${
                mode === m.mode
                  ? 'bg-walnut text-amber-100 shadow'
                  : 'bg-amber-900/10 text-ink hover:bg-amber-900/20'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'ram' && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg bg-amber-900/10 px-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={fewest}
              onChange={(e) => setFewest(e.target.checked)}
              className="h-4 w-4 accent-amber-800"
            />
            Færrest brikker
          </label>
        )}
        {mode !== 'fri' && (
          <button
            type="button"
            onClick={() => newChallenge()}
            className="ml-auto min-h-[44px] rounded-lg bg-amber-700 px-3 text-sm font-semibold text-amber-50 shadow transition hover:bg-amber-800"
          >
            ↻ Ny udfordring
          </button>
        )}
      </div>
      <p className="mx-auto mt-1 max-w-3xl text-xs text-ink/75">{description}</p>
    </div>
  )
}
