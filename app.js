// ============================================================
// Elprisen DK2 — app.js
// Data: elprisenligenu.dk + Energinet/Radius/Skat tariffs (2026)
// ============================================================

const REGION = "DK2";
const API = (date) =>
  `https://www.elprisenligenu.dk/api/v1/prices/${date.getFullYear()}/${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${REGION}.json`;

// Tariffs in kr/kWh (ex. moms). 2026 rates, kalibreret mod faktisk Gasel-regning.
const TARIFFS = {
  elafgift: 0.008,              // 0.8 øre — midlertidig nedsat 2026-2027
  energinetTransmission: 0.047, // 4.7 øre
  energinetSystem: 0.072,       // 7.2 øre
};
const GASEL_MARKUP = 0.06;      // 6 øre
const VAT_RATE = 0.25;

// Radius Elnet C-customer time-of-use tariffs (kr/kWh, ex. moms). 2026.
// Kalibreret mod faktisk Gasel-regning — summer spids er lavere end stromligning.dk angiver.
// Hours: Lav 00-06, Spids 17-21, Høj = alt andet
function radiusTariff(hour, month) {
  // Summer: Apr 1 – Sep 30 (months 3-8, 0-indexed)
  const isSummer = month >= 3 && month <= 8;
  if (hour >= 0 && hour < 6) return 0.1327;                    // Lav (året rundt)
  if (hour >= 17 && hour < 21) return isSummer ? 0.4565 : 1.1945; // Spids
  return isSummer ? 0.1991 : 0.3982;                           // Høj
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
  badgeRO: null,
};

// ------------- utils -------------
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
const hourLabel = (iso) => pad(new Date(iso).getHours()) + ":00";
const hourNum = (iso) => pad(new Date(iso).getHours());

// Compute final consumer price for one hour's spot price
function fullPrice(spotKr, timeStartIso) {
  let p = spotKr;
  if (state.gasel) p += GASEL_MARKUP;
  if (state.tariffs) {
    p += TARIFFS.elafgift + TARIFFS.energinetTransmission + TARIFFS.energinetSystem;
    const d = new Date(timeStartIso);
    p += radiusTariff(d.getHours(), d.getMonth());
  }
  if (state.vat) p *= 1 + VAT_RATE;
  return p;
}

// Same formula as fullPrice(), split into parts for the readout.
// Display only — keep in step with fullPrice().
function priceParts(spotKr, timeStartIso) {
  const k = state.vat ? 1 + VAT_RATE : 1;
  const d = new Date(timeStartIso);
  const fees = TARIFFS.elafgift + TARIFFS.energinetTransmission + TARIFFS.energinetSystem;
  return {
    spot: spotKr * k,
    gasel: state.gasel ? GASEL_MARKUP * k : 0,
    net: state.tariffs ? radiusTariff(d.getHours(), d.getMonth()) * k : 0,
    fees: state.tariffs ? fees * k : 0,
  };
}

