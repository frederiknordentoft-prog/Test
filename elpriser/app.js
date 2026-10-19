// ============================================================
// Elprisen DK2 — app.js
// Data: elprisenligenu.dk + Energinet/Radius/Skat tariffs (Datahub)
// ============================================================

const REGION = "DK2";
const API = (date) =>
  `https://www.elprisenligenu.dk/api/v1/prices/${date.getFullYear()}/${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${REGION}.json`;

// Official tariffs in kr/kWh EXCL. moms, copied from Energinet's Datahub
// price list (api.energidataservice.dk/dataset/DatahubPricelist), each valid
// from its date (Danish local date) until the next row. Add new rows when
// Radius/Energinet publish new periods.
//
// Radius Elnet A/S (GLN 5790000705689), "Nettarif C" (DT_C_01):
// Lav 00–06, Høj 06–17 and 21–24, Spids 17–21.
const RADIUS_C = [
  { from: "2025-10-01", lav: 0.0976,   hoj: 0.2929,   spids: 0.8788 },   // vinter
  { from: "2026-04-01", lav: 0.106175, hoj: 0.159262, spids: 0.414082 }, // sommer
  { from: "2026-10-01", lav: 0.106175, hoj: 0.318524, spids: 0.955573 }, // vinter
  { from: "2027-04-01", lav: 0.106175, hoj: 0.159262, spids: 0.414082 }, // sommer
];
// Energinet (GLN 5790000432752): transmissions nettarif (40000), systemtarif
// (41000) and elafgift (EA-001).
const NATIONAL = [
  { from: "2026-01-01", transmission: 0.043, system: 0.072, elafgift: 0.008 },
  { from: "2027-01-01", transmission: 0.056, system: 0.049, elafgift: 0.008 },
];
const GASEL_MARKUP = 0.048;     // 6 øre inkl. moms
const VAT_RATE = 0.25;

// The row in effect for an hour; time_start carries Danish local time
// ("2026-10-19T20:00:00+02:00"), so date and hour are read from it directly
const rowFor = (rows, day) => rows.reduce((cur, r) => (r.from <= day ? r : cur), rows[0]);

// All grid tariffs + elafgift for one hour, excl. moms
function tariffsAt(timeStartIso) {
  const day = timeStartIso.slice(0, 10);
  const hour = parseInt(timeStartIso.slice(11, 13), 10);
  const r = rowFor(RADIUS_C, day);
  const n = rowFor(NATIONAL, day);
  const radius = hour < 6 ? r.lav : hour >= 17 && hour < 21 ? r.spids : r.hoj;
  return radius + n.transmission + n.system + n.elafgift;
}

const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Absolute color thresholds (kr/kWh on the displayed price) — same across
// days so green today means the same as green tomorrow. User-adjustable.
const THRESH_DEFAULT = { good: 1.00, ok: 1.50, warn: 2.00 };

const state = {
  today: [],
  tomorrow: [],
  view: "today",
  tariffs: true,
  gasel: false,
  vat: true,
  thresholds: { ...THRESH_DEFAULT },
  appliance: { key: "washer", kwh: 1.0, hours: 2 },
  loadedAt: 0,        // last refresh where both days were answered (server or HTTP cache)
  fetchFailed: false, // last refresh hit a network/server error, bad reply or time-out
};

// Chart runtime state (single persistent Chart.js instance)
const chartUI = {
  chart: null,
  prices: [],      // raw API rows for the displayed day
  values: [],      // computed kr/kWh
  colors: [],      // level color per bar
  stats: null,
  nowIdx: -1,
  cheapIdx: -1,    // cheapest upcoming hour (dot marker)
  scrubIdx: null,  // hour under a dragging finger, null = not dragging
  scrubbing: false,
  selIdx: null,    // pinned hour (tap / drag release), null = default hour
  selKey: null,    // its time_start, so the pin survives re-renders
  roPrice: null,   // last readout price (for tween)
  thumbRO: null,
};

// ------------- utils -------------
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
const hourLabel = (iso) => pad(new Date(iso).getHours()) + ":00";
const hourNum = (iso) => pad(new Date(iso).getHours());

// localStorage throws when Safari blocks site data; settings are a nicety,
// so fall back to defaults instead of stopping the page
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* not saved */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* not saved */ } },
  json(k) { try { return JSON.parse(this.get(k) || "null"); } catch (e) { return null; } },
};

// Compute final consumer price for one hour's spot price
function fullPrice(spotKr, timeStartIso) {
  let p = spotKr;
  if (state.gasel) p += GASEL_MARKUP;
  if (state.tariffs) p += tariffsAt(timeStartIso);
  if (state.vat) p *= 1 + VAT_RATE;
  return p;
}

// Same formula as fullPrice(), split into parts for the readout.
// Display only — keep in step with fullPrice().
// "tariffs" = Radius + Energinet net tariffs + elafgift (what the
// "Afgifter" toggle adds).
function priceParts(spotKr, timeStartIso) {
  const k = state.vat ? 1 + VAT_RATE : 1;
  return {
    spot: spotKr * k,
    gasel: state.gasel ? GASEL_MARKUP * k : 0,
    tariffs: state.tariffs ? tariffsAt(timeStartIso) * k : 0,
  };
}

// Whole øre per part, adding up to the rounded total exactly. The fixed
// parts (index 1..) are rounded on their own so they never change from hour
// to hour; the first part (spot) takes the remainder (≤ 1 øre per fixed part).
function roundToTotal(values, total) {
  const fixed = values.slice(1).map(v => Math.round(v * 100));
  const first = Math.round(total * 100) - fixed.reduce((a, b) => a + b, 0);
  return [first, ...fixed];
}

const LEVEL = {
  good: { label: "Billig", color: "#30d158" },
  ok:   { label: "Normal", color: "#ffd60a" },
  warn: { label: "Høj",    color: "#ff9f0a" },
  bad:  { label: "Dyr",    color: "#ff453a" },
};

function levelOf(price) {
  const t = state.thresholds;
  if (price < t.good) return "good";
  if (price < t.ok)   return "ok";
  if (price < t.warn) return "warn";
  return "bad";
}

