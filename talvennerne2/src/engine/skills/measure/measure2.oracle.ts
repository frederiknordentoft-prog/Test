// Independent oracles for the measure skills of 1.–2. klasse (measureUnits, rulerRead, weightCompare,
// readChart, unitChoice). Written by another agent than the generators (SPEC A5, §15.1): every right
// answer is worked out here from what the child is given — the row of units, the ruler, the things on
// the scale, the chart's bars and the spoken question — and never from the generator code. Which things
// are heavy and which unit a thing is measured in is the oracle's own knowledge of a child's world.
// The registry skips *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, MisconceptionId, Prompt, Task } from '../../types'
import { typedSwap, type WhyB } from '../clock/clock.oracle'

const ORDINAL: Readonly<Record<string, number>> = { første: 1, anden: 2, tredje: 3, fjerde: 4 }

// ─── measureUnits ───────────────────────────────────────────────────────────

export interface UnitsRow {
  family: 'cubes' | 'clips'
  n: number
  thing: string
}

/** maal:<cubes|clips>:<n>:<thing>, n = 2–12 cubes or 2–10 clips (pædagogik §1.3). */
export function parseUnitsRow(id: string): UnitsRow | null {
  const m = /^maal:(cubes|clips):(\d+):([a-z]+)$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  const ok = m[1] === 'cubes' ? n >= 2 && n <= 12 : n >= 2 && n <= 10
  return ok ? { family: m[1] as UnitsRow['family'], n, thing: m[3] } : null
}

/** "Hvor mange klodser lang er tingen?" / "Hvor mange clips lang er tingen?" → which unit is asked for. */
export function unitsAsked(text: string): 'cube' | 'clip' | null {
  return text === 'Hvor mange klodser lang er tingen?' ? 'cube' : text === 'Hvor mange clips lang er tingen?' ? 'clip' : null
}

// ─── rulerRead ──────────────────────────────────────────────────────────────

export interface Lay {
  family: 'from0' | 'offset'
  start: number
  len: number
  thing: string
}

/** lin:<from0|offset>:<start>+<len>:<thing>: from0 starts at 0 (1–15 cm), offset at 1–5 (2. kl.); a 20 cm ruler at most. */
export function parseLay(id: string): Lay | null {
  const m = /^lin:(from0|offset):(\d+)\+(\d+):([a-z]+)$/.exec(id)
  if (!m) return null
  const [start, len] = [Number(m[2]), Number(m[3])]
  const ok = len >= 1 && start + len <= 20 && (m[1] === 'from0' ? start === 0 && len <= 15 : start >= 1 && start <= 5)
  return ok ? { family: m[1] as Lay['family'], start, len, thing: m[4] } : null
}

/** The marks the thing lies between on the ruler: where it starts and where it ends (its length is the gap). */
export function rulerMarks(p: Prompt): { start: number; end: number } | null {
  return p.scene === 'ruler' && p.lengthCm !== null ? { start: p.startCm, end: p.startCm + p.lengthCm } : null
}

/**
 * A wrong length (pædagogik §3.2, rulerRead `offset` only): the mark where the thing ends, or the marks
 * counted instead of the spaces (length + 1) — rulerEnd; the mark where it starts ('operand'); a typed
 * length written back to front (SPEC §4.1). A9: length + 1 on the start mark is 'ambiguous'.
 */
export function explainLay(l: Lay, task: Task, v: number): WhyB {
  const mis: MisconceptionId[] = []
  if (l.family === 'offset' && (v === l.start + l.len || v === l.len + 1)) mis.push('rulerEnd')
  return { mis, operand: l.family === 'offset' && v === l.start, swap: typedSwap(task, v, []) }
}

// ─── weightCompare ──────────────────────────────────────────────────────────

/** Things every child knows to be heavy to hold, and light ones (a pillow is light next to a stone). */
export const HEAVY_THINGS: ReadonlySet<string> = new Set(['stone', 'bottle', 'book'])
export const LIGHT_THINGS: ReadonlySet<string> = new Set(['feather', 'balloon', 'leaf', 'flower', 'key', 'strawberry', 'marble', 'pillow'])
/** The teddy is the yardstick of "tungere end bamsen": lighter than the heavy things, heavier than the light ones. */
export const TEDDY = 'teddy'

export interface Scale {
  objects: string[]
  sizes: number[]
}

export function scaleOf(p: Prompt): Scale | null {
  return p.scene === 'compareObjects' && p.mode === 'weight' ? { objects: [...p.objects], sizes: [...p.sizes] } : null
}

const objToken = (thing: string) => `obj:${thing}`

