// ============================================================
// Domænemodel for OKR-systemet.
//
// Tre klart adskilte objekttyper håndhæves bevidst:
//   Objective   = retning (kvalitativt, inspirerende)        — HVOR vil vi hen?
//   Key Result  = udfald (målbart resultat, ikke en opgave)  — HVORDAN ved vi det?
//   Initiativ   = arbejdet der driver et KR                   — HVAD gør vi?
//
// Skellet mellem KR (udfald) og initiativ (arbejde) er centralt for
// god OKR-praksis og afspejles i både typer og UI.
// ============================================================

/** Organisatorisk niveau. Hierarki: company → tribe → team. */
export type Level = 'company' | 'tribe' | 'team';

export const LEVELS: Level[] = ['company', 'tribe', 'team'];

export const LEVEL_LABEL: Record<Level, string> = {
  company: 'Virksomhed',
  tribe: 'Tribe',
  team: 'Team',
};

export type ObjectiveStatus = 'on_track' | 'at_risk' | 'off_track' | 'done';

/** Hvordan et Key Result måles. */
export type MetricType = 'number' | 'percent' | 'currency' | 'boolean';

/**
 * committed   = forventes leveret 100 %. Grøn betyder ~1.0.
 * aspirational = strækmål. 0.7 er allerede et rigtig godt resultat.
 */
export type KrType = 'committed' | 'aspirational';

export type InitiativeStatus = 'ikke_startet' | 'i_gang' | 'færdig' | 'blokeret';

export const INITIATIVE_STATUS_LABEL: Record<InitiativeStatus, string> = {
  ikke_startet: 'Ikke startet',
  i_gang: 'I gang',
  færdig: 'Færdig',
  blokeret: 'Blokeret',
};

/** Kvartalscyklus — giver systemet sin rytme. */
export interface Cycle {
  id: string;
  name: string; // fx "Q2 2026"
  startDate: string; // ISO
  endDate: string; // ISO
  isActive: boolean;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  owner: string;
  level: Level;
  /** Direkte forælder-objective (klassisk træstruktur). Valgfri. */
  parentObjectiveId?: string;
  cycleId: string;
  status: ObjectiveStatus;
  /** Sortering inden for samme forælder/niveau. */
  order: number;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  owner: string;
  metricType: MetricType;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  type: KrType;
  order: number;
}

export interface Initiative {
  id: string;
  keyResultId: string;
  title: string;
  status: InitiativeStatus;
  owner: string;
  dueDate?: string; // ISO
  order: number;
}

export interface CheckIn {
  id: string;
  keyResultId: string;
  date: string; // ISO
  value: number;
  /** 0.0–1.0. Driver rød/gul/grøn-sundhed. */
  confidence: number;
  comment: string;
  author: string;
}

/**
 * Alignment-kobling (mange-til-mange).
 *
 * Et bidragende KR (typisk på team-niveau) peger op mod et parent-KR.
 * Dette er kernen i alignment-modellen: ikke en stiv 1:1-cascade, men et
 * netværk hvor flere child-KR'er kan bidrage til samme parent-KR, og hvor
 * ét child-KR kan bidrage til flere parents.
 *
 * weight bruges til vægtet auto-rollup af fremdrift.
 */
export interface AlignmentLink {
  id: string;
  childKrId: string;
  parentKrId: string;
  weight: number; // relativ vægt i rollup (default 1)
}

// ---- Afledte view-modeller (beregnes, gemmes ikke) ----

export type HealthColor = 'red' | 'yellow' | 'green' | 'none';

export interface KrComputed {
  /** 0–1: fremdrift mod target ud fra current (baseline→target). */
  progress: number;
  /** Seneste confidence (0–1) eller undefined hvis aldrig checket ind. */
  confidence?: number;
  health: HealthColor;
  lastCheckIn?: CheckIn;
  /** Fremdrift inkl. auto-rollup fra bidragende child-KR'er, hvis nogen. */
  rolledUpProgress: number;
  hasContributors: boolean;
  /** Antal dage siden seneste check-in (undefined hvis aldrig). */
  daysSinceCheckIn?: number;
  needsCheckIn: boolean;
}
