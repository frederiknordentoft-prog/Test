// readChart — Aflæs diagrammer (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `diag:`.
//   readPicto    diag:readPicto:p:<values>:<k>     a pictogram, "how many stars in row k?"           values 2–8
//   readBar      diag:readBar:b:<values>:<k>       a bar chart, "how high is bar k?"                 values 2–10
//   mostLeast    diag:mostLeast:<p|b>:<values>:<most|least>   the longest/shortest row, highest/lowest bar
//   difference   diag:difference:<p|b>:<values>:diff          highest minus lowest ("hvor mange flere")
// <values> are 3 or 4 different counts joined by '-' (top row or left bar first); k is 1-based. The id
// carries the instance; the categories (animals) are drawn from it and never named, because the chart
// draws a category as a coloured paw for now (BarChart/Pictogram without renderCat). Rows and bars are
// asked by place ("den første række", "den tredje søjle") or by the extremes.
// Prompt { scene: 'chart', kind: 'picto' | 'bar', data: [{ cat, n }] }. Kinds: choice (numbers) and
// keypad (production), range 0–20.
// Wrong answers:
//   operand          another row's or bar's number (the wrong one read)
//   near             ±1 (a star miscounted, the grid line above or below)
//   wrongOperation   difference only: the two numbers added instead of taken from each other (SPEC
//                    §4.2: every arithmetic skill). A9: when that sum is also a number in the chart, the
//                    child may have read that one: 'ambiguous', never evidence.
import type { Fact, FamilyDef, HintSpec, Prompt, Rng, SpeciesId, SpeechPart } from '../../types'
import { SPECIES_IDS } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { canonical, drawAvoiding, familyRank, rngFor } from '../place/kit'
import { between } from './kit2'

const meta = metaOf('readChart')

type Family = 'readPicto' | 'readBar' | 'mostLeast' | 'difference'
type Chart = 'p' | 'b'

interface Ask {
  family: Family
  chart: Chart
  values: number[]
  /** 1-based row or bar, or which extreme. */
  q: number | 'most' | 'least' | 'diff'
}

const idOf = (a: Ask) => `diag:${a.family}:${a.chart}:${a.values.join('-')}:${a.q}`

function parse(id: string): Ask {
  const [, family, chart, values, q] = id.split(':')
  return { family: family as Family, chart: chart as Chart, values: values.split('-').map(Number), q: /^\d+$/.test(q) ? Number(q) : (q as Ask['q']) }
}

const hi = (a: Ask) => Math.max(...a.values)
const lo = (a: Ask) => Math.min(...a.values)

function answerOf(a: Ask): number {
  if (typeof a.q === 'number') return a.values[a.q - 1]
  if (a.q === 'most') return hi(a)
  if (a.q === 'least') return lo(a)
  return hi(a) - lo(a)
}

const make = (a: Ask): Fact => ({
  id: idOf(a),
  skill: 'readChart',
  family: a.family,
  operands: [...a.values],
  answer: answerOf(a),
  rank: familyRank(meta.families, a.family),
})

/** 3 or 4 different counts (picto 2–8, bars 2–10). */
function valuesFor(chart: Chart, rng: Rng): number[] {
  const n = rng.pick([3, 4])
  return rng.shuffle(between(2, chart === 'p' ? 8 : 10)).slice(0, n)
}

function draw(family: Family, rng: Rng): Fact {
  const chart: Chart = family === 'readPicto' ? 'p' : family === 'readBar' ? 'b' : rng.pick(['p', 'b'] as const)
  const values = valuesFor(chart, rng)
  const q: Ask['q'] = family === 'readPicto' || family === 'readBar' ? rng.between(1, values.length) : family === 'mostLeast' ? rng.pick(['most', 'least'] as const) : 'diff'
  return make({ family, chart, values, q })
}

const FACTS: readonly Fact[] = meta.families.flatMap((fam) => canonical('readChart', fam.id, (rng) => draw(fam.id as Family, rng)))

/** The animals of a chart, from its id (they are drawn, never named). */
function cats(a: Ask): SpeciesId[] {
  return rngFor(idOf(a)).shuffle(SPECIES_IDS.slice(0, 8)).slice(0, a.values.length)
}

const scene = (a: Ask): Prompt => ({
  scene: 'chart',
  kind: a.chart === 'p' ? 'picto' : 'bar',
  data: a.values.map((n, i) => ({ cat: cats(a)[i], n })),
})