/** "Hvilken ting er tungest?": the one heavy thing among light ones (null when it is not that clear). */
export function heaviest(s: Scale): string | null {
  const heavy = s.objects.filter((o) => HEAVY_THINGS.has(o))
  const light = s.objects.filter((o) => LIGHT_THINGS.has(o))
  return heavy.length === 1 && light.length === s.objects.length - 1 ? objToken(heavy[0]) : null
}

/** The thing drawn biggest (null when two share the biggest size). */
export function drawnBiggest(s: Scale): string | null {
  const max = Math.max(...s.sizes)
  const at = s.sizes.flatMap((x, i) => (x === max ? [i] : []))
  return at.length === 1 ? objToken(s.objects[at[0]]) : null
}

/** "Tryk på alle de ting, der er tungere end bamsen.": the teddy first, then the things o0, o1 … */
export function heavierThanTeddy(s: Scale): string | null {
  if (s.objects[0] !== TEDDY) return null
  const things = s.objects.slice(1)
  if (!things.every((o) => HEAVY_THINGS.has(o) || LIGHT_THINGS.has(o))) return null
  return things.flatMap((o, i) => (HEAVY_THINGS.has(o) ? [`o${i}`] : [])).join('|')
}

/** The things drawn bigger than the teddy: what "big is heavy" would tap. */
export function biggerThanTeddy(s: Scale): string {
  return s.objects.slice(1).flatMap((_, i) => (s.sizes[i + 1] > s.sizes[0] ? [`o${i}`] : [])).join('|')
}

/** SPEC §4.3: a conflict item is one where going by size gives a wrong answer. */
export function weighContrast(s: Scale, multi: boolean): 'conflict' | 'congruent' {
  const misled = multi ? biggerThanTeddy(s) !== heavierThanTeddy(s) : drawnBiggest(s) !== heaviest(s)
  return misled ? 'conflict' : 'congruent'
}

/** sizeIsWeight (pædagogik §3.2, "den største ting"): the biggest thing, or the things bigger than the teddy, where that is wrong. */
export function explainWeigh(s: Scale, multi: boolean, given: AnswerValue): WhyB {
  const bySize = multi ? biggerThanTeddy(s) : drawnBiggest(s)
  const right = multi ? heavierThanTeddy(s) : heaviest(s)
  return { mis: bySize !== null && bySize !== right && given === bySize ? ['sizeIsWeight'] : [] }
}

// ─── readChart ──────────────────────────────────────────────────────────────

export interface ChartAsk {
  chart: 'picto' | 'bar'
  /** A row or bar by place (1-based), or an extreme, or the difference between them. */
  q: number | 'most' | 'least' | 'diff'
}

/**
 * The question as the child hears it: "Hvor mange stjerner er der i den tredje række?", "Hvor høj er den
 * anden søjle?", "… i den længste/korteste række?", "Hvor høj er den højeste/laveste søjle?", "Hvor mange
 * flere stjerner er der i den længste række end i den korteste?", "Hvor meget højere er den højeste søjle
 * end den laveste?".
 */
export function chartAsked(text: string): ChartAsk | null {
  if (text === 'Hvor mange flere stjerner er der i den længste række end i den korteste?') return { chart: 'picto', q: 'diff' }
  if (text === 'Hvor meget højere er den højeste søjle end den laveste?') return { chart: 'bar', q: 'diff' }
  const row = /^Hvor mange stjerner er der i den ([a-zæøå]+) række\?$/.exec(text)
  if (row) {
    if (row[1] === 'længste') return { chart: 'picto', q: 'most' }
    if (row[1] === 'korteste') return { chart: 'picto', q: 'least' }
    return row[1] in ORDINAL ? { chart: 'picto', q: ORDINAL[row[1]] } : null
  }
  const bar = /^Hvor høj er den ([a-zæøå]+) søjle\?$/.exec(text)
  if (bar) {
    if (bar[1] === 'højeste') return { chart: 'bar', q: 'most' }
    if (bar[1] === 'laveste') return { chart: 'bar', q: 'least' }
    return bar[1] in ORDINAL ? { chart: 'bar', q: ORDINAL[bar[1]] } : null
  }
  return null
}

/** The answer read off the chart's data (top row or left bar first). */
export function chartAnswer(values: readonly number[], q: ChartAsk['q']): number | null {
  const hi = Math.max(...values)
  const lo = Math.min(...values)
  if (typeof q === 'number') return values[q - 1] ?? null
  return q === 'most' ? hi : q === 'least' ? lo : hi - lo
}

