/* ============================================================
   Banebyggeren · deterministisk golf-hul-bygger
   ------------------------------------------------------------
   Design → Rate → Play, i én statisk side.
   - Al tilfældighed går gennem seedet mulberry32 (INGEN Math.random
     i fysik- eller AI-stien). Samme (hul, seed) => samme resultat.
   - Fysik og rating deler ÉN kerne: samme simulering der tegner et
     slag, bruges også til at score hullet.
   ============================================================ */

'use strict';

/* ---------- seedet PRNG (mulberry32) ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- tile-typer ----------
   cost = hvor hurtigt terrænet spiser bevægelses-momentum (høj = kort rul).
   fairway/tee ruller langt; rough bremser; bunker bremser meget. */
const TILES = ['tee', 'green', 'fairway', 'rough', 'bunker', 'water', 'trees'];
const TILE = {
  tee:     { idx: 0, name: 'Tee',      color: '#8ce99a', cost: 1.0, blocks: false, hazard: null },
  green:   { idx: 1, name: 'Green',    color: '#40c057', cost: 1.15, blocks: false, hazard: null },
  fairway: { idx: 2, name: 'Fairway',  color: '#69db7c', cost: 1.0, blocks: false, hazard: null },
  rough:   { idx: 3, name: 'Rough',    color: '#b2b559', cost: 1.7, blocks: false, hazard: null },
  bunker:  { idx: 4, name: 'Bunker',   color: '#ffe066', cost: 3.2, blocks: false, hazard: 'sand' },
  water:   { idx: 5, name: 'Vand',     color: '#4dabf7', cost: 1.0, blocks: false, hazard: 'water' },
  trees:   { idx: 6, name: 'Træer',    color: '#2b8a3e', cost: 2.0, blocks: true,  hazard: null },
};
const TILE_BY_IDX = TILES.map((t) => TILE[t]);

/* ============================================================
   HUL-MODEL
   ============================================================ */
const GRID_W = 24;
const GRID_H = 16;

function makeEmptyHole() {
  const tiles = new Uint8Array(GRID_W * GRID_H);
  tiles.fill(TILE.rough.idx); // baggrund = rough
  return {
    id: 'hul-1',
    name: 'Mit hul',
    width: GRID_W,
    height: GRID_H,
    tiles,
    tee: null, // {x,y} i grid-celler
    pin: null,
  };
}

const cellIndex = (h, x, y) => y * h.width + x;
const inBounds = (h, x, y) => x >= 0 && y >= 0 && x < h.width && y < h.height;
function tileAt(h, x, y) {
  if (!inBounds(h, x, y)) return TILE.trees; // uden for banen = blokerende
  return TILE_BY_IDX[h.tiles[cellIndex(h, x, y)]];
}

/* ============================================================
   GOLFER-MODEL (SimGolf: binære færdigheder)
   ============================================================ */
// execution-stats afledes af binære skills; støj er seedet.
function golferStats(g) {
  const s = g.skills;
  return {
    power: s.length ? 5.0 : 3.2,        // celler carry pr. fuldt slag
    spread: s.accuracy ? 0.05 : 0.16,   // vinkel-spredning (radianer)
    creativity: s.imagination ? 0.9 : 0.3, // evne til at vælge smarte ruter
  };
}

const PANEL = [
  { id: 'g0', name: 'Alle skills',  skills: { length: true,  accuracy: true,  imagination: true  } },
  { id: 'g1', name: 'Kun længde',   skills: { length: true,  accuracy: false, imagination: false } },
  { id: 'g2', name: 'Kun præcision',skills: { length: false, accuracy: true,  imagination: false } },
  { id: 'g3', name: 'Kun fantasi',  skills: { length: false, accuracy: false, imagination: true  } },
  { id: 'g4', name: 'Ingen skills', skills: { length: false, accuracy: false, imagination: false } },
];

/* ============================================================
   DETERMINISTISK SIMULERING (fysik-kernen)
   ------------------------------------------------------------
   Ét slag: bolden sigter mod et mål, får en seedet vinkel-støj,
   flyver/ruller i faste steps, mister fart via terræn-friktion,
   stopper i vand/OOB eller når den er i ro. Rammer den træer,
   stopper den brat (studsning).
   ============================================================ */

const CELL = 34; // px pr. celle (kun til px<->grid ved tegning)

