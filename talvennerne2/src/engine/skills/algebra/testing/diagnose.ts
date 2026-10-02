// A simulated child for the diagnostics tests of SK2-ALG (as addsub2.diagnostics.test.ts): tasks from a
// map node's keys for one skill, a kind per answer in turn, and children who keep making one mistake,
// always answer right, or guess. Lives in a subfolder so the registry never imports it.
import { NODE_BY_ID } from '../../../../content/curriculum'
import { keysForNode } from '../../../registry'
import { makeRng } from '../../../rng'
import { PICK_KINDS } from '../../../tasks'
import type { AnswerValue, ErrorTag, SkillId, Task, TaskKind } from '../../../types'

const ctx = { states: {}, audioVerified: true }

/**
 * Task i: a key of the skill on the node (drawn independently of the kind), the kinds in turn. The keys
 * are planned afresh every ten tasks, as a round does: one plan never repeats an instance, so a single
 * plan over hundreds of tasks would run a small family (step100, step25) out of fresh instances.
 */
export function builder(node: string, skill: SkillId, kinds: readonly TaskKind[]) {
  const plan = () => keysForNode(NODE_BY_ID[node], ctx).filter((k) => k.skill === skill)
  let keys = plan()
  if (keys.length === 0) throw new Error(`${skill} is not played on ${node}`)
  const pick = makeRng(77)
  return (i: number): Task => {
    if (i > 0 && i % 10 === 0) keys = plan()
    return keys[pick.int(keys.length)].build(kinds[i % kinds.length], makeRng(1000 + i), i)
  }
}

const asAnswer = (t: Task, key: string): AnswerValue => (typeof t.answer === 'number' ? Number(key) : key)

/** The child gives the value tagged `tag` whenever the task has one it can give (a card shown, or typed). */
export const always = (tag: ErrorTag) => (t: Task): AnswerValue => {
  const hit = Object.entries(t.distractorTags).find(([k, x]) => x === tag && (!PICK_KINDS.has(t.kind) || t.options.map(String).includes(k)))
  return hit ? asAnswer(t, hit[0]) : t.answer
}

export const right = (t: Task): AnswerValue => t.answer

/** Taps a random card, types a random number in range, fills the slots at random. */
export function guesser(seed: number) {
  const rng = makeRng(seed)
  return (t: Task): AnswerValue => {
    if (PICK_KINDS.has(t.kind)) return rng.pick(t.options)
    if (t.kind === 'fillSlots') return String(t.answer).split('|').map(() => rng.pick(t.options)).join('|')
    return rng.between(t.range[0], t.range[1])
  }
}