function statsOf(prices) {
  if (!prices.length) return { min: 0, max: 0, avg: 0, minIdx: 0, maxIdx: 0 };
  const vals = prices.map(p => fullPrice(p.DKK_per_kWh, p.time_start));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg, minIdx: vals.indexOf(min), maxIdx: vals.indexOf(max) };
}

function currentHourIndex(prices) {
  const now = Date.now();
  return prices.findIndex(p => {
    const s = new Date(p.time_start).getTime();
    const e = new Date(p.time_end).getTime();
    return now >= s && now < e;
  });
}

function hexWithAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ------------- fetch -------------
// [] = not published (404), null = network/server error or time-out.
// The HTTP cache is used first (prices show offline). Only a 404 for a date
// we don't hold is re-asked from the server: the API lets browsers cache
// that 404 for 4 hours, which would hide tomorrow's prices long after 13:00.
async function fetchDay(date, notHeld, patient) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  // A slow line gets more time once a request has failed, and so does today
  // when there is nothing on screen to fall back on
  const slow = state.fetchFailed || (patient && notHeld);
  const timer = ctl && setTimeout(() => ctl.abort(), slow ? 45000 : 15000);
  const signal = ctl ? ctl.signal : undefined;
  try {
    let res = await fetch(API(date), { signal });
    if (res.status === 404 && notHeld) res = await fetch(API(date), { cache: "no-cache", signal });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let warnedEmpty = false;

const isDay = (rows, date) =>
  rows.length > 0 && new Date(rows[0].time_start).toDateString() === date.toDateString();

// Rows already held for a date (after midnight, yesterday's "tomorrow" is
// today's data)
const heldFor = (date) =>
  isDay(state.today, date) ? state.today : isDay(state.tomorrow, date) ? state.tomorrow : [];

// Usable rows for a date: well-formed and actually for that day
const rowsOk = (rows, date) => Array.isArray(rows) && rows.length > 0 &&
  rows.every(r => r && Number.isFinite(r.DKK_per_kWh) &&
    !isNaN(Date.parse(r.time_start)) && !isNaN(Date.parse(r.time_end))) &&
  isDay(rows, date);

const sameRows = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Today is applied and drawn as soon as its own request lands — it never
// waits for tomorrow, whose "not published" 404 may need a second trip.
// The page is only redrawn when the rows actually changed.
async function loadData() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayChanged = () => new Date().toDateString() !== today.toDateString();
  rollOver(); // a restart after midnight begins from today's rows, not yesterday's
  const tmP = fetchDay(tomorrow, !heldFor(tomorrow).length);
  const td = await fetchDay(today, !heldFor(today).length, true);
  const tdOk = rowsOk(td, today);
  // Midnight passed while waiting: the rows belong to other days — start over
  if (dayChanged()) { await tmP; return loadData(); }
  // A published day never changes, so errors, time-outs and odd replies keep
  // what we already hold for that date
  const nextToday = tdOk ? td : heldFor(today);
  // The first rows for today stamp the footer right away
  if (tdOk && !state.loadedAt) {
    state.loadedAt = Date.now();
    renderFooter();
  }
  if (!sameRows(nextToday, state.today)) {
    state.today = nextToday;
    renderAll();
  }
  // Warn once per outage, not on every retry
  if (!state.today.length && !warnedEmpty) toast("Kunne ikke hente dagens priser.");
  warnedEmpty = !state.today.length;

  const tm = await tmP;
  if (dayChanged()) return loadData();
  const nextTomorrow = rowsOk(tm, tomorrow) ? tm : heldFor(tomorrow);
  const tomorrowChanged = !sameRows(nextTomorrow, state.tomorrow);
  if (tomorrowChanged) state.tomorrow = nextTomorrow;
  syncTomorrowTab(); // always: the tab must be off while tomorrow isn't out
  if (tomorrowChanged) renderAll();
  state.fetchFailed = td === null || tm === null;
  // Later, only a refresh where both days were answered moves "Opdateret"
  if (tdOk && tm !== null) state.loadedAt = Date.now();
  if (!rendered) renderAll();
  renderFooter();
}

function syncTomorrowTab() {
  const tomorrowTab = document.getElementById("tabTomorrow");
  tomorrowTab.disabled = state.tomorrow.length === 0;
  // Viewing "I morgen" when it has no data (e.g. just after midnight)
  if (state.view === "tomorrow" && tomorrowTab.disabled) switchDay("today");
  updateTabDates();
}

// After midnight (or a long sleep) yesterday's "tomorrow" becomes today
// without waiting for the network; rows for a day that is over are dropped
function rollOver() {
  const now = new Date();
  if (isDay(state.today, now)) return;
  if (!state.today.length && !isDay(state.tomorrow, now)) return;
  state.today = isDay(state.tomorrow, now) ? state.tomorrow : [];
  state.tomorrow = [];
  syncTomorrowTab();
}

// Refresh when today's data is missing, the last request failed, or the
// data is over 10 minutes old
function dataIsStale() {
  return !state.today.length || state.fetchFailed || Date.now() - state.loadedAt > 10 * 60 * 1000;
}

let refreshing = null;
function refresh() {
  if (!refreshing) {
    const wasFailed = state.fetchFailed;
    refreshing = loadData().finally(() => {
      refreshing = null;
      // First failure with nothing on screen: try again soon (now with the
      // long time-out) rather than at the next minute tick
      if (!wasFailed && state.fetchFailed && !state.today.length) {
        setTimeout(() => { if (dataIsStale()) refresh(); }, 5000);
      }
    });
  }
  return refreshing;
}

// Runs on every whole minute and when the page becomes visible again.
// Redraws from the rows already held before any refresh, so "nu" is right
// even while a request is still under way.
function minuteTick() {
  renderClock();
  rollOver();
  renderHero();
  renderTable();
  renderCalculator();
  // Chart shows other rows (day rolled over) or a new hour began: redraw.
  // A pin on the same day is kept.
  const shown = state.view === "today" ? state.today : state.tomorrow;
  const ci = currentHourIndex(state.today);
  if (chartUI.prices !== shown || (state.view === "today" && ci !== chartUI.nowIdx)) {
    renderChart();
    renderLists();
  }
  if (dataIsStale()) refresh();
}