// Round parts to whole øre so they add up to the rounded total exactly
// (largest remainder). Each part stays within 1 øre of its true value.
function roundToTotal(values, total) {
  const target = Math.round(total * 100);
  const scaled = values.map(v => v * 100);
  const cents = scaled.map(Math.floor);
  let rest = target - cents.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((s, k) => ({ k, frac: s - cents[k] }))
    .sort((a, b) => b.frac - a.frac);
  for (let j = 0; rest > 0 && j < order.length; j++, rest--) cents[order[j].k]++;
  for (let j = order.length - 1; rest < 0 && j >= 0; j--, rest++) cents[order[j].k]--;
  return cents;
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
async function fetchDay(date) {
  try {
    const res = await fetch(API(date));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}

async function loadData() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const [td, tm] = await Promise.all([fetchDay(today), fetchDay(tomorrow)]);
  state.today = td;
  state.tomorrow = tm;
  if (!td.length) toast("Kunne ikke hente dagens priser.");
  const tomorrowTab = document.getElementById("tabTomorrow");
  tomorrowTab.disabled = tm.length === 0;
  updateTabDates();
}

// ------------- hero -------------
function renderHero() {
  const prices = state.today;
  if (!prices.length) return;

  const stats = statsOf(prices);
  const idx = currentHourIndex(prices);
  const cur = idx >= 0 ? fullPrice(prices[idx].DKK_per_kWh, prices[idx].time_start) : stats.avg;

  document.getElementById("priceNow").textContent = fmt(cur);
  document.getElementById("statMin").textContent = fmt(stats.min);
  document.getElementById("statMax").textContent = fmt(stats.max);
  document.getElementById("statAvg").textContent = fmt(stats.avg);
  document.getElementById("statMinHint").textContent = "kl. " + hourLabel(prices[stats.minIdx].time_start);
  document.getElementById("statMaxHint").textContent = "kl. " + hourLabel(prices[stats.maxIdx].time_start);

  const lvl = levelOf(cur);
  document.getElementById("priceLevel").textContent =
    `${LEVEL[lvl].label} pris pr. kWh`;

  // Caption echoing pricing mode
  const parts = ["Spot"];
  if (state.tariffs) parts.push("afgifter");
  if (state.gasel) parts.push("Gasel");
  if (state.vat) parts.push("moms");
  const echo = document.getElementById("modeEcho");
  if (echo) echo.textContent = parts.join(" + ");

  // Next cheap hour tip
  const forward = [];
  if (idx >= 0) prices.slice(idx + 1).forEach(p => forward.push(p));
  state.tomorrow.forEach(p => forward.push(p));

  if (forward.length) {
    const cheapest = forward.reduce((a, b) =>
      fullPrice(a.DKK_per_kWh, a.time_start) < fullPrice(b.DKK_per_kWh, b.time_start) ? a : b
    );
    const t = new Date(cheapest.time_start);
    const now = new Date();
    const hoursAway = Math.max(1, Math.round((t - now) / 3600000));
    const dayTxt = t.getDate() === now.getDate() ? "i dag" : "i morgen";
    const price = fullPrice(cheapest.DKK_per_kWh, cheapest.time_start);
    document.getElementById("nextCheap").innerHTML =
      `Billigste kommende time er <strong>${pad(t.getHours())}:00 ${dayTxt}</strong> til ${fmt(price)} kr/kWh — om ${hoursAway} timer.`;
  }
}

// ------------- lists -------------
function renderLists() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  if (!prices.length) return;

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
    return `<div class="hour-row ${isNow ? "now" : ""}" data-hour="${i}">
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

// Geometry for the selected column: band, price pill above the plot,
// hour pill on the x-axis row
function selGeometry(chart, i) {
  const bar = chart.getDatasetMeta(0).data[i];
  if (!bar) return null;
  const a = chart.chartArea;
  const colW = (a.right - a.left) / chartUI.prices.length;
  const pillH = 20;
  const pillTop = a.top - pillH - 6;
  // Centre of the x tick labels: tick length (8) + tick padding + half a line
  const xs = chart.scales.x;
  const labelY = xs.top + 8 + xs.options.ticks.padding + (11 * 1.2) / 2;
  return { bar, a, colW, pillH, pillTop, labelY, axisBottom: labelY + 12 };
}

// Plugin: soft band behind the selected column, under the bars
const selBandPlugin = {
  id: "selBand",
  beforeDatasetsDraw(chart) {
    const i = activeIdx();
    const g = i === null ? null : selGeometry(chart, i);
    if (!g) return;
    const { ctx } = chart;
    const top = g.pillTop - 3;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRectPath(ctx, g.bar.x - g.colW / 2, top, g.colW, g.axisBottom - top, Math.min(7, g.colW / 2));
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
    const font = "-apple-system, BlinkMacSystemFont, sans-serif";
    const clampX = (w) => Math.min(chart.width - w - 2, Math.max(2, g.bar.x - w / 2));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const price = fmt(chartUI.values[i]);
    ctx.font = `700 12px ${font}`;
    const pw = Math.ceil(ctx.measureText(price).width) + 16;
    const px = clampX(pw);
    ctx.fillStyle = chartUI.colors[i] || "#f5f5f7";
    roundRectPath(ctx, px, g.pillTop, pw, g.pillH, g.pillH / 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillText(price, px + pw / 2, g.pillTop + g.pillH / 2 + 0.5);

    const hour = hourNum(chartUI.prices[i].time_start);
    ctx.font = `700 11px ${font}`;
    const hw = Math.ceil(ctx.measureText(hour).width) + 12, hh = 18;
    const hx = clampX(hw);
    const hy = g.labelY - hh / 2;
    ctx.fillStyle = "#f5f5f7";
    roundRectPath(ctx, hx, hy, hw, hh, hh / 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillText(hour, hx + hw / 2, hy + hh / 2 + 0.5);
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

function positionNowBadge() {
  const badge = document.getElementById("nowBadge");
  const chart = chartUI.chart;
  if (!badge || !chart) return;
  const nowIdx = chartUI.nowIdx;
  if (nowIdx < 0 || state.view !== "today") { badge.hidden = true; return; }
  const bar = chart.getDatasetMeta(0).data[nowIdx];
  if (!bar) { badge.hidden = true; return; }
  // Make way for the price pill when a nearby tall bar would collide with it
  const sel = activeIdx();
  if (sel !== null && Math.abs(sel - nowIdx) <= 3 && bar.y < chart.chartArea.top + 30) {
    badge.hidden = true;
    return;
  }
  const wrap = badge.parentElement.getBoundingClientRect();
  const canvas = chart.canvas.getBoundingClientRect();
  badge.style.left = (canvas.left - wrap.left + bar.x) + "px";
  badge.style.top = (canvas.top - wrap.top + bar.y) + "px";
  badge.hidden = false;
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
        onComplete: positionNowBadge,
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
            color: tickColor,
            font: { size: 11, family: "-apple-system, sans-serif" },
            maxRotation: 0,
            autoSkip: false,
            padding: 12,
            callback(value, index) {
              // The selected hour gets its own pill; keep its neighbours clear
              const sel = activeIdx();
              if (sel !== null && Math.abs(index - sel) <= 1) return "";
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
    plugins: [selBandPlugin, avgLinePlugin, cheapDotPlugin, selLabelPlugin],
  });

  initScrub(canvas);

  if (chartUI.badgeRO) chartUI.badgeRO.disconnect();
  chartUI.badgeRO = new ResizeObserver(() => {
    positionNowBadge();
    positionThumb();
  });
  chartUI.badgeRO.observe(canvas.parentElement);

  return chartUI.chart;
}

function renderChart() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  const empty = document.getElementById("chartEmpty");
  const canvas = document.getElementById("priceChart");
  const badge = document.getElementById("nowBadge");

  if (!prices.length) {
    empty.hidden = false;
    canvas.style.display = "none";
    if (badge) badge.hidden = true;
    chartUI.prices = [];
    chartUI.scrubIdx = chartUI.selIdx = chartUI.selKey = null;
    setReadoutEmpty();
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

  const chart = ensureChart();
  chart.data.labels = prices.map(p => hourNum(p.time_start));
  chart.data.datasets[0].data = values;
  chart.update(); // morphs bars to new heights — no destroy
  if (REDUCE_MOTION) positionNowBadge(); // no onComplete without animation

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
  if (state.tariffs) parts.push(["Elnet", q.net], ["Afgifter", q.fees]);
  if (parts.length === 1) return "Ren spotpris";
  const cents = roundToTotal(parts.map(x => x[1]), total);
  return parts.map(([name], k) => `${name} ${fmt(cents[k] / 100)}`).join(" · ");
}

function setResetVisible(show) {
  const btn = document.getElementById("roReset");
  btn.classList.toggle("show", show);
  btn.tabIndex = show ? 0 : -1;
  btn.setAttribute("aria-hidden", String(!show));
}

function tweenPrice(el, from, to) {
  if (REDUCE_MOTION || from === null || Math.abs(to - from) < 0.005) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now(), dur = 120;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(from + (to - from) * k);
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
  if (chartUI.chart) chartUI.chart.update("none"); // instant recolor, no animation
  positionNowBadge();
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
function initScrub(canvas) {
  let id = null, sx = 0, sy = 0, st = 0, mode = null; // mode: null | "scrub" | "pan"

  // Column under the finger from plain geometry; edges clamp to first/last.
  // While dragging, stick to the current hour until the finger is well
  // into the neighbour, so the readout doesn't flicker at column edges.
  const idxAt = (clientX) => {
    const chart = chartUI.chart;
    const a = chart && chart.chartArea;
    const n = chartUI.prices.length;
    if (!a || !n) return null;
    const colW = (a.right - a.left) / n;
    const x = clientX - canvas.getBoundingClientRect().left;
    const cur = chartUI.scrubIdx;
    if (cur !== null && Math.abs(x - (a.left + (cur + 0.5) * colW)) < 0.7 * colW) return cur;
    return Math.min(n - 1, Math.max(0, Math.floor((x - a.left) / colW)));
  };

  const release = () => { id = null; mode = null; };

  canvas.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (!chartUI.prices.length) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); mode = null;
    try { canvas.setPointerCapture(id); } catch (_) { /* not critical */ }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === null && Math.hypot(dx, dy) > 8) {
      mode = Math.abs(dx) > Math.abs(dy) ? "scrub" : "pan";
    }
    if (mode === "scrub") {
      chartUI.scrubbing = true;
      scrubTo(idxAt(e.clientX));
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - st;
    const m = mode;
    release();

    // Fast horizontal flick = switch day (if there is a day to switch to)
    const flick = dt < 300 && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy);
    if (flick && switchDay(dx < 0 ? "tomorrow" : "today")) return;
    if (m === "pan") { endScrub(); return; }
    if (m === "scrub") {
      const i = chartUI.scrubIdx ?? idxAt(e.clientX);
      selectHour(i); // what you saw is what you get
      return;
    }
    const i = idxAt(e.clientX);
    if (i === null) return;
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
  const saved = JSON.parse(localStorage.getItem("thresholds") || "null");
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
    localStorage.setItem("thresholds", JSON.stringify(state.thresholds));
    fillInputs();
    renderLegend();
    renderAll();
  };
  Object.values(inputs).forEach(el => el.addEventListener("change", apply));

  document.getElementById("limitsReset").addEventListener("click", () => {
    state.thresholds = { ...THRESH_DEFAULT };
    localStorage.removeItem("thresholds");
    fillInputs();
    renderLegend();
    renderAll();
  });
}

// Swipe on chart card (outside canvas — canvas flicks handled in initScrub)
function initSwipe() {
  const card = document.querySelector(".chart-card");
  if (!card) return;
  let sx = 0, sy = 0, valid = false;
  card.addEventListener("touchstart", (e) => {
    valid = e.target.id !== "priceChart";
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  card.addEventListener("touchend", (e) => {
    if (!valid) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
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
  const saved = JSON.parse(localStorage.getItem("modes") || "null");
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
      localStorage.setItem("modes", JSON.stringify({
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
  const stored = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", stored);
  const btn = document.getElementById("themeBtn");
  btn.textContent = stored === "dark" ? "◑" : "◐";
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    btn.textContent = next === "dark" ? "◑" : "◐";
  });
}

function initClock() {
  const tick = () => {
    const d = new Date();
    const el = document.getElementById("clock");
    if (el) el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  tick();
  setInterval(tick, 30 * 1000);
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

function renderAll() {
  renderHero();
  renderChart();
  renderLists();
  renderTable();
  renderCalculator();
  const el = document.getElementById("lastUpdate");
  if (el) el.textContent = new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
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
  initClock();
  initTabs();
  initSwipe();
  initAppliances();
  initModes();
  initLimits();
  initReveals();
  updateTabDates();

  await loadData();
  renderAll();

  setInterval(async () => { await loadData(); renderAll(); }, 10 * 60 * 1000);
  setInterval(() => {
    if (!state.today.length) return;
    renderHero();
    renderTable();
    // New hour: move NU badge, "· nu" and past-hour dimming (pin is kept)
    const ci = currentHourIndex(state.today);
    if (state.view === "today" && ci >= 0 && ci !== chartUI.nowIdx) renderChart();
  }, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", boot);
