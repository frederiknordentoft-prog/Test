// Afledte selektorer der bygger oven på store'ens maps.

import { useStore } from '../store/useStore';
import { average, worstHealth } from './okr';
import type { HealthColor, KeyResult, Objective } from '../types/domain';

export interface ObjectiveSummary {
  progress: number;
  health: HealthColor;
  krCount: number;
  needsCheckInCount: number;
}

/** Opsummerer et objectives egne KR'er (fremdrift = gns. af rolled-up progress). */
export function useObjectiveSummary(objectiveId: string): ObjectiveSummary {
  const krs = useStore((s) => s.krsByObjective.get(objectiveId) ?? []);
  const computedByKr = useStore((s) => s.computedByKr);

  const computed = krs.map((kr) => computedByKr.get(kr.id)).filter(Boolean) as NonNullable<
    ReturnType<typeof computedByKr.get>
  >[];

  const progress = average(
    computed.map((c) => (c.hasContributors ? c.rolledUpProgress : c.progress)),
  );
  const health = worstHealth(computed.map((c) => c.health));
  const needsCheckInCount = computed.filter((c) => c.needsCheckIn).length;

  return { progress, health, krCount: krs.length, needsCheckInCount };
}

/** Objektiver i den aktive cyklus, hentet på rod-niveau. */
export function useRootObjectives(): Objective[] {
  const objectives = useStore((s) => s.objectives);
  const activeCycleId = useStore((s) => s.activeCycleId);
  return objectives
    .filter((o) => o.cycleId === activeCycleId && o.level === 'company')
    .sort((a, b) => a.order - b.order);
}

export interface OrgPulse {
  total: number;
  green: number;
  yellow: number;
  red: number;
  none: number;
  needs: number;
  avg: number; // 0..1 gns. fremdrift (rolled-up)
}

/** Samlet sundhedspuls for hele den aktive cyklus (til sidebar-ringen). */
export function useOrgPulse(): OrgPulse {
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const computedByKr = useStore((s) => s.computedByKr);
  const activeCycleId = useStore((s) => s.activeCycleId);

  const p: OrgPulse = { total: 0, green: 0, yellow: 0, red: 0, none: 0, needs: 0, avg: 0 };
  let progSum = 0;
  for (const kr of keyResults) {
    const obj = objectivesById.get(kr.objectiveId);
    if (!obj || obj.cycleId !== activeCycleId) continue;
    const c = computedByKr.get(kr.id);
    if (!c) continue;
    p.total += 1;
    p[c.health] += 1;
    if (c.needsCheckIn) p.needs += 1;
    progSum += c.hasContributors ? c.rolledUpProgress : c.progress;
  }
  p.avg = p.total ? progSum / p.total : 0;
  return p;
}

/** Id'er på KR'er i den aktive cyklus der mangler ugens check-in (kø). */
export function useStaleKrIds(): string[] {
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const computedByKr = useStore((s) => s.computedByKr);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const out: string[] = [];
  for (const kr of keyResults) {
    const obj = objectivesById.get(kr.objectiveId);
    if (!obj || obj.cycleId !== activeCycleId) continue;
    if (computedByKr.get(kr.id)?.needsCheckIn) out.push(kr.id);
  }
  return out;
}

/** Distinkte ejere (objectives + KR'er) i den aktive cyklus, sorteret. */
export function useActiveOwners(): string[] {
  const objectives = useStore((s) => s.objectives);
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const set = new Set<string>();
  for (const o of objectives) if (o.cycleId === activeCycleId && o.owner) set.add(o.owner);
  for (const k of keyResults) {
    const obj = objectivesById.get(k.objectiveId);
    if (obj && obj.cycleId === activeCycleId && k.owner) set.add(k.owner);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'da'));
}

/** Alle KR'er i den aktive cyklus (til dashboard). */
export function useActiveKeyResults(): { kr: KeyResult; objective: Objective }[] {
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const out: { kr: KeyResult; objective: Objective }[] = [];
  for (const kr of keyResults) {
    const obj = objectivesById.get(kr.objectiveId);
    if (obj && obj.cycleId === activeCycleId) out.push({ kr, objective: obj });
  }
  return out;
}
