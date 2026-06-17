// ============================================================
// OKR-beregninger: fremdrift, confidence-sundhed og auto-rollup.
//
// Disse funktioner er rene (ingen side-effekter) så de kan bruges både i
// store, dashboards og tests.
// ============================================================

import { differenceInCalendarDays } from 'date-fns';
import type {
  AlignmentLink,
  CheckIn,
  HealthColor,
  KeyResult,
  KrComputed,
  KrType,
} from '../types/domain';

/** Antal dage uden check-in før et KR markeres som "mangler check-in". */
export const CHECKIN_STALE_DAYS = 7;

/** Bløde grænser (advarer, blokerer ikke). */
export const SOFT_LIMITS = {
  objectivesPerLevel: 5,
  krsPerObjective: 4,
};

/**
 * Rå fremdrift 0–1 ud fra baseline → target → current.
 * Håndterer både stigende (target > baseline) og faldende mål
 * (fx "reducér churn fra 8% til 3%").
 */
export function rawProgress(kr: Pick<KeyResult, 'baseline' | 'target' | 'current' | 'metricType'>): number {
  if (kr.metricType === 'boolean') {
    return kr.current >= 1 ? 1 : 0;
  }
  const span = kr.target - kr.baseline;
  if (span === 0) return kr.current >= kr.target ? 1 : 0;
  const p = (kr.current - kr.baseline) / span;
  return clamp01(p);
}

/**
 * Confidence → sundhedsfarve.
 * Tærsklerne justeres for aspirational, hvor 0.7 allerede er "godt".
 *   committed:    <0.5 rød · 0.5–0.8 gul · >0.8 grøn
 *   aspirational: <0.4 rød · 0.4–0.7 gul · >0.7 grøn
 */
export function confidenceHealth(confidence: number | undefined, type: KrType): HealthColor {
  if (confidence === undefined) return 'none';
  if (type === 'aspirational') {
    if (confidence < 0.4) return 'red';
    if (confidence <= 0.7) return 'yellow';
    return 'green';
  }
  if (confidence < 0.5) return 'red';
  if (confidence <= 0.8) return 'yellow';
  return 'green';
}

export const HEALTH_LABEL: Record<HealthColor, string> = {
  red: 'Kritisk',
  yellow: 'Risiko',
  green: 'På sporet',
  none: 'Mangler check-in',
};

export const HEALTH_HEX: Record<HealthColor, string> = {
  red: '#e5484d',
  yellow: '#ffcb05',
  green: '#00a651',
  none: '#94a3b8',
};

/** Seneste check-in for et KR (eller undefined). */
export function latestCheckIn(checkIns: CheckIn[]): CheckIn | undefined {
  if (checkIns.length === 0) return undefined;
  return checkIns.reduce((a, b) => (a.date >= b.date ? a : b));
}

/**
 * Auto-rollup: hvis et KR har bidragende child-KR'er, beregnes fremdriften
 * som et vægtet gennemsnit af childrens (rolled-up) fremdrift. Ellers bruges
 * KR'ets egen rå fremdrift. Rekursivt så fremdrift forplanter sig hele vejen
 * fra team-niveau op til company-niveau.
 */
export function computeRolledUpProgress(
  krId: string,
  krMap: Map<string, KeyResult>,
  linksByParent: Map<string, AlignmentLink[]>,
  checkInsByKr: Map<string, CheckIn[]>,
  visited: Set<string> = new Set(),
): number {
  if (visited.has(krId)) return 0; // beskyt mod cykliske koblinger
  visited.add(krId);

  const kr = krMap.get(krId);
  if (!kr) return 0;

  const childLinks = linksByParent.get(krId) ?? [];
  if (childLinks.length === 0) {
    return rawProgress(kr);
  }

  let weightSum = 0;
  let weighted = 0;
  for (const link of childLinks) {
    const w = link.weight > 0 ? link.weight : 1;
    weightSum += w;
    weighted += w * computeRolledUpProgress(link.childKrId, krMap, linksByParent, checkInsByKr, new Set(visited));
  }
  return weightSum === 0 ? rawProgress(kr) : clamp01(weighted / weightSum);
}

/** Saml alle afledte view-værdier for ét KR. */
export function computeKr(
  kr: KeyResult,
  checkInsByKr: Map<string, CheckIn[]>,
  krMap: Map<string, KeyResult>,
  linksByParent: Map<string, AlignmentLink[]>,
  now: Date = new Date(),
): KrComputed {
  const checkIns = checkInsByKr.get(kr.id) ?? [];
  const last = latestCheckIn(checkIns);
  const confidence = last?.confidence;
  const health = confidenceHealth(confidence, kr.type);
  const childLinks = linksByParent.get(kr.id) ?? [];
  const hasContributors = childLinks.length > 0;
  const rolledUpProgress = computeRolledUpProgress(kr.id, krMap, linksByParent, checkInsByKr);

  const daysSinceCheckIn = last ? differenceInCalendarDays(now, new Date(last.date)) : undefined;
  const needsCheckIn = daysSinceCheckIn === undefined || daysSinceCheckIn >= CHECKIN_STALE_DAYS;

  return {
    progress: rawProgress(kr),
    confidence,
    health,
    lastCheckIn: last,
    rolledUpProgress,
    hasContributors,
    daysSinceCheckIn,
    needsCheckIn,
  };
}

/** Formatér en metrikværdi pænt til visning. */
export function formatMetric(value: number, kr: Pick<KeyResult, 'metricType' | 'unit'>): string {
  switch (kr.metricType) {
    case 'percent':
      return `${round(value)} %`;
    case 'currency':
      return `${formatThousands(Math.round(value))} ${kr.unit || 'kr.'}`;
    case 'boolean':
      return value >= 1 ? 'Ja' : 'Nej';
    default:
      return `${formatThousands(round(value))}${kr.unit ? ' ' + kr.unit : ''}`;
  }
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatThousands(n: number): string {
  return n.toLocaleString('da-DK');
}

/** Gennemsnit af 0..1-værdier (0 hvis tom). */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const HEALTH_RANK: Record<HealthColor, number> = { red: 0, none: 1, yellow: 2, green: 3 };

/** Værste (mest alarmerende) sundhed i en gruppe. */
export function worstHealth(healths: HealthColor[]): HealthColor {
  if (healths.length === 0) return 'none';
  return healths.reduce((a, b) => (HEALTH_RANK[b] < HEALTH_RANK[a] ? b : a));
}

/** Nudge: simpel heuristik der advarer hvis et KR-titel ligner et initiativ. */
export function looksLikeInitiative(title: string): boolean {
  const t = title.toLowerCase().trim();
  const verbs = [
    'lancér',
    'lancer',
    'byg',
    'implementér',
    'implementer',
    'opret',
    'lav',
    'udvikl',
    'design',
    'migrer',
    'flyt',
    'skriv',
    'tilføj',
    'opsæt',
    'integrer',
    'rul ud',
  ];
  return verbs.some((v) => t.startsWith(v));
}
