// Persistens med Dexie: 3 slots + autosave hvert kvartal, samt settings. Eksport/import som JSON.
import Dexie, { type Table } from 'dexie';
import type { GameState, NewGamePlusArv } from '../sim/types';
import { step } from '../sim/step';
import { newGame } from '../sim/init';
import { arvFra } from '../sim/newgameplus';
import { START_AAR } from '../sim/time';

export type SlotId = 'slot1' | 'slot2' | 'slot3' | 'auto';
export type SaveRow = { slot: SlotId; gemt: number; uge: number; firmaNavn: string; kapital: number; state: GameState };
export type SettingRow = { key: string; value: unknown };

class UdfordrerDB extends Dexie {
  saves!: Table<SaveRow, SlotId>;
  settings!: Table<SettingRow, string>;
  constructor() {
    super('udfordreren');
    this.version(1).stores({ saves: 'slot', settings: 'key' });
  }
}

let db: UdfordrerDB | null = null;
function getDb(): UdfordrerDB | null {
  try {
    if (!db) db = new UdfordrerDB();
    return db;
  } catch {
    return null;
  }
}

export async function gem(slot: SlotId, state: GameState): Promise<boolean> {
  const d = getDb();
  if (!d) return false;
  try {
    await d.saves.put({ slot, gemt: Date.now(), uge: state.uge, firmaNavn: state.firmaNavn, kapital: state.kapital, state });
    return true;
  } catch {
    return false;
  }
}

export async function hent(slot: SlotId): Promise<GameState | null> {
  const d = getDb();
  if (!d) return null;
  try {
    const row = await d.saves.get(slot);
    if (!row) return null;
    return validerSave(row.state);
  } catch {
    return null;
  }
}

export async function listSaves(): Promise<Omit<SaveRow, 'state'>[]> {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = await d.saves.toArray();
    return rows.map(({ state: _s, ...rest }) => rest);
  } catch {
    return [];
  }
}

export async function slet(slot: SlotId): Promise<void> {
  const d = getDb();
  if (!d) return;
  try {
    await d.saves.delete(slot);
  } catch {
    /* ignorer */
  }
}

export async function gemSetting(key: string, value: unknown): Promise<void> {
  const d = getDb();
  if (!d) return;
  try {
    await d.settings.put({ key, value });
  } catch {
    /* ignorer */
  }
}

