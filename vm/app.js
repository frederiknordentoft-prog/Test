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
    assistBy: 'assist', loadingData: 'Loading…', myLegend: '★ Your holdet.dk team',
    home: 'Home', hLiveNow: 'Live now', hNext: 'Your teams · next match', hSquad: 'My squad', hMyTeams: 'My teams',
    hToday: "Today's matches", hLatest: 'Latest results', hNoToday: 'No matches today.', hNothingLive: '',
    cIn: 'in', cDay: 'd', cHour: 'h', cMin: 'm', gAb: 'G', aAb: 'A', posOf: 'in', greeting: 'World Cup 2026',
    updatedAgo: 'updated', agoSuffix: 'ago',
    back: 'Back', pContrib: 'Goals & assists', pFixtures: 'Fixtures & results',
    cleanSheets: 'Clean sheets · teams', cardsLbl: 'Discipline · teams', shotsLbl: 'Most shots · teams',
    csUnit: 'clean', cardsUnit: 'cards', shotsUnit: 'shots',
    lblMatchStats: 'Match stats', lblTimeline: 'Timeline', lblLineups: 'Line-ups',
    formation: 'Formation', subsLbl: 'Substitutes', attendanceLbl: 'Attendance', refereeLbl: 'Referee',
    stPossession: 'Possession', stShots: 'Shots', stOnTarget: 'On target', stCorners: 'Corners', stFouls: 'Fouls',
    stYellow: 'Yellow cards', stRed: 'Red cards', stPass: 'Pass accuracy', stOffsides: 'Offsides', stSaves: 'Saves',
    evGoal: 'Goal', evOG: 'Own goal', evYC: 'Yellow card', evRC: 'Red card', evSub: 'Substitution', evHT: 'Half-time', evFT: 'Full-time',
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
    assistBy: 'oplæg', loadingData: 'Henter…', myLegend: '★ Dit holdet.dk-hold',
    home: 'Hjem', hLiveNow: 'Live nu', hNext: 'Dine hold · næste kamp', hSquad: 'Mit hold', hMyTeams: 'Mine hold',
    hToday: 'Dagens kampe', hLatest: 'Seneste resultater', hNoToday: 'Ingen kampe i dag.', hNothingLive: '',
    cIn: 'om', cDay: 'd', cHour: 't', cMin: 'm', gAb: 'M', aAb: 'A', posOf: 'i', greeting: 'VM 2026',
    updatedAgo: 'opdateret', agoSuffix: 'siden',
    back: 'Tilbage', pContrib: 'Mål & oplæg', pFixtures: 'Kampe & resultater',
    cleanSheets: 'Clean sheets · hold', cardsLbl: 'Disciplin · hold', shotsLbl: 'Flest skud · hold',
    csUnit: 'clean', cardsUnit: 'kort', shotsUnit: 'skud',
    lblMatchStats: 'Kampstatistik', lblTimeline: 'Forløb', lblLineups: 'Opstillinger',
    formation: 'Formation', subsLbl: 'Indskiftere', attendanceLbl: 'Tilskuere', refereeLbl: 'Dommer',
    stPossession: 'Boldbesiddelse', stShots: 'Skud', stOnTarget: 'På mål', stCorners: 'Hjørnespark', stFouls: 'Fouls',
    stYellow: 'Gule kort', stRed: 'Røde kort', stPass: 'Afl.præcision', stOffsides: 'Offsides', stSaves: 'Redninger',
    evGoal: 'Mål', evOG: 'Selvmål', evYC: 'Gult kort', evRC: 'Rødt kort', evSub: 'Udskiftning', evHT: 'Pause', evFT: 'Fuldtid',
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

// ---------- team colours (subtle accents) ----------
const COLORS = {
  MEX: '#006847', KOR: '#c8102e', RSA: '#007a4d', CZE: '#d7141a', CAN: '#d52b1e', SUI: '#d52b1e',
  QAT: '#8d1b3d', BIH: '#1f4e9c', BRA: '#009c3b', MAR: '#c1272d', SCO: '#0065bd', HAI: '#1c2b9b',
  USA: '#0a3161', PAR: '#d21034', AUS: '#00843d', TUR: '#e30a17', GER: '#d10a11', ECU: '#034ea2',
  CIV: '#ff8200', CUW: '#002b7f', NED: '#ec4d00', JPN: '#bc002d', TUN: '#e70013', SWE: '#006aa7',
  BEL: '#e30613', IRN: '#239f40', EGY: '#ce1126', NZL: '#00247d', ESP: '#c60b1e', URU: '#4f9fd6',
  KSA: '#006c35', CPV: '#003893', FRA: '#0055a4', SEN: '#00853f', NOR: '#ba0c2f', IRQ: '#007a3d',
  ARG: '#6cace4', AUT: '#ed2939', ALG: '#006233', JOR: '#007a3d', POR: '#1a7a3d', COL: '#1f3a93',
  UZB: '#0099b5', COD: '#007fff', ENG: '#cf142b', CRO: '#c8102e', PAN: '#d21034', GHA: '#006b3f',
};
const teamColor = (code) => COLORS[code] || '#0b5cff';

// ---------- motion / haptics ----------
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const haptic = (ms = 10) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no-op */ } };