function simulateShot(hole, from, target, stats, rnd) {
  // sigte-vinkel + seedet spredning
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dist = Math.hypot(dx, dy);
  const baseAngle = Math.atan2(dy, dx);
  const noise = (rnd() * 2 - 1) * stats.spread;
  const angle = baseAngle + noise;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);

  // momentum = ønsket carry (loftet af power) + seedet let variation
  const wanted = Math.min(dist, stats.power);
  let momentum = wanted * (0.92 + rnd() * 0.16);

  const points = [{ x: from.x, y: from.y }];
  let px = from.x;
  let py = from.y;
  let result = 'in_play';
  const pinx = hole.pin ? hole.pin.x + 0.5 : null;
  const piny = hole.pin ? hole.pin.y + 0.5 : null;

  const H = 0.14; // mikro-step (celler)
  let guard = 0;
  while (momentum > 0 && guard < 800) {
    guard++;
    const stepx = px + dirx * H;
    const stepy = py + diry * H;

    if (!inBounds(hole, Math.floor(stepx), Math.floor(stepy))) {
      result = 'oob';
      break;
    }
    const t = tileAt(hole, Math.floor(stepx), Math.floor(stepy));
    if (t.blocks) { // træer: brat stop, bolden bliver hvor den er
      break;
    }

    px = stepx; py = stepy;
    points.push({ x: px, y: py });

    if (t.hazard === 'water') { result = 'water'; break; }

    // hul ramt undervejs?
    if (pinx !== null && Math.hypot(px - pinx, py - piny) < 0.55) {
      px = pinx; py = piny; result = 'in_hole'; break;
    }

    // terrænet spiser momentum (bunker meget, fairway lidt)
    momentum -= H * t.cost;
  }

  return { points, rest: { x: px, y: py }, result };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// find sidste punkt på ruten der ligger på farbart, ikke-hazard terræn.
function lastSafeDrop(hole, traj, fallback) {
  for (let i = traj.points.length - 1; i >= 0; i--) {
    const p = traj.points[i];
    const t = tileAt(hole, Math.floor(p.x), Math.floor(p.y));
    if (inBounds(hole, Math.floor(p.x), Math.floor(p.y)) && !t.blocks && t.hazard !== 'water') {
      return { x: p.x, y: p.y };
    }
  }
  return { x: clamp(fallback.x, 0.5, hole.width - 0.5), y: clamp(fallback.y, 0.5, hole.height - 0.5) };
}

/* Spil et helt hul med én golfer, deterministisk. */
function playHole(hole, golfer, seed) {
  if (!hole.tee || !hole.pin) return { strokes: 0, perStroke: [], holed: false };
  const rnd = mulberry32(seed ^ hashSkills(golfer));
  const stats = golferStats(golfer);
  let pos = { x: hole.tee.x + 0.5, y: hole.tee.y + 0.5 };
  const pin = { x: hole.pin.x + 0.5, y: hole.pin.y + 0.5 };
  const perStroke = [];
  let strokes = 0;
  let holed = false;

  for (let i = 0; i < 16; i++) {
    strokes++;
    // målvalg: fantasifulde golfere lægger op ad farbar rute frem for lige linje
    const target = chooseTarget(hole, pos, pin, stats, rnd);
    const traj = simulateShot(hole, pos, target, stats, rnd);
    perStroke.push(traj);

    if (traj.result === 'in_hole') { holed = true; break; }
    if (traj.result === 'water' || traj.result === 'oob') {
      strokes++; // strafslag; drop ved sidste sikre punkt på ruten (ikke stuck)
      pos = lastSafeDrop(hole, traj, pos);
      continue;
    }
    pos = { ...traj.rest };
    // meget tæt på hul: put lykkes deterministisk
    if (Math.hypot(pos.x - pin.x, pos.y - pin.y) < 0.7) {
      strokes++;
      perStroke.push({ points: [pos, pin], rest: pin, result: 'in_hole' });
      holed = true;
      break;
    }
  }
  return { strokes, perStroke, holed };
}

// målvalg: sigt mod hullet, men undgå at sigte gennem vand/træer.
// Alle golfere undgår åbenlyse hazards; fantasi (creativity) udvider søgningen,
// så kreative golfere finder bedre/kortere ruter uden om forhindringer.
function chooseTarget(hole, pos, pin, stats, rnd) {
  const dist = Math.hypot(pin.x - pos.x, pin.y - pos.y);
  const reach = Math.min(dist, stats.power);
  const ang = Math.atan2(pin.y - pos.y, pin.x - pos.x);
  const mk = (a, r) => ({ x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r });

  const straightTarget = mk(ang, reach);
  if (routeHazardCost(hole, pos, straightTarget) === 0) return straightTarget;

  // systematisk vifte af vinkler (begge veje, stigende) + lay-up (kortere skud)
  const mags = stats.creativity > 0.6
    ? [0.2, 0.4, 0.6, 0.8, 1.0, 1.3, 1.6]
    : [0.25, 0.5, 0.8, 1.1];
  const reaches = [reach, reach * 0.6, reach * 0.35];
  let best = straightTarget;
  let bestBad = routeHazardCost(hole, pos, straightTarget);
  for (const r of reaches) {
    for (const m of mags) {
      for (const sgn of [-1, 1]) {
        const cand = mk(ang + sgn * m, r);
        const bad = routeHazardCost(hole, pos, cand);
        if (bad < bestBad) { bestBad = bad; best = cand; }
        if (bestBad === 0) return best;
      }
    }
  }
  // sidste udvej: en lille seedet jitter så golferen ikke sidder fast identisk
  if (bestBad > 0) {
    const a = ang + (rnd() * 2 - 1) * 0.5;
    return mk(a, reach * 0.5);
  }
  return best;
}

