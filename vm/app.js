// ============================================================
//  World Cup 2026 — app logic
//  Bundled snapshot (data.js) renders instantly and works offline.
//  A live overlay then pulls real scores + goalscorers straight from
//  ESPN's public World Cup feed (no key, CORS-open) and merges them in.
//  Bilingual UI (English / Danish).
// ============================================================
'use strict';

const CONFIG = {
  // ESPN public scoreboard — no API key, returns CORS headers, ~9s fresh.
  espnUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
  // Per-match summary (carries assists); fetched lazily for the Stats tab.
  summaryUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary',
  refreshMs: 60 * 1000,
};

let DATA = window.WC2026; // bundled snapshot — always present
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------- i18n ----------
const I18N = {
  en: {
    groups: 'Groups', matches: 'Matches', bracket: 'Bracket', stats: 'Stats',
    topScorers: 'Top scorers', topAssists: 'Top assists', tournament: 'Tournament', topTeamsLbl: 'Most goals · teams',
    goalsShort: 'goals', assistsShort: 'assists',
    nGoals: 'Goals', nMatches: 'Matches', nAvg: 'Goals / match', nBiggest: 'Biggest win',
    loadingAssists: 'Loading assists…', noAssists: 'No assists recorded yet.', noData: 'No matches played yet.',
    assistBy: 'assist',
    inProgress: 'Matchday in progress', notStarted: 'Yet to kick off',
    colP: 'P', colGD: 'GD', colPts: 'Pts',
    all: 'All', today: 'Today',
    fullTime: 'FULL-TIME', live: 'LIVE', group: 'Group',
    koTitle: 'Knockout stage',
    koDesc: 'The bracket fills in once the group stage ends on June 27. The 12 group winners, 12 runners-up and the 8 best third-placed teams advance to the Round of 32.',
    segR32: 'Round of 32', segPath: 'Path to the final',
    matchN: 'Match', kickoff: 'Kick-off', venue: 'Venue', goalsLbl: 'Goals', tzNote: '(Danish time)',
    noGoals: 'No goals yet.', notPlayed: 'Not played yet', groupStage: 'Group stage',
    og: 'o.g.', pen: 'pen.',
    winner: 'Winner', runner: 'Runner-up', third: '3rd place',
    finalEyebrow: 'THE FINAL', finalDate: 'July 19, 2026', finalQ: 'Who lifts the trophy?',
    upToDate: 'Up to date', updated: 'Scores updated', offline: 'Showing saved results (offline)',
    locale: 'en-US',
    rounds: { 'Round of 32': 'Round of 32', 'Round of 16': 'Round of 16', 'Quarter-finals': 'Quarter-finals', 'Semi-finals': 'Semi-finals', 'Third place': 'Third place play-off', 'Final': 'Final' },
  },
  da: {
    groups: 'Grupper', matches: 'Kampe', bracket: 'Slutspil', stats: 'Statistik',
    topScorers: 'Topscorere', topAssists: 'Flest assists', tournament: 'Turneringen', topTeamsLbl: 'Flest mål · hold',
    goalsShort: 'mål', assistsShort: 'assists',
    nGoals: 'Mål', nMatches: 'Kampe', nAvg: 'Mål / kamp', nBiggest: 'Største sejr',
    loadingAssists: 'Henter assists…', noAssists: 'Ingen assists registreret endnu.', noData: 'Ingen kampe spillet endnu.',
    assistBy: 'oplæg',
    inProgress: 'Kampe i gang', notStarted: 'Ikke startet endnu',
    colP: 'K', colGD: 'MF', colPts: 'P',
    all: 'Alle', today: 'I dag',
    fullTime: 'FULDTID', live: 'LIVE', group: 'Pulje',
    koTitle: 'Slutspil',
    koDesc: 'Lodtrækningen falder på plads, når gruppespillet slutter 27. juni. De 12 gruppevindere, 12 toere og de 8 bedste treere går videre til 1/16-finalerne.',
    segR32: '1/16-finaler', segPath: 'Vejen til finalen',
    matchN: 'Kamp', kickoff: 'Kampstart', venue: 'Stadion', goalsLbl: 'Mål', tzNote: '(dansk tid)',
    noGoals: 'Ingen mål endnu.', notPlayed: 'Ikke spillet endnu', groupStage: 'Gruppespil',
    og: 'selvmål', pen: 'straffe',
    winner: 'Vinder', runner: 'Toer', third: '3.-plads',
    finalEyebrow: 'FINALEN', finalDate: '19. juli 2026', finalQ: 'Hvem løfter pokalen?',
    upToDate: 'Opdateret', updated: 'Resultater opdateret', offline: 'Viser gemte resultater (offline)',
    locale: 'da-DK',
    rounds: { 'Round of 32': '1/16-finaler', 'Round of 16': 'Ottendedelsfinaler', 'Quarter-finals': 'Kvartfinaler', 'Semi-finals': 'Semifinaler', 'Third place': 'Bronzekamp', 'Final': 'Finale' },
  },
};