/** diag:<family>:<p|b>:<v-v-v>:<k|most|least|diff> as a question (the id's own claim). */
export function parseChartId(id: string): { family: string; chart: 'picto' | 'bar'; values: number[]; q: ChartAsk['q'] } | null {
  const m = /^diag:(readPicto|readBar|mostLeast|difference):(p|b):(\d+(?:-\d+)+):(\d|most|least|diff)$/.exec(id)
  if (!m) return null
  const q = /^\d$/.test(m[4]) ? Number(m[4]) : (m[4] as 'most' | 'least' | 'diff')
  return { family: m[1], chart: m[2] === 'p' ? 'picto' : 'bar', values: m[3].split('-').map(Number), q }
}

/** The family a question belongs to (pædagogik §1.3: readPicto, readBar, mostLeast, difference). */
export const chartFamily = (a: ChartAsk): string =>
  typeof a.q === 'number' ? (a.chart === 'picto' ? 'readPicto' : 'readBar') : a.q === 'diff' ? 'difference' : 'mostLeast'

/**
 * A wrong number for a chart: another row's or bar's number ('operand'); for the difference, the two
 * numbers added (wrongOperation, SPEC §4.2 every arithmetic skill); a typed answer written back to
 * front. A9: a sum that is also a number in the chart is 'ambiguous'.
 */
export function explainChart(values: readonly number[], q: ChartAsk['q'], task: Task, v: number): WhyB {
  const mis: MisconceptionId[] = []
  if (q === 'diff' && v === Math.max(...values) + Math.min(...values)) mis.push('wrongOperation')
  return { mis, operand: values.includes(v), swap: typedSwap(task, v, values) }
}

// ─── unitChoice ─────────────────────────────────────────────────────────────

/** The unit a child measures each thing in: small things in centimetres, big ones in metres; light things in grams, heavy ones in kilograms. */
export const THING_UNIT: Readonly<Record<string, readonly [unit: 'cm' | 'm' | 'g' | 'kg', noun: string]>> = {
  pencil: ['cm', 'en blyant'], fork: ['cm', 'en gaffel'], spoon: ['cm', 'en ske'], shoe: ['cm', 'en sko'],
  carrot: ['cm', 'en gulerod'], comb: ['cm', 'en kam'], worm: ['cm', 'en regnorm'], leaf: ['cm', 'et blad'],
  bus: ['m', 'en bus'], train: ['m', 'et tog'], lorry: ['m', 'en lastbil'], ship: ['m', 'et skib'],
  whale: ['m', 'en hval'], plane: ['m', 'et fly'], bridge: ['m', 'en bro'], house: ['m', 'et hus'],
  feather: ['g', 'en fjer'], strawberry: ['g', 'et jordbær'], key: ['g', 'en nøgle'], letter: ['g', 'et brev'],
  dog: ['kg', 'en hund'], bike: ['kg', 'en cykel'], sofa: ['kg', 'en sofa'], suitcase: ['kg', 'en kuffert'],
}

export const UNIT_KIND: Readonly<Record<string, 'length' | 'weight'>> = { cm: 'length', m: 'length', g: 'weight', kg: 'weight' }
export const UNIT_NAME: Readonly<Record<string, string>> = { cm: 'centimeter', m: 'meter', g: 'gram', kg: 'kilogram' }

/** The thing a noun names ("en bus" → bus). */
export const thingOfNoun = (noun: string): string | null => Object.keys(THING_UNIT).find((t) => THING_UNIT[t][1] === noun.toLowerCase()) ?? null

/** "Hvad måler man længden af en bus i?" / "… vægten af en hund i?" → the thing and the kind of measure. */
export function unitQuestion(text: string): { thing: string; kind: 'length' | 'weight' } | null {
  const m = /^Hvad måler man (længden|vægten) af (.+) i\?$/.exec(text)
  const thing = m ? thingOfNoun(m[2]) : null
  return m && thing ? { thing, kind: m[1] === 'længden' ? 'length' : 'weight' } : null
}

/** "Tryk på alle de ting, man måler i meter." / "… man vejer i gram." → the unit. */
export function unitAskedAll(text: string): 'cm' | 'm' | 'g' | 'kg' | null {
  const m = /^Tryk på alle de ting, man (måler|vejer) i (centimeter|meter|gram|kilogram)\.$/.exec(text)
  if (!m) return null
  const unit = (Object.keys(UNIT_NAME) as ('cm' | 'm' | 'g' | 'kg')[]).find((u) => UNIT_NAME[u] === m[2])!
  return (m[1] === 'måler') === (UNIT_KIND[unit] === 'length') ? unit : null
}
