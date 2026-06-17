// ============================================================
// Dexie (IndexedDB) — fuldt client-side persistens.
// Ingen backend: systemet er selvkørende og deploybart som statisk site.
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  AlignmentLink,
  CheckIn,
  Cycle,
  Initiative,
  KeyResult,
  Objective,
} from '../types/domain';

export class OkrDatabase extends Dexie {
  cycles!: Table<Cycle, string>;
  objectives!: Table<Objective, string>;
  keyResults!: Table<KeyResult, string>;
  initiatives!: Table<Initiative, string>;
  checkIns!: Table<CheckIn, string>;
  alignmentLinks!: Table<AlignmentLink, string>;

  constructor() {
    super('okr-system');
    this.version(1).stores({
      cycles: 'id, isActive',
      objectives: 'id, cycleId, parentObjectiveId, level, order',
      keyResults: 'id, objectiveId, type, order',
      initiatives: 'id, keyResultId, status, order',
      checkIns: 'id, keyResultId, date',
      alignmentLinks: 'id, childKrId, parentKrId',
    });
  }
}

export const db = new OkrDatabase();