export async function hentSetting<T>(key: string): Promise<T | undefined> {
  const d = getDb();
  if (!d) return undefined;
  try {
    return (await d.settings.get(key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}

const erObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const harId = (x: unknown): boolean => erObj(x) && typeof x.id === 'string';

/** Strukturel validering af en save (beskytter mod korrupte filer og saves fra ældre builds).
 *  Til sidst prøvekøres én uge på en kopi: vælter simulationen, afvises filen med den venlige fejl i stedet for at vælte spillet. */
export function validerSave(x: unknown): GameState | null {
  if (!erObj(x)) return null;
  const s = x as Partial<GameState>;
  if (s.version !== 2) return null;
  if (typeof s.uge !== 'number' || typeof s.kapital !== 'number' || typeof s.seed !== 'number') return null;
  if (!Number.isFinite(s.uge) || !Number.isFinite(s.kapital)) return null;
  if (!Array.isArray(s.rngState) || s.rngState.length !== 4) return null;
  if (typeof s.firmaNavn !== 'string') return null;
  for (const liste of [s.staff, s.produkter, s.projekter, s.kandidater]) {
    if (!Array.isArray(liste) || !liste.every(harId)) return null;
  }
  for (const liste of [s.nyheder, s.ventendeEvents, s.kontraktopgaver, s.kontraktTilbud, s.kvartalsmaal, s.konkurrenter, s.historik, s.galla, s.flags]) {
    if (!Array.isArray(liste)) return null;
  }
  if (!erObj(s.markeder) || !erObj(s.markeder.dk)) return null;
  for (const m of Object.values(s.markeder)) {
    if (!erObj(m) || !Array.isArray(m.top10) || !erObj(m.vertikaler) || !erObj(m.spillerKunder) || !erObj(m.andele)) return null;
  }
  if (!erObj(s.investorer) || !erObj(s.regnskab) || !erObj(s.niveauer) || !erObj(s.platforme) || !erObj(s.milepaele)) return null;
  const g = udfyldMangler(s as GameState);
  try {
    step(structuredClone(g), []);
  } catch {
    return null;
  }
  return g;
}

/** Saves fra ældre builds mangler felter, der er kommet til siden: udfyld dem med standardværdier fra et nyt spil */
function udfyldMangler(g: GameState): GameState {
  const frisk = newGame({ seed: g.seed, firmaNavn: g.firmaNavn, stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: g.startVertikal ?? 'betting', tutorial: false }) as unknown as Record<string, unknown>;
  const x = g as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(frisk)) if (x[k] === undefined) x[k] = structuredClone(v);
  const friskeMarkeder = frisk.markeder as Record<string, Record<string, unknown>>;
  for (const [id, m] of Object.entries(g.markeder) as [string, unknown][]) {
    const mm = m as Record<string, unknown>;
    for (const [k, v] of Object.entries(friskeMarkeder[id] ?? {})) if (mm[k] === undefined) mm[k] = structuredClone(v);
  }
  for (const [id, m] of Object.entries(friskeMarkeder)) if (!(id in g.markeder)) (g.markeder as Record<string, unknown>)[id] = structuredClone(m);
  return g;
}

export function eksporterJson(state: GameState): string {
  return JSON.stringify({ app: 'udfordreren', eksporteret: new Date().toISOString(), state });
}

export function importerJson(tekst: string): GameState | null {
  try {
    const obj = JSON.parse(tekst) as { app?: string; state?: unknown };
    return validerSave(obj?.state ?? obj);
  } catch {
    return null;
  }
}

// ---------- New Game+ (spec 6.17): arven og de ulåste modes huskes mellem spil ----------

export type UlaasteModes = 'usa2018' | 'aiNative2026';
export type NgPlusGemt = {
  arv: NewGamePlusArv | null;
  modes: UlaasteModes[];
  afsluttede: number;
  senesteSlut: { id: string; firmaNavn: string; aar: number; seed: number; uge: number } | null;
};
const NGPLUS_NOEGLE = 'ngplus';

/** Flet to arve: sete kombinationer og de højeste niveauer fra begge (så en ny start aldrig mister noget) */
export function fletArv(a: NewGamePlusArv | null | undefined, b: NewGamePlusArv): NewGamePlusArv {
  const ud = structuredClone(b);
  if (!a) return ud;
  for (const [k, v] of Object.entries(a.kombinationsbog)) {
    const n = ud.kombinationsbog[k];
    ud.kombinationsbog[k] = n ? { set: n.set || v.set, bedste40: Math.max(n.bedste40, v.bedste40) } : { ...v };
  }
  for (const del of ['niveauer', 'niveauXp'] as const) {
    for (const g of ['type', 'tema'] as const) {
      const fra = a[del][g] as Record<string, number>;
      const til = ud[del][g] as Record<string, number>;
      for (const [k, v] of Object.entries(fra)) til[k] = Math.max(til[k] ?? 0, v);
    }
  }
  return ud;
}

export async function hentNgPlus(): Promise<NgPlusGemt | null> {
  const v = await hentSetting<NgPlusGemt>(NGPLUS_NOEGLE);
  if (!v || typeof v !== 'object' || !Array.isArray(v.modes)) return null;
  return v;
}

/** Et spil er slut: gem arven (flettet med den forrige) og lås de to modes op. Samme slutning tælles kun én gang. */
export async function registrerSlut(state: GameState): Promise<NgPlusGemt> {
  const foer = await hentNgPlus();
  const uge = state.slut?.uge ?? state.uge;
  const samme = foer?.senesteSlut?.seed === state.seed && foer?.senesteSlut?.uge === uge;
  const ny: NgPlusGemt = {
    arv: fletArv(foer?.arv, arvFra(state)),
    modes: ['usa2018', 'aiNative2026'],
    afsluttede: (foer?.afsluttede ?? 0) + (samme ? 0 : 1),
    senesteSlut: { id: state.slut?.id ?? 'slut', firmaNavn: state.firmaNavn, aar: START_AAR + Math.floor(uge / 52), seed: state.seed, uge },
  };
  await gemSetting(NGPLUS_NOEGLE, ny);
  return ny;
}