// ------------- hero -------------
function renderHero() {
  // Caption echoing pricing mode
  const parts = ["Spot"];
  if (state.tariffs) parts.push("afgifter");
  if (state.gasel) parts.push("Gasel");
  if (state.vat) parts.push("moms");
  const echo = document.getElementById("modeEcho");
  if (echo) echo.textContent = parts.join(" + ");

  const prices = state.today;
  const idx = currentHourIndex(prices);
  // No row for the current hour (today's prices not fetched yet): show
  // nothing rather than an old price posing as "now"
  if (idx < 0) {
    ["priceNow", "statMin", "statMax", "statAvg", "statMinHint", "statMaxHint"]
      .forEach(id => { document.getElementById(id).textContent = "–"; });
    document.getElementById("priceLevel").textContent = "Venter på dagens priser";
    document.getElementById("nextCheap").textContent = "Leder efter billigste time…";
    return;
  }

  const stats = statsOf(prices);
  const cur = fullPrice(prices[idx].DKK_per_kWh, prices[idx].time_start);

  document.getElementById("priceNow").textContent = fmt(cur);
  document.getElementById("statMin").textContent = fmt(stats.min);
  document.getElementById("statMax").textContent = fmt(stats.max);
  document.getElementById("statAvg").textContent = fmt(stats.avg);
  document.getElementById("statMinHint").textContent = "kl. " + hourLabel(prices[stats.minIdx].time_start);
  document.getElementById("statMaxHint").textContent = "kl. " + hourLabel(prices[stats.maxIdx].time_start);

  const lvl = levelOf(cur);
  document.getElementById("priceLevel").textContent =
    `${LEVEL[lvl].label} pris pr. kWh`;

  // Next cheap hour tip
  const forward = [...prices.slice(idx + 1), ...state.tomorrow];

  if (forward.length) {
    const cheapest = forward.reduce((a, b) =>
      fullPrice(a.DKK_per_kWh, a.time_start) <= fullPrice(b.DKK_per_kWh, b.time_start) ? a : b
    );
    const t = new Date(cheapest.time_start);
    const now = new Date();
    const hoursAway = Math.max(1, Math.round((t - now) / 3600000));
    const dayTxt = t.getDate() === now.getDate() ? "i dag" : "i morgen";
    const price = fullPrice(cheapest.DKK_per_kWh, cheapest.time_start);
    document.getElementById("nextCheap").innerHTML =
      `Billigste kommende time er <strong>${pad(t.getHours())}:00 ${dayTxt}</strong> til ${fmt(price)} kr/kWh — om ${hoursAway} timer.`;
  } else {
    // Last hour of the day and tomorrow not out yet: no stale tip
    document.getElementById("nextCheap").textContent = "Morgendagens priser udgives omkring kl. 13.";
  }
}

// ------------- lists -------------
function renderLists() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  if (!prices.length) {
    // Don't leave another day's hours standing
    document.getElementById("cheapList").innerHTML = "";
    document.getElementById("expList").innerHTML = "";
    return;
  }

  const withFinal = prices.map(p => ({ p, final: fullPrice(p.DKK_per_kWh, p.time_start) }));
  withFinal.sort((a, b) => a.final - b.final);
  const cheap = withFinal.slice(0, 3);
  const exp = withFinal.slice(-3).reverse();

  const mkLi = ({ p, final }) =>
    `<li><span class="hour">${hourLabel(p.time_start)}</span><span class="val">${fmt(final)} kr</span></li>`;
  document.getElementById("cheapList").innerHTML = cheap.map(mkLi).join("");
  document.getElementById("expList").innerHTML = exp.map(mkLi).join("");

  document.getElementById("tableChip").textContent =
    state.view === "today" ? "I dag" : "I morgen";
}

// ------------- table -------------
function renderTable() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  const grid = document.getElementById("hoursGrid");
  if (!prices.length) { grid.innerHTML = ""; return; }

  const stats = statsOf(prices);
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;

  grid.innerHTML = prices.map((p, i) => {
    const price = fullPrice(p.DKK_per_kWh, p.time_start);
    const lvl = levelOf(price);
    const meta = LEVEL[lvl];
    const widthPct = Math.max(6, ((price - stats.min) / (stats.max - stats.min || 1)) * 100);
    const isNow = i === nowIdx;
    return `<div class="hour-row ${isNow ? "now" : ""}">
      <span class="hour-time">${hourLabel(p.time_start)}</span>
      <span class="hour-val">${fmt(price)} kr</span>
      <span class="hour-lvl lvl-${lvl}">${meta.label}</span>
      <span class="hour-bar" style="width:${widthPct}%; background:${meta.color}"></span>
    </div>`;
  }).join("");
}

// ============================================================
// CHART — persistent instance, scrub readout, morphing updates
// ============================================================

// Hour shown in the readout and highlighted: finger first, then pin
const activeIdx = () => chartUI.scrubIdx ?? chartUI.selIdx;

