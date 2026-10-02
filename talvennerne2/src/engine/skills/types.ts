// SkillDef contract (SPEC §2.4). The definitions live in src/engine/types.ts; this module is the
// documented import path for skill authors.
import type { AnswerType, AnswerValue, Candidate, ClipId, Fact, Rng, SkillDef, TaskKind } from '../types'

export type {
  AnswerType,
  AnswerValue,
  Candidate,
  ErrorTag,
  Fact,
  FactData,
  FamilyDef,
  HintSpec,
  HintVisual,
  OptionView,
  Prompt,
  Rng,
  SkillDef,
  SkillId,
  SpeechPart,
  TaskKind,
} from '../types'

/**
 * Optional hooks a skill module may add on top of the frozen SkillDef contract. The engine
 * (src/engine/tasks.ts) reads them when present and otherwise falls back to the default noted on
 * each hook, so a skill only implements what its tasks actually need. Export a skill as
 * `export default { … } satisfies SkillModule`.
 */
export interface SkillExtras {
  /**
   * The answer when it depends on the presentation — "which is heavier?" (a token) and "tap all
   * that are heavier than the teddy" (a set) can be the same fact. Default: `fact.answer`.
   */
  answer?(fact: Fact, kind: TaskKind): AnswerValue
  /** Answer type for that presentation. Default: `def.answerType(fact)`. */
  answerTypeFor?(fact: Fact, kind: TaskKind): AnswerType
  /**
   * Every option for kinds whose options are not "answer + distractors": multiSelect items,
   * sortOrder cards and the fillSlots palette. Default: sortOrder shuffles the answer's parts,
   * multiSelect uses the prompt's items or `fact.data.options`, fillSlots uses `fact.data.palette`
   * (see tasks.ts).
   */
  options?(fact: Fact, kind: TaskKind, rng: Rng): AnswerValue[]
  /** Equivalent answers ('frac:2/4' when 'frac:1/2' is coloured on a 4-part shape). Default []. */
  accept?(fact: Fact, kind: TaskKind): AnswerValue[]
  /** Number-line tolerance. Default: 5 % of the line's span, kept at production level (tasks.ts). */
  tolerance?(fact: Fact, kind: TaskKind): number
  /** Keypad suffix for int answers ('cm', 'm', 'kr'). Default null; øre answers always get 'kr'. */
  unit?(fact: Fact, kind: TaskKind): 'kr' | 'cm' | 'm' | null
  /** Clip that reads an option card aloud (unitWord/relation/token views). Default: defaultOptionClip(). */
  optionClip?(fact: Fact, value: AnswerValue): ClipId
  /**
   * Perceptual misconceptions are only concluded from contrast (SPEC §4.3). Default: `fact.data.contrast`
   * when it is 'conflict' or 'congruent'.
   */
  contrast?(fact: Fact): 'conflict' | 'congruent' | undefined
  /**
   * The guess probability the prompt leaves, when it names the possible answers (Task.guessFloor).
   * Default 0: guessP follows from the kind alone.
   */
  guessFloor?(fact: Fact, kind: TaskKind): number
  /**
   * Tagged wrong answers for that presentation, when they depend on it as the answer does: "Byg kun
   * tierne i 47" is answered 40 with blocks and "Hvor mange tiere …?" 4 on cards, so 7 is the other
   * digit (digitSwap) on a card but seven cubes (plain) when built. Default: `def.candidates(fact)`.
   */
  candidatesFor?(fact: Fact, kind: TaskKind): Candidate[]
}

/** What a file in src/engine/skills/<domain>/<skillId>.ts default-exports. */
export type SkillModule = SkillDef & SkillExtras

/** Read the optional hooks of a registered SkillDef. */
export const extrasOf = (def: SkillDef): SkillExtras => def as SkillDef & SkillExtras
