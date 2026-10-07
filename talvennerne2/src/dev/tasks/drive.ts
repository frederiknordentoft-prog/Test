// Dev-only: answers the task on screen through its own controls (buttons are clicked, drag surfaces
// get pointer events), so the harness, the PNG shooter and play.mjs can reach any state without
// knowing the views' internals. Exposed as window.__drive in tasks.html.
import type { AnswerValue, Task } from '../../engine/types'
import { lineRange, splitTokens } from '../../ui/task/answers'
import { useRound } from '../../state/useRound'
import { CENTRE, DIAL, KNOB, VIEW_W, dialValue, hourAngle, minuteAngle, mod, turn } from '../../ui/task/clockSet/logic'
import { fewestPieces, piecesOfSet } from '../../ui/task/pay/logic'
import { fracOf, partsOfValue } from '../../ui/task/colorParts/logic'
import { frameOf, ux, uy } from '../../ui/task/grid/geometry'
import { gridSetup, placeValue, pointOf, readValue } from '../../ui/task/grid/logic'

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

/** A press that does not move (a tap) on an element, at its centre. */
function tapOn(el: Element | null, what: string): void {
  if (!el) throw new Error(`drive: ${what} findes ikke`)
  const r = el.getBoundingClientRect()
  pointer(el, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2)
  pointer(el, 'pointerup', r.left + r.width / 2, r.top + r.height / 2)
}

/** Waits for a lazily loaded view to be on screen. */
async function viewOf(kind: string, area: ParentNode): Promise<HTMLElement> {
  for (let i = 0; i < 100; i++) {
    const el = $(`[data-kind="${kind}"]`, area)
    if (el) return el
    await wait(30)
  }
  throw new Error(`drive: ${kind} kom aldrig frem`)
}

/** A point on the clock face: `angle` degrees clockwise from 12, `r` clock units from the centre. */
function clockPoint(dial: HTMLElement, angle: number, r: number): { x: number; y: number } {
  const svg = $('.tv-clockset__clock', dial)!
  const box = svg.getBoundingClientRect()
  const k = box.width / VIEW_W
  const a = (angle * Math.PI) / 180
  return { x: box.left + (CENTRE + r * Math.sin(a)) * k, y: box.top + (CENTRE - r * Math.cos(a)) * k }
}

/** Drags on the dial from one angle to another along the circle at radius r (in 15° steps). */
async function turnOn(dial: HTMLElement, from: number, to: number, r: number): Promise<void> {
  const d = turn(from, to)
  const steps = Math.max(1, Math.ceil(Math.abs(d) / 15))
  const p0 = clockPoint(dial, from, r)
  pointer(dial, 'pointerdown', p0.x, p0.y)
  for (let i = 1; i <= steps; i++) {
    const p = clockPoint(dial, from + (d * i) / steps, r)
    pointer(dial, 'pointermove', p.x, p.y)
    await wait(8)
  }
  const p1 = clockPoint(dial, to, r)
  pointer(dial, 'pointerup', p1.x, p1.y)
  await wait(220)
}

