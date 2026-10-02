// shapes3D — Rumlige figurer (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 26 facts, prefix `s3d:`.
//   names  (1. kl.)  s3d:n:<solid>       kugle, terning, kasse, cylinder, kegle drawn              5
//                    s3d:o:<thing>       everyday things: bold, glaskugle, klods, bog, sugerør, gulerod 6
//   props  (2. kl.)  s3d:p:<prop>:<j>    kan trille, kan stables, har kun flade sider; 5 sets each   15
// Kinds (each fact has all three):
//   choice: "Tryk på kuglen." (heard; or the thing is shown: "Hvilken figur har samme form som tingen?")
//     or "Hvilken figur kan trille?" — three cards of drawn solids ('solid:<id>').
//   multiSelect (production): "Tryk på alle, der har form som en kugle." / "Tryk på alle, der kan
//     trille." — six cards, drawn solids and things ('obj:<id>'), two to four of them right.
//   keypad (production): "Hvor mange af tingene har form som en kugle?" — the things stand on a shelf
//     ({ scene: 'compareObjects' } as weights of one size: a shelf of things), 0–10.
// The hierarchy (isA.ts): a cube is also a cuboid ("kasse"), so "alle kasser" takes the cubes, and a
// cube is never a wrong card when the answer is the kasse (SPEC §2.3). A cylinder can be stacked and
// rolls, a pyramid has only flat sides: a card that is also right by its property is never dealt wrong.
// The pyramid has no everyday thing in the materials yet (no tent, no roof), so it is asked in props
// only: "alle pyramider" would have one member (proposal in the SK2-GEO report).
// Wrong answers: look-alikes ('near': cylinder/kegle, terning/kasse, kugle/cylinder), other solids
// ('other'); on the keypad one too many or too few ('near') and all the things ('other'). No misconception
// in the catalogue (SPEC §4.2).
// Hint: what makes the solid that solid, or the property ("Figurer med en krum flade kan trille."), with
// the solid drawn.
import type { AnswerValue, Fact, Prompt, SolidId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hashSeed, makeRng } from '../../rng'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { solidClip } from '../../../speech/nouns'
import { isA } from './isA'

type Prop = 'rolls' | 'stacks' | 'flat'

/** Everyday things the materials draw, and the solid each one is shaped like. */
const THINGS: Readonly<Record<string, SolidId>> = { ball: 'sphere', marble: 'sphere', cube: 'cube', book: 'cuboid', straw: 'cylinder', carrot: 'cone' }
const NAMED: readonly SolidId[] = ['sphere', 'cube', 'cuboid', 'cylinder', 'cone']
const SOLIDS: readonly SolidId[] = ['sphere', 'cube', 'cuboid', 'cylinder', 'cone', 'pyramid']
const PROPS: readonly Prop[] = ['rolls', 'stacks', 'flat']
const SETS = 5

const HAS: Readonly<Record<Prop, readonly SolidId[]>> = {
  rolls: ['sphere', 'cylinder', 'cone'],
  stacks: ['cube', 'cuboid', 'cylinder'],
  flat: ['cube', 'cuboid', 'pyramid'],
}
/** A lying straw is a cylinder, but whether a child "stacks" it is not clear: left out there. */
const UNCLEAR: Readonly<Record<Prop, readonly string[]>> = { rolls: [], stacks: ['obj:straw'], flat: [] }
const NEAR: Readonly<Record<SolidId, readonly SolidId[]>> = {
  sphere: ['cylinder'], cube: ['cuboid'], cuboid: ['pyramid'], cylinder: ['cone', 'sphere'], cone: ['pyramid', 'cylinder'], pyramid: ['cone'],
}

const solidToken = (s: SolidId) => `solid:${s}`
/** Every card: the drawn solids and the things. */
const CARDS: readonly string[] = [...SOLIDS.map(solidToken), ...Object.keys(THINGS).map((t) => `obj:${t}`)]
/** The solid a card shows. */
const classOf = (card: string): SolidId => (card.startsWith('solid:') ? (card.slice(6) as SolidId) : THINGS[card.slice(4)])
/** The things on the shelf (keypad). */
const SHELF: readonly string[] = Object.keys(THINGS)

type Parsed =
  | { type: 'name'; solid: SolidId; thing: string | null }
  | { type: 'prop'; prop: Prop; j: number }

function parse(f: Pick<Fact, 'id'>): Parsed {
  const [, code, a, b] = f.id.split(':')
  if (code === 'n') return { type: 'name', solid: a as SolidId, thing: null }
  if (code === 'o') return { type: 'name', solid: THINGS[a], thing: a }
  return { type: 'prop', prop: a as Prop, j: Number(b) }
}

/** Is a card right for the fact: shaped like the solid (with isA), or has the property? */
function fits(p: Parsed, card: string): boolean {
  const c = classOf(card)
  return p.type === 'name' ? isA(c, p.solid) : HAS[p.prop].includes(c)
}
const unclear = (p: Parsed, card: string) => p.type === 'prop' && UNCLEAR[p.prop].includes(card)

const keyOf = (p: Parsed) => (p.type === 'name' ? `n:${p.solid}:${p.thing ?? ''}` : `p:${p.prop}:${p.j}`)

/** The choice answer: the asked solid, or a solid with the property (a different one per set). */
function choiceAnswer(p: Parsed): string {
  if (p.type === 'name') return solidToken(p.solid)
  return solidToken(HAS[p.prop][p.j % HAS[p.prop].length])
}

