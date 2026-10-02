// coinNames — Mønter og sedler (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 10 facts, prefix `mnt:`.
//   coins   mnt:<øre>   50 øre, 1, 2, 5, 10 and 20 kroner                                   6
//   notes   mnt:<øre>   50, 100, 200 and 500 kroner (play notes)                            4
// choice: "Tryk på femkronen." Three pieces of the fact's own family as cards (numbers in øre,
//   optionView 'coin'); the prompt is only the spoken sentence ({ scene: 'hear' }).
// multiSelect (production): "Tryk på alle femkroner." Seven pieces of the family, two or three of them
//   the asked one; every card is its own token (`c500`, `c0500`, `c00500`: see money/kit.ts).
// Wrong pieces have no misconception in the catalogue: the look-alikes (1, 2 and 5 kroner are silver
// with a hole, 10 and 20 kroner gold, notes next to each other) are 'near', the rest 'other'. A
// multiSelect that misses one of the asked pieces, or takes a look-alike too, is 'near'.
import type { AnswerValue, Fact, HintSpec, Rng, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, say, tagged, type Entry } from '../number/kit'
import { COINS, NOTES, coinSays, isCoin, moneySays, pieceToken } from './kit'

const meta = metaOf('coinNames')

type Family = 'coins' | 'notes'

/** Introduction order: the everyday coins first, 50 øre last; then the notes from the smallest. */
const ORDER: readonly (readonly [Family, number])[] = [
  ['coins', 100], ['coins', 200], ['coins', 500], ['coins', 1000], ['coins', 2000], ['coins', 50],
  ['notes', 5000], ['notes', 10000], ['notes', 20000], ['notes', 50000],
]

/** Pieces a child takes for one another. */
const LOOKALIKES: Readonly<Record<number, readonly number[]>> = {
  50: [100],
  100: [200, 50],
  200: [100, 500],
  500: [200],
  1000: [2000],
  2000: [1000],
  5000: [10000],
  10000: [5000, 20000],
  20000: [10000, 50000],
  50000: [20000],
}

const familyOf = (ore: number): Family => (isCoin(ore) ? 'coins' : 'notes')
const piecesOf = (family: Family): readonly number[] => (family === 'coins' ? COINS : NOTES)

interface Item {
  token: string
  ore: number
}

/**
 * The seven pieces of "Tryk på alle …", the same every time for one fact: two or three of the asked
 * piece, the look-alikes, then the rest of its family. Repeats get their own tokens.
 */
function itemsFor(ore: number): Item[] {
  const rng = makeRng(hashSeed(`mnt-items:${ore}`))
  const targets = rng.next() < 0.5 ? 2 : 3
  const others = [...LOOKALIKES[ore], ...rng.shuffle(piecesOf(familyOf(ore)).filter((p) => p !== ore && !LOOKALIKES[ore].includes(p)))]
  const pieces = [...Array.from({ length: targets }, () => ore)]
  for (let i = 0; pieces.length < 7; i++) pieces.push(others[i % others.length])
  const copies = new Map<number, number>()
  return pieces.map((p) => {
    const copy = copies.get(p) ?? 0
    copies.set(p, copy + 1)
    return { token: pieceToken(p, copy), ore: p }
  })
}

const join = (tokens: readonly string[]): string => [...tokens].sort().join('|')

const FACTS: readonly Fact[] = ORDER.map(([family, ore], rank) => ({
  id: `mnt:${ore}`,
  skill: 'coinNames' as const,
  family,
  operands: [ore],
  answer: ore,
  rank,
}))

const oreOf = (f: Fact): number => Number(f.id.slice(f.id.indexOf(':') + 1))
const items = (f: Fact): Item[] => itemsFor(oreOf(f))
/** "Tryk på alle femkroner": the asked pieces' tokens. */
const memberSet = (f: Fact): string => join(items(f).filter((i) => i.ore === oreOf(f)).map((i) => i.token))

function candidates(f: Fact) {
  const ore = oreOf(f)
  const near = LOOKALIKES[ore]
  const entries: Entry[] = piecesOf(familyOf(ore)).map((p) => [p, near.includes(p) ? 'near' : 'other'] as const)
  // multiSelect: one asked piece missed, or a look-alike taken as well
  const all = items(f)
  const asked = all.filter((i) => i.ore === ore).map((i) => i.token)
  const lookalike = all.find((i) => near.includes(i.ore))
  entries.push([join(asked.slice(1)), 'near'])
  if (lookalike) entries.push([join([...asked, lookalike.token]), 'near'])
  return tagged(f.answer, entries)
}

/** "Der står fem kroner på femkronen. Den er sølvfarvet, har et hul og er den største af sølvmønterne." */
function hint(f: Fact, kind?: TaskKind): HintSpec {
  const ore = oreOf(f)
  const look = isCoin(ore) ? [say(`hint.coinNames.look.${ore}`)] : []
  const visual: HintSpec['visual'] = { scene: 'coins', ore: [ore] }
  if (kind === 'multiSelect') {
    // "Find alle de mønter, hvor der står fem kroner."
    return hintOf([say(isCoin(ore) ? 'hint.coinNames.findAllCoins' : 'hint.coinNames.findAllNotes'), moneySays(ore, 'end'), ...look], visual)
  }
  return hintOf([say('hint.coinNames.itSays'), moneySays(ore, 'mid'), say('hint.coinNames.on'), coinSays(ore, 'def', 'end'), ...look], visual)
}

export default {
  ...meta,
  kinds: ['choice', 'multiSelect'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => (kind === 'multiSelect' ? memberSet(f) : oreOf(f)),
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : 'ore'),
  answerType: () => 'ore',
  options: (f: Fact, _kind: TaskKind, rng: Rng): AnswerValue[] => rng.shuffle(items(f).map((i) => i.token)),
  prompt: () => ({ scene: 'hear' }),
  optionView: () => 'coin',
  range: () => [50, 50000],
  speech: (f: Fact, kind: TaskKind) =>
    kind === 'multiSelect'
      ? [say('frag.tryk_paa'), say('s.coinNames.all'), coinSays(oreOf(f), 'pl', 'end')]
      : [say('frag.tryk_paa'), coinSays(oreOf(f), 'def', 'end')],
  candidates,
  hint: (f, _tag, kind) => hint(f, kind),
} satisfies SkillModule