// Opacity for a bar given selection + past-hour dimming. Other bars stay
// fairly visible while pinned so the colour overview is kept.
function barAlpha(i) {
  const base = state.view === "today" && chartUI.nowIdx >= 0 && i < chartUI.nowIdx ? 0.35 : 1;
  const active = activeIdx();
  if (active === null) return base;
  if (i === active) return 1;
  return base * (chartUI.scrubIdx !== null ? 0.45 : 0.6);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const PILL_FONT = "-apple-system, BlinkMacSystemFont, sans-serif";

// Geometry of the selected column in canvas px: band, price pill above the
// plot and hour pill on the x-axis row. Shared by the plugins, the x tick
// colours and the NU badge so they always agree.
let selGeoCache = { key: "", g: null };
function selGeometry(chart, i) {
  const bar = chart.getDatasetMeta(0).data[i];
  const p = chartUI.prices[i];
  if (!bar || !p) return null;
  const a = chart.chartArea;
  const xs = chart.scales.x;
  const key = [i, p.time_start, chartUI.values[i], bar.x, a.left, a.right, a.top, xs.top, chart.width].join("|");
  if (selGeoCache.key === key) return selGeoCache.g;
  // Centre of the x tick labels: tick length (8) + tick padding + half a line
  const labelY = xs.top + 8 + xs.options.ticks.padding + (11 * 1.2) / 2;
  const pill = (text, font, h, y, padX) => {
    chart.ctx.save();
    chart.ctx.font = font;
    const w = Math.ceil(chart.ctx.measureText(text).width) + padX;
    chart.ctx.restore();
    const x = Math.min(chart.width - w - 2, Math.max(2, bar.x - w / 2));
    return { text, font, x, y, w, h };
  };
  const g = {
    bar,
    colW: (a.right - a.left) / chartUI.prices.length,
    price: pill(fmt(chartUI.values[i]), `700 12px ${PILL_FONT}`, 20, a.top - 26, 16),
    hour: pill(hourNum(p.time_start), `700 11px ${PILL_FONT}`, 18, labelY - 9, 12),
    bandTop: a.top - 29,
    bandBottom: labelY + 12,
  };
  selGeoCache = { key, g };
  return g;
}

// x tick labels that would sit under the hour pill are made transparent
// (not removed — removing labels changes Chart.js's layout)
function tickUnderPill(chart, index) {
  const sel = activeIdx();
  const g = sel === null ? null : selGeometry(chart, sel);
  if (!g) return false;
  const x = chart.scales.x.getPixelForTick(index);
  return Math.abs(x - (g.hour.x + g.hour.w / 2)) < g.hour.w / 2 + 9;
}

// Plugin: soft band behind the selected column, under the bars
const selBandPlugin = {
  id: "selBand",
  beforeDatasetsDraw(chart) {
    const i = activeIdx();
    const g = i === null ? null : selGeometry(chart, i);
    if (!g) return;
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRectPath(ctx, g.bar.x - g.colW / 2, g.bandTop, g.colW, g.bandBottom - g.bandTop, Math.min(7, g.colW / 2));
    ctx.fill();
    ctx.restore();
  },
};

// Plugin: price pill (level colour) above the plot + hour pill on the axis
const selLabelPlugin = {
  id: "selLabel",
  afterDatasetsDraw(chart) {
    const i = activeIdx();
    const g = i === null ? null : selGeometry(chart, i);
    if (!g) return;
    const { ctx } = chart;
    const drawPill = (pl, bg) => {
      ctx.fillStyle = bg;
      roundRectPath(ctx, pl.x, pl.y, pl.w, pl.h, pl.h / 2);
      ctx.fill();
      ctx.font = pl.font;
      ctx.fillStyle = "#000";
      ctx.fillText(pl.text, pl.x + pl.w / 2, pl.y + pl.h / 2 + 0.5);
    };
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawPill(g.price, chartUI.colors[i] || "#f5f5f7");
    drawPill(g.hour, "#f5f5f7");
    ctx.restore();
  },
};

// Plugin: dashed average line + label
const avgLinePlugin = {
  id: "avgLine",
  afterDatasetsDraw(chart) {
    const stats = chartUI.stats;
    if (!stats || !stats.avg) return;
    const { ctx, chartArea: { left, right }, scales } = chart;
    const yPix = scales.y.getPixelForValue(stats.avg);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, yPix);
    ctx.lineTo(right, yPix);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(235, 235, 245, 0.6)";
    ctx.font = "500 10.5px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`gns. ${fmt(stats.avg)}`, right - 6, yPix - 5);
    ctx.restore();
  },
};

// Plugin: small green dot under the cheapest upcoming hour
const cheapDotPlugin = {
  id: "cheapDot",
  afterDatasetsDraw(chart) {
    const i = chartUI.cheapIdx;
    if (i < 0) return;
    const bar = chart.getDatasetMeta(0).data[i];
    if (!bar) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = "#30d158";
    ctx.beginPath();
    ctx.arc(bar.x, chart.chartArea.bottom + 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

// Plugin: keep the NU badge glued to its bar after every draw (animation
// frames, instant updates, resizes and reduced motion alike)
const nowBadgePlugin = {
  id: "nowBadge",
  afterDraw: () => positionNowBadge(),
};

function positionNowBadge() {
  const badge = document.getElementById("nowBadge");
  const chart = chartUI.chart;
  if (!badge || !chart) return;
  const nowIdx = chartUI.nowIdx;
  const bar = nowIdx >= 0 && state.view === "today" && chartUI.prices.length
    ? chart.getDatasetMeta(0).data[nowIdx] : null;
  if (!bar) { badge.hidden = true; return; }
  const wrap = badge.parentElement.getBoundingClientRect();
  const canvas = chart.canvas.getBoundingClientRect();
  badge.style.left = (canvas.left - wrap.left + bar.x) + "px";
  badge.style.top = (canvas.top - wrap.top + bar.y) + "px";
  badge.hidden = false;
  // Tuck it away while it would overlap the price pill. visibility (not
  // hidden) so the entry pop doesn't replay on every drag step.
  const sel = activeIdx();
  const g = sel === null ? null : selGeometry(chart, sel);
  let hit = false;
  if (g) {
    const w = badge.offsetWidth, h = badge.offsetHeight, m = 3, p = g.price;
    const x0 = bar.x - w / 2, x1 = bar.x + w / 2, y0 = bar.y - 6 - h, y1 = bar.y - 2;
    hit = x0 < p.x + p.w + m && x1 > p.x - m && y0 < p.y + p.h + m && y1 > p.y - m;
  }
  badge.classList.toggle("tucked", hit);
}

function ensureChart() {
  if (chartUI.chart) return chartUI.chart;
  const canvas = document.getElementById("priceChart");
  const tickColor = "rgba(235, 235, 245, 0.45)";

  chartUI.chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: (ctx) => {
          const i = ctx.dataIndex;
          const color = chartUI.colors[i] || "#666";
          const a = barAlpha(i);
          const { chartArea } = ctx.chart;
          if (!chartArea) return hexWithAlpha(color, a);
          const g = ctx.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, hexWithAlpha(color, a));
          g.addColorStop(1, hexWithAlpha(color, 0.55 * a));
          return g;
        },
        borderColor: (ctx) =>
          ctx.dataIndex === chartUI.nowIdx && state.view === "today" ? "#ffffff" : "transparent",
        borderWidth: (ctx) =>
          ctx.dataIndex === chartUI.nowIdx && state.view === "today" ? 2 : 0,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: REDUCE_MOTION ? false : {
        duration: 800,
        easing: "easeOutQuart",
      },
      events: [], // all interaction handled by our own pointer handlers
      layout: { padding: { top: 30 } }, // room for the selected-hour price pill
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            // The selected hour gets its own pill; labels under it go clear
            color: (c) => (tickUnderPill(c.chart, c.index) ? "rgba(0, 0, 0, 0)" : tickColor),
            font: { size: 11, family: "-apple-system, sans-serif" },
            maxRotation: 0,
            autoSkip: false,
            padding: 12,
            callback(value, index) {
              return index % 3 === 0 ? this.getLabelForValue(value) : "";
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 10, family: "-apple-system, sans-serif" },
            callback: (v) => fmt(v),
            padding: 6,
            maxTicksLimit: 5,
          },
        },
      },
    },
    plugins: [selBandPlugin, avgLinePlugin, cheapDotPlugin, selLabelPlugin, nowBadgePlugin],
  });

  initScrub(canvas);

  if (chartUI.thumbRO) chartUI.thumbRO.disconnect();
  chartUI.thumbRO = new ResizeObserver(() => positionThumb());
  chartUI.thumbRO.observe(canvas.parentElement);

  return chartUI.chart;
}

