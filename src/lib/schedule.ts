// Pure scheduling core. No React, no DOM — fully unit-testable.
//
// The whole plan is derived by walking BACKWARD from the target finish time.
// Each milestone has a "gap before" = the duration of the phase that leads
// into it. time(i) = finishAt − Σ(gap[j] for j > i).

import { formatColdProof, formatDayTimeAbsolute } from './format';

export type Temp = 'cool' | 'normal' | 'warm';
export type ColdProof = 8 | 12 | 16;
export type Size = 'small' | 'large';

export type MilestoneId =
  | 'feed'
  | 'mix'
  | 'salt'
  | 'fold1'
  | 'fold2'
  | 'fold3'
  | 'fold4'
  | 'shape'
  | 'fridge'
  | 'preheat'
  | 'bake'
  | 'cool'
  | 'done';

export interface PlanInput {
  /** Target finish time as epoch ms. Manual delays bump this forward. */
  finishAt: number;
  /** Single kitchen-temperature choice; drives activation + first rise. */
  temp: Temp;
  coldProofHours: ColdProof;
  /** If true, the starter is already active: drop feed + the activation wait. */
  hasActiveStarter: boolean;
  size: Size;
  /** Manual "not ready yet" pushes, in minutes, added to that step's gap. */
  delays: Partial<Record<MilestoneId, number>>;
}

export interface Milestone {
  id: MilestoneId;
  icon: string;
  title: string;
  description: string;
  /** Optional readiness guidance (shown on the two biological wait steps). */
  note?: string;
  /** Epoch ms at which this step happens. */
  at: number;
  /** Whether the "not ready yet" delay control applies to this step. */
  canDelay: boolean;
  /** Effective minutes of the phase leading into this step (incl. delay). */
  gapBeforeMin: number;
}

export interface Recipe {
  starter: number;
  water: number;
  flour: number;
  salt: number;
}

export const RECIPES: Record<Size, Recipe> = {
  small: { starter: 50, water: 175, flour: 250, salt: 5 },
  large: { starter: 100, water: 350, flour: 500, salt: 10 },
};

/** Starter-activation duration after feeding (minutes). */
const ACTIVATION: Record<Temp, number> = { cool: 8 * 60, normal: 6 * 60, warm: 4 * 60 };
/** First (bulk) rise after the folds (minutes). */
const FIRST_RISE: Record<Temp, number> = { cool: 4 * 60, normal: 3 * 60, warm: 2 * 60 };

export const TEMP_LABELS: Record<Temp, string> = {
  cool: 'Køligt · 18–20 °C',
  normal: 'Normalt · 21–23 °C',
  warm: 'Varmt · 24–26 °C',
};

export const SIZE_LABELS: Record<Size, string> = {
  small: 'Lille brød',
  large: 'Stort brød',
};

const ACTIVATION_NOTE =
  'Surdejen er klar, når den er tydeligt boblende, luftig og cirka fordoblet i størrelse.';
const FIRST_RISE_NOTE =
  'Gå mere efter dejen end efter uret. Dejen er klar, når den er vokset cirka 50–75 %, ' +
  'føles luftig og har små bobler langs kanten.';

interface MilestoneMeta {
  icon: string;
  title: string;
  description: string;
  note?: string;
}

