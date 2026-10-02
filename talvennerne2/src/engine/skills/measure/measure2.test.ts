// Tests for the measure skills of 1.–2. klasse (SK2-MEAS): measureUnits, rulerRead, weightCompare,
// unitChoice and readChart. Every skill runs the shared contract over all facts, 200 seeded instances
// per family and every kind through the real task builder (number/testing/harness.ts), with the SK2
// suite on top (algebra/testing/suite.ts: the id format, candidate tags against formulas worked out
// again here, A9, production and ceilings per kind, the diagnostic card, hints rebuilt from the id).
// weightCompare is perceptual and runs the same checks in testing/contract.ts. The blocks below add
// answers read from the prompt, the spoken questions and the strategies.
import { describe, expect, it } from 'vitest'
import measureUnitsModule from './measureUnits'
import rulerReadModule from './rulerRead'
import weightCompareModule, { type WeighScene } from './weightCompare'
import unitChoiceModule from './unitChoice'
import readChartModule from './readChart'
import { perceptualContract } from './testing/contract'
import { algebra2Suite, explainBy, textOf } from '../algebra/testing/suite'
import { factsUnderTest, globalIdCheck, tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { buildTask } from '../../tasks'
import { makeRng } from '../../rng'
import { isCorrect } from '../../answer'
import { compile } from '../../../speech/compile'
import type { AnswerValue, ErrorTag, Fact, Prompt, SkillDef, Task, TaskKind } from '../../types'

const measureUnits: SkillDef = measureUnitsModule
const rulerRead: SkillDef = rulerReadModule
const weightCompare: SkillDef = weightCompareModule
const unitChoice: SkillDef = unitChoiceModule
const readChart: SkillDef = readChartModule

/**
 * A fact by id: canonical, or an instance read back from the id the way the round rebuilds it (these
 * skills keep the whole instance in the id).
 */
function findFact(def: SkillDef, id: string): Fact {
  return def.enumerate().find((f) => f.id === id) ?? { id, skill: def.id, family: id.split(':')[1], operands: [], answer: 0, rank: 0 }
}
const taskOf = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, findFact(def, id), kind, makeRng(seed), 0).task
const hintText = (def: SkillDef, id: string, tag: ErrorTag | null, kind?: TaskKind): string => compile(def.hint(findFact(def, id), tag, kind).speech).text

function sceneOf<S extends Prompt['scene']>(t: Task, scene: S): Extract<Prompt, { scene: S }> {
  if (t.prompt.scene !== scene) throw new Error(`expected ${scene}, got ${t.prompt.scene}`)
  return t.prompt as Extract<Prompt, { scene: S }>
}

/** rulerRead's instance from its documented id: lin:<family>:<start>+<len>:<thing>. */
const lay = (f: Fact) => {
  const [start, len] = f.id.split(':')[2].split('+').map(Number)
  return { start, len, offset: f.family === 'offset' }
}
/** readChart's instance from its documented id: diag:<family>:<p|b>:<values>:<q>. */
const chartOf = (f: Fact) => {
  const [, , chart, values, q] = f.id.split(':')
  return { chart, values: values.split('-').map(Number), q }
}