let lang = localStorage.getItem('wc-lang') || 'en';
const t = (k) => I18N[lang][k];

// ---------- helpers ----------
const team = (code) => DATA.teams[code] || { name: code, flag: '🏳️' };
const isPlayed = (m) => Number.isInteger(m.hs) && Number.isInteger(m.as);
const isLive = (m) => m.st === 'in';

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t('locale'), { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtDateShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t('locale'), { month: 'short', day: 'numeric' });
}

// ---------- Danish-time helpers ----------
// Kick-off instants are stored in UTC; everything is shown in Copenhagen time.
const TZ = 'Europe/Copenhagen';
const _dkDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const _dkTime = new Intl.DateTimeFormat('da-DK', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dkDateIso = (m) => (m.utc ? _dkDate.format(new Date(m.utc)) : m.date);
const dkTime = (m) => (m.utc ? _dkTime.format(new Date(m.utc)) : (m.time || ''));
const dkToday = () => _dkDate.format(new Date());
function localizeRange(str) {
  if (lang !== 'da') return str;
  return str.replace(/Jun/g, 'jun.').replace(/Jul/g, 'jul.');
}
function minVal(m) { const [a, b] = String(m).split('+'); return parseInt(a, 10) + (b ? parseInt(b, 10) / 100 : 0); }

// ---------- standings ----------
function standings(groupLetter) {
  const codes = DATA.groups[groupLetter];
  const row = {};
  codes.forEach((c) => (row[c] = { c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  DATA.matches.filter((m) => m.g === groupLetter && isPlayed(m)).forEach((m) => {
    const H = row[m.h], A = row[m.a];
    if (!H || !A) return;
    H.p++; A.p++; H.gf += m.hs; H.ga += m.as; A.gf += m.as; A.ga += m.hs;
    if (m.hs > m.as) { H.w++; A.l++; H.pts += 3; }
    else if (m.hs < m.as) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  });
  return Object.values(row).sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || team(a.c).name.localeCompare(team(b.c).name));
}

// ---------- render: groups ----------
function renderGroups() {
  $('#groupsGrid').innerHTML = Object.keys(DATA.groups).map((g) => {
    const table = standings(g);
    const anyPlayed = table.some((r) => r.p > 0);
    const rows = table.map((r, i) => {
      const tm = team(r.c);
      const cls = i < 2 ? 'qual-row' : i === 2 ? 'qual-edge' : '';
      const gd = r.gf - r.ga;
      return `<tr class="${cls}">
        <td class="team-col"><span class="rank">${i + 1}</span><span class="flag">${tm.flag}</span><span class="team-name">${tm.name}</span></td>
        <td>${r.p}</td><td>${gd > 0 ? '+' : ''}${gd}</td><td class="pts">${r.pts}</td>
      </tr>`;
    }).join('');
    return `<div class="group-card">
      <div class="group-head">
        <span class="group-badge">${g}</span>
        <span class="group-title">${t('group')} ${g}</span>
        <span class="group-note">${anyPlayed ? t('inProgress') : t('notStarted')}</span>
      </div>
      <table class="table">
        <thead><tr><th class="team-col">Team</th><th>${t('colP')}</th><th>${t('colGD')}</th><th>${t('colPts')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

// ---------- render: matches ----------
let activeDay = 'all';

function matchRow(m) {
  const H = team(m.h), A = team(m.a);
  const played = isPlayed(m), live = isLive(m);
  const homeWin = played && !live && m.hs > m.as;
  const awayWin = played && !live && m.as > m.hs;
  let center;
  if (live) {
    center = `<div class="m-score"><span class="livedot"></span>${m.hs}<span class="x">–</span>${m.as}</div><div class="m-livetag">${t('live')}${m.min ? ` · ${m.min}` : ''}</div>`;
  } else if (played) {
    center = `<div class="m-score">${m.hs}<span class="x">–</span>${m.as}</div><div class="m-ft">${t('fullTime')}</div>`;
  } else {
    center = `<div class="m-time">${dkTime(m)}</div><div class="m-meta">${m.city || ''}</div>`;
  }
  return `<button class="match" data-mi="${m._i}">
    <div class="m-side home ${awayWin ? 'lose' : ''}"><span class="m-name">${H.name}</span><span class="m-flag">${H.flag}</span></div>
    <div class="m-center">${center}<div class="m-gtag">${t('group')} ${m.g}</div></div>
    <div class="m-side away ${homeWin ? 'lose' : ''}"><span class="m-flag">${A.flag}</span><span class="m-name">${A.name}</span></div>
  </button>`;
}

function renderMatches() {
  const dates = [...new Set(DATA.matches.map(dkDateIso))].sort();
  const todayIso = dkToday();
  if (activeDay === 'all' && !renderMatches._init) {
    if (dates.includes(todayIso)) activeDay = todayIso;
    else { const next = dates.find((d) => d >= todayIso); if (next) activeDay = next; }
    renderMatches._init = true;
  }
  const chips = [`<button class="chip ${activeDay === 'all' ? 'active' : ''}" data-day="all">${t('all')}</button>`]
    .concat(dates.map((d) => `<button class="chip ${activeDay === d ? 'active' : ''}" data-day="${d}">${d === todayIso ? t('today') : fmtDateShort(d)}</button>`)).join('');
  $('#dayFilter').innerHTML = chips;

  const shown = activeDay === 'all' ? dates : [activeDay];
  $('#matchesList').innerHTML = shown.map((d) => {
    const list = DATA.matches.filter((m) => dkDateIso(m) === d)
      .sort((a, b) => (a.utc || a.time || '').localeCompare(b.utc || b.time || '')).map(matchRow).join('');
    const label = d === todayIso ? `${t('today')} · ${fmtDate(d)}` : fmtDate(d);
    return `<div class="day-group"><div class="day-label">${label}</div>${list}</div>`;
  }).join('');

  $$('#dayFilter .chip').forEach((c) => c.addEventListener('click', () => {
    activeDay = c.dataset.day; renderMatches();
    $('#view-matches').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('#matchesList .match').forEach((el) => el.addEventListener('click', () => openSheet(+el.dataset.mi)));
}

// ---------- match detail sheet ----------
function goalLine(g, m) {
  const tm = team(g.t);
  const tags = [g.pen ? `(${t('pen')})` : '', g.og ? `(${t('og')})` : ''].filter(Boolean).join(' ');
  const side = g.t === m.h ? 'left' : 'right';
  const assist = g.a ? `<span class="goal-assist">${t('assistBy')}: ${g.a}</span>` : '';
  return `<div class="goal ${side}">
    <span class="goal-min">${g.m}'</span>
    <span class="goal-flag">${tm.flag}</span>
    <span class="goal-player">${g.p} ${tags ? `<em>${tags}</em>` : ''}${assist}</span>
  </div>`;
}

let sheetMi = -1;

function fillSheet(m) {
  const H = team(m.h), A = team(m.a), played = isPlayed(m), live = isLive(m);
  const status = live ? `${t('live')}${m.min ? ` · ${m.min}` : ''}` : (played ? t('fullTime') : t('notPlayed'));
  const head = `<div class="sheet-head">
    <div class="sheet-team"><span class="sheet-flag">${H.flag}</span><span class="sheet-tname">${H.name}</span></div>
    <div class="sheet-score">${played ? `${m.hs}<span class="x">–</span>${m.as}` : (m.time || '')}<div class="sheet-status ${live ? 'livetxt' : ''}">${status}</div></div>
    <div class="sheet-team"><span class="sheet-flag">${A.flag}</span><span class="sheet-tname">${A.name}</span></div>
  </div>`;

  let goalsHtml = '';
  if (played) {
    if (m.goals && m.goals.length) {
      const sorted = [...m.goals].sort((a, b) => minVal(a.m) - minVal(b.m));
      goalsHtml = `<div class="sheet-section"><div class="sheet-label">${t('goalsLbl')}</div><div class="goals">${sorted.map((g) => goalLine(g, m)).join('')}</div></div>`;
    } else {
      goalsHtml = `<div class="sheet-section"><p class="sheet-empty">${t('noGoals')}</p></div>`;
    }
  }

  const info = `<div class="sheet-info">
    <div class="info-row"><span>🏷️</span><span>${t('group')} ${m.g} · ${t('groupStage')}</span></div>
    <div class="info-row"><span>📅</span><span>${fmtDate(dkDateIso(m))} · ${t('kickoff')} ${dkTime(m)} <em class="tznote">${t('tzNote')}</em></span></div>
    <div class="info-row"><span>📍</span><span>${m.venue}, ${m.city}</span></div>
  </div>`;

  $('#sheetBody').innerHTML = head + goalsHtml + info;
}

function openSheet(i) {
  const m = DATA.matches[i];
  if (!m) return;
  sheetMi = i;
  fillSheet(m);
  const ov = $('#sheetOverlay');
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add('open'));
  // pull in assists for this match, then refresh the open sheet
  if (isPlayed(m) && m.eid) ensureSummaries([m]).then(() => { if (sheetMi === i && !ov.hidden) fillSheet(m); });
}

function closeSheet() {
  sheetMi = -1;
  const ov = $('#sheetOverlay');
  ov.classList.remove('open');
  setTimeout(() => (ov.hidden = true), 220);
}

// ---------- render: knockout ----------
let koTab = 'r32';

function slotLabel(s) {
  if (s.w === 'W') return `${t('winner')} ${t('group')} ${s.g}`;
  if (s.w === 'R') return `${t('runner')} ${t('group')} ${s.g}`;
  return `${t('third')} · ${s.g}`;
}

function renderKnockout() {
  $('#koTitle').textContent = t('koTitle');
  $('#koDesc').textContent = t('koDesc');
  $$('#koSeg .seg-btn')[0].textContent = t('segR32');
  $$('#koSeg .seg-btn')[1].textContent = t('segPath');

  const dates = [...new Set(DATA.r32.map((x) => x.date))].sort();
  $('#r32List').innerHTML = dates.map((d) => {
    const ties = DATA.r32.filter((x) => x.date === d).map((x) => `
      <div class="tie">
        <div class="tie-no">${t('matchN')} ${x.n}</div>
        <div class="tie-slot"><span class="slot-pill ${x.a.w === 'T' ? 'third' : ''}">${slotLabel(x.a)}</span></div>
        <div class="tie-v">v</div>
        <div class="tie-slot"><span class="slot-pill ${x.b.w === 'T' ? 'third' : ''}">${slotLabel(x.b)}</span></div>
        <div class="tie-city">📍 ${x.city}</div>
      </div>`).join('');
    return `<div class="day-group"><div class="day-label">${fmtDate(d)}</div>${ties}</div>`;
  }).join('');

  const icons = ['🎟️', '⚔️', '🥊', '🔥', '🥉', '🏆'];
  $('#bracket').innerHTML = DATA.knockout.map((r, i) => `
    <div class="ko-round">
      <div class="ko-icon">${icons[i] || '⚽'}</div>
      <div class="ko-body"><div class="ko-name">${t('rounds')[r.round] || r.round}</div><div class="ko-dates">${localizeRange(r.dates)}</div></div>
      <div class="ko-count">${r.count}</div>
    </div>`).join('');
  $('#finalCard').innerHTML = `
    <div class="final-eyebrow">${t('finalEyebrow')}</div>
    <div class="final-title">${t('finalDate')}</div>
    <div class="final-date">${t('finalQ')}</div>
    <div class="final-venue">${DATA.meta.finalVenue}</div>`;

  applyKoTab();
}

function applyKoTab() {
  $('#r32List').hidden = koTab !== 'r32';
  $('#bracket').hidden = koTab !== 'path';
  $('#finalCard').hidden = koTab !== 'path';
  $$('#koSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.ko === koTab));
}

// ---------- render: stats ----------
function leaderRows(map, unit, limit = 15) {
  const rows = Object.values(map).sort((a, b) => b.n - a.n || a.p.localeCompare(b.p)).slice(0, limit);
  if (!rows.length) return '';
  return rows.map((r, i) => `<div class="statrow">
    <span class="rk">${i + 1}</span>
    <span class="fl">${team(r.t).flag}</span>
    <span class="nm">${r.p}</span>
    <span class="vl">${r.n}<small>${unit}</small></span>
  </div>`).join('');
}

function renderStats() {
  $('#lblScorers').textContent = t('topScorers');
  $('#lblAssists').textContent = t('topAssists');
  $('#lblNumbers').textContent = t('tournament');
  $('#lblTeams').textContent = t('topTeamsLbl');

  const played = DATA.matches.filter(isPlayed);
  if (!played.length) {
    $('#statScorers').innerHTML = `<p class="muted-note">${t('noData')}</p>`;
    $('#statAssists').innerHTML = ''; $('#statNumbers').innerHTML = ''; $('#statTeams').innerHTML = '';
    return;
  }

  // top scorers (own goals excluded)
  const sc = {};
  played.forEach((m) => (m.goals || []).forEach((g) => {
    if (g.og || !g.p) return;
    const k = g.t + '|' + g.p;
    (sc[k] = sc[k] || { p: g.p, t: g.t, n: 0 }).n++;
  }));
  $('#statScorers').innerHTML = leaderRows(sc, t('goalsShort'));

  // top assists (enriched lazily from the summary endpoint)
  const as = {};
  played.forEach((m) => (m.goals || []).forEach((g) => {
    if (!g.a) return;
    const k = g.t + '|' + g.a;
    (as[k] = as[k] || { p: g.a, t: g.t, n: 0 }).n++;
  }));
  const assistHtml = leaderRows(as, t('assistsShort'));
  $('#statAssists').innerHTML = assistHtml || `<p class="muted-note">${assistsPending ? t('loadingAssists') : t('noAssists')}</p>`;

  // tournament numbers
  const totalGoals = played.reduce((s, m) => s + m.hs + m.as, 0);
  const avg = (totalGoals / played.length).toFixed(2);
  let big = null;
  played.forEach((m) => {
    const diff = Math.abs(m.hs - m.as), tot = m.hs + m.as;
    if (!big || diff > big.diff || (diff === big.diff && tot > big.tot)) big = { m, diff, tot };
  });
  const bigStr = big ? `${team(big.m.h).flag} ${big.m.hs}–${big.m.as} ${team(big.m.a).flag}` : '—';
  $('#statNumbers').innerHTML = `<div class="numgrid">
    <div class="numcard"><div class="big">${totalGoals}</div><div class="cap">${t('nGoals')}</div></div>
    <div class="numcard"><div class="big">${played.length}</div><div class="cap">${t('nMatches')}</div></div>
    <div class="numcard"><div class="big">${avg}</div><div class="cap">${t('nAvg')}</div></div>
    <div class="numcard"><div class="big small">${bigStr}</div><div class="cap">${t('nBiggest')}</div></div>
  </div>`;

  // most goals scored, by team
  const tg = {};
  played.forEach((m) => { tg[m.h] = (tg[m.h] || 0) + m.hs; tg[m.a] = (tg[m.a] || 0) + m.as; });
  const teamMap = {};
  Object.entries(tg).forEach(([code, n]) => { if (n > 0) teamMap[code] = { p: team(code).name, t: code, n }; });
  $('#statTeams').innerHTML = leaderRows(teamMap, t('goalsShort'), 8);
}

// ---------- assists enrichment (lazy, cached) ----------
const summaryCache = {}; // `${eid}:${hs}-${as}` -> true once fetched
let assistsPending = false;

async function ensureSummaries(list) {
  const todo = (list || DATA.matches.filter(isPlayed))
    .filter((m) => isPlayed(m) && m.eid && !summaryCache[`${m.eid}:${m.hs}-${m.as}`]);
  if (!todo.length) { assistsPending = false; return false; }
  assistsPending = true;
  let any = false;
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async (m) => {
      try {
        const res = await fetch(`${CONFIG.summaryUrl}?event=${m.eid}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        const byMin = {};
        for (const k of d.keyEvents || []) {
          if (!k.scoringPlay) continue;
          const min = String((k.clock && k.clock.displayValue) || '').replace(/'/g, '');
          const ps = k.participants || [];
          if (ps.length > 1 && ps[1].athlete) byMin[min] = ps[1].athlete.shortName || ps[1].athlete.displayName;
        }
        (m.goals || []).forEach((g) => { if (byMin[g.m]) g.a = byMin[g.m]; });
        summaryCache[`${m.eid}:${m.hs}-${m.as}`] = true;
        any = true;
      } catch (e) { /* ignore */ }
    }));
  }
  assistsPending = false;
  return any;
}

function openStats() {
  const hasUncached = DATA.matches.some((m) => isPlayed(m) && m.eid && !summaryCache[`${m.eid}:${m.hs}-${m.as}`]);
  if (hasUncached) assistsPending = true; // show "loading assists…" right away
  renderStats(); // scorers + numbers instantly
  ensureSummaries().then(() => renderStats()); // assists fill in
}

// ---------- navigation ----------
function go(view) {
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  $$('.tab').forEach((tb) => tb.classList.toggle('active', tb.dataset.go === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- language ----------
function applyLangChrome() {
  document.documentElement.lang = lang;
  $('#langLabel').textContent = lang === 'en' ? 'DA' : 'EN';
  const tabKey = { groups: 'groups', matches: 'matches', stats: 'stats', knockout: 'bracket' };
  $$('.tab').forEach((tb) => { $('.tab-lbl', tb).textContent = t(tabKey[tb.dataset.go]); });
}
function setLang(next) {
  lang = next;
  localStorage.setItem('wc-lang', lang);
  applyLangChrome();
  renderAll();
}

// ---------- render all ----------
function renderAll() { renderGroups(); renderMatches(); renderStats(); renderKnockout(); }

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2400);
}

// ---------- live overlay (ESPN) ----------
const pairKey = (a, b) => [a, b].sort().join('|');
const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

function datesToFetch(full) {
  if (full) {
    const today = new Date().toISOString().slice(0, 10);
    return [...new Set(DATA.matches.map((m) => m.date))].filter((d) => d <= today).map((d) => d.replace(/-/g, ''));
  }
  const now = new Date(), out = [];
  for (let off = -1; off <= 1; off++) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + off); out.push(ymd(d)); }
  return [...new Set(out)];
}

