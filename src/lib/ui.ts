// Små UI-hjælpere: klassesammensætning, farver, etiketter.

import type { HealthColor, InitiativeStatus, Level } from '../types/domain';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const HEALTH_BG: Record<HealthColor, string> = {
  red: 'bg-health-red',
  yellow: 'bg-health-yellow',
  green: 'bg-health-green',
  none: 'bg-slate-300',
};

export const HEALTH_TEXT: Record<HealthColor, string> = {
  red: 'text-health-red',
  yellow: 'text-health-yellow',
  green: 'text-health-green',
  none: 'text-slate-400',
};

export const HEALTH_SOFT: Record<HealthColor, string> = {
  red: 'bg-health-red/10 text-health-red',
  yellow: 'bg-health-yellow/10 text-[#b76e00]',
  green: 'bg-health-green/10 text-health-green',
  none: 'bg-slate-100 text-slate-500',
};

export const LEVEL_ACCENT: Record<Level, string> = {
  company: 'bg-brand-500',
  tribe: 'bg-violet-500',
  team: 'bg-teal-500',
};

export const LEVEL_SOFT: Record<Level, string> = {
  company: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  tribe: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  team: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
};

export const INITIATIVE_STYLE: Record<InitiativeStatus, { dot: string; soft: string }> = {
  ikke_startet: { dot: 'bg-slate-400', soft: 'bg-slate-100 text-slate-600' },
  i_gang: { dot: 'bg-brand-500', soft: 'bg-brand-50 text-brand-700' },
  færdig: { dot: 'bg-health-green', soft: 'bg-health-green/10 text-health-green' },
  blokeret: { dot: 'bg-health-red', soft: 'bg-health-red/10 text-health-red' },
};

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
