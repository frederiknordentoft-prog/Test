// Node-testharness for Territorieduel (index.html er single-file; scriptet køres headless i vm).
// Strategi: kompilér scriptet ÉN gang, kør det i en FRISK vm-context pr. kald (loadGame),
// så modul-level `let`-state (counts, timeLeft, particles, snd*, ...) aldrig lækker mellem tests.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Udtræk det inline game-script (PeerJS-tagget har src og ingen krop).
const m = html.match(/<script>\s*\n"use strict";([\s\S]*?)<\/script>/);
if (!m) throw new Error('Kunne ikke udtrække game-scriptet fra index.html');
export const source = '"use strict";' + m[1];
const script = new vm.Script(source, {filename: 'territorieduel-inline.js'});

// Deterministisk RNG (mulberry32) — seedes pr. kørsel inde i realm'en.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "Blackhole": kaldbar, konstruérbar proxy hvor alle property-gets giver blackhole igen,
// alle kald giver blackhole, sets sluges. Dækker 2d-context, audio-element m.m.
function makeBlackhole() {
  const fn = function () {};
  const bh = new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      // 2d-ctx feature-detect: `filter`-readback må IKKE round-trip'e (holder bloom slukket i Node)
      if (prop === 'filter') return '';
      return bh;
    },
    set() { return true; },
    apply() { return bh; },
    construct() { return bh; },
    has() { return true; },
  });
  return bh;
}

function makeElement(bh) {
  const listeners = {};
  const el = {
    classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
    style: new Proxy({}, {set: () => true, get: () => ''}),
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    volume: 0, playbackRate: 1, paused: true,
    width: 0, height: 0,
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    removeEventListener() {},
    appendChild() {},
    getContext: () => bh,
    getBoundingClientRect: () => ({left: 0, top: 0, width: 812, height: 504}),
    play() { return {catch() {}}; },
    pause() {},
    focus() {}, blur() {}, click() {},
    setAttribute() {}, removeAttribute() {},
    toDataURL: () => 'data:,',
    _listeners: listeners,
  };
  return el;
}

// Bygger en frisk global-sandbox med DOM/BOM-stubs og kører game-scriptet i den.
export function loadGame({seed = 1} = {}) {
  const bh = makeBlackhole();
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(bh));
    return elements.get(id);
  };

  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };

  const document = {
    getElementById: getEl,
    createElement: () => makeElement(bh),
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeElement(bh),
  };

  const window = {
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1200,
    innerHeight: 900,
    devicePixelRatio: 1,
    matchMedia: () => ({matches: false, addEventListener() {}}),
    // Bevidst ingen AudioContext: ensureAudio()'s try/catch giver actx=null → al lyd no-op'er.
  };

  const sandbox = {
    window, document, localStorage,
    navigator: {vibrate: () => true, share: undefined, language: 'da'},
    performance: {now: () => Date.now()},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    console,
    Image: function () { return makeElement(bh); },
    // Peer er bevidst udefineret (online-stier kaldes ikke i harness).
  };
  sandbox.globalThis = sandbox;
  window.document = document;
  window.localStorage = localStorage;

  const context = vm.createContext(sandbox);
  script.runInContext(context);

  // Seed realm'ens egen Math.random (efter eval, så boot-demoen ikke afhænger af seed-rækkefølge
  // er lige meget — men vi re-seeder for at gøre testkørsler reproducérbare herfra).
  const realmMath = vm.runInContext('Math', context);
  realmMath.random = mulberry32(seed);

  const t = sandbox.__t;
  if (!t) throw new Error('__t blev ikke eksporteret af scriptet');
  return {t, context, sandbox, elements};
}

// Kør en fuld kamp deterministisk (spejler frame()'s timer/storm-logik uden rAF).
export function runFullMatch(t, {players, mapVariant, difficulty, stormOn = true, powerupsOn = false, seed = 1, bountyOn} = {}) {
  const {G} = t;
  t.setLocalPlayers(1, players - 1);
  G.mapVariant = mapVariant;
  G.difficulty = difficulty;
  G.stormOn = stormOn;
  G.powerupsOn = powerupsOn;
  if (bountyOn !== undefined) G.bountyOn = bountyOn;
  t.startMatch();

  const ROUND_TIME = 90, STORM_T = 20;
  let ticks = 0, guard = 0;
  const GUARD_MAX = 400000;
  while (G.phase !== 'matchend' && guard++ < GUARD_MAX) {
    if (G.phase === 'select') {
      pickFor(t, G.picker);
    } else if (G.phase === 'play') {
      ticks++;
      const tle = ROUND_TIME - ticks / G.speed;      // spejler frame(): timeLeft
      if (tle <= 0) { t.endRound(null, 'tid'); ticks = 0; continue; }
      G.stormM = (G.stormOn && tle <= STORM_T)       // spejler frame(): storm-formlen
        ? Math.floor((1 - tle / STORM_T) * (Math.min(t.W, t.H) / 2 - 3)) : 0;
      t.simulate();
    } else if (G.phase === 'roundwin') {
      t.finishWin(); ticks = 0;
    } else if (G.phase === 'roundend') {
      t.nextRound(); ticks = 0;
    } else {
      throw new Error('Uventet fase: ' + G.phase);
    }
  }
  if (G.phase !== 'matchend') throw new Error('Nåede aldrig matchend (guard opbrugt), fase=' + G.phase);
  return {ticks, guard};
}

// Deterministisk startfelt-valg: første gyldige (x,y) i scanning-orden, forskudt pr. spiller-id.
export function pickFor(t, id) {
  const {G} = t;
  for (let y = 3 + (id * 5) % 20; y < t.H - 3; y++) {
    for (let x = 3; x < t.W - 3; x++) {
      if (t.validPick(x, y)) { t.doPick(id, x, y); return; }
    }
  }
  // fald tilbage: fuld scanning
  for (let y = 3; y < t.H - 3; y++) for (let x = 3; x < t.W - 3; x++) {
    if (t.validPick(x, y)) { t.doPick(id, x, y); return; }
  }
  throw new Error('Ingen gyldig startposition fundet for spiller ' + id);
}

// Fælles invariant-tjek af board-tilstanden.
export function assertInvariants(t, assert) {
  const counts = t.counts();
  const sum = counts.reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, t.TOTAL, 'sum(counts) skal være TOTAL');
  const manual = new Array(9).fill(0);
  for (let i = 0; i < t.TOTAL; i++) manual[t.owner[i]]++;
  assert.deepStrictEqual([...counts], manual, 'counts skal matche manuel recount');
  const aliveIds = new Set(t.G.players.filter((p) => p.alive).map((p) => p.id));
  for (let i = 0; i < t.TOTAL; i++) {
    if (t.trail[i] !== 0) assert.ok(aliveIds.has(t.trail[i]), 'trail-celle tilhører død spiller: id=' + t.trail[i]);
  }
  for (const p of t.G.players) {
    for (const k of ['cx', 'cy', 'combo', 'comboUntil', 'bonus']) {
      if (k in p) assert.ok(!Number.isNaN(p[k]), 'NaN i spiller-felt ' + k);
    }
  }
}
