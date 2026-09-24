// Persistens med Dexie: 3 slots + autosave hvert kvartal, samt settings. Eksport/import som JSON.
import Dexie, { type Table } from 'dexie';
import type { GameState } from '../sim/types';

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

/** Minimal strukturel validering af en save (beskytter mod korrupte filer) */
export function validerSave(x: unknown): GameState | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as Partial<GameState>;
  if (s.version !== 2) return null;
  if (typeof s.uge !== 'number' || typeof s.kapital !== 'number' || typeof s.seed !== 'number') return null;
  if (!Array.isArray(s.rngState) || s.rngState.length !== 4) return null;
  if (!Array.isArray(s.staff) || !Array.isArray(s.produkter) || !Array.isArray(s.projekter)) return null;
  if (!s.markeder || typeof s.markeder !== 'object' || !s.markeder.dk) return null;
  return s as GameState;
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
