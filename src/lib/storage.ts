// Persistence with graceful degradation. If localStorage is unavailable
// (private mode, sandboxed iframe with a null origin, quota errors), we fall
// back to an in-memory value so the app keeps working — just without persistence.

import type { PlanInput, MilestoneId } from './schedule';

const KEY = 'surdej.plan.v1';

export interface PersistedPlan {
  v: 1;
  input: PlanInput;
  doneIds: MilestoneId[];
  createdAt: number;
}

let memory: string | null = null;

function safeGet(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function safeSet(value: string): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    memory = value;
  }
}

function safeRemove(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    memory = null;
  }
}

const TEMPS = new Set(['cool', 'normal', 'warm']);
const SIZES = new Set(['small', 'large']);
const COLD = new Set([8, 12, 16]);

/** Validate a parsed blob without trusting its shape. Returns null on any drift. */
function validate(raw: unknown): PersistedPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const input = o.input as Record<string, unknown> | undefined;
  if (!input || typeof input !== 'object') return null;
  if (typeof input.finishAt !== 'number' || !Number.isFinite(input.finishAt)) return null;
  if (typeof input.temp !== 'string' || !TEMPS.has(input.temp)) return null;
  if (typeof input.size !== 'string' || !SIZES.has(input.size)) return null;
  if (typeof input.coldProofHours !== 'number' || !COLD.has(input.coldProofHours)) return null;
  if (typeof input.hasActiveStarter !== 'boolean') return null;
  if (!input.delays || typeof input.delays !== 'object') return null;
  if (!Array.isArray(o.doneIds)) return null;
  if (typeof o.createdAt !== 'number') return null;
  return raw as PersistedPlan;
}

export function loadPlan(): PersistedPlan | null {
  const raw = safeGet();
  if (!raw) return null;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePlan(plan: PersistedPlan): void {
  try {
    safeSet(JSON.stringify(plan));
  } catch {
    /* ignore — nothing more we can do */
  }
}

export function clearPlan(): void {
  safeRemove();
}
