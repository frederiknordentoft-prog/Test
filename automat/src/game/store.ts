// Game store + persistence (localStorage 'nordlys.v1', in-memory fallback with a visible banner).
import type { MeterState } from '../math/meter.ts';

export interface HistoryEntry {
  spinId: string;
  mode: 'base' | 'perk' | 'storm' | 'demo';
  stakeOre: number;
  winOre: number;
  netOre: number;
  pre: { charge: number; stakeSumOre: number; perksPending: number };
  at: number; // epoch ms
}

export interface ActiveStorm {
  source: 'A' | 'B' | 'AB';
  stakeOre: number;
  seedIdx: number;          // storm domain index used for this storm
  spinIndex: number;        // spins already played
  spinsTotal: number;
  marks: number[];
  winOre: number;
  maxMark: number;
}

export interface Settings {
  music: number;            // 0..1
  sfx: number;              // 0..1
  muted: boolean;
  haptics: boolean;
  calm: 'auto' | 'on' | 'off'; // 'auto' follows prefers-reduced-motion
}

export interface Stats {
  spins: number;
  storms: number;
  bestWinX: number;
  highestKp: number;
}

export interface SaveData {
  v: 1;
  balanceOre: number;
  stakeOre: number;
  meter: MeterState;
  perksPending: number;
  sessionSeed: number;
  counters: { base: number; storm: number; perk: number; demo: number };
  history: HistoryEntry[];
  settings: Settings;
  stats: Stats;
  activeStorm: ActiveStorm | null;
  lastPlayed: number;
}

export const START_BALANCE_ORE = 100_000; // 1.000,00 kr legepenge
const KEY = 'nordlys.v1';
const RETAIN_MS = 365 * 24 * 3600 * 1000;

export let storageOk = true;

export function defaults(seed: number, stakeOre: number): SaveData {
  return {
    v: 1,
    balanceOre: START_BALANCE_ORE,
    stakeOre,
    meter: { charge: 0, stakeSumOre: 0 },
    perksPending: 0,
    sessionSeed: seed,
    counters: { base: 0, storm: 0, perk: 0, demo: 0 },
    history: [],
    settings: { music: 0.7, sfx: 0.85, muted: false, haptics: true, calm: 'auto' },
    stats: { spins: 0, storms: 0, bestWinX: 0, highestKp: 0 },
    activeStorm: null,
    lastPlayed: Date.now(),
  };
}

export function load(seed: number, stakeOre: number): SaveData {
  const d = defaults(seed, stakeOre);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw) as SaveData;
    if (s.v !== 1) return d;
    // Progress retained for 365 days after the last spin (rules §3).
    if (Date.now() - (s.lastPlayed || 0) > RETAIN_MS) {
      s.meter = { charge: 0, stakeSumOre: 0 };
      s.perksPending = 0;
    }
    return { ...d, ...s, settings: { ...d.settings, ...s.settings }, stats: { ...d.stats, ...s.stats }, counters: { ...d.counters, ...s.counters } };
  } catch {
    storageOk = false;
    return d;
  }
}

let writesEnabled = true;
/** Demo mode runs on an in-memory fork: persistence writes are disabled while it runs. */
export function setPersistenceEnabled(b: boolean): void { writesEnabled = b; }

export function save(s: SaveData): void {
  if (!writesEnabled) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

export function wipe(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
