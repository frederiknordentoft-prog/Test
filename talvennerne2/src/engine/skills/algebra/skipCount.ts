// skipCount — Tælle i spring (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `skc:`, seven
// families; an instance `skc:<family>:<start>:<shown>` is a row of `shown` stepping stones from `start`:
//   step2         start 0–20 (even), step 2                       2, 4, 6 → 8
//   step5         start 0–60 (fives), step 5                      15, 20, 25 → 30
//   step10        start 0–60 (tens), step 10                      30, 40, 50 → 60
//   step10offset  start with ones 1–9, step 10                    3, 13, 23 → 33
//   back10        start 40–99, step −10 (never below 0)           87, 77, 67 → 57
//   step100 (2.)  start 100·h + 10·t, step 100, up to 1000        230, 330, 430 → 530
//   step25 (3.)   start 0–200 (25s), step 25, up to 300           50, 75, 100 → 125
// Three or four stones are shown (step10: three to five). The row is read aloud ("Femten, tyve,
// femogtyve. Hvilket tal kommer så?"); the step is not drawn, the child finds it.
// Kinds: choice and keypad ask for the next number; fillSlots (production) for the next two, from a
// palette of five or six numbers (at least 5² = 25 ways to fill, SPEC §3.3). The fact's answer is the
// next number; the fillSlots answer is "<next>|<after>" (the `answer` hook).
// Ranges (cards, keypad and the palette): step2 0–40, step5/step10/step10offset/back10 0–100, step100
// 0–1000, step25 0–300.
// Wrong answers (pædagogik §3.2): skipStepOne — the row continued by one, not the step (5, 10, 15 → 16;
// back10: one less; fillSlots: "16|17"), the numbers of the row ('operand'), and near misses (±1, ±2,
// one step too far, the two numbers swapped). The skipStepOne value is never a number of the row.
// Hint: "Springet er fem. Femten plus fem giver tyve." (fillSlots: both hops), with the hops on a
// number line. skipStepOne says to hop the same length every time first.
import type { AnswerValue, Candidate, ErrorTag, Fact, FamilyDef, HintSpec, HintVisual, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { canonicalFacts, drawInstance, swapHint, type Drawer } from '../addsub/calc'

type Family = 'step2' | 'step5' | 'step10' | 'step10offset' | 'back10' | 'step100' | 'step25'

const STEP: Readonly<Record<Family, number>> = {
  step2: 2, step5: 5, step10: 10, step10offset: 10, back10: -10, step100: 100, step25: 25,
}
const TOP: Readonly<Record<Family, number>> = {
  step2: 40, step5: 100, step10: 100, step10offset: 100, back10: 100, step100: 1000, step25: 300,
}

const FAST: Partial<Record<TaskKind, number>> = { choice: 8_000, keypad: 10_000, fillSlots: 14_000 }
const META = metaOf('skipCount')
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

interface Row {
  family: Family
  start: number
  shown: number
  step: number
}

const rowNumbers = (r: Row): number[] => Array.from({ length: r.shown }, (_, i) => r.start + i * r.step)
const next = (r: Row, k = 1): number => r.start + (r.shown - 1 + k) * r.step

/** The row from its id (also for a fact the round screen rebuilt from its task). */
function rowOf(f: Pick<Fact, 'id'>): Row {
  const m = /^skc:([A-Za-z0-9]+):(\d+):(\d+)$/.exec(f.id)
  if (!m || !(m[1] in STEP)) throw new Error(`not a skipCount fact: ${f.id}`)
  const family = m[1] as Family
  return { family, start: Number(m[2]), shown: Number(m[3]), step: STEP[family] }
}

function make(family: Family, start: number, shown: number): Fact | null {
  const r: Row = { family, start, shown, step: STEP[family] }
  const after = next(r, 2)
  if (after < 0 || after > TOP[family]) return null
  return { id: `skc:${family}:${start}:${shown}`, skill: 'skipCount', family, operands: rowNumbers(r), answer: next(r), rank: RANK[family] }
}

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    const shown = rng.between(3, 4)
    switch (family as Family) {
      case 'step2':
        return make('step2', 2 * rng.between(0, 10), shown)
      case 'step5':
        return make('step5', 5 * rng.between(0, 12), shown)
      case 'step10':
        return make('step10', 10 * rng.between(0, 6), rng.between(3, 5))
      case 'step10offset':
        return make('step10offset', 10 * rng.between(0, 5) + rng.between(1, 9), shown)
      case 'back10':
        return make('back10', rng.between(40, 99), shown)
      case 'step100':
        return make('step100', 100 * rng.between(0, 5) + 10 * rng.pick([0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), shown)
      case 'step25':
        return make('step25', 25 * rng.between(0, 8), shown)
      default:
        return null
    }
  },
}

