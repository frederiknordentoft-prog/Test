/** A family of related number facts. One island practises one or a few skills. */
export type SkillId =
  | 'count'       // how many things are there? (1–10)
  | 'neighbour'   // one more / one less
  | 'addTo10'
  | 'subTo10'
  | 'tenFriends'  // what pairs with a to make 10
  | 'doubles'
  | 'halves'
  | 'addTo20'     // crossing the ten: 8 + 5
  | 'subTo20'     // crossing back: 13 − 5
  | 'tensAndOnes' // 4 tens and 3 ones = 43
  | 'addTo100'
  | 'subTo100'

/** How a fact is presented to the child. */
export type TaskKind =
  | 'choice'     // three big answer buttons
  | 'keypad'     // type the answer on a 0–9 pad
  | 'count'      // tap the right number of things
  | 'pair'       // drag two bubbles together
  | 'numberline' // place the number on a line

/**
 * One atomic thing to know, e.g. "3 + 4". Facts are enumerable per skill, which
 * is what makes exhaustive correctness tests possible.
 */
export interface Fact {
  id: string
  skill: SkillId
  a: number
  b: number
  answer: number
  /** 0 = easiest. Drives cold-start ordering for a child who has never played. */
  rank: number
}

/** A fact turned into something on screen. One occurrence, one id. */
export interface Task {
  id: string
  factId: string
  skill: SkillId
  kind: TaskKind
  a: number
  b: number
  op: '+' | '−' | null
  answer: number
  /** answer buttons for 'choice', bubble values for 'pair'; empty otherwise */
  options: number[]
  /** bounds for 'numberline'; also the ceiling for 'count' */
  range: [number, number]
  /** Danish sentence read aloud for children who cannot read yet */
  speech: string
}

/** What the app remembers about one fact for one child. */
export interface FactState {
  /** Leitner box, 0 = brand new / just missed, 5 = solid */
  box: number
  seen: number
  correct: number
  /** index of the round this fact was last shown in */
  lastRound: number
  /** rolling average answer time in ms */
  avgMs: number
}

export type FactStates = Record<string, FactState>
