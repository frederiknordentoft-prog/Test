// ============================================================
// Elprisen DK2 — app.js
// Data: elprisenligenu.dk + Energinet/Radius/Skat tariffs (2026)
// ============================================================

const REGION = "DK2";
const API = (date) =>
  `https://www.elprisenligenu.dk/api/v1/prices/${date.getFullYear()}/${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${REGION}.json`;

// Tariffs in kr/kWh (ex. moms). 2026 rates.
const TARIFFS = {
  elafgift: 0.008,              // 0.8 øre — midlertidig nedsat 2026-2027
  energinetTransmission: 0.043, // 4.3 øre
  energinetSystem: 0.072,       // 7.2 øre
};
const GASEL_MARKUP = 0.06;      // 6 øre
const VAT_RATE = 0.25;

// Radius Elnet C-customer time-of-use tariffs (kr/kWh, ex. moms). 2026.
// Hours: Lav 00-06, Spids 17-21, Høj = alt andet
function radiusTariff(hour, month) {
  // Summer: Apr 1 – Sep 30 (months 3-8, 0-indexed)
  const isSummer = month >= 3 && month <= 8;
  if (hour >= 0 && hour < 6) return 0.1327;                    // Lav (året rundt)
  if (hour >= 17 && hour < 21) return isSummer ? 0.5176 : 1.1945; // Spids
  return isSummer ? 0.1991 : 0.3982;                           // Høj
}

const state = {
  today: [],
  tomorrow: [],
  view: "today",
  tariffs: true,
  gasel: false,
  vat: true,
  appliance: { key: "washer", kwh: 1.0, hours: 2 },
  chart: null,
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

const LEVEL = {
  good: { label: "Billig", color: "#30d158" },
  ok:   { label: "Normal", color: "#ffd60a" },
  warn: { label: "Høj",    color: "#ff9f0a" },
  bad:  { label: "Dyr",    color: "#ff453a" },
};

function levelOf(price, stats) {
  const { min, max } = stats;
  const range = max - min || 0.01;
  const rel = (price - min) / range;
  if (rel < 0.25) return "good";
  if (rel < 0.55) return "ok";
  if (rel < 0.8)  return "warn";
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

  const lvl = levelOf(cur, stats);
  document.getElementById("priceLevel").textContent =
    `${LEVEL[lvl].label} pris pr. kWh`;

  // Caption echoing pricing mode
  const parts = ["Spot"];
  if (state.tariffs) parts.push("afgifter");
  if (state.gasel) parts.push("Gasel");
  if (state.vat) parts.push("moms");
  const modeTxt = parts.join(" + ");
  const echo = document.getElementById("modeEcho");
  if (echo) echo.textContent = modeTxt;

  // Next cheap hour tip (based on spot, since tariffs may re-rank — but tip uses full price)
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
  const body = document.getElementById("hoursBody");
  if (!prices.length) { body.innerHTML = ""; return; }

  const stats = statsOf(prices);
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;

  body.innerHTML = prices.map((p, i) => {
    const price = fullPrice(p.DKK_per_kWh, p.time_start);
    const lvl = levelOf(price, stats);
    const meta = LEVEL[lvl];
    const widthPct = Math.max(6, ((price - stats.min) / (stats.max - stats.min || 1)) * 100);
    const isNow = i === nowIdx;
    return `<tr class="${isNow ? "now" : ""}">
      <td>${hourLabel(p.time_start)}</td>
      <td class="val">${fmt(price)} kr</td>
      <td><span class="lvl lvl-${lvl}">${meta.label}</span></td>
      <td><div class="bar" style="width:${widthPct}%; background:${meta.color}"></div></td>
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
  const labels = prices.map(p => hourNum(p.time_start));
  const values = prices.map(p => fullPrice(p.DKK_per_kWh, p.time_start));
  const colors = values.map(v => LEVEL[levelOf(v, stats)].color);
  const nowIdx = state.view === "today" ? currentHourIndex(prices) : -1;
  const borders = values.map((_, i) => i === nowIdx ? "#ffffff" : "transparent");
  const borderWidths = values.map((_, i) => i === nowIdx ? 2 : 0);

  if (state.chart) state.chart.destroy();

  const tickColor = "rgba(235, 235, 245, 0.45)";
  const gridColor = "rgba(255, 255, 255, 0.06)";

  state.chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
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
      animation: { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(28, 28, 30, 0.98)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          padding: 14,
          cornerRadius: 12,
          titleFont: { size: 13, weight: "600", family: "-apple-system, sans-serif" },
          bodyFont: { size: 13, family: "-apple-system, sans-serif" },
          displayColors: false,
          callbacks: {
            title: (items) => `Kl. ${items[0].label}:00`,
            label: (ctx) => {
              const kr = ctx.parsed.y;
              const lvl = LEVEL[levelOf(kr, stats)].label;
              return `${fmt(kr)} kr/kWh · ${lvl}`;
            },
            afterLabel: (ctx) => {
              const diff = ctx.parsed.y - stats.avg;
              const sign = diff >= 0 ? "+" : "";
              return `${sign}${fmt(diff)} kr vs. gns.`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: "-apple-system, sans-serif" },
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 12,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: "-apple-system, sans-serif" },
            callback: (v) => fmt(v),
            padding: 10,
          },
        },
      },
    },
  });
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

// ------------- UI wiring -------------
function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.day;
      renderChart(); renderLists(); renderTable();
    });
  });
}

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
  // Restore persisted modes
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
  // Ensure first load starts at top, regardless of browser restore or hash
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
  initAppliances();
  initModes();
  initReveals();

  await loadData();
  renderAll();

  setInterval(async () => { await loadData(); renderAll(); }, 10 * 60 * 1000);
  setInterval(() => { if (state.today.length) { renderHero(); renderTable(); } }, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", boot);