function renderChart() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  const empty = document.getElementById("chartEmpty");
  const canvas = document.getElementById("priceChart");
  const badge = document.getElementById("nowBadge");

  // Message in place of the chart (no data, or Chart.js didn't load)
  const showMessage = (text) => {
    empty.hidden = false;
    empty.textContent = text;
    canvas.style.display = "none";
    if (badge) badge.hidden = true;
    setReadoutEmpty();
  };

  if (!prices.length) {
    chartUI.prices = prices;
    chartUI.nowIdx = -1;
    chartUI.scrubIdx = chartUI.selIdx = chartUI.selKey = null;
    showMessage(state.view === "today"
      ? "Dagens priser er ikke hentet endnu."
      : "Morgendagens priser udgives omkring kl. 13.");
    return;
  }
  empty.hidden = true;
  canvas.style.display = "block";

  const stats = statsOf(prices);
  const values = prices.map(p => fullPrice(p.DKK_per_kWh, p.time_start));
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;

  // Cheapest upcoming hour: strictly future today, any hour tomorrow
  let cheapIdx = -1, cheapVal = Infinity;
  values.forEach((v, i) => {
    if (state.view === "today" && i <= nowIdx) return;
    if (v < cheapVal) { cheapVal = v; cheapIdx = i; }
  });

  chartUI.prices = prices;
  chartUI.values = values;
  chartUI.colors = values.map(v => LEVEL[levelOf(v)].color);
  chartUI.stats = stats;
  chartUI.nowIdx = nowIdx;
  chartUI.cheapIdx = cheapIdx;
  // A refresh mid-drag keeps the finger's hour; otherwise drop the preview
  if (!chartUI.scrubbing || chartUI.scrubIdx >= prices.length) chartUI.scrubIdx = null;
  // Re-find the pinned hour by its start time (survives refresh and toggles,
  // dropped when the day rolls over)
  const k = chartUI.selKey ? prices.findIndex(p => p.time_start === chartUI.selKey) : -1;
  chartUI.selIdx = k >= 0 ? k : null;
  if (k < 0) chartUI.selKey = null;

  // Chart.js didn't load (CDN down): say so, and let the rest of the page render
  if (typeof Chart === "undefined") {
    showMessage("Grafen kunne ikke indlæses.");
    return;
  }

  const chart = ensureChart();
  chart.data.labels = prices.map(p => hourNum(p.time_start));
  chart.data.datasets[0].data = values;
  chart.update(); // morphs bars to new heights — no destroy
  document.getElementById("chartLive").textContent = "";

  canvas.setAttribute("aria-label",
    `Timepriser ${state.view === "today" ? "i dag" : "i morgen"}: ` +
    `laveste ${fmt(stats.min)} kr kl. ${hourLabel(prices[stats.minIdx].time_start)}, ` +
    `højeste ${fmt(stats.max)} kr kl. ${hourLabel(prices[stats.maxIdx].time_start)}. ` +
    `Tryk på en søjle for at se timen.`);

  syncReadout(false);
}

// ------------- readout (Apple Stocks-style) -------------
function defaultReadoutIdx() {
  if (state.view === "today" && chartUI.nowIdx >= 0) return chartUI.nowIdx;
  if (chartUI.cheapIdx >= 0) return chartUI.cheapIdx;
  return 0;
}

function setReadoutEmpty() {
  tweenToken++; // a running count-up must not write a number over "–"
  document.getElementById("roPrice").textContent = "–";
  document.getElementById("roHour").textContent = "–";
  document.getElementById("roLevel").textContent = "–";
  document.getElementById("roLevel").style.color = "";
  document.getElementById("roDiff").textContent = "–";
  document.getElementById("roSplit").innerHTML = "&nbsp;";
  document.getElementById("roPriceWrap").classList.remove("is-past");
  setResetVisible(false);
  chartUI.roPrice = null;
}

