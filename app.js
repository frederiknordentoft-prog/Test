// ============================================================
// Elpriser DK2 — dashboard
// Data: elprisenligenu.dk public API (no key required)
// ============================================================

const REGION = "DK2";
const API = (date) =>
  `https://www.elprisenligenu.dk/api/v1/prices/${date.getFullYear()}/${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${REGION}.json`;
const VAT_RATE = 0.25;

const state = {
  today: [],
  tomorrow: [],
  view: "today",       // "today" | "tomorrow"
  vat: true,
  appliance: { key: "washer", kwh: 1.0, hours: 2 },
  chart: null,
};

// ------------- utils -------------
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
const fmtOre = (kr) => Math.round(kr * 100) + " øre";
const hourLabel = (iso) => new Date(iso).getHours().toString().padStart(2, "0") + ":00";

function withVat(kr) { return state.vat ? kr * (1 + VAT_RATE) : kr; }

function levelOf(price, stats) {
  // thresholds based on today's distribution + absolute sanity values
  const { min, max, avg } = stats;
  const range = max - min || 0.01;
  const rel = (price - min) / range;
  if (rel < 0.25) return "good";
  if (rel < 0.55) return "ok";
  if (rel < 0.8) return "warn";
  return "bad";
}

const LEVEL_META = {
  good: { label: "Billig", color: "#10d982" },
  ok:   { label: "Normal", color: "#eab308" },
  warn: { label: "Høj",    color: "#f97316" },
  bad:  { label: "Dyr",    color: "#ef4444" },
};

function statsOf(prices) {
  if (!prices.length) return { min: 0, max: 0, avg: 0 };
  const vals = prices.map(p => withVat(p.DKK_per_kWh));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg };
}

function currentHourIndex(prices) {
  const now = Date.now();
  return prices.findIndex(p => {
    const s = new Date(p.time_start).getTime();
    const e = new Date(p.time_end).getTime();
    return now >= s && now < e;
  });
}

// ------------- fetch -------------
async function fetchDay(date) {
  try {
    const res = await fetch(API(date));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("Fetch failed", date, e);
    return [];
  }
}

async function loadData() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [td, tm] = await Promise.all([fetchDay(today), fetchDay(tomorrow)]);
  state.today = td;
  state.tomorrow = tm;

  if (!td.length) {
    toast("Kunne ikke hente dagens priser. Prøv igen senere.");
  }

  const tomorrowTab = document.getElementById("tabTomorrow");
  tomorrowTab.disabled = tm.length === 0;
  tomorrowTab.title = tm.length === 0 ? "Ikke offentliggjort endnu" : "Se i morgen";
}

// ------------- rendering -------------
function renderHero() {
  const prices = state.today;
  if (!prices.length) return;

  const stats = statsOf(prices);
  const idx = currentHourIndex(prices);
  const cur = idx >= 0 ? withVat(prices[idx].DKK_per_kWh) : stats.avg;

  document.getElementById("priceNow").textContent = fmt(cur);
  document.getElementById("statMin").textContent = fmt(stats.min) + " kr";
  document.getElementById("statMax").textContent = fmt(stats.max) + " kr";
  document.getElementById("statAvg").textContent = fmt(stats.avg) + " kr";

  // Level + dot color
  const level = levelOf(cur, stats);
  const meta = LEVEL_META[level];
  const badge = document.getElementById("priceLevel");
  badge.textContent = meta.label;
  badge.className = "badge " + level;
  document.getElementById("nowDot").style.color = meta.color;
  document.getElementById("nowDot").style.background = meta.color;

  // Trend arrow compared to prev hour
  if (idx > 0) {
    const prev = withVat(prices[idx - 1].DKK_per_kWh);
    const diff = cur - prev;
    const pct = Math.abs((diff / prev) * 100);
    const trend = document.getElementById("priceTrend");
    if (Math.abs(diff) < 0.01) {
      trend.textContent = "→ stabil";
      trend.className = "trend";
    } else if (diff > 0) {
      trend.textContent = `▲ ${pct.toFixed(0)}% vs. sidste time`;
      trend.className = "trend up";
    } else {
      trend.textContent = `▼ ${pct.toFixed(0)}% vs. sidste time`;
      trend.className = "trend down";
    }
  }

  // Next cheap hour (from now forward), looking into tomorrow too
  const forward = [];
  if (idx >= 0) {
    prices.slice(idx + 1).forEach(p => forward.push(p));
  }
  state.tomorrow.forEach(p => forward.push(p));

  if (forward.length) {
    const cheapest = forward.reduce((a, b) => (a.DKK_per_kWh < b.DKK_per_kWh ? a : b));
    const t = new Date(cheapest.time_start);
    const now = new Date();
    const hoursAway = Math.round((t - now) / 3600000);
    const dayTxt = t.getDate() === now.getDate() ? "i dag" : "i morgen";
    const whenTxt = hoursAway <= 1 ? "om kort tid" : `om ${hoursAway} t.`;
    const price = withVat(cheapest.DKK_per_kWh);
    document.getElementById("nextCheap").innerHTML =
      `💡 Billigste kommende time: <strong>${pad(t.getHours())}:00 ${dayTxt}</strong> til <strong>${fmt(price)} kr/kWh</strong> (${whenTxt})`;
  }
}

