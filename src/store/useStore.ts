// ============================================================
// Zustand-store: én kilde til sandhed i UI.
// Holder hele datasættet i hukommelsen, eksponerer afledte maps og
// genindlæser efter hver mutation (datasættet er lille).
// ============================================================

import { create } from 'zustand';
import * as repo from '../db/repository';
import { ensureSeeded, resetToSeed, type Snapshot } from '../db/repository';
import { computeKr } from '../lib/okr';
import type {
  AlignmentLink,
  CheckIn,
  Initiative,
  KeyResult,
  KrComputed,
  Objective,
} from '../types/domain';

interface Derived {
  objectivesById: Map<string, Objective>;
  krsById: Map<string, KeyResult>;
  krsByObjective: Map<string, KeyResult[]>;
  objectivesByParent: Map<string, Objective[]>;
  initiativesByKr: Map<string, Initiative[]>;
  checkInsByKr: Map<string, CheckIn[]>;
  linksByParent: Map<string, AlignmentLink[]>;
  linksByChild: Map<string, AlignmentLink[]>;
  computedByKr: Map<string, KrComputed>;
}

interface StoreState extends Snapshot, Derived {
  loaded: boolean;
  activeCycleId: string;

  init: () => Promise<void>;
  reload: () => Promise<void>;
  setActiveCycle: (id: string) => void;
  reset: () => Promise<void>;

  // Mutationer (wrapper repo + reload)
  addCheckIn: (c: Omit<CheckIn, 'id'>) => Promise<void>;
  saveObjective: (o: Objective | Omit<Objective, 'id'>) => Promise<void>;
  removeObjective: (id: string) => Promise<void>;
  saveKeyResult: (k: KeyResult | Omit<KeyResult, 'id'>) => Promise<void>;
  removeKeyResult: (id: string) => Promise<void>;
  saveInitiative: (i: Initiative | Omit<Initiative, 'id'>) => Promise<void>;
  removeInitiative: (id: string) => Promise<void>;
  addLink: (childKrId: string, parentKrId: string, weight?: number) => Promise<void>;
  removeLink: (id: string) => Promise<void>;

  // Selektorer
  getComputed: (krId: string) => KrComputed | undefined;
}

function buildDerived(s: Snapshot): Derived {
  const objectivesById = new Map(s.objectives.map((o) => [o.id, o]));
  const krsById = new Map(s.keyResults.map((k) => [k.id, k]));

  const krsByObjective = new Map<string, KeyResult[]>();
  for (const k of s.keyResults) {
    const arr = krsByObjective.get(k.objectiveId) ?? [];
    arr.push(k);
    krsByObjective.set(k.objectiveId, arr);
  }
  krsByObjective.forEach((arr) => arr.sort((a, b) => a.order - b.order));

  const objectivesByParent = new Map<string, Objective[]>();
  for (const o of s.objectives) {
    const key = o.parentObjectiveId ?? '__root__';
    const arr = objectivesByParent.get(key) ?? [];
    arr.push(o);
    objectivesByParent.set(key, arr);
  }
  objectivesByParent.forEach((arr) => arr.sort((a, b) => a.order - b.order));

  const initiativesByKr = new Map<string, Initiative[]>();
  for (const i of s.initiatives) {
    const arr = initiativesByKr.get(i.keyResultId) ?? [];
    arr.push(i);
    initiativesByKr.set(i.keyResultId, arr);
  }
  initiativesByKr.forEach((arr) => arr.sort((a, b) => a.order - b.order));

  const checkInsByKr = new Map<string, CheckIn[]>();
  for (const c of s.checkIns) {
    const arr = checkInsByKr.get(c.keyResultId) ?? [];
    arr.push(c);
    checkInsByKr.set(c.keyResultId, arr);
  }
  checkInsByKr.forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));

  const linksByParent = new Map<string, AlignmentLink[]>();
  const linksByChild = new Map<string, AlignmentLink[]>();
  for (const l of s.alignmentLinks) {
    const p = linksByParent.get(l.parentKrId) ?? [];
    p.push(l);
    linksByParent.set(l.parentKrId, p);
    const c = linksByChild.get(l.childKrId) ?? [];
    c.push(l);
    linksByChild.set(l.childKrId, c);
  }

  const computedByKr = new Map<string, KrComputed>();
  for (const k of s.keyResults) {
    computedByKr.set(k.id, computeKr(k, checkInsByKr, krsById, linksByParent));
  }

  return {
    objectivesById,
    krsById,
    krsByObjective,
    objectivesByParent,
    initiativesByKr,
    checkInsByKr,
    linksByParent,
    linksByChild,
    computedByKr,
  };
}

const EMPTY: Snapshot = {
  cycles: [],
  objectives: [],
  keyResults: [],
  initiatives: [],
  checkIns: [],
  alignmentLinks: [],
};

export const useStore = create<StoreState>((set, get) => ({
  ...EMPTY,
  ...buildDerived(EMPTY),
  loaded: false,
  activeCycleId: '',

  init: async () => {
    await ensureSeeded();
    await get().reload();
    const cycles = get().cycles;
    const active = cycles.find((c) => c.isActive) ?? cycles[0];
    set({ loaded: true, activeCycleId: get().activeCycleId || active?.id || '' });
  },

  reload: async () => {
    const snap = await repo.loadAll();
    set({ ...snap, ...buildDerived(snap) });
  },

  setActiveCycle: (id) => set({ activeCycleId: id }),

  reset: async () => {
    await resetToSeed();
    await get().reload();
    const cycles = get().cycles;
    const active = cycles.find((c) => c.isActive) ?? cycles[0];
    set({ activeCycleId: active?.id ?? '' });
  },

  addCheckIn: async (c) => {
    await repo.createCheckIn(c);
    await get().reload();
  },

  saveObjective: async (o) => {
    if ('id' in o) await repo.updateObjective(o.id, o);
    else await repo.createObjective(o);
    await get().reload();
  },
  removeObjective: async (id) => {
    await repo.deleteObjective(id);
    await get().reload();
  },

  saveKeyResult: async (k) => {
    if ('id' in k) await repo.updateKeyResult(k.id, k);
    else await repo.createKeyResult(k);
    await get().reload();
  },
  removeKeyResult: async (id) => {
    await repo.deleteKeyResult(id);
    await get().reload();
  },

  saveInitiative: async (i) => {
    if ('id' in i) await repo.updateInitiative(i.id, i);
    else await repo.createInitiative(i);
    await get().reload();
  },
  removeInitiative: async (id) => {
    await repo.deleteInitiative(id);
    await get().reload();
  },

  addLink: async (childKrId, parentKrId, weight) => {
    await repo.createLink(childKrId, parentKrId, weight);
    await get().reload();
  },
  removeLink: async (id) => {
    await repo.deleteLink(id);
    await get().reload();
  },

  getComputed: (krId) => get().computedByKr.get(krId),
}));