// "What is this price made of" line. Parts are rounded so they add up to
// the big number exactly.
function splitText(p, total) {
  const q = priceParts(p.DKK_per_kWh, p.time_start);
  const parts = [["Spot", q.spot]];
  if (state.gasel) parts.push(["Gasel", q.gasel]);
  if (state.tariffs) parts.push(["Nettarif og afgift", q.tariffs]);
  if (parts.length === 1) return state.vat ? "Spotpris inkl. moms" : "Ren spotpris";
  const cents = roundToTotal(parts.map(x => x[1]), total);
  return parts.map(([name], k) => `${name} ${fmt(cents[k] / 100)}`).join(" · ");
}

function setResetVisible(show) {
  const btn = document.getElementById("roReset");
  btn.classList.toggle("show", show);
  btn.tabIndex = show ? 0 : -1;
  btn.setAttribute("aria-hidden", String(!show));
}

// Every write bumps the token, so a running tween can never overwrite a
// newer value (e.g. a day switch right after a drag).
let tweenToken = 0;
function tweenPrice(el, from, to) {
  const token = ++tweenToken;
  if (REDUCE_MOTION || from === null || Math.abs(to - from) < 0.005) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now(), dur = 120;
  const step = (t) => {
    if (token !== tweenToken) return;
    const k = Math.max(0, Math.min(1, (t - t0) / dur));
    el.textContent = fmt(k < 1 ? from + (to - from) * k : to); // exact on the last frame
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateReadout(idx, animate = true) {
  const p = chartUI.prices[idx];
  if (!p) { setReadoutEmpty(); return; }
  const price = chartUI.values[idx];
  const stats = chartUI.stats;
  const lvl = levelOf(price);

  const hStart = new Date(p.time_start).getHours();
  const hEnd = new Date(p.time_end).getHours();
  const isNow = idx === chartUI.nowIdx && state.view === "today";
  document.getElementById("roHour").textContent =
    `Kl. ${pad(hStart)}–${pad(hEnd)}` + (isNow ? " · nu" : "");

  const lvlEl = document.getElementById("roLevel");
  lvlEl.textContent = LEVEL[lvl].label;
  lvlEl.style.color = LEVEL[lvl].color;

  const diff = price - stats.avg;
  document.getElementById("roDiff").textContent =
    `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))} vs. gns.`;

  document.getElementById("roSplit").textContent = splitText(p, price);

  // Past hours today: muted price, like their dimmed bars
  const past = state.view === "today" && chartUI.nowIdx >= 0 && idx < chartUI.nowIdx;
  document.getElementById("roPriceWrap").classList.toggle("is-past", past);

  const priceEl = document.getElementById("roPrice");
  tweenPrice(priceEl, animate ? chartUI.roPrice : null, price);
  chartUI.roPrice = price;
}

// Readout shows finger hour, else pinned hour, else now/cheapest
function syncReadout(animate = true) {
  if (!chartUI.prices.length) { setReadoutEmpty(); return; }
  updateReadout(activeIdx() ?? defaultReadoutIdx(), animate);
  const btn = document.getElementById("roReset");
  btn.textContent = state.view === "today" && chartUI.nowIdx >= 0 ? "↺ Nu" : "↺ Billigst";
  setResetVisible(chartUI.selIdx !== null);
}

// ------------- tap / drag selection -------------
function refreshSelection() {
  syncReadout();
  if (!chartUI.chart) return;
  chartUI.chart.update("none"); // instant recolor, no animation
  // update("none") skips drawing in the frame a morph finishes; draw anyway
  // so the pill and band always match the readout
  chartUI.chart.draw();
}

function scrubTo(idx) {
  if (idx === null || idx === chartUI.scrubIdx) return;
  chartUI.scrubIdx = idx;
  refreshSelection();
}

function endScrub() {
  chartUI.scrubbing = false;
  if (chartUI.scrubIdx === null) return;
  chartUI.scrubIdx = null;
  refreshSelection();
}

function selectHour(idx) {
  const p = idx === null ? null : chartUI.prices[idx];
  chartUI.selIdx = p ? idx : null;
  chartUI.selKey = p ? p.time_start : null;
  chartUI.scrubIdx = null;
  chartUI.scrubbing = false;
  refreshSelection();
  announceSelection();
}

function announceSelection() {
  const live = document.getElementById("chartLive");
  const i = chartUI.selIdx ?? defaultReadoutIdx();
  const p = chartUI.prices[i];
  if (!live || !p) return;
  const v = chartUI.values[i];
  live.textContent = `Kl. ${hourNum(p.time_start)}–${hourNum(p.time_end)}: ` +
    `${fmt(v)} kr pr. kWh, ${LEVEL[levelOf(v)].label}`;
}

// Touch model (iPhone first):
//  - tap a column        → pin that hour (tap it again to unpin)
//  - drag sideways       → live preview, the hour under the finger is pinned on release
//  - fast sideways flick → switch day
//  - vertical drag       → page scrolls; nothing is previewed or pinned
//  - second finger       → gesture abandoned (no accidental pin or day switch)
function initScrub(canvas) {
  let id = null, sx = 0, sy = 0, st = 0, mode = null; // mode: null | "scrub" | "pan"
  let stoppedScroll = false, lastScrollT = -Infinity;

  // Column under clientX from plain geometry. sticky: while dragging, keep
  // the current hour until the finger is well into the neighbour (no flicker
  // at column edges). strict: taps beside the bars (y-axis labels) select
  // nothing; drags clamp to the first/last hour instead.
  const idxAt = (clientX, sticky = false, strict = false) => {
    const chart = chartUI.chart;
    const a = chart && chart.chartArea;
    const n = chartUI.prices.length;
    if (!a || !n) return null;
    const colW = (a.right - a.left) / n;
    const x = clientX - canvas.getBoundingClientRect().left;
    if (strict && (x < a.left - colW / 2 || x > a.right + colW / 2)) return null;
    const cur = chartUI.scrubIdx;
    if (sticky && cur !== null && Math.abs(x - (a.left + (cur + 0.5) * colW)) < 0.7 * colW) return cur;
    return Math.min(n - 1, Math.max(0, Math.floor((x - a.left) / colW)));
  };

  const release = () => { id = null; mode = null; };

  window.addEventListener("scroll", () => { lastScrollT = performance.now(); }, { passive: true });

  // A second finger anywhere (pinch) cancels the current chart gesture
  document.addEventListener("pointerdown", (e) => {
    if (id !== null && e.pointerType === "touch" && e.pointerId !== id) {
      release();
      endScrub();
    }
  }, true);

  canvas.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (!chartUI.prices.length) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; mode = null;
    // Time the gesture by when the finger moved, not when a busy main
    // thread got round to the handler (a flick must stay a flick)
    st = e.timeStamp;
    // A touch that lands while the page is still gliding just stops the glide
    stoppedScroll = performance.now() - lastScrollT < 120;
    try { canvas.setPointerCapture(id); } catch (_) { /* not critical */ }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === null && Math.hypot(dx, dy) > 8) {
      mode = Math.abs(dx) > Math.abs(dy) ? "scrub" : "pan";
    } else if (mode === "pan" && Math.abs(dx) > 16 && Math.abs(dx) > 2 * Math.abs(dy)) {
      // Curved start: the page never took the pan (no pointercancel), so the
      // finger is clearly dragging sideways
      mode = "scrub";
    }
    if (mode === "scrub") {
      if (!chartUI.scrubbing) {
        chartUI.scrubbing = true;
        scrubTo(idxAt(sx)); // start from the touched column
      }
      scrubTo(idxAt(e.clientX, true));
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = e.timeStamp - st;
    const m = mode;
    release();

    // Fast horizontal flick = switch day; never pins, even with no day to go to
    const flick = dt < 300 && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy);
    if (flick) {
      if (!switchDay(dx < 0 ? "tomorrow" : "today")) endScrub();
      return;
    }
    // A short, quick touch is a tap whatever way the thumb rolled (iOS tap slop)
    const tapLike = Math.hypot(dx, dy) <= 16 && dt < 300;
    if (m === "scrub" && !tapLike) {
      selectHour(chartUI.scrubIdx ?? idxAt(e.clientX, true)); // what you saw is what you get
      return;
    }
    if (m === "pan" && !tapLike) return;
    const i = stoppedScroll ? null : idxAt(sx, false, true); // the column the finger landed on
    if (i === null) { endScrub(); return; }
    selectHour(i === chartUI.selIdx ? null : i);
  });

  canvas.addEventListener("pointercancel", (e) => {
    if (e.pointerId !== id) return;
    release();
    endScrub();
  });

  document.getElementById("roReset").addEventListener("click", () => selectHour(null));

  canvas.style.cursor = "pointer";
}