function routeHitsHazard(hole, from, to) {
  return routeHazardCost(hole, from, to) > 0;
}
function routeHazardCost(hole, from, to) {
  const steps = 14;
  let cost = 0;
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    const t = tileAt(hole, Math.floor(x), Math.floor(y));
    if (t.hazard === 'water') cost += 3;
    if (t.blocks) cost += 2;
    if (t.hazard === 'sand') cost += 1;
  }
  return cost;
}

function hashSkills(g) {
  const s = g.skills;
  return (s.length ? 1 : 0) | (s.accuracy ? 2 : 0) | (s.imagination ? 4 : 0);
}

/* ============================================================
   AUTO-PAR + RATING (rating-motoren = simuleringen)
   ------------------------------------------------------------
   Auto-par: afstand tee->pin oversat til forventet slag-tal.
   Rating pr. skill: gns. slag i kohorte UDEN skill minus MED skill,
   over det faste seedede panel. total = sum af de tre.
   ============================================================ */
function autoPar(hole) {
  if (!hole.tee || !hole.pin) return 3;
  const d = Math.hypot(hole.pin.x - hole.tee.x, hole.pin.y - hole.tee.y);
  if (d < 6) return 3;
  if (d < 13) return 4;
  return 5;
}

function rateHole(hole, seed) {
  if (!hole.tee || !hole.pin) {
    return { length: 0, accuracy: 0, imagination: 0, total: 0, avgStrokes: 0, valid: false };
  }
  // spil hele panelet
  const strokesById = {};
  for (const g of PANEL) {
    const r = playHole(hole, g, seed);
    strokesById[g.id] = r.holed ? r.strokes : r.strokes + 4; // straf for ikke at hulle
  }
  const has = (skill) => PANEL.filter((g) => g.skills[skill]);
  const not = (skill) => PANEL.filter((g) => !g.skills[skill]);
  const avg = (arr) => arr.reduce((s, g) => s + strokesById[g.id], 0) / arr.length;

  const rating = (skill) => Math.max(0, avg(not(skill)) - avg(has(skill)));
  const length = round1(rating('length'));
  const accuracy = round1(rating('accuracy'));
  const imagination = round1(rating('imagination'));
  const total = round1(length + accuracy + imagination);
  const allStrokes = PANEL.reduce((s, g) => s + strokesById[g.id], 0) / PANEL.length;
  return { length, accuracy, imagination, total, avgStrokes: round1(allStrokes), valid: true };
}

function round1(n) { return Math.round(n * 10) / 10; }

/* design-par: mål-rating man skal slå (seedet af hullets størrelse) */
function designPar(hole) {
  const d = hole.tee && hole.pin ? Math.hypot(hole.pin.x - hole.tee.x, hole.pin.y - hole.tee.y) : 8;
  return round1(1.5 + d * 0.12);
}

/* ============================================================
   DAGENS UDFORDRING (deterministisk pr. dato)
   ============================================================ */
function dailyChallenge(dateStr) {
  // seed = dato -> deterministisk constraint
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) | 0;
  const rnd = mulberry32(seed >>> 0);
  const parTarget = 3 + Math.floor(rnd() * 3); // par 3-5
  const maxBunkers = 1 + Math.floor(rnd() * 3);
  const minRating = round1(2 + rnd() * 2);
  const skills = ['length', 'accuracy', 'imagination'];
  const focusSkill = skills[Math.floor(rnd() * 3)];
  return { parTarget, maxBunkers, minRating, focusSkill, seed: seed >>> 0 };
}

function countTiles(hole, type) {
  const idx = TILE[type].idx;
  let n = 0;
  for (let i = 0; i < hole.tiles.length; i++) if (hole.tiles[i] === idx) n++;
  return n;
}

/* eksportér til test/konsol (og til app.js via global) */
const Banebyggeren = {
  mulberry32, TILE, TILES, TILE_BY_IDX, GRID_W, GRID_H, CELL,
  makeEmptyHole, cellIndex, inBounds, tileAt,
  golferStats, PANEL,
  simulateShot, playHole, chooseTarget,
  autoPar, rateHole, designPar, dailyChallenge, countTiles,
};
if (typeof window !== 'undefined') window.Banebyggeren = Banebyggeren;
if (typeof module !== 'undefined' && module.exports) module.exports = Banebyggeren;
