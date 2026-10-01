// Dev-only: answers the task on screen through its own controls (buttons are clicked, drag surfaces
// get pointer events), so the harness, the PNG shooter and play.mjs can reach any state without
// knowing the views' internals. Exposed as window.__drive in tasks.html.
import type { AnswerValue, Task } from '../../engine/types'
import { lineRange, splitTokens } from '../../ui/task/answers'
import { useRound } from '../../state/useRound'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const esc = (v: AnswerValue) => CSS.escape(String(v))

function click(el: Element | null, what: string): void {
  if (!el) throw new Error(`drive: ${what} findes ikke`)
  ;(el as HTMLElement).click()
}

function pointer(el: Element, type: string, x: number, y: number): void {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }))
}

/** The task the round is asking (the golden egg's when it flies). */
export function currentTask(): Task | null {
  const s = useRound.getState()
  return s.status === 'golden' ? s.goldenTask : s.current
}

/** Answers the current task with `value` through the view's controls. */
export async function answer(value: AnswerValue): Promise<void> {
  const task = currentTask()
  if (!task) throw new Error('drive: ingen opgave')
  const area = $('.tv-round__answer') ?? document
  const check = () => click($('[data-check]', area), 'fluebenet')
  switch (task.kind) {
    case 'choice':
    case 'trueFalse':
      click($(`[data-option="${esc(value)}"]`, area), `kortet ${value}`)
      return
    case 'pair': {
      const el = $(`[data-option="${esc(value)}"]`, area)
      if (!el) throw new Error(`drive: boblen ${value} findes ikke`)
      const r = el.getBoundingClientRect()
      pointer(el, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2)
      pointer(el, 'pointerup', r.left + r.width / 2, r.top + r.height / 2)
      return
    }
    case 'keypad': {
      const digits = String(typeof value === 'number' ? value / task.entryScale : value)
      for (const d of digits) {
        click($(`[data-key="${d}"]`, area), `tasten ${d}`)
        await wait(30)
      }
      check()
      return
    }
    case 'countTap': {
      const n = Number(value)
      for (let i = 0; i < n; i++) {
        const item = $('[data-pile-item]', area)
        click(item, 'en ting i bunken')
        await wait(30)
      }
      check()
      return
    }
    case 'numberline': {
      const surface = $('.tv-nline__surface', area)
      if (!surface) throw new Error('drive: tallinjen findes ikke')
      const [min, max] = lineRange(task)
      const r = surface.getBoundingClientRect()
      const pad = Number(surface.dataset.linePad ?? 24)
      const ratio = (Number(value) - min) / (max - min)
      const x = r.left + pad + ratio * (r.width - 2 * pad)
      const y = r.top + r.height * 0.7
      pointer(surface, 'pointerdown', x, y)
      pointer(surface, 'pointerup', x, y)
      await wait(40)
      check()
      return
    }
    case 'sortOrder': {
      for (const v of splitTokens(value)) {
        click($(`[data-pool-card][data-option="${esc(v)}"]`, area), `kortet ${v}`)
        await wait(60)
      }
      check()
      return
    }
    case 'multiSelect': {
      for (const v of splitTokens(value)) {
        click($(`[data-option="${esc(v)}"]`, area), `tingen ${v}`)
        await wait(30)
      }
      check()
      return
    }
    case 'fillSlots': {
      for (const v of splitTokens(value)) {
        click($(`.tv-fill__palette [data-option="${esc(v)}"]`, area), `brikken ${v}`)
        await wait(30)
      }
      check()
      return
    }
    case 'buildBase': {
      const n = Number(value)
      const parts: ['flat' | 'rod' | 'unit', number][] = [['flat', Math.floor(n / 100)], ['rod', Math.floor((n % 100) / 10)], ['unit', n % 10]]
      for (const [kind, count] of parts) {
        for (let i = 0; i < count; i++) {
          click($(`[data-source="${kind}"]`, area), `kilden ${kind}`)
          await wait(20)
        }
      }
      check()
      return
    }
    default:
      throw new Error(`drive: ${task.kind} kan ikke besvares endnu`)
  }
}

/** Taps the big confirm button after a mistake. */
export function confirmRight(): void {
  click($('[data-confirm]'), 'bekræft-knappen')
}

/** Waits until the round shows `beat` (data-beat on the round screen). */
export async function until(beat: string, timeoutMs = 8000): Promise<void> {
  const t0 = performance.now()
  while (performance.now() - t0 < timeoutMs) {
    if ($(`.tv-round[data-beat="${beat}"]`)) return
    await wait(40)
  }
  throw new Error(`drive: venter forgæves på ${beat} (nu ${$('.tv-round')?.getAttribute('data-beat')})`)
}

export const drive = { answer, confirmRight, until, currentTask, $$ }