// ------------- calculator -------------
function computeWindow(prices, hours, mode) {
  const now = Date.now();
  const pool = prices.filter(p => new Date(p.time_end).getTime() > now);
  if (pool.length < hours) return null;
  let best = null;
  for (let i = 0; i <= pool.length - hours; i++) {
    const win = pool.slice(i, i + hours);
    const sum = win.reduce((s, p) => s + fullPrice(p.DKK_per_kWh, p.time_start), 0);
    if (!best) best = { sum, window: win };
    else if (mode === "min" && sum < best.sum) best = { sum, window: win };
    else if (mode === "max" && sum > best.sum) best = { sum, window: win };
  }
  return best;
}

function renderCalculator() {
  const { kwh, hours } = state.appliance;
  const pool = [...state.today, ...state.tomorrow];
  const out = document.getElementById("calcOutput");
  if (!pool.length) { out.textContent = "Venter på data…"; return; }

  const best = computeWindow(pool, hours, "min");
  const worst = computeWindow(pool, hours, "max");
  if (!best || !worst) { out.textContent = "Ikke nok fremtidige timer til beregning endnu."; return; }

  const runCost = kwh * (best.sum / hours);
  const worstCost = kwh * (worst.sum / hours);
  const savings = worstCost - runCost;
  const savePct = Math.round((savings / worstCost) * 100);

  const start = new Date(best.window[0].time_start);
  const end = new Date(best.window[best.window.length - 1].time_end);
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const dayTxt = sameDay ? "i dag" : "i morgen";

  out.innerHTML = `
    <div class="when">Start <strong>${dayTxt} kl. ${pad(start.getHours())}:00</strong>, slut ${pad(end.getHours())}:00.</div>
    <div class="cost">Estimeret pris <strong>${fmt(runCost)} kr</strong> for ${kwh} kWh over ${hours} t.</div>
    <div class="savings">Du sparer ${fmt(savings)} kr (${savePct}%) ift. værste start.</div>
  `;
}

// ------------- tabs / day switch -------------
// Returns true if the day actually changed
function switchDay(day) {
  if (day === state.view) return false;
  const btn = document.querySelector(`.tab[data-day="${day}"]`);
  if (!btn || btn.disabled) return false;
  document.querySelectorAll(".tab").forEach(t => {
    const active = t === btn;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  // A pinned hour belongs to its day — the new day opens on its default hour
  chartUI.scrubIdx = chartUI.selIdx = chartUI.selKey = null;
  chartUI.scrubbing = false;
  state.view = day;
  positionThumb();
  renderChart();
  renderLists();
  renderTable();
  return true;
}

function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchDay(btn.dataset.day));
  });
  window.addEventListener("resize", positionThumb);
}

function positionThumb() {
  const active = document.querySelector(".tab.active");
  const thumb = document.getElementById("tabThumb");
  if (!active || !thumb) return;
  thumb.style.width = active.offsetWidth + "px";
  thumb.style.transform = `translateX(${active.offsetLeft}px)`;
}

function updateTabDates() {
  const t = new Date();
  const m = new Date(t);
  m.setDate(t.getDate() + 1);
  const f = (d) => d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric" });
  document.getElementById("tabDateToday").textContent = f(t);
  const tomEl = document.getElementById("tabDateTomorrow");
  tomEl.textContent = state.tomorrow.length ? f(m) : "fra ca. 13.00";
  requestAnimationFrame(positionThumb);
}