function renderLists() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  if (!prices.length) return;

  const sorted = [...prices].sort(
    (a, b) => a.DKK_per_kWh - b.DKK_per_kWh
  );
  const cheap = sorted.slice(0, 3);
  const exp = sorted.slice(-3).reverse();

  const mkLi = (p) => {
    const price = withVat(p.DKK_per_kWh);
    return `<li><span class="hour">${hourLabel(p.time_start)}</span><span class="val">${fmt(price)} kr</span></li>`;
  };
  document.getElementById("cheapList").innerHTML = cheap.map(mkLi).join("");
  document.getElementById("expList").innerHTML = exp.map(mkLi).join("");

  const chipTxt = state.view === "today" ? "I dag" : "I morgen";
  document.getElementById("dayChip").textContent = chipTxt;
  document.getElementById("tableChip").textContent = chipTxt;
}

function renderTable() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  const body = document.getElementById("hoursBody");
  if (!prices.length) { body.innerHTML = ""; return; }

  const stats = statsOf(prices);
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;

  body.innerHTML = prices.map((p, i) => {
    const price = withVat(p.DKK_per_kWh);
    const lvl = levelOf(price, stats);
    const meta = LEVEL_META[lvl];
    const widthPct = Math.max(6, ((price - stats.min) / (stats.max - stats.min || 1)) * 100);
    const isNow = i === nowIdx;
    return `<tr class="${isNow ? "now" : ""}">
      <td>${hourLabel(p.time_start)}</td>
      <td class="val">${fmt(price)} kr</td>
      <td><span class="level-chip level-${lvl}">${meta.label}</span></td>
      <td><div class="bar" style="width:${widthPct}%; --lvl-color:${meta.color}; background:${meta.color}"></div></td>
    </tr>`;
  }).join("");
}

// ------------- chart -------------
function renderChart() {
  const prices = state.view === "today" ? state.today : state.tomorrow;
  const empty = document.getElementById("chartEmpty");
  const canvas = document.getElementById("priceChart");

  if (!prices.length) {
    empty.hidden = false;
    canvas.style.display = "none";
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    return;
  }
  empty.hidden = true;
  canvas.style.display = "block";

  const stats = statsOf(prices);
  const labels = prices.map(p => hourLabel(p.time_start));
  const values = prices.map(p => withVat(p.DKK_per_kWh));
  const colors = values.map(v => LEVEL_META[levelOf(v, stats)].color);
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;
  const borders = values.map((_, i) =>
    i === nowIdx ? "#ffffff" : "rgba(255,255,255,0.05)"
  );
  const borderWidths = values.map((_, i) => (i === nowIdx ? 2.5 : 1));

  if (state.chart) state.chart.destroy();

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)";
  const tickColor = isLight ? "#64748b" : "#8891a8";

  state.chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "kr/kWh",
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: borderWidths,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 20, 39, 0.95)",
          borderColor: "rgba(124, 92, 255, 0.4)",
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: "600" },
          bodyFont: { size: 13 },
          displayColors: true,
          callbacks: {
            label: (ctx) => {
              const kr = ctx.parsed.y;
              const lvl = LEVEL_META[levelOf(kr, stats)].label;
              return `  ${fmt(kr)} kr/kWh · ${lvl}`;
            },
            afterLabel: (ctx) => {
              const diff = ctx.parsed.y - stats.avg;
              const sign = diff >= 0 ? "+" : "";
              return `  ${sign}${fmt(diff)} kr vs. gns.`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, font: { size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 11 },
            callback: (v) => fmt(v) + " kr",
          },
        },
      },
    },
  });
}

