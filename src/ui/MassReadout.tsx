import { ELEMENTS, formatU, MICRO, toMicroU } from '../data/elements'
import { challengeTargetMicro } from '../game/challenge'
import { tileMass, type Tile } from '../game/types'
import { playerSideOf, useGameStore } from '../state/store'

function sumMicro(tiles: readonly Tile[]): number {
  return tiles.reduce((s, t) => s + toMicroU(tileMass(t)), 0)
}

const H_MICRO = 100_800 // 1.008 u

/** Pædagogisk hint: hvad mangler der, målt i noget man kan mærke. */
function hintFor(diffMicro: number, tolMicro: number): string {
  if (diffMicro > 0) {
    const single = ELEMENTS.find(
      (e) => Math.abs(toMicroU(e.mass) - diffMicro) <= tolMicro,
    )
    if (single) return `Mangler ${formatU(diffMicro)} u — prøv 1 × ${single.navn}!`
    const nH = Math.max(1, Math.round(diffMicro / H_MICRO))
    return `Mangler ${formatU(diffMicro)} u ≈ ${nH} × Brint`
  }
  return `${formatU(-diffMicro)} u for meget — tap en brik i skålen for at fjerne den`
}

export function MassReadout() {
  const challenge = useGameStore((s) => s.challenge)
  const left = useGameStore((s) => s.left)
  const right = useGameStore((s) => s.right)
  const solved = useGameStore((s) => s.solved)
  const wrongHint = useGameStore((s) => s.wrongMoleculeHint)

  const isRam = challenge.mode === 'ram'
  const leftMicro = sumMicro(left) + (isRam ? challengeTargetMicro(challenge) : 0)
  const rightMicro = sumMicro(right)
  const tolMicro = Math.round(challenge.toleranceU * MICRO)

  const playerSide = playerSideOf(challenge)
  const playerMicro = playerSide === 'right' ? rightMicro : leftMicro
  const targetMicro =
    challenge.mode === 'fri'
      ? playerSide === 'right'
        ? leftMicro
        : rightMicro
      : challengeTargetMicro(challenge)
  const diff = targetMicro - playerMicro
  const inBalance = Math.abs(rightMicro - leftMicro) <= tolMicro

  let hint: string | null = null
  if (wrongHint && challenge.molecule) {
    const parts = Object.entries(challenge.molecule.atoms)
      .map(([s, n]) => `${n} × ${s}`)
      .join(' + ')
    hint = `Vægten står lige — men det er ikke ${challenge.molecule.formula}! Brug præcis ${parts}.`
  } else if (solved) {
    hint = 'Løst! Tag en ny udfordring — eller leg videre.'
  } else if (challenge.mode === 'fri') {
    hint =
      leftMicro === 0 && rightMicro === 0
        ? 'Læg grundstoffer i skålene og mærk forskellen.'
        : inBalance && (leftMicro > 0 || rightMicro > 0)
          ? 'I balance!'
          : hintFor(diff, tolMicro)
  } else if (playerMicro === 0) {
    hint = null
  } else if (inBalance) {
    hint = 'Tæt på! Vent til bjælken falder til ro …'
  } else {
    hint = hintFor(diff, tolMicro)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center gap-0.5 px-2 text-center">
      <div
        className="flex items-center gap-3 rounded-full bg-amber-50/85 px-4 py-1 font-display text-sm text-ink shadow-sm ring-1 ring-amber-900/15"
        role="status"
        aria-live="polite"
      >
        <span>
          Venstre: <strong>{formatU(leftMicro)} u</strong>
        </span>
        <span className="text-ink/40">⚖</span>
        <span>
          Højre: <strong>{formatU(rightMicro)} u</strong>
        </span>
      </div>
      {hint && (
        <p
          className={`max-w-md rounded-full px-3 py-0.5 text-xs shadow-sm ring-1 ${
            wrongHint
              ? 'bg-orange-100/95 text-orange-900 ring-orange-900/20'
              : 'bg-amber-50/80 text-ink/80 ring-amber-900/10'
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