// ------------- color thresholds -------------
function renderLegend() {
  const t = state.thresholds;
  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  set("lgGood", `Billig < ${fmt(t.good)}`);
  set("lgOk", `Normal < ${fmt(t.ok)}`);
  set("lgWarn", `Høj < ${fmt(t.warn)}`);
  set("lgBad", `Dyr ≥ ${fmt(t.warn)}`);
}

function sanitizeThresholds(t) {
  let good = Math.max(0.05, t.good || THRESH_DEFAULT.good);
  let ok = Math.max(good + 0.05, t.ok || THRESH_DEFAULT.ok);
  let warn = Math.max(ok + 0.05, t.warn || THRESH_DEFAULT.warn);
  const r = (x) => Math.round(x * 100) / 100;
  return { good: r(good), ok: r(ok), warn: r(warn) };
}

function initLimits() {
  const saved = store.json("thresholds");
  if (saved) state.thresholds = sanitizeThresholds(saved);

  const inputs = {
    good: document.getElementById("thGood"),
    ok: document.getElementById("thOk"),
    warn: document.getElementById("thWarn"),
  };

  const fillInputs = () => {
    inputs.good.value = fmt(state.thresholds.good);
    inputs.ok.value = fmt(state.thresholds.ok);
    inputs.warn.value = fmt(state.thresholds.warn);
  };
  fillInputs();
  renderLegend();

  const toggle = document.getElementById("limitsToggle");
  const panel = document.getElementById("limitsPanel");
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    toggle.textContent = panel.hidden ? "Justér farvegrænser" : "Skjul farvegrænser";
  });

  const apply = () => {
    const parse = (el, fallback) => {
      const v = parseFloat(String(el.value).replace(",", "."));
      return Number.isFinite(v) ? v : fallback;
    };
    state.thresholds = sanitizeThresholds({
      good: parse(inputs.good, THRESH_DEFAULT.good),
      ok: parse(inputs.ok, THRESH_DEFAULT.ok),
      warn: parse(inputs.warn, THRESH_DEFAULT.warn),
    });
    store.set("thresholds", JSON.stringify(state.thresholds));
    fillInputs();
    renderLegend();
    renderAll();
  };
  Object.values(inputs).forEach(el => el.addEventListener("change", apply));

  document.getElementById("limitsReset").addEventListener("click", () => {
    state.thresholds = { ...THRESH_DEFAULT };
    store.del("thresholds");
    fillInputs();
    renderLegend();
    renderAll();
  });
}

// Swipe on chart card (outside canvas — canvas flicks handled in initScrub)
function initSwipe() {
  const card = document.querySelector(".chart-card");
  if (!card) return;
  // One-finger swipes only: a pinch (two touches) never switches day
  let sx = 0, sy = 0, valid = false, tid = null;
  card.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) { valid = false; return; }
    const t = e.changedTouches[0];
    valid = e.target.id !== "priceChart";
    tid = t.identifier;
    sx = t.clientX;
    sy = t.clientY;
  }, { passive: true });
  card.addEventListener("touchend", (e) => {
    if (!valid) return;
    const t = Array.from(e.changedTouches).find(x => x.identifier === tid);
    if (!t) return;
    valid = false;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) {
      switchDay(dx < 0 ? "tomorrow" : "today");
    }
  }, { passive: true });
}

// ------------- UI wiring -------------
function initAppliances() {
  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.appliance = {
        key: btn.dataset.appliance,
        kwh: parseFloat(btn.dataset.kwh),
        hours: parseInt(btn.dataset.hours, 10),
      };
      renderCalculator();
    });
  });
}

function initModes() {
  const saved = store.json("modes");
  if (saved) {
    state.tariffs = !!saved.tariffs;
    state.gasel = !!saved.gasel;
    state.vat = !!saved.vat;
  }
  syncModeChips();

  document.querySelectorAll(".mode-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const m = chip.dataset.mode;
      state[m] = !state[m];
      chip.classList.toggle("active", state[m]);
      store.set("modes", JSON.stringify({
        tariffs: state.tariffs, gasel: state.gasel, vat: state.vat,
      }));
      renderAll();
    });
  });
}

function syncModeChips() {
  document.querySelectorAll(".mode-chip").forEach(chip => {
    chip.classList.toggle("active", !!state[chip.dataset.mode]);
  });
}

function initTheme() {
  const stored = store.get("theme") || "light";
  document.documentElement.setAttribute("data-theme", stored);
  const btn = document.getElementById("themeBtn");
  btn.textContent = stored === "dark" ? "◑" : "◐";
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("theme", next);
    btn.textContent = next === "dark" ? "◑" : "◐";
  });
}

// Updated by the minute tick, so it changes together with the price
function renderClock() {
  const d = new Date();
  const el = document.getElementById("clock");
  if (el) el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


function initReveals() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -80px 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

function initScrollTop() {
  window.addEventListener("load", () => {
    if (!location.hash || location.hash === "#top") {
      window.scrollTo(0, 0);
    }
  });
}

let rendered = false;
function renderAll() {
  rendered = true;
  renderHero();
  renderChart();
  renderLists();
  renderTable();
  renderCalculator();
  renderFooter();
}

// When both days were last answered — not when a failed retry ran
function renderFooter() {
  const el = document.getElementById("lastUpdate");
  if (!el) return;
  el.textContent = (state.loadedAt
    ? new Date(state.loadedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
    : "–") + (state.fetchFailed ? " (ingen forbindelse lige nu)" : "");
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 4000);
}

async function boot() {
  initScrollTop();
  initTheme();
  renderClock();
  initTabs();
  initSwipe();
  initAppliances();
  initModes();
  initLimits();
  initReveals();
  syncTomorrowTab();

  // Tick on the whole minute, so a new hour (and midnight) shows within a
  // second. Re-armed first, so an error in one tick can't stop the clock.
  const scheduleTick = () => setTimeout(() => {
    scheduleTick();
    minuteTick();
  }, 60500 - (Date.now() % 60000));
  scheduleTick();
  // iPhone Safari pauses timers in the background — catch up on return
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") minuteTick();
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) minuteTick(); });

  await refresh();
}

document.addEventListener("DOMContentLoaded", boot);