describe('the measure skills of 1.–2. klasse: contract and SK2 suite', () => {
  globalIdCheck()

  algebra2Suite(measureUnits, {
    families: { cubes: 20, clips: 20 },
    idFormat: /^maal:(cubes|clips):\d{1,2}:[a-z]+$/,
    answerOf: (_f, _kind, task) => sceneOf(task, 'unitsRow').length,
    explain: (_f, v) => explainBy(v, -1, [], []),
    formulaValues: () => [],
    ceilings: { choice: 3, keypad: 5 },
  })

  algebra2Suite(rulerRead, {
    families: { from0: 20, offset: 20 },
    idFormat: /^lin:(from0|offset):\d\+\d{1,2}:[a-z]+$/,
    answerOf: (_f, _kind, task) => sceneOf(task, 'ruler').lengthCm ?? -1,
    explain(f, v) {
      const { start, len, offset } = lay(f)
      // rulerEnd: the end mark, or the marks counted (len + 1); the start mark is a number on the card
      return explainBy(v, len, offset ? [['rulerEnd', start + len], ['rulerEnd', len + 1]] : [], offset ? [start] : [])
    },
    formulaValues(f) {
      const { start, len, offset } = lay(f)
      return offset ? [start + len, len + 1, start] : []
    },
    ceilings: { choice: 3, keypad: 5 },
  })

  algebra2Suite(readChart, {
    families: { readPicto: 20, readBar: 20, mostLeast: 20, difference: 20 },
    idFormat: /^diag:(readPicto|readBar|mostLeast|difference):[pb]:\d{1,2}(-\d{1,2}){2,3}:([1-4]|most|least|diff)$/,
    answerOf: (_f, _kind, task) => chartAnswer(task),
    explain(f, v) {
      const { values, q } = chartOf(f)
      const sum = Math.max(...values) + Math.min(...values)
      return explainBy(v, f.answer, q === 'diff' ? [['wrongOperation', sum]] : [], values)
    },
    formulaValues(f) {
      const { values, q } = chartOf(f)
      return q === 'diff' ? [Math.max(...values) + Math.min(...values), ...values] : values
    },
    ceilings: { choice: 3, keypad: 5 },
  })

  algebra2Suite(unitChoice, {
    families: { length: 16, weight: 8 },
    idFormat: /^enh:(length|weight):[a-z]+$/,
    answerOf: (f, kind, task) => (kind === 'multiSelect' ? sameUnit(f, task) : `unit:${UNIT_OF[thingOf(f)]}`),
    explain: (_f, v) => explainBy(v, '', [], []),
    formulaValues: () => [],
    ceilings: { choice: 3, multiSelect: 5 },
  })

  perceptualContract(weightCompare, {
    families: { congruent: 6, conflict: 6 },
    idFormat: /^vgt:[gk][1-6]$/,
    answerOf: (_f, kind, task) => heaviestOf(task, kind),
    ceilings: { choice: 3, multiSelect: 5 },
  })
})

// ─── measureUnits ───────────────────────────────────────────────────────────

describe('measureUnits', () => {
  const tasks = tasksUnderTest(measureUnits)

  it('lays a long thing over a row of cubes (2–12) or clips (2–10) that reach end to end', () => {
    for (const { fact, task } of tasks) {
      const s = sceneOf(task, 'unitsRow')
      expect(s.unit).toBe(fact.family === 'cubes' ? 'cube' : 'clip')
      expect(s.length).toBeGreaterThanOrEqual(2)
      expect(s.length).toBeLessThanOrEqual(fact.family === 'cubes' ? 12 : 10)
      expect(['pencil', 'crayon', 'brush', 'rope', 'ribbon', 'stick', 'straw', 'worm', 'scarf']).toContain(s.object)
      expect(textOf(task)).toBe(fact.family === 'cubes' ? 'Hvor mange klodser lang er tingen?' : 'Hvor mange clips lang er tingen?')
      if (task.kind === 'keypad') expect([task.range, task.maxDigits, task.unit]).toEqual([[0, 15], 2, null])
    }
  })

  it('takes one unit off or on as near, two as other', () => {
    const t = taskOf(measureUnits, 'maal:cubes:7:pencil', 'keypad')
    expect([classifyAnswer(t, 6), classifyAnswer(t, 8), classifyAnswer(t, 9), classifyAnswer(t, 12)]).toEqual(['near', 'near', 'other', 'other'])
    expect(detectableOf(t)).toEqual([])
  })

  it('counts the units, pointing at each one', () => {
    expect(hintText(measureUnits, 'maal:cubes:7:pencil', null)).toBe('Tæl klodserne under tingen. Peg på hver klods, mens du tæller. Tingen er syv klodser lang.')
    expect(hintText(measureUnits, 'maal:clips:4:worm', 'near')).toBe('Tæl langsomt, og tæl hver enkelt en gang. Tæl clipsene under tingen. Peg på hver clips, mens du tæller. Tingen er fire clips lang.')
    expect(measureUnits.hint(findFact(measureUnits, 'maal:clips:4:worm'), null).visual).toEqual({ scene: 'unitsRow', object: 'worm', unit: 'clip', length: 4 })
  })

  it('gives counting time: 0.7 s a unit', () => {
    const f = findFact(measureUnits, 'maal:cubes:10:rope')
    expect(measureUnits.fastMs?.(f, 'keypad')).toBe(11_000)
    expect(measureUnits.fastMs?.(f, 'choice')).toBe(10_000)
  })
})

// ─── rulerRead ──────────────────────────────────────────────────────────────