/** Six cards for "Tryk på alle …": two to four right, the same for one fact. */
function multiCards(p: Parsed): string[] {
  const rng = makeRng(hashSeed(`s3d-multi:${keyOf(p)}`))
  const usable = CARDS.filter((c) => !unclear(p, c))
  const right = rng.shuffle(usable.filter((c) => fits(p, c)))
  const wrong = rng.shuffle(usable.filter((c) => !fits(p, c)))
  const own = p.type === 'name' ? [p.thing ? `obj:${p.thing}` : solidToken(p.solid)] : []
  const count = Math.min(right.length, 2 + rng.int(3))
  const picked = [...own, ...right.filter((c) => !own.includes(c))].slice(0, count)
  return rng.shuffle([...picked, ...wrong.slice(0, 6 - picked.length)])
}

/** The shelf of things for the keypad, the same for one fact. */
function shelf(p: Parsed): string[] {
  const rng = makeRng(hashSeed(`s3d-shelf:${keyOf(p)}`))
  const things = SHELF.filter((t) => !unclear(p, `obj:${t}`))
  return p.type === 'name' ? rng.shuffle(things) : rng.shuffle(things).slice(0, 5)
}
const shelfCount = (p: Parsed): number => shelf(p).filter((t) => fits(p, `obj:${t}`)).length

const join = (ids: readonly string[]): string => [...ids].sort().join('|')

const FACTS: readonly Fact[] = [
  ...NAMED.map((s) => `s3d:n:${s}`),
  ...Object.keys(THINGS).map((t) => `s3d:o:${t}`),
  ...PROPS.flatMap((prop) => Array.from({ length: SETS }, (_, j) => `s3d:p:${prop}:${j}`)),
].map((id, rank) => {
  const p = parse({ id })
  return { id, skill: 'shapes3D' as const, family: p.type === 'name' ? 'names' : 'props', operands: [], answer: choiceAnswer(p), rank }
})

function answer(f: Fact, kind: TaskKind): AnswerValue {
  const p = parse(f)
  if (kind === 'multiSelect') return join(multiCards(p).filter((c) => fits(p, c)))
  if (kind === 'keypad') return shelfCount(p)
  return choiceAnswer(p)
}

function candidates(f: Fact) {
  const p = parse(f)
  const entries: Entry[] = []
  // cards: never a solid that is also right (a cube for "kassen", a cylinder for "kan trille")
  const target = p.type === 'name' ? p.solid : classOf(choiceAnswer(p))
  for (const s of SOLIDS) if (!fits(p, solidToken(s))) entries.push([solidToken(s), NEAR[target].includes(s) ? 'near' : 'other'])
  // keypad
  const n = shelfCount(p)
  entries.push([n - 1, 'near'], [n + 1, 'near'], [shelf(p).length, 'other'])
  // multiSelect: one right card left out, one wrong card taken
  const cards = multiCards(p)
  const right = cards.filter((c) => fits(p, c))
  for (const c of right) if (right.length > 1) entries.push([join(right.filter((x) => x !== c)), 'near'])
  for (const c of cards.filter((x) => !fits(p, x))) entries.push([join([...right, c]), 'other'])
  return tagged(f.answer, entries).filter((c) => c.value !== n)
}

function hint(f: Fact, _tag: string | null, kind?: TaskKind) {
  const p = parse(f)
  const solid = p.type === 'name' ? p.solid : classOf(choiceAnswer(p))
  const visual: Prompt = { scene: 'solid', solid }
  const what = p.type === 'name' ? say(`hint.shapes3D.${p.solid}`) : say(`hint.shapes3D.${p.prop}`)
  if (kind === 'keypad') return hintOf([what, say('hint.shapes3D.countThings'), num(shelfCount(p), 'end')], visual)
  return hintOf([what], visual)
}

function speech(f: Fact, kind: TaskKind) {
  const p = parse(f)
  if (p.type === 'prop') {
    if (kind === 'multiSelect') return [say('frag.tryk_paa'), say(`s.shapes3D.all.${p.prop}`)]
    if (kind === 'keypad') return [say(`s.shapes3D.howMany.${p.prop}`)]
    return [say(`s.shapes3D.which.${p.prop}`)]
  }
  if (kind === 'multiSelect') return [say('frag.tryk_paa'), say('s.shapes3D.allShaped'), say(solidClip(p.solid, 'indef', 'end'))]
  if (kind === 'keypad') return [say('s.shapes3D.howManyShaped'), say(solidClip(p.solid, 'indef', 'end'))]
  if (p.thing) return [say('s.shapes3D.sameShape')]
  return [say('frag.tryk_paa'), say(solidClip(p.solid, 'def', 'end'))]
}

export default {
  ...metaOf('shapes3D'),
  kinds: ['choice', 'multiSelect', 'keypad'],
  enumerate: () => [...FACTS],
  answer,
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'multiSelect' ? 'set' : kind === 'keypad' ? 'int' : 'token'),
  answerType: () => 'token',
  options: (f: Fact) => multiCards(parse(f)),
  prompt: (f: Fact, kind: TaskKind): Prompt => {
    const p = parse(f)
    if (kind === 'keypad') {
      const things = shelf(p)
      return { scene: 'compareObjects', objects: things, sizes: things.map(() => 1), aligned: true, mode: 'weight' }
    }
    if (kind === 'choice' && p.type === 'name' && p.thing) return { scene: 'solid', solid: p.solid, asObject: p.thing }
    return { scene: 'hear' }
  },
  optionView: (_f: Fact, kind: TaskKind) => (kind === 'keypad' ? 'numeral' : 'solid'),
  range: (_f: Fact, kind: TaskKind) => (kind === 'keypad' ? [0, 10] : [0, 1]),
  speech,
  candidates,
  hint,
} satisfies SkillModule
