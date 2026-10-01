// The end of a round as screens (SPEC §5.8): the summary first — "Det lærte du" with the stars and
// the count-up, one screen — then at most three full-screen ceremonies in the queue's order with the
// hatch always last, then "Også i dag" with the two equal buttons. Pure functions of the planned
// queue, plus where the child got to (kept across a visit to the wardrobe and back).
import {
  MAX_BLOCK_MS, type CeremonyKind, type CeremonyPlan, type CeremonyStep,
} from '../../../../meta/ceremonyQueue'

export type Screen =
  | { kind: 'summary'; steps: CeremonyStep[]; ms: number; blockMs: number }
  | { kind: 'step'; step: CeremonyStep; ms: number; blockMs: number; interactive: boolean }
  | { kind: 'end'; ms: 0; blockMs: number }

const SUMMARY: ReadonlySet<CeremonyKind> = new Set(['learned', 'stars', 'tally'])

/** A step the child takes part in (a hatch, a new animal to name, an animal to pick): it waits for them. */
export function isInteractive(step: CeremonyStep): boolean {
  if (step.kind === 'hatch') return step.rewards.some((r) => r.t === 'eggReady')
  return step.kind === 'thing' && (step.rewards[0]?.t === 'animal' || step.rewards[0]?.t === 'choice')
}

export function screensOf(plan: CeremonyPlan): Screen[] {
  const summary = plan.steps.filter((s) => SUMMARY.has(s.kind))
  const rest = plan.steps.filter((s) => !SUMMARY.has(s.kind))
  const out: Screen[] = []
  if (summary.length > 0) {
    out.push({
      kind: 'summary',
      steps: summary,
      ms: summary.reduce((sum, s) => sum + s.ms, 0),
      blockMs: Math.min(MAX_BLOCK_MS, Math.max(...summary.map((s) => s.blockMs))),
    })
  }
  for (const step of rest) {
    out.push({ kind: 'step', step, ms: step.ms, blockMs: Math.min(MAX_BLOCK_MS, step.blockMs), interactive: isInteractive(step) })
  }
  out.push({ kind: 'end', ms: 0, blockMs: 300 })
  return out
}

/** How long a screen waits before moving on by itself (null: it waits for the child). */
export function autoAdvanceMs(screen: Screen): number | null {
  if (screen.kind === 'end') return null
  if (screen.kind === 'step' && screen.interactive) return null
  return screen.ms
}

// ─── Where the child got to ─────────────────────────────────────────────────

const reached = new WeakMap<CeremonyPlan, number>()

/** The screen to show for this plan (0 the first time; after "Prøv den på" the one after). */
export function progressOf(plan: CeremonyPlan): number {
  return reached.get(plan) ?? 0
}

export function setProgress(plan: CeremonyPlan, index: number): void {
  reached.set(plan, Math.max(0, index))
}
