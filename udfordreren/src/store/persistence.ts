// Persistens med Dexie: 3 slots + autosave hvert kvartal, samt settings. Eksport/import som JSON.
import Dexie, { type Table } from 'dexie';
import type { GameState } from '../sim/types';
import { step } from '../sim/step';

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
  const g = s as GameState;
  try {
    step(structuredClone(g), []);
  } catch {
    return null;
  }
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
