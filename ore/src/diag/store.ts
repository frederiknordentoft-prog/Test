/**
 * Diagnostics store for the F0 spike. Plain object + subscribers, read by React through
 * useSyncExternalStore. Every check writes one entry; "Kopiér rapport" copies all of it.
 */
import { useSyncExternalStore } from 'react';

export type Status = 'afventer' | 'ok' | 'advarsel' | 'fejl';
export interface Check { status: Status; detail: string; data?: Record<string, unknown> }

const checks: Record<string, Check> = {};
const listeners = new Set<() => void>();
let version = 0;

export function setCheck(key: string, check: Check): void {
  checks[key] = check;
  version++;
  listeners.forEach((l) => l());
}

export function getChecks(): Record<string, Check> {
  return checks;
}

export function useChecks(): Record<string, Check> {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return checks;
}

export function report(): string {
  return JSON.stringify({ when: new Date().toISOString(), href: location.href, checks }, null, 1);
}