const META: Record<MilestoneId, MilestoneMeta> = {
  feed: {
    icon: '🫙',
    title: 'Fodr surdejen',
    description:
      'Rør din surdej op med frisk mel og vand. Lad den stå lunt, til den er luftig og boblende.',
  },
  mix: {
    icon: '🥣',
    title: 'Bland dejen',
    description: 'Bland aktiv surdej, vand og mel. Rør, til der ikke er tørt mel tilbage.',
    note: ACTIVATION_NOTE,
  },
  salt: {
    icon: '🧂',
    title: 'Tilsæt salt',
    description: 'Ælt saltet — og en lille skvæt vand — grundigt ind i dejen.',
  },
  fold1: {
    icon: '🤲',
    title: 'Fold dejen – gang 1',
    description: 'Tag fat under dejen, stræk den op, og fold den ind over sig selv hele vejen rundt.',
  },
  fold2: { icon: '🤲', title: 'Fold dejen – gang 2', description: 'Stræk og fold dejen rundt igen.' },
  fold3: { icon: '🤲', title: 'Fold dejen – gang 3', description: 'Stræk og fold dejen rundt igen.' },
  fold4: {
    icon: '🤲',
    title: 'Fold dejen – gang 4',
    description: 'Sidste foldning. Dejen skal føles glattere og mere spændstig nu.',
  },
  shape: {
    icon: '🥖',
    title: 'Form brødet',
    description: 'Hæld dejen ud, stram den op til en fin kugle, og læg den i en meldrysset hævekurv.',
    note: FIRST_RISE_NOTE,
  },
  fridge: {
    icon: '❄️',
    title: 'Sæt brødet i køleskabet',
    description: 'Dæk hævekurven til, og stil dejen koldt til langsom koldhævning.',
  },
  preheat: {
    icon: '🔥',
    title: 'Varm ovnen op',
    description:
      'Varm ovnen grundigt op til 250 °C. Sæt en bagesten eller en bageplade midt i ovnen, ' +
      'og stil en tom bradepande i bunden — den skal bruges til damp.',
  },
  bake: {
    icon: '🍞',
    title: 'Bag brødet',
    description:
      'Sæt brødet på den varme sten, og snit toppen. Hæld straks en kop kogende vand i den ' +
      'varme bradepande for damp, og luk ovnen. Bag med damp de første ca. 20 min, tag så ' +
      'bradepanden ud, og bag færdig, til skorpen er gylden og sprød.',
  },
  cool: {
    icon: '⏳',
    title: 'Lad brødet køle af',
    description: 'Lad brødet køle helt af på en rist, før du skærer i det — ellers bliver krummen klæg.',
  },
  done: {
    icon: '✅',
    title: 'Brødet er klar',
    description: 'Skær for, og nyd dit hjemmebagte surdejsbrød.',
  },
};

/** Ordered (forward) list of steps with their base gap-before in minutes. */
interface Segment {
  id: MilestoneId;
  baseGap: number;
  canDelay: boolean;
}

function segments(input: PlanInput, coldProofMin?: number): Segment[] {
  const activation = ACTIVATION[input.temp];
  const firstRise = FIRST_RISE[input.temp];
  const coldProof = coldProofMin ?? input.coldProofHours * 60;

  const segs: Segment[] = [];
  if (!input.hasActiveStarter) {
    segs.push({ id: 'feed', baseGap: 0, canDelay: false });
    segs.push({ id: 'mix', baseGap: activation, canDelay: true });
  } else {
    // Active starter: mix is the very first action, no activation wait.
    segs.push({ id: 'mix', baseGap: 0, canDelay: false });
  }
  segs.push({ id: 'salt', baseGap: 30, canDelay: false });
  segs.push({ id: 'fold1', baseGap: 30, canDelay: false });
  segs.push({ id: 'fold2', baseGap: 30, canDelay: false });
  segs.push({ id: 'fold3', baseGap: 30, canDelay: false });
  segs.push({ id: 'fold4', baseGap: 30, canDelay: false });
  segs.push({ id: 'shape', baseGap: firstRise, canDelay: true });
  segs.push({ id: 'fridge', baseGap: 15, canDelay: false });
  segs.push({ id: 'preheat', baseGap: coldProof, canDelay: false });
  segs.push({ id: 'bake', baseGap: 45, canDelay: false });
  segs.push({ id: 'cool', baseGap: 45, canDelay: false });
  segs.push({ id: 'done', baseGap: 60, canDelay: false });
  return segs;
}

/**
 * Compute the full schedule, backward from the finish time.
 * Pure: same input → same output. Times are epoch ms (DST-correct).
 *
 * `override` lets the night post-processor re-anchor (a snapped finish) or
 * re-time the cold proof without duplicating the geometry. With no override
 * the result is byte-identical to the plain backward schedule.
 */
export function computeSchedule(
  input: PlanInput,
  override?: { finishAt?: number; coldProofMin?: number },
): Milestone[] {
  const segs = segments(input, override?.coldProofMin);
  const gaps = segs.map((s) => s.baseGap + (input.delays[s.id] ?? 0));
  const finishAt = override?.finishAt ?? input.finishAt;

  const out: Milestone[] = new Array(segs.length);
  let suffixMin = 0; // Σ of gaps strictly after the current index
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i];
    const meta = META[seg.id];
    out[i] = {
      id: seg.id,
      icon: meta.icon,
      title: meta.title,
      description: meta.description,
      note: meta.note,
      at: finishAt - suffixMin * 60000,
      canDelay: seg.canDelay,
      gapBeforeMin: gaps[i],
    };
    suffixMin += gaps[i];
  }
  return out;
}