// ---------- my holdet.dk squad ----------
const MY_TEAMS = ['ESP', 'GER', 'CAN', 'BRA', 'USA', 'ECU', 'FRA', 'COL', 'NOR'];
const MY_PLAYERS = [
  { code: 'ESP', frag: 'Simón', name: 'Unai Simón', pos: 'GK' },
  { code: 'GER', frag: 'Brown', name: 'Nathaniel Brown', pos: 'DEF' },
  { code: 'CAN', frag: 'Fougerolles', name: 'Luc de Fougerolles', pos: 'DEF' },
  { code: 'BRA', frag: 'Bremer', name: 'Bremer', pos: 'DEF' },
  { code: 'USA', frag: 'Robinson', name: 'Antonee Robinson', pos: 'DEF' },
  { code: 'ECU', frag: 'Caicedo', name: 'Moisés Caicedo', pos: 'MID' },
  { code: 'FRA', frag: 'Tchouaméni', name: 'Aurélien Tchouaméni', pos: 'MID' },
  { code: 'COL', frag: 'Arias', name: 'Jhon Arias', pos: 'MID' },
  { code: 'ESP', frag: 'Oyarzabal', name: 'Mikel Oyarzabal', pos: 'FWD' },
  { code: 'FRA', frag: 'Mbappé', name: 'Kylian Mbappé', pos: 'FWD' },
  { code: 'NOR', frag: 'Haaland', name: 'Erling Haaland', pos: 'FWD' },
];
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const myTeam = (code) => MY_TEAMS.includes(code);
const myPlayer = (name, code) => { const n = norm(name); return MY_PLAYERS.some((p) => p.code === code && n.includes(norm(p.frag))); };
const STAR = '<span class="mine" title="Dit holdet.dk-hold">★</span>';
const teamMark = (code) => (myTeam(code) ? STAR : '');
const playerMark = (name, code) => (myPlayer(name, code) ? STAR : '');
const teamLink = (code, text) => `<span class="lk" data-team="${code}">${text}</span>`;
const playerLink = (code, name, frag) => `<span class="lk" data-player="1" data-code="${code}" data-name="${encodeURIComponent(name)}" data-frag="${encodeURIComponent(frag || name)}">${name}</span>`;

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
  const legend = `<div class="legend-mine">${t('myLegend')}</div>`;
  $('#groupsGrid').innerHTML = legend + Object.keys(DATA.groups).map((g) => {
    const table = standings(g);
    const anyPlayed = table.some((r) => r.p > 0);
    const rows = table.map((r, i) => {
      const tm = team(r.c);
      const cls = i < 2 ? 'qual-row' : i === 2 ? 'qual-edge' : '';
      const gd = r.gf - r.ga;
      return `<tr class="${cls}${myTeam(r.c) ? ' mine-row' : ''}">
        <td class="team-col"><span class="rank">${i + 1}</span><span class="flag">${tm.flag}</span>${teamLink(r.c, `<span class="team-name">${tm.name}</span>`)}${teamMark(r.c)}</td>
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
  const mineCls = myTeam(m.h) || myTeam(m.a) ? ' mine' : '';
  return `<button class="match${mineCls}" data-mi="${m._i}">
    <div class="m-side home ${awayWin ? 'lose' : ''}"><span class="m-name">${H.name}${teamMark(m.h)}</span><span class="m-flag">${H.flag}</span></div>
    <div class="m-center">${center}<div class="m-gtag">${t('group')} ${m.g}</div></div>
    <div class="m-side away ${homeWin ? 'lose' : ''}"><span class="m-flag">${A.flag}</span><span class="m-name">${teamMark(m.a)}${A.name}</span></div>
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
}

// ---------- match detail sheet ----------
function goalLine(g, m) {
  const tm = team(g.t);
  const tags = [g.pen ? `(${t('pen')})` : '', g.og ? `(${t('og')})` : ''].filter(Boolean).join(' ');
  const side = g.t === m.h ? 'left' : 'right';
  const assist = g.a ? `<span class="goal-assist">${t('assistBy')}: ${g.a}${playerMark(g.a, g.t)}</span>` : '';
  return `<div class="goal ${side}">
    <span class="goal-min">${g.m}'</span>
    <span class="goal-flag">${tm.flag}</span>
    <span class="goal-player">${g.p}${playerMark(g.p, g.t)} ${tags ? `<em>${tags}</em>` : ''}${assist}</span>
  </div>`;
}

function goalsFallbackHtml(m, played) {
  if (!played) return '';
  if (!(m.goals && m.goals.length)) return `<div class="sheet-section"><p class="sheet-empty">${t('noGoals')}</p></div>`;
  const sorted = [...m.goals].sort((a, b) => minVal(a.m) - minVal(b.m));
  return `<div class="sheet-section"><div class="sheet-label">${t('goalsLbl')}</div><div class="goals">${sorted.map((g) => goalLine(g, m)).join('')}</div></div>`;
}

function timelineHtml(m) {
  if (!(m.events && m.events.length)) return goalsFallbackHtml(m, isPlayed(m));
  const icon = { goal: '⚽', og: '⚽', yc: '🟨', rc: '🟥', sub: '🔁', ht: '⏸️', ft: '🏁' };
  const rows = m.events.map((e) => {
    if (e.kind === 'ht' || e.kind === 'ft') return `<div class="tl-break">${icon[e.kind]} ${e.kind === 'ht' ? t('evHT') : t('evFT')}</div>`;
    const side = e.code === m.h ? 'left' : 'right';
    let txt = '';
    if (e.kind === 'goal' || e.kind === 'og') {
      const g = (m.goals || []).find((x) => x.m === e.min && x.t === e.code);
      const scorer = e.players[0] || (g && g.p) || '';
      const extra = [e.kind === 'og' ? `(${t('og')})` : '', g && g.pen ? `(${t('pen')})` : ''].filter(Boolean).join(' ');
      const assist = g && g.a ? `<span class="tl-sub">${t('assistBy')}: ${g.a}${playerMark(g.a, e.code)}</span>` : '';
      txt = `<b>${scorer}${playerMark(scorer, e.code)}</b> ${extra}${assist}`;
    } else if (e.kind === 'sub') {
      txt = `${e.players[0] || ''}${playerMark(e.players[0], e.code)}<span class="tl-sub">↔ ${e.players[1] || ''}${playerMark(e.players[1], e.code)}</span>`;
    } else {
      txt = `${e.players[0] || ''}${playerMark(e.players[0], e.code)}`;
    }
    return `<div class="tl ${side}"><span class="tl-min">${e.min}'</span><span class="tl-ic">${icon[e.kind]}</span><span class="tl-flag">${e.code ? team(e.code).flag : ''}</span><span class="tl-txt">${txt}</span></div>`;
  }).join('');
  return `<div class="sheet-section"><div class="sheet-label">${t('lblTimeline')}</div><div class="timeline">${rows}</div></div>`;
}

function statVal(raw, key) {
  let v = parseFloat(raw); if (isNaN(v)) v = 0;
  if (key === 'passPct') return { n: v, d: Math.round(v * 100) + '%' };
  if (key === 'possessionPct') return { n: v, d: Math.round(v) + '%' };
  return { n: v, d: String(v) };
}

function statsCompareHtml(m) {
  if (!m.stats) return '';
  const h = m.stats[m.h] || {}, a = m.stats[m.a] || {};
  const rows = [
    ['possessionPct', t('stPossession')], ['totalShots', t('stShots')], ['shotsOnTarget', t('stOnTarget')],
    ['wonCorners', t('stCorners')], ['foulsCommitted', t('stFouls')], ['yellowCards', t('stYellow')], ['passPct', t('stPass')],
  ].map(([key, label]) => {
    if (h[key] == null && a[key] == null) return '';
    const H = statVal(h[key], key), A = statVal(a[key], key);
    const tot = H.n + A.n || 1, lp = Math.round((H.n / tot) * 100);
    return `<div class="cmp"><div class="cmp-top"><span class="cmp-v">${H.d}</span><span class="cmp-lbl">${label}</span><span class="cmp-v">${A.d}</span></div>
      <div class="cbar"><div class="cbar-l" style="width:${lp}%;background:${teamColor(m.h)}"></div><div class="cbar-r" style="width:${100 - lp}%;background:${teamColor(m.a)}"></div></div></div>`;
  }).join('');
  return rows.trim() ? `<div class="sheet-section"><div class="sheet-label">${t('lblMatchStats')}</div>${rows}</div>` : '';
}

function lineupHtml(m) {
  if (!m.lineup) return '';
  const col = (code) => {
    const l = m.lineup[code]; if (!l) return '';
    return `<div class="lu-team"><div class="lu-head">${team(code).flag} ${team(code).name}${teamMark(code)} <span class="lu-form">${l.formation}</span></div>
      <ol class="lu-xi">${l.xi.map((n) => `<li class="${myPlayer(n, code) ? 'mine-li' : ''}">${playerLink(code, n)}${playerMark(n, code)}</li>`).join('')}</ol>
      ${l.subs && l.subs.length ? `<div class="lu-subs"><b>${t('subsLbl')}:</b> ${l.subs.map((n) => `${playerLink(code, n)}${playerMark(n, code)}`).join(', ')}</div>` : ''}</div>`;
  };
  const h = col(m.h), a = col(m.a);
  if (!h && !a) return '';
  return `<div class="sheet-section"><div class="sheet-label">${t('lblLineups')}</div><div class="lineups">${h}${a}</div></div>`;
}

function matchSheetHtml(m) {
  const H = team(m.h), A = team(m.a), played = isPlayed(m), live = isLive(m);
  const status = live ? `${t('live')}${m.min ? ` · ${m.min}` : ''}` : (played ? t('fullTime') : t('notPlayed'));
  const head = `<div class="sheet-head">
    <div class="sheet-team">${teamLink(m.h, `<span class="sheet-flag">${H.flag}</span><span class="sheet-tname">${H.name}${teamMark(m.h)}</span>`)}</div>
    <div class="sheet-score">${played ? `${m.hs}<span class="x">–</span>${m.as}` : (dkTime(m) || '')}<div class="sheet-status ${live ? 'livetxt' : ''}">${status}</div></div>
    <div class="sheet-team">${teamLink(m.a, `<span class="sheet-flag">${A.flag}</span><span class="sheet-tname">${A.name}${teamMark(m.a)}</span>`)}</div>
  </div>`;

  const info = `<div class="sheet-info">
    <div class="info-row"><span>🏷️</span><span>${t('group')} ${m.g} · ${t('groupStage')}</span></div>
    <div class="info-row"><span>📅</span><span>${fmtDate(dkDateIso(m))} · ${t('kickoff')} ${dkTime(m)} <em class="tznote">${t('tzNote')}</em></span></div>
    <div class="info-row"><span>📍</span><span>${m.venue}, ${m.city}</span></div>
    ${m.att ? `<div class="info-row"><span>👥</span><span>${Number(m.att).toLocaleString(t('locale'))}</span></div>` : ''}
    ${m.ref ? `<div class="info-row"><span>🧑‍⚖️</span><span>${t('refereeLbl')}: ${m.ref}</span></div>` : ''}
  </div>`;

  const accent = `<div class="head-accent"><span style="background:${teamColor(m.h)}"></span><span style="background:${teamColor(m.a)}"></span></div>`;
  return head + accent + timelineHtml(m) + statsCompareHtml(m) + lineupHtml(m) + info;
}

// ---------- player & team sheets ----------
function miniMatch(m) { return matchRow(m); }

function teamFixtures(code) {
  return DATA.matches.filter((m) => m.h === code || m.a === code)
    .sort((a, b) => (a.utc || a.date).localeCompare(b.utc || b.date));
}

function playerSheetHtml(code, name, frag) {
  frag = frag || name;
  let goals = 0, assists = 0;
  const involved = [];
  DATA.matches.filter(isPlayed).forEach((m) => {
    if (m.h !== code && m.a !== code) return;
    let g = 0, a = 0;
    (m.goals || []).forEach((gl) => {
      if (gl.t !== code) return;
      if (!gl.og && norm(gl.p).includes(norm(frag))) g++;
      if (gl.a && norm(gl.a).includes(norm(frag))) a++;
    });
    if (g || a) involved.push({ m, g, a });
    goals += g; assists += a;
  });
  const squad = MY_PLAYERS.find((p) => p.code === code && norm(name).includes(norm(p.frag)));
  const pos = squad ? ` · ${squad.pos}` : '';
  const head = `<div class="entity-head">
    <span class="entity-flag">${team(code).flag}</span>
    <div class="entity-meta"><div class="entity-name">${name}${myPlayer(name, code) ? STAR : ''}</div>
      <div class="entity-sub">${teamLink(code, team(code).name)}${pos}</div></div>
  </div>
  <div class="head-accent"><span style="background:${teamColor(code)}"></span></div>`;
  const nums = `<div class="numgrid">
    <div class="numcard"><div class="big">${goals}</div><div class="cap">${t('nGoals')}</div></div>
    <div class="numcard"><div class="big">${assists}</div><div class="cap">${t('topAssists')}</div></div>
    <div class="numcard"><div class="big">${goals + assists}</div><div class="cap">G+A</div></div>
  </div>`;
  let contrib = '';
  if (involved.length) {
    contrib = `<div class="sheet-section"><div class="sheet-label">${t('pContrib')}</div>${involved.map((x) => {
      const tag = [x.g ? `⚽×${x.g}` : '', x.a ? `🅰️×${x.a}` : ''].filter(Boolean).join(' ');
      return `<div class="contrib-row">${miniMatch(x.m)}<div class="contrib-tag">${tag}</div></div>`;
    }).join('')}</div>`;
  }
  const fx = teamFixtures(code);
  const fixturesHtml = `<div class="sheet-section"><div class="sheet-label">${t('pFixtures')}</div>${fx.map(miniMatch).join('')}</div>`;
  return head + nums + contrib + fixturesHtml;
}

function teamSheetHtml(code) {
  const g = Object.keys(DATA.groups).find((G) => DATA.groups[G].includes(code));
  const tb = standings(g), pos = tb.findIndex((r) => r.c === code), row = tb[pos];
  const head = `<div class="entity-head">
    <span class="entity-flag">${team(code).flag}</span>
    <div class="entity-meta"><div class="entity-name">${team(code).name}${teamMark(code)}</div>
      <div class="entity-sub">${t('group')} ${g} · ${pos + 1}${ordSuffix(pos + 1)}</div></div>
  </div>
  <div class="head-accent"><span style="background:${teamColor(code)}"></span></div>`;
  const nums = `<div class="numgrid">
    <div class="numcard"><div class="big">${row.pts}</div><div class="cap">${t('colPts')}</div></div>
    <div class="numcard"><div class="big">${row.w}-${row.d}-${row.l}</div><div class="cap">W-D-L</div></div>
    <div class="numcard"><div class="big">${row.gf}</div><div class="cap">${t('nGoals')}</div></div>
    <div class="numcard"><div class="big">${row.gf - row.ga > 0 ? '+' : ''}${row.gf - row.ga}</div><div class="cap">${t('colGD')}</div></div>
  </div>`;
  // team scorers
  const sc = {};
  DATA.matches.filter(isPlayed).forEach((m) => (m.goals || []).forEach((gl) => {
    if (gl.t !== code || gl.og || !gl.p) return;
    (sc[gl.p] = sc[gl.p] || { p: gl.p, t: code, n: 0 }).n++;
  }));
  const scorers = Object.keys(sc).length ? `<div class="sheet-section"><div class="sheet-label">${t('topScorers')}</div>${leaderRows(sc, t('goalsShort'), 8)}</div>` : '';
  const fx = teamFixtures(code);
  const fixturesHtml = `<div class="sheet-section"><div class="sheet-label">${t('pFixtures')}</div>${fx.map(miniMatch).join('')}</div>`;
  return head + nums + scorers + fixturesHtml;
}

// ---------- sheet router ----------
let sheetStack = [];

function showSheet() {
  const entry = sheetStack[sheetStack.length - 1];
  if (!entry) return;
  const back = sheetStack.length > 1 ? `<button class="sheet-back" id="sheetBack">‹ ${t('back')}</button>` : '';
  let body = '';
  if (entry.type === 'match') body = matchSheetHtml(DATA.matches[entry.i]);
  else if (entry.type === 'player') body = playerSheetHtml(entry.code, entry.name, entry.frag);
  else if (entry.type === 'team') body = teamSheetHtml(entry.code);
  $('#sheetBody').innerHTML = back + body;
  const ov = $('#sheetOverlay');
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add('open'));
  $('#sheet').scrollTop = 0;

  // enrich asynchronously, then re-render if still on top
  let mats = [];
  if (entry.type === 'match') mats = [DATA.matches[entry.i]].filter((m) => m && m.eid);
  else if (entry.type === 'team') mats = DATA.matches.filter((m) => (m.h === entry.code || m.a === entry.code) && isPlayed(m));
  else if (entry.type === 'player') mats = DATA.matches.filter((m) => (m.h === entry.code || m.a === entry.code) && isPlayed(m));
  if (mats.length) ensureSummaries(mats).then((got) => { if (got && sheetStack[sheetStack.length - 1] === entry && !$('#sheetOverlay').hidden) showSheet(); });
}

function openEntry(entry, fresh) {
  if (fresh) sheetStack = [];
  sheetStack.push(entry);
  haptic(6);
  showSheet();
}
function openSheet(i) { openEntry({ type: 'match', i }, true); }

function closeSheet() {
  sheetStack = [];
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
function leaderRows(map, unit, limit = 15, isTeam = false) {
  const rows = Object.values(map).sort((a, b) => b.n - a.n || a.p.localeCompare(b.p)).slice(0, limit);
  if (!rows.length) return '';
  return rows.map((r, i) => {
    const mine = isTeam ? myTeam(r.t) : myPlayer(r.p, r.t);
    const label = isTeam ? teamLink(r.t, r.p) : playerLink(r.t, r.p);
    return `<div class="statrow${mine ? ' mine-row' : ''}">
    <span class="rk">${i + 1}</span>
    <span class="fl">${team(r.t).flag}</span>
    <span class="nm">${label}${mine ? STAR : ''}</span>
    <span class="vl">${r.n}<small>${unit}</small></span>
  </div>`;
  }).join('');
}

function renderStats() {
  $('#lblScorers').textContent = t('topScorers');
  $('#lblAssists').textContent = t('topAssists');
  $('#lblNumbers').textContent = t('tournament');
  $('#lblTeams').textContent = t('topTeamsLbl');
  $('#lblClean').textContent = t('cleanSheets');
  $('#lblCards').textContent = t('cardsLbl');
  $('#lblShots').textContent = t('shotsLbl');

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
  $('#statTeams').innerHTML = leaderRows(teamMap, t('goalsShort'), 8, true);

  // clean sheets — derived from scores alone
  const cs = {};
  played.forEach((m) => { if (m.as === 0) cs[m.h] = (cs[m.h] || 0) + 1; if (m.hs === 0) cs[m.a] = (cs[m.a] || 0) + 1; });
  const csMap = {};
  Object.entries(cs).forEach(([code, n]) => (csMap[code] = { p: team(code).name, t: code, n }));
  $('#statClean').innerHTML = Object.keys(csMap).length ? leaderRows(csMap, t('csUnit'), 8, true) : `<p class="muted-note">${t('noData')}</p>`;

  // discipline (cards) and shots — from per-team match stats (summaries)
  const cd = {}, sh = {};
  played.forEach((m) => {
    if (!m.stats) return;
    [m.h, m.a].forEach((code) => {
      const s = m.stats[code]; if (!s) return;
      const cards = (parseInt(s.yellowCards, 10) || 0) + (parseInt(s.redCards, 10) || 0);
      const shots = parseInt(s.totalShots, 10) || 0;
      if (cards > 0) cd[code] = (cd[code] || 0) + cards;
      if (shots > 0) sh[code] = (sh[code] || 0) + shots;
    });
  });
  const mapOf = (obj) => { const o = {}; Object.entries(obj).forEach(([c, n]) => (o[c] = { p: team(c).name, t: c, n })); return o; };
  const pendNote = `<p class="muted-note">${assistsPending ? t('loadingData') : t('noData')}</p>`;
  $('#statCards').innerHTML = Object.keys(cd).length ? leaderRows(mapOf(cd), t('cardsUnit'), 8, true) : pendNote;
  $('#statShots').innerHTML = Object.keys(sh).length ? leaderRows(mapOf(sh), t('shotsUnit'), 8, true) : pendNote;
}

// ---------- summary parsing (assists, stats, line-ups, events) ----------
function parseSummary(d, m) {
  const idToCode = {};
  ((d.boxscore && d.boxscore.teams) || []).forEach((tm) => (idToCode[tm.team.id] = tm.team.abbreviation));
  const nm = (p) => p && p.athlete && (p.athlete.shortName || p.athlete.displayName);

  // assists onto existing goals, matched by minute
  const byMin = {};
  for (const k of d.keyEvents || []) {
    if (!k.scoringPlay) continue;
    const min = String((k.clock && k.clock.displayValue) || '').replace(/'/g, '');
    const ps = k.participants || [];
    if (ps.length > 1 && ps[1].athlete) byMin[min] = nm(ps[1]);
  }
  (m.goals || []).forEach((g) => { if (byMin[g.m]) g.a = byMin[g.m]; });

  // per-team match statistics
  const stats = {};
  ((d.boxscore && d.boxscore.teams) || []).forEach((tm) => {
    const o = {}; (tm.statistics || []).forEach((s) => (o[s.name] = s.displayValue));
    if (Object.keys(o).length) stats[tm.team.abbreviation] = o;
  });
  if (Object.keys(stats).length) m.stats = stats;

  // game info
  const gi = d.gameInfo || {};
  if (gi.attendance != null) m.att = gi.attendance;
  const ref = (gi.officials || []).find((o) => /referee/i.test((o.position && o.position.displayName) || '')) || (gi.officials || [])[0];
  if (ref) m.ref = ref.displayName;

  // line-ups
  const lineup = {};
  (d.rosters || []).forEach((r) => {
    const code = r.team && r.team.abbreviation;
    if (!code) return;
    const roster = r.roster || [];
    const xi = roster.filter((p) => p.starter).map(nm).filter(Boolean);
    const subs = roster.filter((p) => !p.starter && p.subbedIn).map(nm).filter(Boolean);
    if (xi.length) lineup[code] = { formation: r.formation || '', xi, subs };
  });
  if (Object.keys(lineup).length) m.lineup = lineup;

  // event timeline
  const kinds = { 'Yellow Card': 'yc', 'Red Card': 'rc', 'VAR - (Red) Card Upgrade': 'rc', Substitution: 'sub', Halftime: 'ht', 'End Regular Time': 'ft' };
  const events = [];
  for (const k of d.keyEvents || []) {
    const tx = (k.type && k.type.text) || '';
    let kind = null;
    if (k.scoringPlay || /goal/i.test(tx)) kind = /own goal/i.test(tx) ? 'og' : 'goal';
    else if (kinds[tx]) kind = kinds[tx];
    if (!kind) continue;
    events.push({
      min: String((k.clock && k.clock.displayValue) || '').replace(/'/g, ''),
      kind, code: idToCode[k.team && k.team.id],
      players: (k.participants || []).map(nm).filter(Boolean),
    });
  }
  if (events.length) m.events = events;
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
        parseSummary(await res.json(), m);
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

// ---------- render: home ----------
function ordSuffix(n) {
  if (lang === 'da') return '.';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function fmtCountdown(utc) {
  const diff = new Date(utc).getTime() - Date.now();
  if (diff <= 0) return '';
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), mi = Math.floor((diff % 36e5) / 6e4);
  if (d > 0) return `${t('cIn')} ${d}${t('cDay')} ${h}${t('cHour')}`;
  if (h > 0) return `${t('cIn')} ${h}${t('cHour')} ${mi}${t('cMin')}`;
  return `${t('cIn')} ${mi}${t('cMin')}`;
}

function mySquadStats() {
  const stat = MY_PLAYERS.map((p) => ({ ...p, g: 0, a: 0 }));
  DATA.matches.filter(isPlayed).forEach((m) => (m.goals || []).forEach((gl) => {
    stat.forEach((p) => {
      if (p.code !== gl.t) return;
      if (!gl.og && norm(gl.p).includes(norm(p.frag))) p.g++;
      if (gl.a && norm(gl.a).includes(norm(p.frag))) p.a++;
    });
  }));
  return stat;
}

function myPlayedMatches() {
  return DATA.matches.filter((m) => isPlayed(m) && (myTeam(m.h) || myTeam(m.a)));
}

function renderHome() {
  const now = Date.now();
  const todayIso = dkToday();
  const live = DATA.matches.filter(isLive);
  const today = DATA.matches.filter((m) => dkDateIso(m) === todayIso).sort((a, b) => (a.utc || '').localeCompare(b.utc || ''));
  const latest = DATA.matches.filter((m) => isPlayed(m) && !isLive(m)).sort((a, b) => (b.utc || '').localeCompare(a.utc || '')).slice(0, 5);
  const next = DATA.matches
    .filter((m) => (myTeam(m.h) || myTeam(m.a)) && m.utc && new Date(m.utc).getTime() > now && m.st !== 'post' && !isLive(m))
    .sort((a, b) => new Date(a.utc) - new Date(b.utc))[0];

  const ago = lastUpdated ? ` · ${t('updatedAgo')} ${agoText(lastUpdated)} ${t('agoSuffix')}` : '';
  let html = `<div class="home-hero"><div class="hh-title">${t('greeting')}</div><div class="hh-sub">${fmtDate(todayIso)}${ago}</div></div>`;

  if (live.length) {
    html += `<div class="home-sec"><div class="home-h"><span class="livedot"></span>${t('hLiveNow')}</div>${live.map(matchRow).join('')}</div>`;
  }

  if (next) {
    const H = team(next.h), A = team(next.a);
    html += `<div class="home-sec"><div class="home-h">${t('hNext')}</div>
      <div class="next-card">
        <div class="nc-row">
          <div class="nc-team"><span class="nc-flag">${H.flag}</span><span class="nc-name">${H.name}${teamMark(next.h)}</span></div>
          <div class="nc-cd">${fmtCountdown(next.utc)}</div>
          <div class="nc-team"><span class="nc-flag">${A.flag}</span><span class="nc-name">${A.name}${teamMark(next.a)}</span></div>
        </div>
        <div class="nc-meta">${fmtDate(dkDateIso(next))} · ${dkTime(next)} · ${t('group')} ${next.g}</div>
      </div></div>`;
  }

  const squad = mySquadStats();
  html += `<div class="home-sec"><div class="home-h">⭐ ${t('hSquad')}</div><div class="squad-list">${squad.map((p) => `
    <div class="squad-row lk-row" data-player="1" data-code="${p.code}" data-name="${encodeURIComponent(p.name)}" data-frag="${encodeURIComponent(p.frag)}">
      <span class="sq-flag">${team(p.code).flag}</span>
      <span class="sq-info"><span class="sq-name">${p.name}</span><span class="sq-team">${team(p.code).name} · ${p.pos}</span></span>
      <span class="sq-stat"><b>${p.g}</b>${t('gAb')}</span>
      <span class="sq-stat"><b>${p.a}</b>${t('aAb')}</span>
    </div>`).join('')}</div></div>`;

  const teamsStatus = MY_TEAMS.map((code) => {
    const g = Object.keys(DATA.groups).find((G) => DATA.groups[G].includes(code));
    const tb = standings(g), pos = tb.findIndex((r) => r.c === code), row = tb[pos];
    return { code, g, pos: pos + 1, pts: row.pts };
  }).sort((a, b) => a.g.localeCompare(b.g));
  html += `<div class="home-sec"><div class="home-h">${t('hMyTeams')}</div><div class="myteams-list">${teamsStatus.map((s) => `
    <div class="myteam-row lk-row" data-team="${s.code}">
      <span class="mt-flag">${team(s.code).flag}</span>
      <span class="mt-name">${team(s.code).name}</span>
      <span class="mt-pos">${t('group')} ${s.g} · ${s.pos}${ordSuffix(s.pos)} · ${s.pts}p</span>
    </div>`).join('')}</div></div>`;

  html += `<div class="home-sec"><div class="home-h">${t('hToday')}</div>${today.length ? today.map(matchRow).join('') : `<p class="muted-note">${t('hNoToday')}</p>`}</div>`;

  if (latest.length) {
    html += `<div class="home-sec"><div class="home-h">${t('hLatest')}</div>${latest.map(matchRow).join('')}</div>`;
  }

  $('#homeView').innerHTML = html;
}

function openHome() {
  renderHome();
  ensureSummaries(myPlayedMatches()).then(() => renderHome());
}

// ---------- navigation ----------
const TAB_ORDER = ['home', 'groups', 'matches', 'stats', 'knockout'];
let currentView = 'home';

function go(view) {
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  $$('.tab').forEach((tb) => tb.classList.toggle('active', tb.dataset.go === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navTo(view) {
  if (!view || view === currentView) return;
  currentView = view;
  go(view);
  if (view === 'stats') openStats();
  if (view === 'home') openHome();
  haptic(8);
}

// ---------- language ----------
function applyLangChrome() {
  document.documentElement.lang = lang;
  $('#langLabel').textContent = lang === 'en' ? 'DA' : 'EN';
  const tabKey = { home: 'home', groups: 'groups', matches: 'matches', stats: 'stats', knockout: 'bracket' };
  $$('.tab').forEach((tb) => { $('.tab-lbl', tb).textContent = t(tabKey[tb.dataset.go]); });
}
function setLang(next) {
  lang = next;
  localStorage.setItem('wc-lang', lang);
  applyLangChrome();
  renderAll();
}

// ---------- render all ----------
function renderAll() { renderHome(); renderGroups(); renderMatches(); renderStats(); renderKnockout(); }

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2400);
}

// ---------- celebration & freshness ----------
let lastUpdated = 0;
function agoText(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const mi = Math.round(s / 60);
  return mi < 60 ? `${mi}${t('cMin')}` : `${Math.round(mi / 60)}${t('cHour')}`;
}
function confetti(cols) {
  if (reduceMotion()) return;
  const wrap = document.createElement('div'); wrap.className = 'confetti';
  const palette = (cols && cols.length) ? cols : ['#0b5cff', '#f4a000', '#1a9e57', '#e5484d'];
  for (let i = 0; i < 38; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = palette[i % palette.length];
    p.style.animationDelay = (Math.random() * 0.3).toFixed(2) + 's';
    p.style.transform = `rotate(${Math.floor(Math.random() * 360)}deg)`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2700);
}
function celebrate(m, code) {
  const tm = team(code);
  const gs = (m.goals || []).filter((g) => g.t === code && !g.og).sort((a, b) => minVal(b.m) - minVal(a.m));
  const scorer = gs.length ? ` — ${gs[0].p}` : '';
  toast(`⚽ ${tm.flag} ${tm.name}${scorer}!`);
  confetti([teamColor(code), '#f4a000', '#ffffff']);
  haptic([20, 40, 30]);
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

let celebrationsArmed = false;

async function refresh(manual = false, full = false) {
  const badge = $('#liveBadge');
  badge.classList.add('refreshing');
  const snap = {};
  DATA.matches.forEach((m) => { if (myTeam(m.h) || myTeam(m.a)) snap[m._i] = { hs: m.hs, as: m.as }; });
  try {
    const dates = datesToFetch(full);
    const results = await Promise.all(dates.map((d) =>
      fetch(`${CONFIG.espnUrl}?dates=${d}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    const events = results.filter(Boolean).flatMap((r) => r.events || []);
    if (!events.length) throw new Error('no events');
    const changed = mergeEspn(events);
    lastUpdated = Date.now();

    // celebrate a fresh goal by one of my teams (skip the first backfill)
    if (celebrationsArmed) {
      for (const m of DATA.matches) {
        const s = snap[m._i]; if (!s) continue;
        if (myTeam(m.h) && Number.isInteger(m.hs) && Number.isInteger(s.hs) && m.hs > s.hs) { celebrate(m, m.h); break; }
        if (myTeam(m.a) && Number.isInteger(m.as) && Number.isInteger(s.as) && m.as > s.as) { celebrate(m, m.a); break; }
      }
    }

    renderAll();
    if (!$('#view-stats').hidden) ensureSummaries().then((got) => { if (got) renderStats(); });
    if (!$('#view-home').hidden) ensureSummaries(myPlayedMatches()).then((got) => { if (got) renderHome(); });
    if (manual) toast(changed ? t('updated') : t('upToDate'));
  } catch (err) {
    if (manual) toast(t('offline'));
  } finally {
    badge.classList.remove('refreshing');
    celebrationsArmed = true;
  }
}

// ---------- boot ----------
function indexMatches() { DATA.matches.forEach((m, i) => (m._i = i)); }

function boot() {
  if (!DATA) { document.body.innerHTML = '<p style="padding:40px;text-align:center">Could not load tournament data.</p>'; return; }
  indexMatches();
  applyLangChrome();
  renderAll();

  $$('.tab').forEach((tb) => tb.addEventListener('click', () => navTo(tb.dataset.go)));

  // swipe left/right between tabs
  let tsX = 0, tsY = 0, tsT = 0, swiping = false;
  const main = $('#main');
  main.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { swiping = false; return; }
    const p = e.touches[0]; tsX = p.clientX; tsY = p.clientY; tsT = Date.now();
    swiping = !e.target.closest('.filter-row, .seg, .table-scroll, .timeline, .lineups, .cbar, .next-card');
  }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (!swiping || !$('#sheetOverlay').hidden) return;
    const p = e.changedTouches[0], dx = p.clientX - tsX, dy = p.clientY - tsY, dt = Date.now() - tsT;
    if (dt < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const i = TAB_ORDER.indexOf(currentView), ni = i + (dx < 0 ? 1 : -1);
      if (ni >= 0 && ni < TAB_ORDER.length) navTo(TAB_ORDER[ni]);
    }
  }, { passive: true });
  $('#langBtn').addEventListener('click', () => setLang(lang === 'en' ? 'da' : 'en'));
  $('#liveBadge').addEventListener('click', () => refresh(true, true));
  $$('#koSeg .seg-btn').forEach((b) => b.addEventListener('click', () => { koTab = b.dataset.ko; applyKoTab(); }));
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetOverlay').addEventListener('click', (e) => { if (e.target === $('#sheetOverlay')) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // delegated navigation: players, teams, matches, and sheet back-button
  document.addEventListener('click', (e) => {
    const back = e.target.closest('#sheetBack');
    if (back) { sheetStack.pop(); if (sheetStack.length) showSheet(); else closeSheet(); return; }
    const inSheet = !!e.target.closest('#sheetBody');
    const pl = e.target.closest('[data-player]');
    if (pl) { openEntry({ type: 'player', code: pl.dataset.code, name: decodeURIComponent(pl.dataset.name), frag: decodeURIComponent(pl.dataset.frag) }, !inSheet); return; }
    const tl = e.target.closest('[data-team]');
    if (tl) { openEntry({ type: 'team', code: tl.dataset.team }, !inSheet); return; }
    const mt = e.target.closest('.match');
    if (mt) { openEntry({ type: 'match', i: +mt.dataset.mi }, !inSheet); return; }
  });

  setTimeout(() => refresh(false, true), 600);                // full backfill on load
  setInterval(() => refresh(false, false), CONFIG.refreshMs); // live window thereafter
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false, false); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', boot);
