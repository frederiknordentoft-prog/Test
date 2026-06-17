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

// Fyldt sundhedsfarve (til score-badges som "96").
export const HEALTH_SOLID: Record<HealthColor, string> = {
  red: 'bg-health-red text-white',
  yellow: 'bg-health-yellow text-ink',
  green: 'bg-health-green text-white',
  none: 'bg-slate-300 text-ink-soft',
};

// Niveau-hierarki i brandets palet: grøn (top) → guld (midt) → grå-grøn (bund).
export const LEVEL_ACCENT: Record<Level, string> = {
  company: 'bg-brand-600',
  tribe: 'bg-accent-500',
  team: 'bg-slate-400',
};

export const LEVEL_SOFT: Record<Level, string> = {
  company: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  tribe: 'bg-accent-50 text-accent-800 ring-1 ring-accent-300',
  team: 'bg-slate-100 text-ink-soft ring-1 ring-slate-300',
};

// Svag flade-tone til niveau-headere (instant genkendelse).
export const LEVEL_TINT: Record<Level, string> = {
  company: 'bg-brand-50/60',
  tribe: 'bg-accent-50/60',
  team: 'bg-slate-50',
};

// Ikon-flise pr. niveau.
export const LEVEL_ICONBG: Record<Level, string> = {
  company: 'bg-brand-100 text-brand-700',
  tribe: 'bg-accent-100 text-accent-800',
  team: 'bg-slate-200 text-ink-soft',
};

// Forbindelseslinje (connector) farvet efter forælderens niveau.
export const LEVEL_BORDER: Record<Level, string> = {
  company: 'border-brand-300',
  tribe: 'border-accent-300',
  team: 'border-slate-300',
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