describe('rulerRead', () => {
  const facts = factsUnderTest(rulerRead)
  const tasks = tasksUnderTest(rulerRead)

  it('lays the thing from 0 (from0) or from 1–5 (offset) on the ruler, inside 20 cm', () => {
    for (const f of facts) {
      const { start, len, offset } = lay(f)
      if (offset) {
        expect(start).toBeGreaterThanOrEqual(1)
        expect(start).toBeLessThanOrEqual(5)
        expect(len).toBeLessThanOrEqual(12)
        expect(start + len).toBeLessThanOrEqual(17)
      } else {
        expect(start).toBe(0)
        expect(len).toBeLessThanOrEqual(15)
      }
      expect(len).toBeGreaterThanOrEqual(2)
    }
    for (const { fact, task } of tasks) {
      expect(sceneOf(task, 'ruler')).toMatchObject({ startCm: lay(fact).start, lengthCm: lay(fact).len })
      expect(textOf(task)).toBe('Hvor mange centimeter lang er tingen?')
      if (task.kind === 'keypad') expect([task.unit, task.range]).toEqual(['cm', [0, 20]])
    }
  })

  it('reads the end mark and the marks counted as rulerEnd, the start as an operand, and A9 as ambiguous', () => {
    const t = taskOf(rulerRead, 'lin:offset:2+7:worm', 'keypad')
    expect(t.answer).toBe(7)
    expect(classifyAnswer(t, 9)).toBe('rulerEnd')
    expect(classifyAnswer(t, 8)).toBe('rulerEnd')
    expect(classifyAnswer(t, 2)).toBe('operand')
    expect(classifyAnswer(t, 6)).toBe('near')
    expect(classifyAnswer(t, 5)).toBe('other')
    // five to nine is four long; five is the start mark and the marks counted: never evidence
    expect(classifyAnswer(taskOf(rulerRead, 'lin:offset:5+4:pencil', 'keypad'), 5)).toBe('ambiguous')
    // from 0 the end mark is the length, and one more cannot be told from a slip
    const zero = taskOf(rulerRead, 'lin:from0:0+7:pencil', 'keypad')
    expect(classifyAnswer(zero, 8)).toBe('near')
    expect(detectableOf(zero)).toEqual([])
    expect(detectableOf(t)).toEqual(['rulerEnd'])
  })

  it('shows the rulerEnd card on offset cards', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'choice' || fact.family !== 'offset') continue
      expect(Object.values(task.distractorTags), fact.id).toContain('rulerEnd')
      expect(task.options.some((o) => task.distractorTags[String(o)] === 'rulerEnd'), fact.id).toBe(true)
    }
  })

  it('counts the centimetres from start to end, and moves the thing to 0 for rulerEnd', () => {
    expect(hintText(rulerRead, 'lin:from0:0+7:pencil', null)).toBe('Tingen starter ved nul. Den slutter ved syv. Så er den syv centimeter lang.')
    expect(hintText(rulerRead, 'lin:offset:2+7:worm', null)).toBe('Tingen starter ved to. Den starter ikke ved nul. Tæl centimeterne fra to til ni. Så er den syv centimeter lang.')
    const h = rulerRead.hint(findFact(rulerRead, 'lin:offset:2+7:worm'), 'rulerEnd')
    expect(compile(h.speech).text).toMatch(/^Tallet, hvor tingen slutter, er kun længden, når tingen starter ved nul\. /)
    expect(h).toMatchObject({ misconception: 'rulerEnd', visual: { scene: 'ruler', object: 'worm', startCm: 0, lengthCm: 7 } })
    expect(rulerRead.hint(findFact(rulerRead, 'lin:offset:2+7:worm'), null).visual).toEqual({ scene: 'line', min: 0, max: 15, hops: [2, 3, 4, 5, 6, 7, 8, 9] })
    expect(compile(rulerRead.hint(findFact(rulerRead, 'lin:offset:3+1:worm'), null).speech).text).toContain('en centimeter lang')
  })
})

// ─── weightCompare ──────────────────────────────────────────────────────────

/** The test's own knowledge of the things: heavy ones always outweigh the teddy and the light ones. */
const HEAVY_THINGS = new Set(['stone', 'bottle', 'book'])
const LIGHT_THINGS = new Set(['feather', 'balloon', 'leaf', 'flower', 'key', 'strawberry', 'marble', 'pillow'])

