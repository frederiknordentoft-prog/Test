// "Vis Pip hvad du kan" for the onboarding, as its own chunk: OnboardingScreen fetches it on the grade
// step only once Stjernefjeldet is built, so no child before that (and no first load) carries the
// ladder, its screen or its voice.
import { preloadSpeech } from '../../../../../audio/voice'
import { clips } from '../../../../../speech/clips/ui/placement'

export { PLACEMENT_GRADE, placementOffered } from './flow'
export { PlacementStep } from './PlacementStep'

/** Fetch the placement's own sprite (pack placement-3), so Pip's lines are in the recorded voice. */
export function preloadPlacementVoice(): void {
  void preloadSpeech(Object.keys(clips).map((clip) => [{ clip }])).catch(() => undefined)
}