/** Sets the clock to `value` minutes: the minute hand round to its place, then the hour hand. */
async function setClock(task: Task, area: ParentNode, value: number): Promise<void> {
  const dial = $('.tv-clockset__dial', await viewOf('clockSet', area))
  if (!dial) throw new Error('drive: uret findes ikke')
  const target = mod(value, DIAL)
  const m = target % 60
  const h = Math.floor(target / 60)
  let now = Number(dial.dataset.minutes ?? 0)
  await turnOn(dial, minuteAngle(now), m * 6, KNOB.minute)
  now = Number(dial.dataset.minutes ?? 0)
  await turnOn(dial, hourAngle(now), h * 30 + m * 0.5, KNOB.hour)
  if (dialValue(task, Number(dial.dataset.minutes)) !== dialValue(task, target)) {
    throw new Error(`drive: uret viser ${dial.dataset.minutes}, ikke ${target}`)
  }
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
    case 'clockSet': {
      await setClock(task, area, Number(value))
      check()
      return
    }
    case 'pay': {
      const view = await viewOf('pay', area)
      const purse = $$('[data-source]', view).map((el) => Number(el.dataset.source))
      const pieces = typeof value === 'string' ? piecesOfSet(value) : (fewestPieces(Number(value), purse) ?? [])
      if (pieces.length === 0) throw new Error(`drive: pungen kan ikke betale ${value}`)
      for (const p of pieces) {
        tapOn($(`[data-source="${p}"]`, view), `mønten ${p}`)
        await wait(30)
      }
      check()
      return
    }
    case 'share': {
      const view = await viewOf('share', area)
      const plates = $$('[data-plate]', view)
      if (typeof value === 'string') {
        // the deal itself (a set, largest first: '9|3'): each plate gets its own count
        const counts = splitTokens(value).map(Number)
        for (const [p, n] of counts.entries()) {
          for (let i = 0; i < n; i++) {
            tapOn(plates[p], `tallerken ${p + 1}`)
            await wait(30)
          }
        }
        check()
        return
      }
      const things = $$('[data-pile] [data-thing]', view).length
      for (let i = 0; i < things; i++) {
        // −1 (an uneven deal): everything on the first plate; else round the plates in turn
        tapOn(Number(value) < 0 ? plates[0] : plates[i % plates.length], 'en tallerken')
        await wait(30)
      }
      check()
      return
    }
    case 'colorParts': {
      const view = await viewOf('colorParts', area)
      const parts = Number($('[data-parts]', view)?.getAttribute('data-parts') ?? 0)
      for (const i of partsOfValue(value, parts)) {
        tapOn($(`path[data-part="${i}"]`, view), `delen ${i}`)
        await wait(30)
      }
      check()
      return
    }
    case 'grid': {
      // place: a tap on the crossing; read: a tap on each axis at the number (SPEC A21)
      const view = await viewOf('grid', area)
      const q = pointOf(value)
      if (!q) throw new Error(`drive: ${value} er intet punkt`)
      const h = Number(view.dataset.h)
      const svg = $('.tv-grid__figure svg', view)
      if (!svg) throw new Error('drive: nettet findes ikke')
      const r = svg.getBoundingClientRect()
      const { W, H } = frameOf(Number(view.dataset.w), h)
      const atX = (u: number) => r.left + (u * r.width) / W
      const atY = (v: number) => r.top + (v * r.height) / H
      if (view.dataset.gridMode === 'read') {
        for (const axis of ['x', 'y'] as const) {
          const strip = $(`[data-axis="${axis}"]`, view)
          if (!strip) throw new Error(`drive: aksen ${axis} findes ikke`)
          const b = strip.getBoundingClientRect()
          const x = axis === 'x' ? atX(ux(q.x)) : b.left + b.width / 2
          const y = axis === 'y' ? atY(uy(h, q.y)) : b.top + b.height / 2
          pointer(strip, 'pointerdown', x, y)
          pointer(strip, 'pointerup', x, y)
          await wait(40)
        }
      } else {
        const board = $('[data-board]', view)
        if (!board) throw new Error('drive: nettets flade findes ikke')
        pointer(board, 'pointerdown', atX(ux(q.x)), atY(uy(h, q.y)))
        pointer(board, 'pointerup', atX(ux(q.x)), atY(uy(h, q.y)))
        await wait(40)
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

/** The round's bookkeeping, for play.mjs to check progress across a pause. */
export function roundState() {
  const s = useRound.getState()
  return {
    status: s.status, cleared: s.cleared, total: s.total, streak: s.streak, mistakes: s.mistakes,
    current: s.current?.id ?? null, golden: s.goldenTask?.id ?? null, goldenUsed: s.goldenUsed, goldenCaught: s.goldenCaught,
  }
}

/** A wrong answer the task's own view can give (another card, one more, the far end of the line, …). */
export function wrongFor(task: Task): AnswerValue | null {
  const a = task.answer
  switch (task.kind) {
    case 'choice':
    case 'trueFalse':
      return task.options?.find((o) => String(o) !== String(a)) ?? null
    case 'keypad':
      return typeof a === 'number' ? a + task.entryScale : null
    case 'countTap':
    case 'buildBase':
      return typeof a === 'number' ? a + 1 : null
    case 'numberline': {
      const [min, max] = lineRange(task)
      return Number(a) - min > (max - min) / 2 ? min : max
    }
    case 'multiSelect': {
      const right = new Set(splitTokens(a).map(String))
      const other = task.options?.find((o) => !right.has(String(o)))
      return other === undefined ? null : other
    }
    case 'clockSet':
      return typeof a === 'number' ? dialValue(task, mod(a, DIAL) + 60) : null
    case 'pay':
      return typeof a === 'number' ? a + 100 : `${a}|c100`
    case 'share': {
      // a set answer: one thing moved from the fullest plate to the emptiest; else an uneven deal
      if (typeof a !== 'string') return -1
      const c = splitTokens(a).map(Number)
      if (c.length < 2 || c[0] < 1) return null
      c[0] -= 1
      c[c.length - 1] += 1
      return c.sort((x, y) => y - x).join('|')
    }
    case 'colorParts': {
      const f = fracOf(a)
      return f ? `frac:${f.n > 1 ? f.n - 1 : f.n + 1}/${f.d}` : null
    }
    case 'grid': {
      // the point one step along (or back at the far edge), in the answer's own form
      const q = pointOf(a)
      const setup = gridSetup(task)
      if (!q || !setup) return null
      const o = { x: q.x < setup.w ? q.x + 1 : q.x - 1, y: q.y }
      return setup.mode === 'read' ? readValue(o.x, o.y) : placeValue(o)
    }
    default:
      return null
  }
}

export const drive = { answer, confirmRight, until, currentTask, roundState, wrongFor, $$ }