const RANGE: [number, number] = [0, 20]

function candidates(f: Fact) {
  const a = parse(f.id)
  const answer = answerOf(a)
  const entries: Entry[] = [
    ...(a.q === 'diff' ? [[hi(a) + lo(a), 'wrongOperation'] as const] : []),
    ...a.values.map((v): Entry => [v, 'operand']),
    [answer + 1, 'near'],
    [answer - 1, 'near'],
    [answer + 2, 'other'],
    [answer - 2, 'other'],
  ]
  return tagged(answer, entries.filter(([v]) => typeof v === 'number' && v > 0 && v <= RANGE[1]))
}

/** The question: by place ("Hvor høj er den tredje søjle?") or by an extreme. */
function speech(f: Fact): SpeechPart[] {
  const a = parse(f.id)
  const picto = a.chart === 'p'
  if (typeof a.q === 'number') return [say(`s.readChart.${picto ? 'pictoRow' : 'barCol'}.${a.q}`)]
  if (a.q === 'diff') return [say(picto ? 's.readChart.pictoDiff' : 's.readChart.barDiff')]
  const most = a.q === 'most'
  return [say(picto ? (most ? 's.readChart.pictoLongest' : 's.readChart.pictoShortest') : most ? 's.readChart.barHighest' : 's.readChart.barLowest')]
}

/**
 * Pictogram: "Find rækken, og tæl stjernerne en ad gangen. Der er fem stjerner." Bars: "Følg toppen af
 * søjlen hen til tallene ved siden af. Søjlen når op til fem." Difference: "Den højeste søjle når op til
 * otte, og den laveste når op til tre. Otte minus tre giver fem." — on a number line from the low to
 * the high number.
 */
function hint(f: Fact, tag: string | null): HintSpec {
  const a = parse(f.id)
  const picto = a.chart === 'p'
  const answer = answerOf(a)
  const chart = scene(a)
  if (a.q === 'diff') {
    const standard: SpeechPart[] = [
      say(picto ? 'hint.readChart.longestHas' : 'hint.readChart.highestReaches'), num(hi(a), 'mid'),
      say(picto ? 'hint.readChart.shortestHas' : 'hint.readChart.lowestReaches'), num(lo(a), 'end'),
      num(hi(a), 'mid'), say('op.minus'), num(lo(a), 'mid'), say('op.giver'), num(answer, 'end'),
    ]
    const line: Prompt = { scene: 'line', min: 0, max: 10, hops: [lo(a), hi(a)] }
    if (tag === 'wrongOperation') return hintOf([say('hint.readChart.howManyMore'), ...standard], line, 'wrongOperation')
    if (tag === 'operand') return hintOf([say('hint.readChart.bothNumbers'), ...standard], line)
    return hintOf(standard, line)
  }
  const find: SpeechPart[] =
    a.q === 'most' ? [say(picto ? 'hint.readChart.findLongest' : 'hint.readChart.findHighest')]
      : a.q === 'least' ? [say(picto ? 'hint.readChart.findShortest' : 'hint.readChart.findLowest')]
        : []
  const read: SpeechPart[] = picto
    ? [say('hint.readChart.countStars'), say('hint.readChart.thereAre'), num(answer, 'mid'), say('hint.readChart.stars')]
    : [say('hint.readChart.followTop'), say('hint.readChart.reachesUpTo'), num(answer, 'end')]
  const lead =
    tag === 'operand' ? [say(picto ? 'hint.readChart.rightRow' : 'hint.readChart.rightBar')]
      : tag === 'near' ? [say(picto ? 'hint.readChart.countSlowly' : 'hint.readChart.lineAtTop')]
        : []
  return hintOf([...lead, ...find, ...read], chart)
}

export default {
  ...meta,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawAvoiding(() => draw(family.id as Family, rng), avoid),
  // read back from the id (a fact rebuilt from a task has only its id)
  answer: (f: Fact) => answerOf(parse(f.id)),
  answerType: () => 'int',
  prompt: (f: Fact) => scene(parse(f.id)),
  optionView: () => 'numeral',
  range: () => RANGE,
  speech: (f: Fact) => speech(f),
  candidates,
  hint: (f: Fact, tag) => hint(f, tag),
} satisfies SkillModule