function heaviestOf(task: Task, kind: TaskKind): AnswerValue {
  const s = sceneOf(task, 'compareObjects')
  if (kind === 'multiSelect') return s.objects.slice(1).flatMap((o, i) => (HEAVY_THINGS.has(o) ? [`o${i}`] : [])).sort().join('|')
  const heavy = s.objects.filter((o) => HEAVY_THINGS.has(o))
  return heavy.length === 1 ? `obj:${heavy[0]}` : 'two heavy things'
}

describe('weightCompare', () => {
  const tasks = tasksUnderTest(weightCompare)
  const bigger = (s: Extract<Prompt, { scene: 'compareObjects' }>) => s.objects.slice(1).flatMap((_, i) => (s.sizes[i + 1] > s.sizes[0] ? [`o${i}`] : [])).join('|')

  it('weighs heavy against light only: three things on the card, the teddy and six on multiSelect', () => {
    for (const { fact, kind, task } of tasks) {
      const s = sceneOf(task, 'compareObjects')
      expect(s.mode).toBe('weight')
      for (const o of s.objects) expect(HEAVY_THINGS.has(o) || LIGHT_THINGS.has(o) || o === 'teddy', o).toBe(true)
      expect((s as WeighScene).weights).toHaveLength(s.objects.length)
      if (kind === 'choice') {
        expect(s.objects).toHaveLength(3)
        expect(s.objects.filter((o) => HEAVY_THINGS.has(o))).toHaveLength(1)
        expect(textOf(task)).toBe('Hvilken ting er tungest?')
        expect([...task.options].sort()).toEqual(s.objects.map((o) => `obj:${o}`).sort())
      } else {
        expect(s.objects[0]).toBe('teddy')
        expect(s.objects).toHaveLength(7)
        expect(s.objects.slice(1).every((o) => o !== 'pillow'), fact.id).toBe(true)
        expect(task.options).toEqual(['o0', 'o1', 'o2', 'o3', 'o4', 'o5'])
        expect(textOf(task)).toBe('Tryk på alle de ting, der er tungere end bamsen.')
      }
    }
  })

  it('is a conflict exactly when size misleads: the biggest is not the heaviest, the teddy\'s bigger ones not the heavier', () => {
    for (const { fact, kind, task } of tasks) {
      const s = sceneOf(task, 'compareObjects')
      const misleads = kind === 'choice' ? s.objects[s.sizes.indexOf(Math.max(...s.sizes))] !== String(task.answer).slice(4) : bigger(s) !== task.answer
      expect(task.contrast, `${fact.id} ${kind}`).toBe(misleads ? 'conflict' : 'congruent')
      expect(fact.family).toBe(task.contrast)
    }
  })

  it('offers the biggest thing as the sizeIsWeight card, and the things bigger than the teddy as the sizeIsWeight set', () => {
    for (const { fact, kind, task } of tasks) {
      const s = sceneOf(task, 'compareObjects')
      expect(detectableOf(task)).toContain('sizeIsWeight')
      if (task.contrast !== 'conflict') {
        expect(Object.values(task.distractorTags), fact.id).not.toContain('sizeIsWeight')
        continue
      }
      if (kind === 'choice') {
        const big = `obj:${s.objects[s.sizes.indexOf(Math.max(...s.sizes))]}`
        expect(task.options).toContain(big)
        expect(classifyAnswer(task, big)).toBe('sizeIsWeight')
      } else {
        expect(classifyAnswer(task, bigger(s))).toBe('sizeIsWeight')
      }
    }
  })

  it('thinks of holding the things, and says that big is not heavy', () => {
    const k1 = findFact(weightCompare, 'vgt:k1')
    expect(compile(weightCompare.hint(k1, null, 'choice').speech).text).toBe('Tænk på, hvordan tingene føles, når du holder dem. En sten er tung, selv når den er lille.')
    const h = weightCompare.hint(k1, 'sizeIsWeight', 'choice')
    expect(compile(h.speech).text).toBe('Store ting er ikke altid tunge. En ballon er stor, men den er let. Tænk på, hvordan tingene føles, når du holder dem. En sten er tung, selv når den er lille.')
    expect(h.misconception).toBe('sizeIsWeight')
    expect(compile(weightCompare.hint(findFact(weightCompare, 'vgt:g4'), null, 'multiSelect').speech).text).toBe(
      'Tænk på hver ting for sig. Er den tungere at holde end bamsen? En flaske med vand er tung. En sten er tung. En bog er tung.',
    )
  })
})

// ─── unitChoice ─────────────────────────────────────────────────────────────

