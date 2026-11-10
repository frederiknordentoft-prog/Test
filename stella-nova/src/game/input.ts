/**
 * The nudge drag: the player's finger on a ring.
 *
 * The ring follows the pointer 1:1 up to one notch, then resists like a
 * rubber band. Past half a notch it is "armed": the view clicks, and faint
 * beams show what letting go would win. Releasing armed (or with a flick)
 * commits; anything else springs back.
 */
import { STEP_ANGLE } from '../core/config';
import type { IEngine, IGameView, NudgeChoice } from '../core/types';

export interface NudgeInputHooks {
  /** True only while the director is waiting for the player's move. */
  isActive(): boolean;
  onDragStart(): void;
  /** The ring has snapped into its new notch. */
  onCommit(choice: NudgeChoice): void;
}

interface Drag {
  pointerId: number;
  ring: number;
  startAngle: number;
  lastAngle: number;
  /** Unwrapped angle travelled since the start, clockwise-positive. */
  travel: number;
  armed: 0 | 1 | -1;
  velocity: number;
  lastTime: number;
}

const TWO_PI = Math.PI * 2;

function wrap(a: number): number {
  let x = a % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  return x;
}

/** One notch of free travel, then a quarter of the excess, capped. */
function rubber(travel: number): number {
  const a = Math.abs(travel);
  if (a <= STEP_ANGLE) return travel;
  const extra = Math.min(STEP_ANGLE * 0.35, (a - STEP_ANGLE) * 0.25);
  return Math.sign(travel) * (STEP_ANGLE + extra);
}

export function attachNudgeInput(view: IGameView, engine: IEngine, hooks: NudgeInputHooks): () => void {
  const canvas = view.canvas;
  let drag: Drag | null = null;
  let releasing = false;

  /**
   * Polar angle of a pointer around the instrument's centre, clockwise from
   * north. Measured in screen space against the projected east/west and
   * north/south spoke tips, so it keeps working when the finger slides off
   * the ring it grabbed.
   */
  const angleAt = (clientX: number, clientY: number): number => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const east = view.spokeTipScreen(2);
    const west = view.spokeTipScreen(6);
    const north = view.spokeTipScreen(0);
    const south = view.spokeTipScreen(4);
    const cx = (east.x + west.x) / 2;
    const cy = (east.y + west.y) / 2;
    const rx = Math.max(1, (east.x - west.x) / 2);
    const dy = y - cy;
    const ry = Math.max(1, dy < 0 ? cy - north.y : south.y - cy);
    return Math.atan2((x - cx) / rx, -dy / ry);
  };

  const preview = (d: Drag): void => {
    if (d.armed === 0) {
      view.previewLines(null);
      return;
    }
    try {
      const option = engine.previewNudge({ ring: d.ring, dir: d.armed });
      view.previewLines(option.lines.length ? option.lines.map((l) => ({ spoke: l.spoke, count: l.count, symbol: l.symbol })) : null);
    } catch {
      view.previewLines(null);
    }
  };

  const onDown = (e: PointerEvent): void => {
    if (!hooks.isActive() || drag || releasing || !e.isPrimary) return;
    const pick = view.pickRing(e.clientX, e.clientY);
    if (!pick) return;
    const a = angleAt(e.clientX, e.clientY);
    drag = { pointerId: e.pointerId, ring: pick.ring, startAngle: a, lastAngle: a, travel: 0, armed: 0, velocity: 0, lastTime: e.timeStamp };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail on synthetic events; the drag still works inside the canvas.
    }
    hooks.onDragStart();
    e.preventDefault();
  };

  const onMove = (e: PointerEvent): void => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const a = angleAt(e.clientX, e.clientY);
    const step = wrap(a - d.lastAngle);
    d.lastAngle = a;
    d.travel += step;
    const dt = Math.max(1, e.timeStamp - d.lastTime) / 1000;
    d.lastTime = e.timeStamp;
    d.velocity += (step / dt - d.velocity) * 0.35;

    view.setRingOffset(d.ring, rubber(d.travel));
    const armed: 0 | 1 | -1 = Math.abs(d.travel) > STEP_ANGLE / 2 ? (d.travel > 0 ? 1 : -1) : 0;
    if (armed !== d.armed) {
      d.armed = armed;
      preview(d);
    }
    e.preventDefault();
  };

  const finish = (e: PointerEvent, cancelled: boolean): void => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    drag = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    view.previewLines(null);

    let dir: 0 | 1 | -1 = cancelled || !hooks.isActive() ? 0 : d.armed;
    // A decisive flick commits even short of the half-way point.
    if (!cancelled && dir === 0 && hooks.isActive() && Math.abs(d.velocity) > 2.4 && Math.abs(d.travel) > STEP_ANGLE * 0.16) {
      dir = d.velocity > 0 ? 1 : -1;
    }
    releasing = true;
    view
      .releaseRing(d.ring, dir)
      .catch(() => undefined)
      .then(() => {
        releasing = false;
        if (dir !== 0) hooks.onCommit({ ring: d.ring, dir });
      });
  };

  const onUp = (e: PointerEvent): void => finish(e, false);
  const onCancel = (e: PointerEvent): void => finish(e, true);

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
  };
}
