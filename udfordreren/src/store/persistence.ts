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

/** Et løfte, der giver `fallback`, hvis det ikke er afgjort inden for `ms` (en hængende IndexedDB må ikke fryse UI'et) */
function medFrist<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

let lagringTjek: Promise<boolean> | null = null;
/**
 * Kan browseren gemme? Nej i fx ældre private vinduer, ved blokeret lagring eller uden IndexedDB.
 * Spillet kører videre uden gem (med en synlig besked); eksport og import virker stadig. Resultatet huskes.
 */
export function lagringVirker(): Promise<boolean> {
  if (!lagringTjek) {
    lagringTjek = medFrist(
      (async () => {
        if (typeof indexedDB === 'undefined') return false;
        const d = getDb();
        if (!d) return false;
        await d.open();
        const proeve = Date.now();
        await d.settings.put({ key: '_lagringstjek', value: proeve });
        return (await d.settings.get('_lagringstjek'))?.value === proeve;
      })(),
      6000,
      false,
    );
  }
  return lagringTjek;
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

// ---------- Nødgem: synkron kopi i localStorage, når siden lukkes ----------
// En IndexedDB-skrivning i pagehide når sjældent at blive færdig, før siden er væk (reload, lukket fane). Derfor
// skrives autosaven også synkront i localStorage. Ved næste indlæsning flyttes kopien ind i Dexie, hvis den er nyere.

const NOEDGEM_NOEGLE = 'udfordreren-noedgem';

/** Skriv autosaven synkront (bruges i pagehide/visibilitychange). Fejler stille (fuld eller blokeret lagring). */
export function noedGem(state: GameState): boolean {
  try {
    const row: SaveRow = { slot: 'auto', gemt: Date.now(), uge: state.uge, firmaNavn: state.firmaNavn, kapital: state.kapital, state };
    localStorage.setItem(NOEDGEM_NOEGLE, JSON.stringify(row));
    return true;
  } catch {
    return false;
  }
}

function laesNoedGem(): SaveRow | null {
  try {
    const raa = localStorage.getItem(NOEDGEM_NOEGLE);
    if (!raa) return null;
    const row = JSON.parse(raa) as Partial<SaveRow>;
    if (row.slot !== 'auto' || typeof row.gemt !== 'number' || !row.state) return null;
    return row as SaveRow;
  } catch {
    return null;
  }
}

function fjernNoedGem(): void {
  try {
    localStorage.removeItem(NOEDGEM_NOEGLE);
  } catch {
    /* ignorer */
  }
}

/** Flyt en nyere nødkopi ind i autosave-pladsen (en ældre smides væk). Kaldes, før gemte spil læses. */
async function synkNoedGem(d: UdfordrerDB): Promise<void> {
  const n = laesNoedGem();
  if (!n) return;
  try {
    const row = await d.saves.get('auto');
    if ((!row || n.gemt > row.gemt) && validerSave(n.state)) await d.saves.put(n);
    fjernNoedGem();
  } catch {
    /* prøv igen næste gang */
  }
}

export async function hent(slot: SlotId): Promise<GameState | null> {
  const d = getDb();
  if (!d) return null;
  try {
    if (slot === 'auto') await medFrist(synkNoedGem(d), 6000, undefined);
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
    await medFrist(synkNoedGem(d), 6000, undefined);
    const rows = await medFrist(d.saves.toArray(), 6000, []);
    return rows.map(({ state: _s, ...rest }) => rest);
  } catch {
    return [];
  }
}

export async function slet(slot: SlotId): Promise<void> {
  const d = getDb();
  if (slot === 'auto') fjernNoedGem();
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

/** Den save-version, denne build læser (GameState.version) */
export const SAVE_VERSION = 2;

/** Hvorfor en save blev afvist (til en venlig fejlbesked) */
export type SaveFejl = { grund: 'ikkeSpil' } | { grund: 'version'; version: unknown } | { grund: 'mangler'; felt: string } | { grund: 'simulering' };

/** Strukturel validering af en save (beskytter mod korrupte filer og saves fra ældre builds).
 *  Til sidst prøvekøres én uge på en kopi: vælter simulationen, afvises filen med den venlige fejl i stedet for at vælte spillet. */
export function tjekSave(x: unknown): { state: GameState } | { fejl: SaveFejl } {
  if (!erObj(x)) return { fejl: { grund: 'ikkeSpil' } };
  const s = x as Partial<GameState>;
  if (s.version === undefined && s.uge === undefined && s.markeder === undefined) return { fejl: { grund: 'ikkeSpil' } };
  if (s.version !== SAVE_VERSION) return { fejl: { grund: 'version', version: s.version } };
  const mangler = (felt: string): { fejl: SaveFejl } => ({ fejl: { grund: 'mangler', felt } });
  for (const felt of ['uge', 'kapital', 'seed'] as const) {
    const v = s[felt];
    if (typeof v !== 'number' || !Number.isFinite(v)) return mangler(felt);
  }
  if (!Array.isArray(s.rngState) || s.rngState.length !== 4 || !s.rngState.every((n) => typeof n === 'number' && Number.isFinite(n))) return mangler('rngState');
  if (typeof s.firmaNavn !== 'string') return mangler('firmaNavn');
  for (const felt of ['staff', 'produkter', 'projekter', 'kandidater'] as const) {
    const liste = s[felt];
    if (!Array.isArray(liste) || !liste.every(harId)) return mangler(felt);
  }
  for (const felt of ['nyheder', 'ventendeEvents', 'kontraktopgaver', 'kontraktTilbud', 'kvartalsmaal', 'konkurrenter', 'historik', 'galla', 'flags'] as const) {
    if (!Array.isArray(s[felt])) return mangler(felt);
  }
  if (!erObj(s.markeder) || !erObj(s.markeder.dk)) return mangler('markeder');
  for (const m of Object.values(s.markeder)) {
    if (!erObj(m) || !Array.isArray(m.top10) || !erObj(m.vertikaler) || !erObj(m.spillerKunder) || !erObj(m.andele)) return mangler('markeder');
  }
  for (const felt of ['investorer', 'regnskab', 'niveauer', 'platforme', 'milepaele'] as const) {
    if (!erObj(s[felt])) return mangler(felt);
  }
  try {
    const g = udfyldMangler(s as GameState);
    step(structuredClone(g), []);
    return { state: g };
  } catch {
    return { fejl: { grund: 'simulering' } };
  }
}

/** Som tjekSave, men giver bare null ved en afvist save */
export function validerSave(x: unknown): GameState | null {
  const r = tjekSave(x);
  return 'state' in r ? r.state : null;
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

export type ImportResultat = { ok: true; state: GameState } | { ok: false; fejl: string };

/** Venlig forklaring på en afvist save (vises i Gem og indlæs) */
export function saveFejlTekst(f: SaveFejl): string {
  switch (f.grund) {
    case 'ikkeSpil':
      return 'Filen er ikke en gemt fil fra Udfordreren.';
    case 'version':
      return typeof f.version === 'number' && f.version > SAVE_VERSION
        ? 'Filen er fra en nyere version af spillet. Opdatér spillet, og prøv igen.'
        : 'Filen er fra en anden version af spillet, som denne version ikke kan læse.';
    case 'mangler':
      return `Filen mangler dele af spillet (${f.felt}). Den er nok blevet beskadiget undervejs.`;
    case 'simulering':
      return 'Filen ser rigtig ud, men spillet kan ikke køre videre fra den. Den er nok blevet beskadiget undervejs.';
  }
}

/** Læs en eksporteret fil (eller en rå GameState) og forklar venligt, hvis den ikke kan bruges. Kaster aldrig. */
export function importerMedGrund(tekst: string): ImportResultat {
  if (!tekst.trim()) return { ok: false, fejl: 'Filen er tom.' };
  let obj: unknown;
  try {
    obj = JSON.parse(tekst);
  } catch {
    return { ok: false, fejl: 'Filen er ikke gyldig JSON. Den er måske blevet klippet over eller redigeret undervejs.' };
  }
  if (erObj(obj) && typeof obj.app === 'string' && obj.app !== 'udfordreren') return { ok: false, fejl: saveFejlTekst({ grund: 'ikkeSpil' }) };
  const r = tjekSave(erObj(obj) && obj.state !== undefined && obj.state !== null ? obj.state : obj);
  return 'state' in r ? { ok: true, state: r.state } : { ok: false, fejl: saveFejlTekst(r.fejl) };
}

export function importerJson(tekst: string): GameState | null {
  const r = importerMedGrund(tekst);
  return r.ok ? r.state : null;
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
