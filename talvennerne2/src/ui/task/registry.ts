// The task kinds the round screen can show. Waves 1 and 2 are complete; wave 3 (grid) is added as
// src/ui/task/<kind>/{View,Demo}.tsx plus one entry here. Until then a task of a missing kind — or
// one its kind cannot play (a share without a deal) — falls back to cards (when it has options) or
// the keypad (a number answer), so a round never dead-ends.
//
// Wave 2 (clockSet, pay, share, colorParts) loads lazily: each kind is its own chunk, fetched with
// the first task of that kind, so the round screen stays small for the youngest children, who never
// meet a clock or a coin. Every part waits in its own Suspense (the rest of the screen never blinks),
// and a chunk that cannot load falls back like a missing kind.
import { Suspense, createElement, lazy, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
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
import type { DemoProps, FaceProps, KindModule, TaskViewProps } from './types'
import { canClockSet, clockSetOwnsPrompt } from './clockSet/logic'
import { canPay } from './pay/logic'
import { canShare, shareOwnsPrompt } from './share/logic'
import { canColorParts, colorPartsOwnsPrompt } from './colorParts/logic'

// ─── Lazy kinds ─────────────────────────────────────────────────────────────

interface KindChunk {
  View: ComponentType<TaskViewProps>
  Face: ComponentType<FaceProps>
  Demo: ComponentType<DemoProps>
}

/** Stand-ins when a chunk cannot load (offline): the fallback kind's own parts. */
const STAND_IN: KindChunk = {
  View: (props) => createElement(fallbackFor(props.task).View, props),
  Face: (props) => createElement(fallbackFor(props.task).Face, props),
  Demo: function DemoStandIn({ onDone }) {
    useEffect(() => onDone(), [onDone])
    return null
  },
}

/** Room kept for a view while its chunk loads, so the layout does not jump. */
const VIEW_WAIT: ReactNode = createElement('div', { className: 'tv-kind-wait', style: { minHeight: 220, width: '100%' }, 'aria-hidden': true })

function lazyKind(load: () => Promise<KindChunk>, extra: Pick<KindModule, 'ownsPrompt' | 'wideFace'>): KindModule {
  let chunk: Promise<KindChunk> | null = null
  const get = () => (chunk ??= load().catch((err: unknown) => {
    console.warn('task kind chunk did not load; using the fallback kind', err)
    return STAND_IN
  }))
  function part<P extends object>(pick: (c: KindChunk) => ComponentType<P>, wait: ReactNode): ComponentType<P> {
    const Lazy = lazy(async () => ({ default: pick(await get()) }))
    return function KindPart(props: P) {
      return createElement(Suspense, { fallback: wait }, createElement(Lazy as unknown as ComponentType<P>, props))
    }
  }
  return {
    View: part((c) => c.View, VIEW_WAIT),
    Face: part((c) => c.Face, null),
    Demo: part((c) => c.Demo, null),
    ...extra,
  }
}

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
  clockSet: lazyKind(() => import('./clockSet'), { ownsPrompt: clockSetOwnsPrompt, wideFace: true }),
  pay: lazyKind(() => import('./pay'), { wideFace: true }),
  share: lazyKind(() => import('./share'), { ownsPrompt: shareOwnsPrompt, wideFace: true }),
  colorParts: lazyKind(() => import('./colorParts'), { ownsPrompt: colorPartsOwnsPrompt, wideFace: true }),
}

/** Whether a kind can play this task at all (a share needs a deal, a pay an amount the purse makes …). */
const PLAYABLE: Partial<Record<TaskKind, (task: Task) => boolean>> = {
  clockSet: canClockSet,
  pay: canPay,
  share: canShare,
  colorParts: canColorParts,
}

/** Kinds with their own view (the others fall back, see moduleFor). */
export const BUILT_KINDS = Object.keys(KIND_MODULES) as TaskKind[]

/** The module that shows a task: its own kind, or the closest built one. */
export function moduleFor(task: Task): KindModule {
  const own = KIND_MODULES[task.kind]
  if (own && (PLAYABLE[task.kind]?.(task) ?? true)) return own
  return fallbackFor(task)
}

/** The closest wave-1 kind for a task its own kind cannot show. */
function fallbackFor(task: Task): KindModule {
  if (task.options.length > 0 && task.answerType !== 'set') return KIND_MODULES.choice!
  if (typeof task.answer === 'number' && (task.answerType === 'int' || task.answerType === 'ore')) return KIND_MODULES.keypad!
  return KIND_MODULES.choice!
}