/** Total minutes from the first step to finish, for the given input. */
export function totalMinutes(input: PlanInput): number {
  return segments(input).reduce((sum, s) => sum + s.baseGap + (input.delays[s.id] ?? 0), 0);
}

// ============================================================
//  Night avoidance
//  No milestone requiring human involvement may land in the local
//  window [23:00, 06:00). The elastic lever is the cold proof
//  (fridge→preheat): it repositions the whole evening/active cluster.
//  The morning cluster (preheat/bake/cool) is pinned to the finish and
//  cannot be moved by the cold proof — an early-morning/night finish is
//  therefore structurally infeasible.
// ============================================================

const MIN = 60000;
const NIGHT_START = 23 * 60; // minutes-of-day
const NIGHT_END = 6 * 60;
const CP_MIN = 6 * 60; // never schedule less than 6 h cold proof
const CP_MAX = 24 * 60; // never more than 24 h
const TRIM_CAP = 2 * 60; // may shorten the user's cold proof by at most 2 h

/** Steps that need a person present — everything except the endpoint `done`. */
const HUMAN_IDS: MilestoneId[] = [
  'feed', 'mix', 'salt', 'fold1', 'fold2', 'fold3', 'fold4', 'shape', 'fridge', 'preheat', 'bake', 'cool',
];

const minutesOfDay = (at: number): number => {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
};

/** True if the instant falls in [23:00, 06:00) local time. */
const inNight = (at: number): boolean => {
  const m = minutesOfDay(at);
  return m >= NIGHT_START || m < NIGHT_END;
};