const CANON = canonicalFacts('skipCount', drawer, FAMILIES)

const slotsOf = (kind?: TaskKind) => (kind === 'fillSlots' ? 2 : 1)

/** "Hvilket tal kommer så?" after the row, read number by number. */
function speech(f: Fact, kind: TaskKind): SpeechPart[] {
  const nums = rowNumbers(rowOf(f))
  return [
    ...nums.map((n, i) => num(n, i === nums.length - 1 ? 'end' : 'mid')),
    say(slotsOf(kind) === 2 ? 's.skipCount.nextTwo' : 's.skipCount.next'),
  ]
}

/**
 * The fillSlots palette: both answers, the skipStepOne pair and near misses one past each answer (5 or 6
 * numbers), all inside the family's numbers (0 to its top), like the cards and the keypad. A row whose
 * second answer is the top (skc:step10:60:3 → 90, 100) leaves out the number past it, as back10 leaves out
 * the one below 0: five numbers, the skipStepOne pair always among them (it lies before the answers).
 */
function palette(r: Row): number[] {
  const s = Math.sign(r.step)
  const last = next(r, 0)
  const x = next(r, 1)
  const y = next(r, 2)
  const inside = (v: number) => v >= 0 && v <= TOP[r.family]
  return [...new Set([x, y, last + s, last + 2 * s, x + s, y + s])].filter(inside).sort((p, q) => p - q)
}

function candidates(f: Fact): Candidate[] {
  const r = rowOf(f)
  const s = Math.sign(r.step)
  const last = next(r, 0)
  const x = next(r, 1)
  const y = next(r, 2)
  const shown = rowNumbers(r)
  const one = tagged(x, [
    [last + s, 'skipStepOne'],
    ...shown.map((n) => [n, 'operand'] as const),
    [x + 1, 'near'], [x - 1, 'near'], [x + 2, 'near'], [x - 2, 'near'], [y, 'near'],
  ])
  const two = tagged(`${x}|${y}`, [
    [`${last + s}|${last + 2 * s}`, 'skipStepOne'],
    [`${y}|${x}`, 'near'],
    [`${x}|${x + s}`, 'near'],
    [`${x + s}|${y + s}`, 'near'],
  ])
  return [...one, ...two]
}

/** A number line around the hops: tens (hundreds for step100, 25s for step25) on both ends. */
function hopsLine(stops: readonly number[], step: number): HintVisual {
  const unit = Math.abs(step) >= 100 ? 100 : Math.abs(step) === 25 ? 25 : 10
  const lo = Math.min(...stops)
  const hi = Math.max(...stops)
  const min = Math.floor(lo / unit) * unit
  const max = Math.max(min + unit, Math.ceil(hi / unit) * unit)
  return { scene: 'line', min, max, hops: [...stops] }
}

function hint(f: Fact, tag: ErrorTag | null, kind?: TaskKind): HintSpec {
  const r = rowOf(f)
  const d = Math.abs(r.step)
  const answers = slotsOf(kind) === 2 ? [next(r, 1), next(r, 2)] : [next(r, 1)]
  if (tag === 'digitSwap' && answers.length === 1) return swapHint(answers[0])
  const strategy: SpeechPart[] = [say(r.step > 0 ? 'hint.skipCount.everyHop' : 'hint.skipCount.everyHopBack'), num(d)]
  let at = next(r, 0)
  for (const v of answers) {
    strategy.push(num(at, 'mid'), say(r.step > 0 ? 'op.plus' : 'op.minus'), num(d, 'mid'), say('op.giver'), num(v))
    at = v
  }
  const line = hopsLine([...rowNumbers(r), ...answers], r.step)
  if (tag === 'skipStepOne') return hintOf([say('hint.skipCount.sameHop'), ...strategy], line, 'skipStepOne')
  return hintOf(strategy, line)
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad', 'fillSlots'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  answerTypeFor: (_f: Fact, kind: TaskKind) => (kind === 'fillSlots' ? 'set' : 'int'),
  answer: (f: Fact, kind: TaskKind): AnswerValue => {
    const r = rowOf(f)
    return kind === 'fillSlots' ? `${next(r, 1)}|${next(r, 2)}` : next(r, 1)
  },
  options: (f: Fact, _kind: TaskKind, rng: Rng): AnswerValue[] => rng.shuffle(palette(rowOf(f))),
  prompt: (f, kind) => ({ scene: 'row', cells: [...rowNumbers(rowOf(f)), ...Array<null>(slotsOf(kind)).fill(null)] }),
  optionView: () => 'numeral',
  range: (f) => [0, TOP[rowOf(f).family]],
  speech,
  candidates,
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
