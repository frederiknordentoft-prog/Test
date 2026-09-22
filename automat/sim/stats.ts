// Small statistics helpers for the simulator (pure TS, no deps).

/** Log-binned histogram of non-negative values (× stake). Bin 0 holds exact zeros. */
export const HIST_BINS = 1200;
const H_MIN = 0.01, H_MAX = 1e5;
const H_LOG = Math.log(H_MAX / H_MIN);

export function histBin(x: number): number {
  if (x <= 0) return 0;
  if (x < H_MIN) return 1;
  const b = 1 + Math.floor((Math.log(x / H_MIN) / H_LOG) * (HIST_BINS - 2));
  return b >= HIST_BINS ? HIST_BINS - 1 : b;
}
/** Lower edge of a bin (bin ≥ 1). */
export function histEdge(b: number): number {
  if (b <= 0) return 0;
  return H_MIN * Math.exp(((b - 1) / (HIST_BINS - 2)) * H_LOG);
}
/** Quantile q ∈ (0,1) from a histogram (geometric bin mid-point; exact zero if in bin 0). */
export function histQuantile(h: ArrayLike<number>, q: number): number {
  let tot = 0;
  for (let i = 0; i < h.length; i++) tot += h[i];
  const target = q * tot;
  let acc = 0;
  for (let i = 0; i < h.length; i++) {
    acc += h[i];
    if (acc >= target) return i === 0 ? 0 : Math.sqrt(histEdge(i) * histEdge(i + 1));
  }
  return histEdge(h.length);
}

export function addInto(dst: Float64Array, src: ArrayLike<number>): void {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i];
}

/** Median from an integer-valued histogram (index = value). */
export function intHistQuantile(h: ArrayLike<number>, q: number): number {
  let tot = 0;
  for (let i = 0; i < h.length; i++) tot += h[i];
  if (tot === 0) return NaN;
  const target = q * tot;
  let acc = 0;
  for (let i = 0; i < h.length; i++) {
    acc += h[i];
    if (acc >= target) return i;
  }
  return h.length - 1;
}
export function intHistMean(h: ArrayLike<number>): number {
  let tot = 0, s = 0;
  for (let i = 0; i < h.length; i++) {
    tot += h[i];
    s += i * h[i];
  }
  return tot ? s / tot : NaN;
}

/** Quantile of a sorted Float64Array. */
export function sortedQuantile(a: Float64Array, q: number): number {
  if (a.length === 0) return NaN;
  const i = Math.min(a.length - 1, Math.max(0, Math.floor(q * a.length)));
  return a[i];
}

export const fmtPct = (x: number, d = 2) => (x * 100).toFixed(d) + ' %';
