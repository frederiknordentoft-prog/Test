// ============================================================
// Repository-lag: al data-adgang går gennem disse funktioner.
// Holder Dexie-detaljer ude af store og UI.
// ============================================================

import { endOfQuarter, formatISO, getQuarter, getYear, startOfQuarter } from 'date-fns';
import { db } from './database';
import { seedData } from './seed';
import type {
  AlignmentLink,
  CheckIn,
  Cycle,
  Initiative,
  KeyResult,
  Objective,
} from '../types/domain';

/** Bygger en cyklus for det kvartal en given dato falder i. */
function quarterCycle(date = new Date()): Cycle {
  const q = getQuarter(date);
  const y = getYear(date);
  return {
    id: `cycle-q${q}-${y}`,
    name: `Q${q} ${y}`,
    startDate: formatISO(startOfQuarter(date), { representation: 'date' }),
    endDate: formatISO(endOfQuarter(date), { representation: 'date' }),
    isActive: true,
  };
}

/**
 * Sikrer at der altid findes mindst én cyklus, så brugeren kan oprette
 * objectives med det samme. Seeder IKKE eksempel-data — appen starter tom.
 */
export async function ensureBaseline(): Promise<void> {
  const cycleCount = await db.cycles.count();
  if (cycleCount === 0) {
    await db.cycles.add(quarterCycle());
  }
}

async function clearEverything(): Promise<void> {
  await Promise.all([
    db.cycles.clear(),
    db.objectives.clear(),
    db.keyResults.clear(),
    db.initiatives.clear(),
    db.checkIns.clear(),
    db.alignmentLinks.clear(),
  ]);
}

/** Indlæs det fulde eksempel-datasæt (erstatter alt eksisterende). */
export async function loadDemoData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.cycles, db.objectives, db.keyResults, db.initiatives, db.checkIns, db.alignmentLinks],
    async () => {
      await clearEverything();
      await db.cycles.bulkAdd(seedData.cycles);
      await db.objectives.bulkAdd(seedData.objectives);
      await db.keyResults.bulkAdd(seedData.keyResults);
      await db.initiatives.bulkAdd(seedData.initiatives);
      await db.checkIns.bulkAdd(seedData.checkIns);
      await db.alignmentLinks.bulkAdd(seedData.alignmentLinks);
    },
  );
}

/** Ryd alle data og start forfra med en tom, aktiv cyklus. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.cycles, db.objectives, db.keyResults, db.initiatives, db.checkIns, db.alignmentLinks],
    async () => {
      await clearEverything();
      await db.cycles.add(quarterCycle());
    },
  );
}

export interface Snapshot {
  cycles: Cycle[];
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives: Initiative[];
  checkIns: CheckIn[];
  alignmentLinks: AlignmentLink[];
}

/** Læs hele datasættet (appen er lille nok til at holdes i hukommelsen). */
export async function loadAll(): Promise<Snapshot> {
  const [cycles, objectives, keyResults, initiatives, checkIns, alignmentLinks] = await Promise.all([
    db.cycles.toArray(),
    db.objectives.toArray(),
    db.keyResults.toArray(),
    db.initiatives.toArray(),
    db.checkIns.toArray(),
    db.alignmentLinks.toArray(),
  ]);
  return { cycles, objectives, keyResults, initiatives, checkIns, alignmentLinks };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---- Objectives ----
export async function createObjective(o: Omit<Objective, 'id'>): Promise<Objective> {
  const obj: Objective = { ...o, id: uid('obj') };
  await db.objectives.add(obj);
  return obj;
}
export async function updateObjective(id: string, patch: Partial<Objective>): Promise<void> {
  await db.objectives.update(id, patch);
}
export async function deleteObjective(id: string): Promise<void> {
  const krs = await db.keyResults.where('objectiveId').equals(id).toArray();
  await db.transaction(
    'rw',
    [db.objectives, db.keyResults, db.initiatives, db.checkIns, db.alignmentLinks],
    async () => {
      for (const kr of krs) await deleteKeyResultInternal(kr.id);
      await db.objectives.delete(id);
    },
  );
}

// ---- Key Results ----
export async function createKeyResult(k: Omit<KeyResult, 'id'>): Promise<KeyResult> {
  const kr: KeyResult = { ...k, id: uid('kr') };
  await db.keyResults.add(kr);
  return kr;
}
export async function updateKeyResult(id: string, patch: Partial<KeyResult>): Promise<void> {
  await db.keyResults.update(id, patch);
}
async function deleteKeyResultInternal(id: string): Promise<void> {
  await db.initiatives.where('keyResultId').equals(id).delete();
  await db.checkIns.where('keyResultId').equals(id).delete();
  await db.alignmentLinks.where('childKrId').equals(id).delete();
  await db.alignmentLinks.where('parentKrId').equals(id).delete();
  await db.keyResults.delete(id);
}
export async function deleteKeyResult(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.keyResults, db.initiatives, db.checkIns, db.alignmentLinks],
    async () => deleteKeyResultInternal(id),
  );
}

// ---- Initiatives ----
export async function createInitiative(i: Omit<Initiative, 'id'>): Promise<Initiative> {
  const ini: Initiative = { ...i, id: uid('ini') };
  await db.initiatives.add(ini);
  return ini;
}
export async function updateInitiative(id: string, patch: Partial<Initiative>): Promise<void> {
  await db.initiatives.update(id, patch);
}
export async function deleteInitiative(id: string): Promise<void> {
  await db.initiatives.delete(id);
}

// ---- Check-ins ----
export async function createCheckIn(c: Omit<CheckIn, 'id'>): Promise<CheckIn> {
  const ci: CheckIn = { ...c, id: uid('ci') };
  await db.transaction('rw', [db.checkIns, db.keyResults], async () => {
    await db.checkIns.add(ci);
    // Et check-in opdaterer KR'ets current-værdi.
    await db.keyResults.update(c.keyResultId, { current: c.value });
  });
  return ci;
}

// ---- Alignment links ----
export async function createLink(childKrId: string, parentKrId: string, weight = 1): Promise<AlignmentLink> {
  const l: AlignmentLink = { id: uid('link'), childKrId, parentKrId, weight };
  await db.alignmentLinks.add(l);
  return l;
}
export async function deleteLink(id: string): Promise<void> {
  await db.alignmentLinks.delete(id);
}
