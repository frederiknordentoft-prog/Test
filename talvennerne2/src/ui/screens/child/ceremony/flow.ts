// The end of a round as screens (SPEC §5.8): the summary first — "Det lærte du" with the stars and
// the count-up, one screen — then at most three full-screen ceremonies in the queue's order with the
// hatch always last, then "Også i dag" with the two equal buttons. Pure functions of the planned
// queue, plus where the child got to (kept across a visit to the wardrobe and back).
//
// The summary stays until the child taps (review r1 P2-3), and so does a screen with "Prøv den på"
// (a new level with its thing, a new thing): there is something to look at or to do there. The
// others move on after their planned time, never in the middle of their words.
//
// A world finale passed is its own party (QA2 P2-7), not a trial's bridge: its screen gathers every
// thing the finale gave, with pictures and "Prøv dem på", and waits for the child; those things are
// not shown again as their own screens or as small cards under "Også i dag".
import type { ItemId } from '../../../../engine/types'
import {
  MAX_BLOCK_MS, type CeremonyCard, type CeremonyKind, type CeremonyPlan, type CeremonyStep,
} from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'

export type Screen =
  | { kind: 'summary'; steps: CeremonyStep[]; ms: number; blockMs: number }
  | { kind: 'step'; step: CeremonyStep; ms: number; blockMs: number; interactive: boolean; waits: boolean }
  | { kind: 'end'; ms: 0; blockMs: number }

const SUMMARY: ReadonlySet<CeremonyKind> = new Set(['learned', 'stars', 'tally'])

/** A step the child takes part in (a hatch, a new animal to name, an animal to pick): "Næste" goes through it. */
export function isInteractive(step: CeremonyStep): boolean {
  if (step.kind === 'hatch') return step.rewards.some((r) => r.t === 'eggReady')
  return step.kind === 'thing' && (step.rewards[0]?.t === 'animal' || step.rewards[0]?.t === 'choice')
}

/** A step with "Prøv den på" (a new level's thing, a new thing): it waits for a tap. */
export function offersTryOn(step: CeremonyStep): boolean {
  if (step.kind === 'levelUp') return step.rewards.some((r) => r.t === 'item')
  return step.kind === 'thing' && step.rewards[0]?.t === 'item'
}

type ItemReward = Extract<Reward, { t: 'item' }>
const isFinaleThing = (r: Reward): r is ItemReward => r.t === 'item' && r.source.kind === 'finale'

/** The step of a world finale passed in this round: its own party (QA2 P2-7). */
export function isFinaleParty(step: CeremonyStep): boolean {
  return step.kind === 'trial' && step.rewards.some((r) => r.t === 'trial' && r.finale && r.passed)
}

/** The things a finale party shows, in the order they were given. */
export function finaleThings(step: CeremonyStep): ItemId[] {
  return isFinaleParty(step) ? step.rewards.filter(isFinaleThing).map((r) => r.item) : []
}

/** "Også i dag" lists whose finale things are already on the finale's own screen. */
const SHOWN_ON_FINALE = new WeakSet<readonly CeremonyCard[]>()

/** "Også i dag" without the things the finale's own screen shows (the plan's list as it is otherwise). */
export function alsoTodayOf(cards: readonly CeremonyCard[]): readonly CeremonyCard[] {
  return SHOWN_ON_FINALE.has(cards) ? cards.filter((c) => !isFinaleThing(c.reward)) : cards
}

/**
 * The queue's steps, with a passed finale's things gathered on its screen: every finale thing of the
 * round (its own "En ny ting!" screens and its "Også i dag" cards) moves to the finale's step.
 */
function withFinaleParty(plan: CeremonyPlan): CeremonyStep[] {
  const party = plan.steps.find(isFinaleParty)
  if (!party) return plan.steps
  SHOWN_ON_FINALE.add(plan.alsoToday)
  const things = [...plan.steps.flatMap((s) => s.rewards), ...plan.alsoToday.map((c) => c.reward)].filter(isFinaleThing)
  const seen = new Set<ItemId>()
  const gathered = things.filter((r) => !seen.has(r.item) && !!seen.add(r.item))
  return plan.steps
    .filter((s) => !(s.kind === 'thing' && s.rewards.length > 0 && s.rewards.every(isFinaleThing)))
    .map((s) => (s === party ? { ...s, rewards: [...s.rewards.filter((r) => !isFinaleThing(r)), ...gathered] } : s))
}

export function screensOf(plan: CeremonyPlan): Screen[] {
  const steps = withFinaleParty(plan)
  const summary = steps.filter((s) => SUMMARY.has(s.kind))
  const rest = steps.filter((s) => !SUMMARY.has(s.kind))
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
    const interactive = isInteractive(step)
    // the finale's party waits for the child: there is a world to celebrate and things to try on
    const waits = interactive || offersTryOn(step) || isFinaleParty(step)
    out.push({ kind: 'step', step, ms: step.ms, blockMs: Math.min(MAX_BLOCK_MS, step.blockMs), interactive, waits })
  }
  out.push({ kind: 'end', ms: 0, blockMs: 300 })
  return out
}

/** How long a screen waits before moving on by itself (null: it waits for the child). */
export function autoAdvanceMs(screen: Screen): number | null {
  if (screen.kind === 'end' || screen.kind === 'summary') return null
  if (screen.waits) return null
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
