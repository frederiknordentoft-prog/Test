/**
 * RTP-convergence chart for the maths lab: one series (the running RTP of a
 * simulation) against the model's RTP, with the band the estimate should stay
 * inside 95 % of the time. Drawn on a canvas so a 10-million-spin run can
 * repaint every chunk without touching the DOM.
 */
import { PALETTE } from '../core/config';
import { formatPercent } from '../core/format';

const rgba = (n: number, a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

const FONT = 'Manrope, system-ui, sans-serif';
const MAX_POINTS = 720;
const NICE_STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];

export interface ConvergenceChart {
  /** Start a new run of `target` spins. */
  reset(target: number): void;
  push(spins: number, rtp: number): void;
  /** Repaint (also after the canvas changed size). */
  draw(): void;
  readonly points: number;
}

export interface ChartOptions {
  /** Model RTP, 0..1: the reference line. */
  rtp: number;
  /** Standard deviation of one spin's return, in bets: sets the band. */
  stdDev: number;
  formatSpins(n: number): string;
}

export function createConvergenceChart(canvas: HTMLCanvasElement, tip: HTMLElement, opts: ChartOptions): ConvergenceChart {
  const ctx = canvas.getContext('2d');
  let xs: number[] = [];
  let ys: number[] = [];
  let target = 0;
  let half = 0.05;
  let hover = -1;

  // Plot box in CSS px, refreshed by draw() and reused by the hover lookup.
  let pl = 0;
  let pw = 1;

  const bandAt = (n: number) => (1.96 * opts.stdDev) / Math.sqrt(Math.max(1, n));

  function reset(t: number): void {
    xs = [];
    ys = [];
    target = t;
    hover = -1;
    tip.classList.remove('is-on');
    // The window is the band at 2 % of the run: wide enough to show the early
    // swings, narrow enough that the last stretch is still readable.
    half = Math.min(0.3, Math.max(0.012, 1.3 * bandAt(t * 0.02)));
    draw();
  }

  function push(spins: number, rtp: number): void {
    xs.push(spins);
    ys.push(rtp);
    if (xs.length > MAX_POINTS) {
      // Thin the history instead of growing without bound; the newest point always stays.
      const nx: number[] = [];
      const ny: number[] = [];
      for (let i = xs.length - 1; i >= 0; i -= 2) {
        nx.push(xs[i]);
        ny.push(ys[i]);
      }
      xs = nx.reverse();
      ys = ny.reverse();
    }
    draw();
  }

  function draw(): void {
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 40 || h < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (target <= 0) return;

    const L = 44;
    const R = 14;
    const T = 16;
    const B = 26;
    pl = L;
    pw = w - L - R;
    const ph = h - T - B;
    const yMin = opts.rtp - half;
    const yMax = opts.rtp + half;
    const X = (n: number) => L + (n / target) * pw;
    const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

    // Grid and y labels.
    const step = NICE_STEPS.find((s) => (yMax - yMin) / s <= 5) ?? 0.5;
    const digits = step < 0.01 ? 1 : 0;
    ctx.font = `600 10.5px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.lineWidth = 1;
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = rgba(PALETTE.uiGold, 0.1);
      ctx.beginPath();
      ctx.moveTo(L, y);
      ctx.lineTo(L + pw, y);
      ctx.stroke();
      ctx.fillStyle = rgba(PALETTE.uiDim, 0.95);
      ctx.fillText(formatPercent(v, digits), L - 7, y);
    }

    // X labels: start, middle, end.
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgba(PALETTE.uiDim, 0.95);
    ctx.textAlign = 'left';
    ctx.fillText('0', L, h - 8);
    ctx.textAlign = 'center';
    ctx.fillText(opts.formatSpins(target / 2), L + pw / 2, h - 8);
    ctx.textAlign = 'right';
    ctx.fillText(`${opts.formatSpins(target)} spins`, L + pw, h - 8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, pw, ph);
    ctx.clip();

    // 95 % band around the model value: a funnel that closes as the sample grows.
    ctx.beginPath();
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const n = target * (0.003 + (0.997 * i) / N);
      const y = Y(opts.rtp + bandAt(n));
      if (i === 0) ctx.moveTo(X(n), y);
      else ctx.lineTo(X(n), y);
    }
    for (let i = N; i >= 0; i--) {
      const n = target * (0.003 + (0.997 * i) / N);
      ctx.lineTo(X(n), Y(opts.rtp - bandAt(n)));
    }
    ctx.closePath();
    ctx.fillStyle = rgba(PALETTE.comet, 0.12);
    ctx.fill();

    // Reference: the model's RTP.
    const yr = Math.round(Y(opts.rtp)) + 0.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = rgba(PALETTE.comet, 0.85);
    ctx.beginPath();
    ctx.moveTo(L, yr);
    ctx.lineTo(L + pw, yr);
    ctx.stroke();
    ctx.setLineDash([]);

    // The run itself.
    if (xs.length > 0) {
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(PALETTE.gold, 1);
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const x = X(xs[i]);
        const y = Y(Math.min(yMax + half, Math.max(yMin - half, ys[i])));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = `700 10.5px ${FONT}`;
    // Under the line at the far end: the run's own label sits above its newest point.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgba(0xd8fbff, 0.95);
    ctx.fillText(`Model ${formatPercent(opts.rtp)}`, L + pw - 6, yr + 15);

    if (xs.length > 0) {
      const i = hover >= 0 && hover < xs.length ? hover : xs.length - 1;
      const x = X(xs[i]);
      const v = ys[i];
      const y = Math.min(T + ph, Math.max(T, Y(v)));
      ctx.fillStyle = rgba(PALETTE.night0, 1);
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(PALETTE.starCore, 1);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (hover < 0) {
        // Direct label on the newest value, kept inside the plot box.
        const label = formatPercent(v);
        ctx.font = `800 12px ${FONT}`;
        const tw = ctx.measureText(label).width;
        const above = y - T > 26;
        ctx.textAlign = 'left';
        ctx.fillStyle = rgba(PALETTE.uiText, 1);
        ctx.fillText(label, Math.min(L + pw - tw, Math.max(L + 2, x - tw - 9)), above ? y - 10 : y + 19);
      }
    }
  }

  function pick(e: PointerEvent): void {
    if (xs.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const n = ((e.clientX - rect.left - pl) / pw) * target;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - n) < Math.abs(xs[best] - n)) best = i;
    hover = best;
    tip.textContent = `${opts.formatSpins(xs[best])} spins · ${formatPercent(ys[best])}`;
    tip.classList.add('is-on');
    draw();
  }

  function leave(): void {
    if (hover < 0) return;
    hover = -1;
    tip.classList.remove('is-on');
    draw();
  }

  canvas.addEventListener('pointermove', pick);
  canvas.addEventListener('pointerdown', pick);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointercancel', leave);

  return {
    reset,
    push,
    draw,
    get points() {
      return xs.length;
    },
  };
}
