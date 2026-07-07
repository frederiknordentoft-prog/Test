// Zustand store: UI/params state. The engine subscribes to sim params via
// TunnelCanvas wiring; measurements flow back through setMeasure (called from
// the engine callback, throttled to 10 Hz — never inside React render).

import { create } from 'zustand';
import type { Measurements, OverlayMode, ShapeKind, ShapeSpec, SimParams } from '../engine/types';
import { makePrimitive } from '../engine/shape/primitives';

export type Tool = ShapeKind | 'probe';

export interface AppState {
  // sim slice
  windSpeed: number;
  density: number;
  restAngleDeg: number;
  pivotLocked: boolean;
  paused: boolean;
  timeScale: number;

  // shape slice
  activeTool: Tool;
  committedShape: ShapeSpec | null;
  shapeB: ShapeSpec | null;

  // view slice
  overlay: OverlayMode;
  smoke: boolean;
  labels: boolean;
  advanced: boolean;
  compareMode: boolean;
  probe: [number, number] | null;
  reducedMotion: boolean;

  // measure slice (engine-written)
  measure: Measurements | null;
  measureB: Measurements | null;

  /** Bump to ask the engine to re-initialize the flow field. */
  resetFlowNonce: number;

  // learn slice
  toast: string | null;
  bubble: string | null;
  dismissedBubbles: string[];
  completedChallenges: string[];
  challengesOpen: boolean;

  // actions
  set: (p: Partial<AppState>) => void;
  setMeasure: (m: Measurements) => void;
  setMeasureB: (m: Measurements) => void;
  showToast: (msg: string) => void;
  showBubble: (id: string) => void;
  dismissBubble: (id: string) => void;
  completeChallenge: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  windSpeed: 0.4,
  density: 1,
  restAngleDeg: 0,
  pivotLocked: true,
  paused: false,
  timeScale: 1,

  // Appen åbner med en form i vinden — hvirvelgade og levende målere fra sekund ét.
  activeTool: 'freehand',
  committedShape: makePrimitive('circle'),
  shapeB: null,

  overlay: 'none',
  smoke: true,
  labels: true,
  advanced: false,
  compareMode: false,
  probe: null,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,

  measure: null,
  measureB: null,

  resetFlowNonce: 0,

  toast: null,
  bubble: null,
  dismissedBubbles: [],
  completedChallenges: [],
  challengesOpen: false,

  set: (p) => set(p),
  setMeasure: (m) => set({ measure: m }),
  setMeasureB: (m) => set({ measureB: m }),
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 3200);
  },
  showBubble: (id) => {
    const s = get();
    if (s.dismissedBubbles.includes(id) || s.bubble === id) return;
    set({ bubble: id });
  },
  dismissBubble: (id) =>
    set((s) => ({ bubble: s.bubble === id ? null : s.bubble, dismissedBubbles: [...s.dismissedBubbles, id] })),
  completeChallenge: (id) =>
    set((s) => (s.completedChallenges.includes(id) ? s : { completedChallenges: [...s.completedChallenges, id] })),
}));

export function selectSimParams(s: AppState): SimParams {
  return {
    windSpeed: s.windSpeed,
    density: s.density,
    restAngleDeg: s.restAngleDeg,
    pivotLocked: s.pivotLocked,
    timeScale: s.timeScale,
    overlay: s.overlay,
    smoke: s.smoke,
    paused: s.paused,
    quality: 'auto',
    probe: s.probe,
    reducedMotion: s.reducedMotion,
  };
}