/** The test's own unit for each thing. */
const UNIT_OF: Readonly<Record<string, string>> = {
  pencil: 'cm', eraser: 'cm', spoon: 'cm', shoe: 'cm', carrot: 'cm', toothbrush: 'cm', worm: 'cm', leaf: 'cm',
  bus: 'm', train: 'm', pitch: 'm', pool: 'm', whale: 'm', plane: 'm', gym: 'm', house: 'm',
  feather: 'g', strawberry: 'g', key: 'g', letter: 'g', dog: 'kg', bike: 'kg', potatoes: 'kg', suitcase: 'kg',
}
const thingOf = (f: Fact) => f.id.split(':')[2]
const sameUnit = (f: Fact, task: Task) =>
  task.options.map(String).filter((o) => UNIT_OF[o.slice(3)] === UNIT_OF[thingOf(f)]).sort().join('|')

describe('unitChoice', () => {
  const tasks = tasksUnderTest(unitChoice)

  it('asks for the unit of a named thing on three spoken unit cards', () => {
    for (const { fact, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'hear' })
      const length = fact.family === 'length'
      if (kind === 'choice') {
        expect(task.optionView).toBe('unitWord')
        const near = length ? (UNIT_OF[thingOf(fact)] === 'cm' ? 'unit:m' : 'unit:cm') : UNIT_OF[thingOf(fact)] === 'g' ? 'unit:kg' : 'unit:g'
        expect(task.options).toContain(near)
        expect(task.distractorTags[near]).toBe('near')
        const other = task.options.find((o) => o !== task.answer && o !== near)!
        expect(length ? ['unit:g', 'unit:kg'] : ['unit:cm', 'unit:m']).toContain(other)
        expect(task.optionClips).toEqual(task.options.map((o) => `noun.unit.${String(o).slice(5)}.end`))
        expect(textOf(task)).toMatch(length ? /^Hvad måler man længden af .+ i\?$/ : /^Hvad måler man vægten af .+ i\?$/)
      } else {
        expect(task.optionView).toBe('token')
        expect(task.options).toHaveLength(6)
        expect(task.options).toContain(`mt:${thingOf(fact)}`)
        for (const o of task.options) expect(Object.keys(UNIT_OF)).toContain(String(o).slice(3))
        // one kind of measure on one card set
        const units = new Set(task.options.map((o) => UNIT_OF[String(o).slice(3)]))
        expect(units).toEqual(new Set(length ? ['cm', 'm'] : ['g', 'kg']))
        expect(task.optionClips).toEqual(task.options.map((o) => `noun.mt.${String(o).slice(3)}`))
        expect(isCorrect(task, String(task.answer).split('|').reverse().join('|'))).toBe(true)
      }
    }
  })

  it('reads the questions and the cards aloud', () => {
    expect(textOf(taskOf(unitChoice, 'enh:length:bus', 'choice'))).toBe('Hvad måler man længden af en bus i?')
    expect(textOf(taskOf(unitChoice, 'enh:length:bus', 'multiSelect'))).toBe('Tryk på alle de ting, man måler i meter.')
    expect(textOf(taskOf(unitChoice, 'enh:weight:dog', 'choice'))).toBe('Hvad måler man vægten af en hund i?')
    expect(compile([{ clip: 'noun.mt.pool' }]).text).toBe('Et svømmebassin.')
  })

  it('says the rule and the unit of the thing', () => {
    expect(hintText(unitChoice, 'enh:length:bus', null)).toBe('Små ting måler vi i centimeter, og store ting måler vi i meter. En bus måler man i meter.')
    expect(hintText(unitChoice, 'enh:length:pencil', 'other')).toBe(
      'Centimeter og meter bruger vi til at måle, hvor langt noget er. Små ting måler vi i centimeter, og store ting måler vi i meter. En blyant måler man i centimeter.',
    )
    expect(hintText(unitChoice, 'enh:weight:feather', null)).toBe('Lette ting vejer vi i gram, og tunge ting vejer vi i kilogram. En fjer vejer man i gram.')
  })
})

// ─── readChart ──────────────────────────────────────────────────────────────

const PLACES = ['første', 'anden', 'tredje', 'fjerde']

/** The answer from the chart in the prompt and the spoken question alone. */
function chartAnswer(task: Task): number {
  const values = sceneOf(task, 'chart').data.map((d) => d.n)
  const q = textOf(task)
  if (/flere|højere/.test(q)) return Math.max(...values) - Math.min(...values)
  if (/længste|højeste/.test(q)) return Math.max(...values)
  if (/korteste|laveste/.test(q)) return Math.min(...values)
  return values[PLACES.findIndex((p) => q.includes(` ${p} `))]
}

