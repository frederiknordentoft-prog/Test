// ============================================================
//  World Cup 2026 — app logic
//  Hybrid data: bundled snapshot (data.js) renders instantly,
//  then an optional live source can refresh it on top.
// ============================================================
'use strict';

const CONFIG = {
  // Optional live source. Leave empty to run purely on the bundled snapshot.
  // Any URL returning the same JSON shape as data.json works (e.g. a redeployed
  // data.json, or a small proxy in front of a football API). Same-origin or
  // CORS-enabled only.
  liveUrl: 'data.json',
  // Re-check the live source on this cadence while the app is open.
  refreshMs: 90 * 1000,
};

let DATA = window.WC2026; // bundled snapshot — always present
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------- helpers ----------
const team = (code) => DATA.teams[code] || { name: code, flag: '🏳️' };
const isPlayed = (m) => Number.isInteger(m.hs) && Number.isInteger(m.as);

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtDateShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------- standings ----------
function standings(groupLetter) {
  const codes = DATA.groups[groupLetter];
  const row = {};
  codes.forEach((c) => (row[c] = { c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));

  DATA.matches
    .filter((m) => m.g === groupLetter && isPlayed(m))
    .forEach((m) => {
      const H = row[m.h], A = row[m.a];
      if (!H || !A) return;
      H.p++; A.p++;
      H.gf += m.hs; H.ga += m.as;
      A.gf += m.as; A.ga += m.hs;
      if (m.hs > m.as) { H.w++; A.l++; H.pts += 3; }
      else if (m.hs < m.as) { A.w++; H.l++; A.pts += 3; }
      else { H.d++; A.d++; H.pts++; A.pts++; }
    });

  return Object.values(row).sort((a, b) => {
    const gd = (x) => x.gf - x.ga;
    return b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf || team(a.c).name.localeCompare(team(b.c).name);
  });
}

// ---------- render: groups ----------
function renderGroups() {
  const grid = $('#groupsGrid');
  grid.innerHTML = Object.keys(DATA.groups).map((g) => {
    const table = standings(g);
    const anyPlayed = table.some((r) => r.p > 0);
    const rows = table.map((r, i) => {
      const t = team(r.c);
      const cls = i < 2 ? 'qual-row' : i === 2 ? 'qual-edge' : '';
      return `<tr class="${cls}">
        <td class="team-col"><span class="rank">${i + 1}</span><span class="flag">${t.flag}</span><span class="team-name">${t.name}</span></td>
        <td>${r.p}</td>
        <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
        <td class="pts">${r.pts}</td>
      </tr>`;
    }).join('');
    return `<div class="group-card">
      <div class="group-head">
        <span class="group-badge">${g}</span>
        <span class="group-title">Group ${g}</span>
        <span class="group-note">${anyPlayed ? 'Matchday in progress' : 'Yet to kick off'}</span>
      </div>
      <table class="table">
        <thead><tr><th class="team-col">Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

// ---------- render: matches ----------
let activeDay = 'all';

function matchRow(m) {
  const H = team(m.h), A = team(m.a);
  const played = isPlayed(m);
  const homeWin = played && m.hs > m.as;
  const awayWin = played && m.as > m.hs;
  const center = played
    ? `<div class="m-score">${m.hs}<span class="x">–</span>${m.as}</div><div class="m-ft">FULL-TIME</div>`
    : `<div class="m-time">${m.time || ''}</div><div class="m-meta">${m.city || ''}</div>`;
  return `<div class="match">
    <div class="m-side home ${awayWin ? 'lose' : ''}">
      <span class="m-name">${H.name}</span><span class="m-flag">${H.flag}</span>
    </div>
    <div class="m-center">${center}<div class="m-gtag">Group ${m.g}</div></div>
    <div class="m-side away ${homeWin ? 'lose' : ''}">
      <span class="m-flag">${A.flag}</span><span class="m-name">${A.name}</span>
    </div>
  </div>`;
}

function renderMatches() {
  const dates = [...new Set(DATA.matches.map((m) => m.date))].sort();
  // default to today (or nearest upcoming) on first paint
  if (activeDay === 'all' && !renderMatches._init) {
    const today = DATA.meta.asOf;
    if (dates.includes(today)) activeDay = today;
    else {
      const next = dates.find((d) => d >= today);
      if (next) activeDay = next;
    }
    renderMatches._init = true;
  }

  const chips = [`<button class="chip ${activeDay === 'all' ? 'active' : ''}" data-day="all">All</button>`]
    .concat(dates.map((d) => {
      const isToday = d === DATA.meta.asOf;
      return `<button class="chip ${activeDay === d ? 'active' : ''}" data-day="${d}">${isToday ? 'Today' : fmtDateShort(d)}</button>`;
    })).join('');
  $('#dayFilter').innerHTML = chips;

  const shown = activeDay === 'all' ? dates : [activeDay];
  $('#matchesList').innerHTML = shown.map((d) => {
    const list = DATA.matches
      .filter((m) => m.date === d)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      .map(matchRow).join('');
    const label = d === DATA.meta.asOf ? `Today · ${fmtDate(d)}` : fmtDate(d);
    return `<div class="day-group"><div class="day-label">${label}</div>${list}</div>`;
  }).join('');

  $$('#dayFilter .chip').forEach((c) => c.addEventListener('click', () => {
    activeDay = c.dataset.day;
    renderMatches();
    $('#view-matches').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

// ---------- render: knockout ----------
function renderKnockout() {
  const icons = ['🎟️', '⚔️', '🥊', '🔥', '🥉', '🏆'];
  $('#bracket').innerHTML = DATA.knockout.map((r, i) => `
    <div class="ko-round">
      <div class="ko-icon">${icons[i] || '⚽'}</div>
      <div class="ko-body">
        <div class="ko-name">${r.round}</div>
        <div class="ko-dates">${r.dates}</div>
      </div>
      <div class="ko-count">${r.count} ${r.count === 1 ? 'match' : 'matches'}</div>
    </div>`).join('');

  $('#finalCard').innerHTML = `
    <div class="final-eyebrow">THE FINAL</div>
    <div class="final-title">July 19, 2026</div>
    <div class="final-date">Who lifts the trophy?</div>
    <div class="final-venue">${DATA.meta.finalVenue}</div>`;
}

// ---------- navigation ----------
function go(view) {
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.go === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- render all ----------
function renderAll() {
  renderGroups();
  renderMatches();
  renderKnockout();
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

// ---------- hybrid live refresh ----------
async function refresh(manual = false) {
  if (!CONFIG.liveUrl) { if (manual) toast('Live source not configured'); return; }
  const badge = $('#liveBadge');
  badge.classList.add('refreshing');
  try {
    const res = await fetch(CONFIG.liveUrl + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const fresh = await res.json();
    if (!fresh || !fresh.matches) throw new Error('bad payload');
    const changed = JSON.stringify(fresh.matches) !== JSON.stringify(DATA.matches);
    DATA = fresh;
    window.WC2026 = fresh;
    renderAll();
    if (manual) toast(changed ? 'Results updated' : 'Up to date');
  } catch (err) {
    if (manual) toast('Showing saved results (offline)');
  } finally {
    badge.classList.remove('refreshing');
  }
}

// ---------- boot ----------
function boot() {
  if (!DATA) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Could not load tournament data.</p>'; return; }
  renderAll();

  $$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.go)));
  $('#liveBadge').addEventListener('click', () => refresh(true));

  // attempt a live refresh shortly after load, then on a cadence
  setTimeout(() => refresh(false), 800);
  setInterval(() => refresh(false), CONFIG.refreshMs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