function parseGoals(comp) {
  const tlaById = {};
  comp.competitors.forEach((c) => (tlaById[c.team.id] = c.team.abbreviation));
  const goals = [];
  for (const det of comp.details || []) {
    if (!det.scoringPlay || det.shootout) continue;
    const code = tlaById[det.team && det.team.id];
    if (!code) continue;
    const ath = det.athletesInvolved && det.athletesInvolved[0];
    goals.push({
      p: (ath && (ath.shortName || ath.displayName)) || '',
      m: String((det.clock && det.clock.displayValue) || '').replace(/'/g, ''),
      t: code, pen: !!det.penaltyKick, og: !!det.ownGoal,
    });
  }
  return goals;
}

function mergeEspn(events) {
  const byPair = {};
  DATA.matches.forEach((m) => (byPair[pairKey(m.h, m.a)] = m));
  let changed = 0;
  for (const ev of events) {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) continue;
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const m = byPair[pairKey(cs[0].team.abbreviation, cs[1].team.abbreviation)];
    if (!m) continue;
    if (ev.date) m.utc = ev.date; // keep kick-off time fresh for all states
    if (ev.id) m.eid = ev.id;     // event id → used to fetch assists
    const state = ev.status && ev.status.type && ev.status.type.state;
    if (state !== 'in' && state !== 'post') continue;
    const scoreOf = (code) => { const c = cs.find((x) => x.team.abbreviation === code); return c ? parseInt(c.score, 10) : NaN; };
    const nhs = scoreOf(m.h), nas = scoreOf(m.a);
    if (!Number.isInteger(nhs) || !Number.isInteger(nas)) continue;
    const min = state === 'in' ? ((ev.status.type.shortDetail) || ev.status.displayClock || '') : null;
    if (m.hs !== nhs || m.as !== nas || m.st !== state) changed++;
    m.hs = nhs; m.as = nas; m.st = state;
    if (min) m.min = min; else delete m.min;
    const goals = parseGoals(comp);
    if (goals.length) m.goals = goals;
  }
  return changed;
}