// ------------- calculator -------------
function computeCheapestWindow(prices, windowHours) {
  // include future today + all tomorrow
  const now = Date.now();
  const pool = prices.filter(p => new Date(p.time_end).getTime() > now);
  if (pool.length < windowHours) return null;

  let best = null;
  for (let i = 0; i <= pool.length - windowHours; i++) {
    const window = pool.slice(i, i + windowHours);
    const sum = window.reduce((s, p) => s + withVat(p.DKK_per_kWh), 0);
    if (!best || sum < best.sum) {
      best = { sum, window };
    }
  }
  return best;
}

function renderCalculator() {
  const { key, kwh, hours } = state.appliance;
  const pool = [...state.today, ...state.tomorrow];
  if (!pool.length) {
    document.getElementById("calcOutput").textContent = "Venter på data...";
    return;
  }

  const best = computeCheapestWindow(pool, hours);
  if (!best) {
    document.getElementById("calcOutput").textContent =
      "Ikke nok fremtidige timer til at beregne vindue endnu.";
    return;
  }

  const avgKr = best.sum / hours;
  const runCost = kwh * avgKr;

  // Worst window for comparison
  let worst = null;
  for (let i = 0; i <= pool.length - hours; i++) {
    const w = pool.slice(i, i + hours);
    const s = w.reduce((x, p) => x + withVat(p.DKK_per_kWh), 0);
    if (!worst || s > worst.sum) worst = { sum: s, window: w };
  }
  const worstAvg = worst.sum / hours;
  const worstCost = kwh * worstAvg;
  const savings = worstCost - runCost;
  const savePct = ((savings / worstCost) * 100).toFixed(0);

  const start = new Date(best.window[0].time_start);
  const end = new Date(best.window[best.window.length - 1].time_end);
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const dayTxt = sameDay ? "i dag" : "i morgen";
  const startTxt = `${pad(start.getHours())}:00`;
  const endTxt = `${pad(end.getHours())}:00`;

  document.getElementById("calcOutput").innerHTML = `
    Start <strong>${dayTxt} kl. ${startTxt}</strong> (slut ca. ${endTxt})<br/>
    Estimeret pris for en kørsel: <strong>${fmt(runCost)} kr</strong>
    (${kwh} kWh · ${hours} t.)<br/>
    <span class="savings">Du sparer ca. ${fmt(savings)} kr (${savePct}%)</span> ift. den dyreste start.
  `;
}

// ------------- UI wiring -------------
function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.day;
      renderChart();
      renderLists();
      renderTable();
    });
  });
}

function initAppliances() {
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("active"));
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

function initVat() {
  const toggle = document.getElementById("vatToggle");
  toggle.addEventListener("change", () => {
    state.vat = toggle.checked;
    renderAll();
  });
}

function initTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) document.documentElement.setAttribute("data-theme", stored);
  const btn = document.getElementById("themeBtn");
  btn.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    btn.textContent = next === "light" ? "☀️" : "🌙";
    renderChart();
  });
}

function initClock() {
  const tick = () => {
    const d = new Date();
    document.getElementById("clock").textContent =
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

function renderAll() {
  renderHero();
  renderChart();
  renderLists();
  renderTable();
  renderCalculator();
  document.getElementById("lastUpdate").textContent = new Date().toLocaleTimeString("da-DK");
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 4000);
}

// ------------- boot -------------
async function boot() {
  initTheme();
  initClock();
  initTabs();
  initAppliances();
  initVat();

  await loadData();
  renderAll();

  // Auto-refresh: every 10 minutes data; re-render hero/table on hour change
  setInterval(async () => {
    await loadData();
    renderAll();
  }, 10 * 60 * 1000);

  // Re-render every minute for clock-dependent views
  setInterval(() => {
    if (state.today.length) {
      renderHero();
      renderTable();
    }
  }, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", boot);