/** Epoch ms for h:m on the local calendar day containing `ref`. DST-safe. */
const atLocal = (ref: number, h: number, m: number): number => {
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

const dayShift = (at: number, days: number): number => {
  const d = new Date(at);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

const sameLocalDay = (a: number, b: number): boolean => atLocal(a, 0, 0) === atLocal(b, 0, 0);

/**
 * The contiguous evening cluster ends at `fridge` and starts `dMin` earlier.
 * Since it is < 17 h long, it is night-free iff both ends are daytime and on
 * the same calendar day (then the whole span sits inside [06:00, 23:00)).
 */
const blockNightFree = (fridge: number, dMin: number): boolean => {
  const head = fridge - dMin * MIN;
  return !inNight(fridge) && !inNight(head) && sameLocalDay(fridge, head);
};

/**
 * Choose the cold-proof length (minutes) that keeps the evening cluster out of
 * the night. Prefer a small trim (≤ 2 h); otherwise extend so the cluster ends
 * at 22:59 the day before the offending night. Clamped to [6 h, 24 h].
 */
function chooseColdProof(preheatAt: number, dMin: number, cp0Min: number): number {
  const fridge0 = preheatAt - cp0Min * MIN;
  if (blockNightFree(fridge0, dMin)) return cp0Min;

  // (a) Small trim: slide the cluster later so its head sits at 06:00.
  const fridgeTrim = atLocal(fridge0, 6, 0) + dMin * MIN;
  const cpTrim = Math.round((preheatAt - fridgeTrim) / MIN);
  if (
    blockNightFree(fridgeTrim, dMin) &&
    cpTrim >= CP_MIN &&
    cp0Min - cpTrim > 0 &&
    cp0Min - cpTrim <= TRIM_CAP
  ) {
    return cpTrim;
  }

  // (b) Extend: fridge → 22:59 of the latest earlier day that clears the night.
  for (const off of [0, -1, -2]) {
    const fridgeExt = atLocal(dayShift(fridge0, off), 22, 59);
    if (fridgeExt <= fridge0 && blockNightFree(fridgeExt, dMin)) {
      const cpExt = Math.round((preheatAt - fridgeExt) / MIN);
      if (cpExt <= CP_MAX) return cpExt;
      break;
    }
  }

  // (c) Best effort within caps — a night step may remain (caller warns).
  const fallback = Math.round((preheatAt - atLocal(dayShift(fridge0, -1), 22, 59)) / MIN);
  return Math.max(CP_MIN, Math.min(CP_MAX, fallback));
}

export interface NightPolicy {
  avoidNight: boolean;
  coldProof: 'adjust' | 'keep';
  finish: 'snap' | 'keep';
}

export interface NightAdjustment {
  applied: boolean;
  targetColdProofMin: number;
  effectiveColdProofMin: number;
  coldProofChanged: boolean;
  finishNudgedTo: number | null;
  status: 'ok' | 'adjusted' | 'nightUnavoidable';
  nightSteps: MilestoneId[];
  note: string | null;
}

export interface SafeSchedule {
  milestones: Milestone[];
  adjustment: NightAdjustment;
}

const DEFAULT_NIGHT_POLICY: NightPolicy = { avoidNight: true, coldProof: 'adjust', finish: 'keep' };

const atOf = (ms: Milestone[], id: MilestoneId): number => ms.find((m) => m.id === id)!.at;

function buildNote(a: {
  status: NightAdjustment['status'];
  effectiveColdProofMin: number;
  targetColdProofMin: number;
  coldProofChanged: boolean;
  finishNudgedTo: number | null;
}): string | null {
  if (a.status === 'nightUnavoidable') {
    return 'Nogle trin falder mellem kl. 23 og 06 og kan ikke undgås med dit valgte færdig-tidspunkt — prøv et senere tidspunkt.';
  }
  const parts: string[] = [];
  if (a.finishNudgedTo !== null) {
    parts.push(
      `Færdig-tidspunktet er rykket til ${formatDayTimeAbsolute(a.finishNudgedTo)}, så bagningen ikke sker om natten.`,
    );
  }
  if (a.coldProofChanged) {
    const verb = a.effectiveColdProofMin > a.targetColdProofMin ? 'forlænget' : 'forkortet';
    parts.push(
      `Koldhævningen er ${verb} til ${formatColdProof(a.effectiveColdProofMin)} ` +
        `(du valgte ${a.targetColdProofMin / 60} t), så ingen trin falder mellem kl. 23 og 06.`,
    );
  }
  return parts.length ? parts.join(' ') : null;
}

/**
 * Compute the schedule and, unless disabled, adjust it so no human step lands
 * in the night. Pure over `input`, so it re-runs automatically whenever the
 * input changes (manual delays, finish edits) via the caller's memo.
 */
export function computeScheduleSafe(input: PlanInput, policyIn?: Partial<NightPolicy>): SafeSchedule {
  const policy = { ...DEFAULT_NIGHT_POLICY, ...policyIn };
  const cp0 = input.coldProofHours * 60;

  if (!policy.avoidNight) {
    return {
      milestones: computeSchedule(input),
      adjustment: {
        applied: false,
        targetColdProofMin: cp0,
        effectiveColdProofMin: cp0,
        coldProofChanged: false,
        finishNudgedTo: null,
        status: 'ok',
        nightSteps: [],
        note: null,
      },
    };
  }

  // (B) Finish feasibility — the morning cluster is pinned to the finish.
  let finishAt = input.finishAt;
  let finishNudgedTo: number | null = null;
  const morningBad = [150, 105, 60].some((gap) => inNight(finishAt - gap * MIN));
  if (morningBad && policy.finish === 'snap') {
    finishAt = atLocal(input.finishAt, 8, 30); // preheat → 06:00
    finishNudgedTo = finishAt;
  }

  // (A) Evening cluster — pick the effective cold proof.
  const firstId: MilestoneId = input.hasActiveStarter ? 'mix' : 'feed';
  const base = computeSchedule(input, { finishAt });
  const preheatAt = atOf(base, 'preheat');
  const dMin = (atOf(base, 'fridge') - atOf(base, firstId)) / MIN;
  const effectiveColdProofMin = policy.coldProof === 'adjust' ? chooseColdProof(preheatAt, dMin, cp0) : cp0;

  // Final schedule + residual-night audit.
  const milestones = computeSchedule(input, { finishAt, coldProofMin: effectiveColdProofMin });
  const present = new Set(milestones.map((m) => m.id));
  const nightSteps = HUMAN_IDS.filter((id) => present.has(id) && inNight(atOf(milestones, id)));

  const coldProofChanged = effectiveColdProofMin !== cp0;
  const status: NightAdjustment['status'] = nightSteps.length
    ? 'nightUnavoidable'
    : coldProofChanged || finishNudgedTo !== null
      ? 'adjusted'
      : 'ok';

  return {
    milestones,
    adjustment: {
      applied: true,
      targetColdProofMin: cp0,
      effectiveColdProofMin,
      coldProofChanged,
      finishNudgedTo,
      status,
      nightSteps,
      note: buildNote({ status, effectiveColdProofMin, targetColdProofMin: cp0, coldProofChanged, finishNudgedTo }),
    },
  };
}