async function refresh(manual = false, full = false) {
  const badge = $('#liveBadge');
  badge.classList.add('refreshing');
  try {
    const dates = datesToFetch(full);
    const results = await Promise.all(dates.map((d) =>
      fetch(`${CONFIG.espnUrl}?dates=${d}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    const events = results.filter(Boolean).flatMap((r) => r.events || []);
    if (!events.length) throw new Error('no events');
    const changed = mergeEspn(events);
    renderAll();
    if (!$('#view-stats').hidden) ensureSummaries().then((got) => { if (got) renderStats(); });
    if (manual) toast(changed ? t('updated') : t('upToDate'));
  } catch (err) {
    if (manual) toast(t('offline'));
  } finally {
    badge.classList.remove('refreshing');
  }
}

// ---------- boot ----------
function indexMatches() { DATA.matches.forEach((m, i) => (m._i = i)); }

function boot() {
  if (!DATA) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Could not load tournament data.</p>'; return; }
  indexMatches();
  applyLangChrome();
  renderAll();

  $$('.tab').forEach((tb) => tb.addEventListener('click', () => { go(tb.dataset.go); if (tb.dataset.go === 'stats') openStats(); }));
  $('#langBtn').addEventListener('click', () => setLang(lang === 'en' ? 'da' : 'en'));
  $('#liveBadge').addEventListener('click', () => refresh(true, true));
  $$('#koSeg .seg-btn').forEach((b) => b.addEventListener('click', () => { koTab = b.dataset.ko; applyKoTab(); }));
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetOverlay').addEventListener('click', (e) => { if (e.target === $('#sheetOverlay')) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  setTimeout(() => refresh(false, true), 600);                // full backfill on load
  setInterval(() => refresh(false, false), CONFIG.refreshMs); // live window thereafter
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false, false); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', boot);
