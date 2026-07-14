// Pure scheduling core. No React, no DOM — fully unit-testable.
//
// The whole plan is derived by walking BACKWARD from the target finish time.
// Each milestone has a "gap before" = the duration of the phase that leads
// into it. time(i) = finishAt − Σ(gap[j] for j > i).

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
    title: 'Tænd ovnen og varm gryden op',
    description: 'Varm ovn og støbejernsgryde grundigt op — gerne 250 °C med låg på.',
  },
  bake: {
    icon: '🍞',
    title: 'Bag brødet',
    description: 'Vend dejen i den varme gryde, snit toppen, og bag med låg. Tag låget af undervejs for sprød skorpe.',
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

function segments(input: PlanInput): Segment[] {
  const activation = ACTIVATION[input.temp];
  const firstRise = FIRST_RISE[input.temp];
  const coldProof = input.coldProofHours * 60;

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
 * Compute the full schedule, backward from `input.finishAt`.
 * Pure: same input → same output. Times are epoch ms (DST-correct).
 */
export function computeSchedule(input: PlanInput): Milestone[] {
  const segs = segments(input);
  const gaps = segs.map((s) => s.baseGap + (input.delays[s.id] ?? 0));

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
      at: input.finishAt - suffixMin * 60000,
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
