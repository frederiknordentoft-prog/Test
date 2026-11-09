/** Easing curves, t in [0,1] → [0,1] (back/elastic overshoot on purpose). */
export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const inQuad: Ease = (t) => t * t;
export const outQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const inOutQuad: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const inCubic: Ease = (t) => t * t * t;
export const outCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const inOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const outQuart: Ease = (t) => 1 - Math.pow(1 - t, 4);
export const outQuint: Ease = (t) => 1 - Math.pow(1 - t, 5);
export const inExpo: Ease = (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
export const outExpo: Ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const outSine: Ease = (t) => Math.sin((t * Math.PI) / 2);

/** Anticipation: pulls back before going. */
export const inBack: Ease = (t) => {
  const c1 = 1.70158;
  return (c1 + 1) * t * t * t - c1 * t * t;
};
/** Overshoots, then settles. */
export const outBack: Ease = (t) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const outBackSoft: Ease = (t) => {
  const c1 = 0.9;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const outElastic: Ease = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
};
export const outBounce: Ease = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach. halfLife in seconds. */
export const damp = (current: number, target: number, halfLife: number, dt: number) =>
  target + (current - target) * Math.pow(0.5, dt / Math.max(1e-5, halfLife));