describe('readChart', () => {
  const facts = factsUnderTest(readChart)
  const tasks = tasksUnderTest(readChart)

  it('draws 3–4 different counts, a pictogram up to 8 and bars up to 10', () => {
    for (const f of facts) {
      const { chart, values } = chartOf(f)
      expect(new Set(values).size).toBe(values.length)
      expect(values.length).toBeGreaterThanOrEqual(3)
      expect(values.length).toBeLessThanOrEqual(4)
      expect(Math.min(...values)).toBeGreaterThanOrEqual(2)
      expect(Math.max(...values)).toBeLessThanOrEqual(chart === 'p' ? 8 : 10)
      if (f.family === 'readPicto') expect(chart).toBe('p')
      if (f.family === 'readBar') expect(chart).toBe('b')
    }
    for (const { fact, task } of tasks) {
      const s = sceneOf(task, 'chart')
      expect(s.kind).toBe(chartOf(fact).chart === 'p' ? 'picto' : 'bar')
      expect(new Set(s.data.map((d) => d.cat)).size).toBe(s.data.length)
    }
  })

  it('asks by place or by the extremes', () => {
    expect(textOf(taskOf(readChart, 'diag:readBar:b:4-7-2:3', 'keypad'))).toBe('Hvor høj er den tredje søjle?')
    expect(textOf(taskOf(readChart, 'diag:readPicto:p:5-3-6-2:1', 'keypad'))).toBe('Hvor mange stjerner er der i den første række?')
    expect(textOf(taskOf(readChart, 'diag:mostLeast:b:4-7-2:least', 'choice'))).toBe('Hvor høj er den laveste søjle?')
    expect(textOf(taskOf(readChart, 'diag:difference:p:5-3-6:diff', 'choice'))).toBe('Hvor mange flere stjerner er der i den længste række end i den korteste?')
    expect(textOf(taskOf(readChart, 'diag:difference:b:4-9-2:diff', 'choice'))).toBe('Hvor meget højere er den højeste søjle end den laveste?')
  })

  it('reads another bar as an operand, and the two numbers added as wrongOperation', () => {
    const bar = taskOf(readChart, 'diag:readBar:b:4-7-2:2', 'keypad')
    expect(bar.answer).toBe(7)
    expect([classifyAnswer(bar, 4), classifyAnswer(bar, 2), classifyAnswer(bar, 8), classifyAnswer(bar, 9)]).toEqual(['operand', 'operand', 'near', 'other'])
    const diff = taskOf(readChart, 'diag:difference:b:4-9-2:diff', 'keypad')
    expect(diff.answer).toBe(7)
    expect(classifyAnswer(diff, 11)).toBe('wrongOperation')
    expect(classifyAnswer(diff, 9)).toBe('operand')
    expect(detectableOf(diff)).toEqual(['wrongOperation'])
    expect(taskOf(readChart, 'diag:difference:b:4-9-2:diff', 'choice').options).toContain(11)
  })

  it('counts the stars, follows the top of the bar, and takes the low number from the high one', () => {
    expect(hintText(readChart, 'diag:readPicto:p:5-3-6-2:1', null)).toBe('Tæl stjernerne i rækken en ad gangen. Der er fem stjerner.')
    expect(hintText(readChart, 'diag:readBar:b:4-7-2:2', 'near')).toBe('Se på stregen lige ud for toppen af søjlen. Følg toppen af søjlen hen til tallene ved siden af. Søjlen når op til syv.')
    expect(hintText(readChart, 'diag:mostLeast:b:4-7-2:most', 'operand')).toBe('Find den rigtige søjle først. Find den højeste søjle først. Følg toppen af søjlen hen til tallene ved siden af. Søjlen når op til syv.')
    const h = readChart.hint(findFact(readChart, 'diag:difference:b:4-9-2:diff'), 'wrongOperation')
    expect(compile(h.speech).text).toBe('Når du skal finde ud af, hvor mange flere der er, skal du trække fra. Den højeste søjle når op til ni og den laveste når op til to. Ni minus to giver syv.')
    expect(h).toMatchObject({ misconception: 'wrongOperation', visual: { scene: 'line', min: 0, max: 10, hops: [2, 9] } })
  })
})
