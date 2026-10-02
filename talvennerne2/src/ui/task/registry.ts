// The task kinds the round screen can show. Wave 1 is complete; wave 2 (clockSet, pay, share,
// colorParts) and wave 3 (grid) are added as src/ui/task/<kind>/{View,Demo}.tsx plus one entry here.
// Until then a task of a missing kind falls back to cards (when it has options) or the keypad (a
// number answer), so a round never dead-ends.
import type { Task, TaskKind } from '../../engine/types'
import { BuildBaseDemo } from './buildBase/Demo'
import { BuildBaseFace, BuildBaseView } from './buildBase/View'
import { ChoiceDemo } from './choice/Demo'
import { ChoiceFace, ChoiceView } from './choice/View'
import { CountTapDemo } from './countTap/Demo'
import { CountTapFace, CountTapView, countTapOwnsPrompt } from './countTap/View'
import { FillSlotsDemo } from './fillSlots/Demo'
import { FillSlotsFace, FillSlotsView, fillSlotsOwnsPrompt } from './fillSlots/View'
import { KeypadDemo } from './keypad/Demo'
import { KeypadFace, KeypadView } from './keypad/View'
import { MultiSelectDemo } from './multiSelect/Demo'
import { MultiSelectFace, MultiSelectView, multiSelectOwnsPrompt } from './multiSelect/View'
import { NumberlineDemo } from './numberline/Demo'
import { NumberlineFace, NumberlineView, numberlineOwnsPrompt } from './numberline/View'
import { PairDemo } from './pair/Demo'
import { PairFace, PairView, pairOwnsPrompt } from './pair/View'
import { SortOrderDemo } from './sortOrder/Demo'
import { SortOrderFace, SortOrderView, sortOrderOwnsPrompt } from './sortOrder/View'
import { TrueFalseDemo } from './trueFalse/Demo'
import { TrueFalseFace, TrueFalseView } from './trueFalse/View'
import type { KindModule } from './types'

export const KIND_MODULES: Partial<Record<TaskKind, KindModule>> = {
  choice: { View: ChoiceView, Demo: ChoiceDemo, Face: ChoiceFace },
  keypad: { View: KeypadView, Demo: KeypadDemo, Face: KeypadFace },
  countTap: { View: CountTapView, Demo: CountTapDemo, Face: CountTapFace, ownsPrompt: countTapOwnsPrompt },
  pair: { View: PairView, Demo: PairDemo, Face: PairFace, ownsPrompt: pairOwnsPrompt },
  numberline: { View: NumberlineView, Demo: NumberlineDemo, Face: NumberlineFace, ownsPrompt: numberlineOwnsPrompt },
  trueFalse: { View: TrueFalseView, Demo: TrueFalseDemo, Face: TrueFalseFace },
  sortOrder: { View: SortOrderView, Demo: SortOrderDemo, Face: SortOrderFace, ownsPrompt: sortOrderOwnsPrompt, wideFace: true },
  multiSelect: { View: MultiSelectView, Demo: MultiSelectDemo, Face: MultiSelectFace, ownsPrompt: multiSelectOwnsPrompt, wideFace: true },
  fillSlots: { View: FillSlotsView, Demo: FillSlotsDemo, Face: FillSlotsFace, ownsPrompt: fillSlotsOwnsPrompt, wideFace: true },
  buildBase: { View: BuildBaseView, Demo: BuildBaseDemo, Face: BuildBaseFace },
}

/** Kinds with their own view (the others fall back, see moduleFor). */
export const BUILT_KINDS = Object.keys(KIND_MODULES) as TaskKind[]

/** The module that shows a task: its own kind, or the closest built one. */
export function moduleFor(task: Task): KindModule {
  const own = KIND_MODULES[task.kind]
  if (own) return own
  if (task.options.length > 0 && task.answerType !== 'set') return KIND_MODULES.choice!
  if (typeof task.answer === 'number' && (task.answerType === 'int' || task.answerType === 'ore')) return KIND_MODULES.keypad!
  return KIND_MODULES.choice!
}
