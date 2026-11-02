/**
 * Live layer, redrawn every tick: the price line so far, NU, pins, halts and gaps, limit lines,
 * entry, ghost (pace) line, branch tags with leader lines, VAR ghost prices and the cause chip.
 */
import type { FootballSim } from '../../engine/football/sim';
import type { Display } from '../../engine/football/display';
import type { LimitOrder } from '../../engine/book/portfolio';
import type { Ghost } from '../../state/match';
import { xOf, yOf, type Geo } from './geometry';

const FONT_NUM = '"UDF Flex", "Roboto Flex", Arial, sans-serif';
const FONT_UI = '"UDF Tight", "Inter Tight", Arial, sans-serif';
const TEAM = ['#5ce1ff', '#ffd200'];

export interface LiveInput {
  sim: FootballSim;
  d: Display;
  focus: 0 | 1 | 2;
  limits: LimitOrder[];
  entries: { t: number; price: number }[];
  ghost: Ghost | null;
  showGhost: boolean;
  draftLevel: number | null;
  scrubT: number | null;
  counts: [number, number, number] | null;
}

export interface LiveOut { headY: number; tags: { y: number; idx: number }[] }

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  if (typeof c.roundRect === 'function') c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

export function drawLive(canvas: HTMLCanvasElement, dpr: number, g: Geo, inp: LiveInput): LiveOut {
  const W = Math.round(g.w * dpr);
  const H = Math.round(g.h * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, g.w, g.h);
  const { sim, d, focus } = inp;
  const hist = sim.hist;
  const col = focus === 0 ? '92,225,255' : focus === 2 ? '255,210,0' : '200,206,216';
  const colHex = focus === 0 ? '#5ce1ff' : focus === 2 ? '#ffd200' : '#c8ced8';

  // Pressure tint at NU.
  const pi = sim.pi;
  if (Math.abs(pi) > 0.15 && !sim.halted) {
    const a = Math.min(0.12, Math.abs(pi) * 0.12);
    const tc = pi > 0 ? '92,225,255' : '255,210,0';
    const grd = c.createLinearGradient(g.nowX - 28, 0, g.nowX + 28, 0);
    grd.addColorStop(0, `rgba(${tc},0)`);
    grd.addColorStop(0.5, `rgba(${tc},${a})`);
    grd.addColorStop(1, `rgba(${tc},0)`);
    c.fillStyle = grd;
    c.fillRect(g.nowX - 28, g.top, 56, g.bottom - g.top);
  }

  // Event pins on the baseline (goals, red cards, VAR).
  for (const e of sim.events) {
    if (e.kind !== 'goal' && e.kind !== 'red' && e.kind !== 'var-start') continue;
    const x = xOf(g, e.t);
    c.strokeStyle = 'rgba(232,237,242,0.10)';
    c.beginPath();
    c.moveTo(x + 0.5, g.top);
    c.lineTo(x + 0.5, g.bottom);
    c.stroke();
    c.fillStyle = e.kind === 'var-start' ? '#a7b0be' : TEAM[e.team ?? 0];
    if (e.kind === 'goal') {
      c.beginPath();
      c.arc(x, g.bottom + 6, 3, 0, Math.PI * 2);
      c.fill();
    } else if (e.kind === 'red') c.fillRect(x - 2, g.bottom + 2, 4, 7);
    else {
      c.beginPath();
      c.moveTo(x, g.bottom + 2);
      c.lineTo(x + 3.5, g.bottom + 6);
      c.lineTo(x, g.bottom + 10);
      c.lineTo(x - 3.5, g.bottom + 6);
      c.fill();
    }
  }

  // Price line so far (continuous ask of the focused outcome), with a double-stroke glow.
  const path = () => {
    c.beginPath();
    let lastX = -1e9;
    let first = true;
    for (let i = 0; i < hist.n; i++) {
      const x = xOf(g, hist.t[i]);
      if (x - lastX < 0.6 && i !== hist.n - 1) continue;
      const y = yOf(g, hist.ask[i * 3 + focus]);
      if (first) c.moveTo(x, y);
      else c.lineTo(x, y);
      first = false;
      lastX = x;
    }
  };
  c.lineJoin = 'round';
  c.strokeStyle = `rgba(${col},0.16)`;
  c.lineWidth = 6;
  path();
  c.stroke();
  c.strokeStyle = colHex;
  c.lineWidth = 2;
  path();
  c.stroke();

  // Gap labels at reopen.
  c.font = `700 10.5px ${FONT_NUM}`;
  c.textAlign = 'left';
  for (const e of sim.events) {
    if (e.kind !== 'reopen' || !e.gap || Math.abs(e.gap[focus]) < 2) continue;
    const x = xOf(g, e.t);
    if (x < g.left + 8) continue;
    const v = e.gap[focus];
    c.fillStyle = 'rgba(232,237,242,0.75)';
    c.fillText(`${v > 0 ? '+' : '−'}${Math.abs(v)} point`, x + 4, g.top + 10);
  }

  // Halt band at NU.
  const askNow = sim.askRaw[focus];
  const headY = yOf(g, askNow);
  if (sim.halt) {
    const x0 = g.nowX - 2;
    c.save();
    c.beginPath();
    c.rect(x0, g.top, 40, g.bottom - g.top);
    c.clip();
    c.strokeStyle = 'rgba(138,143,152,0.30)';
    for (let k = -200; k < 200; k += 7) {
      c.beginPath();
      c.moveTo(x0 + k, g.top);
      c.lineTo(x0 + k + (g.bottom - g.top), g.bottom);
      c.stroke();
    }
    c.restore();
    c.font = `700 10px ${FONT_UI}`;
    c.fillStyle = '#c4cad3';
    c.textAlign = 'left';
    c.fillText(sim.halt.kind === 'var' ? 'HANDEL STOPPET · VAR-tjek' : 'HANDEL STOPPET', g.nowX + 6, g.bottom - 8);
  }

  // VAR: two ghost prices, only one survives the verdict.
  if (d.varQuote) {
    const [ok, no] = d.varQuote.ghosts;
    for (const [v, label] of [[ok, 'Godkendt'], [no, 'Annulleret']] as const) {
      const y = yOf(g, v);
      c.setLineDash([4, 4]);
      c.strokeStyle = 'rgba(232,237,242,0.45)';
      c.beginPath();
      c.moveTo(g.nowX, y);
      c.lineTo(g.right, y);
      c.stroke();
      c.setLineDash([]);
      c.font = `600 11px ${FONT_UI}`;
      c.fillStyle = '#e8edf2';
      c.fillText(`${label} ≈ ${v}`, g.nowX + 46, y - 5);
    }
  }

  // Limit lines (buy traps), drawn at the level where they fill.
  c.setLineDash([5, 4]);
  for (const l of inp.limits) {
    const y = yOf(g, l.level);
    c.strokeStyle = 'rgba(197,139,255,0.85)';
    c.beginPath();
    c.moveTo(g.left, y);
    c.lineTo(g.right, y);
    c.stroke();
    c.fillStyle = '#c58bff';
    c.font = `600 10.5px ${FONT_UI}`;
    c.fillText(`Køb ved kurs ${l.level}`, g.left + 4, y - 4);
  }
  if (inp.draftLevel !== null) {
    const y = yOf(g, inp.draftLevel);
    c.strokeStyle = 'rgba(197,139,255,1)';
    c.beginPath();
    c.moveTo(g.left, y);
    c.lineTo(g.right, y);
    c.stroke();
    c.setLineDash([]);
    rr(c, g.left, y - 26, 118, 22, 11);
    c.fillStyle = 'rgba(30,20,48,0.95)';
    c.fill();
    c.fillStyle = '#e4d4ff';
    c.font = `700 11.5px ${FONT_UI}`;
    c.fillText(`Købsgrænse kurs ${Math.round(inp.draftLevel)}`, g.left + 10, y - 11);
  }
  c.setLineDash([]);

  // Ghost line (pace to win), from purchase to full time.
  if (inp.ghost && inp.showGhost) {
    const gh = inp.ghost;
    c.setLineDash([3, 3]);
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let k = 0; k < gh.t.length; k++) {
      const x = xOf(g, gh.t[k]);
      const y = yOf(g, gh.v[k]);
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);
    c.lineWidth = 1;
  }

  // Entry points.
  for (const e of inp.entries) {
    const x = xOf(g, e.t);
    const y = yOf(g, e.price);
    c.strokeStyle = '#e8edf2';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, 4, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1;
  }

  // NU line and time labels.
  c.strokeStyle = 'rgba(232,237,242,0.30)';
  c.setLineDash([3, 4]);
  c.beginPath();
  c.moveTo(g.nowX + 0.5, g.top - 4);
  c.lineTo(g.nowX + 0.5, g.bottom + 4);
  c.stroke();
  c.setLineDash([]);
  c.font = `600 11px ${FONT_NUM}`;
  c.fillStyle = '#e8edf2';
  c.textAlign = 'center';
  const nowLabel = sim.phase === 'pre' ? 'Auktion' : sim.phase === 'HT' ? 'Pause' : sim.t > 90 ? `NU 90+${Math.ceil(sim.t - 90 - 1e-6)}′` : `NU ${Math.floor(sim.t)}′`;
  c.fillText(nowLabel, g.nowX, g.h - 6);
  c.fillStyle = '#8a94a3';
  c.font = `500 10.5px ${FONT_NUM}`;
  if (sim.t > 3) {
    c.textAlign = 'left';
    c.fillText('0′', g.left, g.h - 6);
  }
  c.textAlign = 'right';
  c.fillText('90+', g.right, g.h - 6);

  // Tally at full time: the price, counted in futures (crisp, so it lives on this layer).
  if (inp.counts && inp.counts[0] + inp.counts[1] + inp.counts[2] === 100) {
    const counts = inp.counts;
    const gx = g.right + 8;
    const top = counts[focus];
    const names = ['FCK', 'X', 'BIF'];
    const cols = ['#5ce1ff', '#9aa3b2', '#ffd200'];
    c.textAlign = 'left';
    c.fillStyle = cols[focus];
    c.font = `700 20px ${FONT_NUM}`;
    c.fillText(String(top), gx, g.top + 14);
    c.font = `600 10px ${FONT_UI}`;
    c.fillText(names[focus], gx + (top >= 10 ? 26 : 16), g.top + 13);
    [0, 1, 2].filter((i) => i !== focus).forEach((o, i) => {
      c.font = `700 14px ${FONT_NUM}`;
      c.fillStyle = cols[o];
      const y = g.bottom - 14 + i * 16;
      c.fillText(String(counts[o]), gx, y);
      c.font = `600 10px ${FONT_UI}`;
      c.fillText(names[o], gx + (counts[o] >= 10 ? 20 : 12), y - 1);
    });
  }

  // Branch tags in the right gutter.
  const tags: { y: number; idx: number }[] = [];
  if (!sim.halted && sim.phase !== 'pre' && d.branches.length) {
    const tx = xOf(g, Math.min(sim.end, sim.t + d.horizon));
    const maxW = Math.max(...d.branches.map((b) => b.weight), 1e-6);
    const items = d.branches.map((b, idx) => ({ b, idx, src: yOf(g, b.price), y: yOf(g, b.price) })).sort((p, q) => p.src - q.src);
    const minY = g.top + 40;
    const maxY = g.bottom - 54;
    for (const it of items) it.y = Math.max(minY, Math.min(maxY, it.y));
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 30) items[i].y = items[i - 1].y + 30;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].y > maxY) items[i].y = maxY;
      if (i > 0 && items[i].y - items[i - 1].y < 30) items[i - 1].y = items[i].y - 30;
    }
    const gx = g.right + 8;
    for (const it of items) {
      const alpha = 0.4 + 0.6 * (it.b.weight / maxW);
      const tc = it.b.team === 0 ? '92,225,255' : it.b.team === 1 ? '255,210,0' : '232,237,242';
      c.strokeStyle = `rgba(${tc},${0.32 * alpha})`;
      c.beginPath();
      c.moveTo(tx, it.src);
      c.lineTo(g.right + 2, it.y);
      c.stroke();
      c.fillStyle = `rgba(${tc},${alpha})`;
      c.beginPath();
      c.arc(tx, it.src, 2.5, 0, Math.PI * 2);
      c.fill();
      c.textAlign = 'left';
      c.font = `500 10px ${FONT_UI}`;
      c.fillStyle = `rgba(185,194,206,${alpha})`;
      c.fillText(it.b.label, gx, it.y - 3);
      c.font = `700 13px ${FONT_NUM}`;
      c.fillStyle = `rgba(${tc},${alpha})`;
      c.fillText(`→ ${Math.round(it.b.price)}`, gx, it.y + 11);
      tags.push({ y: it.y, idx: it.idx });
    }
  }

  // Scrub crosshair.
  if (inp.scrubT !== null) {
    const x = xOf(g, inp.scrubT);
    let i = 0;
    while (i < hist.n - 1 && hist.t[i + 1] <= inp.scrubT) i++;
    const p = hist.ask[i * 3 + focus];
    c.strokeStyle = 'rgba(232,237,242,0.6)';
    c.beginPath();
    c.moveTo(x + 0.5, g.top);
    c.lineTo(x + 0.5, g.bottom);
    c.stroke();
    c.fillStyle = colHex;
    c.beginPath();
    c.arc(x, yOf(g, p), 4, 0, Math.PI * 2);
    c.fill();
    const label = `${inp.scrubT > 90 ? `90+${Math.ceil(inp.scrubT - 90)}` : Math.floor(inp.scrubT)}′ · kurs ${Math.round(p)}`;
    c.font = `700 11.5px ${FONT_NUM}`;
    const w = c.measureText(label).width + 16;
    const bx = Math.max(g.left, Math.min(g.right - w, x - w / 2));
    rr(c, bx, g.top - 26, w, 20, 10);
    c.fillStyle = 'rgba(14,18,23,0.95)';
    c.fill();
    c.fillStyle = '#e8edf2';
    c.textAlign = 'left';
    c.fillText(label, bx + 8, g.top - 12);
  }

  // Cause chip: top-left, with a hairline to the head.
  if (d.cause && inp.scrubT === null) {
    c.font = `500 11.5px ${FONT_UI}`;
    const text = d.cause.text;
    const w = Math.ceil(c.measureText(text).width) + 20;
    const x = g.left;
    const y = g.top - 26;
    c.strokeStyle = 'rgba(185,194,206,0.18)';
    c.beginPath();
    c.moveTo(Math.min(x + w - 12, g.nowX), y + 20);
    c.lineTo(g.nowX, headY - 7);
    c.stroke();
    rr(c, x, y, w, 20, 10);
    c.fillStyle = 'rgba(14,18,23,0.94)';
    c.fill();
    c.strokeStyle = '#232a35';
    c.stroke();
    c.fillStyle = '#b9c2ce';
    c.textAlign = 'left';
    c.fillText(text, x + 10, y + 14);
  }
  return { headY, tags };
}
