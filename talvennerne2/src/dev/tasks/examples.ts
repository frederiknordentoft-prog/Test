// Example tasks per kind for the task harness (dev only). Hand-built Task objects in the shapes the
// skills will produce (src/engine/types.ts), so every view, prompt scene, face and strategy can be
// played before the real SkillDefs exist. Each has a wrong answer worth trying (`wrong`), chosen to
// show a misconception's strategy where there is one.
import type { AnswerValue, ErrorTag, Prompt, SkillId, SpeechPart, Task, TaskKind } from '../../engine/types'

export interface Example {
  id: string
  title: string
  task: Task
  /** A wrong answer that shows an interesting strategy. */
  wrong: AnswerValue
}

type Base = Pick<Task, 'skill' | 'kind' | 'prompt' | 'answer'> & Partial<Task>

function mk(id: string, t: Base): Task {
  return {
    id: `${id}#1`,
    factId: id,
    masteryKey: id,
    family: 'all',
    answerType: typeof t.answer === 'number' ? 'int' : 'token',
    accept: [],
    tolerance: 0,
    modulo: 0,
    options: [],
    optionView: 'numeral',
    distractorTags: {},
    optionClips: null,
    unit: null,
    entryScale: 1,
    range: [0, 20],
    maxDigits: 2,
    scaffold: false,
    speech: [],
    retryOf: null,
    ...t,
  }
}

const eq = (a: number, op: '+' | '−' | '·' | ':', b: number): Prompt => ({ scene: 'equation', terms: [{ n: a }, { op }, { n: b }, { op: '=' }, { blank: true }] })
const ask = (a: number, op: string, b: number): SpeechPart[] => [{ clip: 'frag.hvad_er' }, { num: a, form: 'mid' }, { clip: op }, { num: b, form: 'end' }]
const tags = (m: Record<string, ErrorTag>) => m

export const EXAMPLES: Record<TaskKind, Example[]> = {
  choice: [
    {
      id: 'choice-8+5', title: '8 + 5 (tal)', wrong: 12,
      task: mk('add:8+5', {
        skill: 'addTo20', kind: 'choice', prompt: eq(8, '+', 5), answer: 13, options: [12, 13, 14],
        distractorTags: tags({ '12': 'countFromFirst', '14': 'near' }), speech: [{ clip: 'q.add:8+5' }],
      }),
    },
    {
      id: 'choice-unit', title: 'Enhed (ord læses op)', wrong: 'unit:kg',
      task: mk('unit:pencil', {
        skill: 'unitChoice', kind: 'choice', prompt: { scene: 'compareObjects', objects: ['pencil'], sizes: [1], aligned: true, mode: 'length' },
        answer: 'unit:cm', options: ['unit:cm', 'unit:m', 'unit:kg'], optionView: 'unitWord',
        optionClips: ['noun.unit.cm.end', 'noun.unit.m.end', 'noun.unit.kg.end'], speech: [{ free: 'Hvad måler man en blyant i?' }],
      }),
    },
    {
      id: 'choice-shape', title: 'Find trekanten (figurkort)', wrong: 'shape:square:0',
      task: mk('shp:triangle:1', {
        skill: 'shapes2D', kind: 'choice', prompt: { scene: 'hear' }, answer: 'shape:triangle:1',
        options: ['shape:circle:0', 'shape:triangle:1', 'shape:square:0'], optionView: 'shape',
        distractorTags: tags({ 'shape:square:0': 'other' }), speech: [{ clip: 'frag.tryk_paa' }, { clip: 'noun.shape.triangle.def.end' }],
      }),
    },
    {
      id: 'choice-clock', title: 'Ur (analoge kort)', wrong: 150,
      task: mk('clk:180', {
        skill: 'clockHour', kind: 'choice', prompt: { scene: 'hear' }, answer: 180, answerType: 'minutes', modulo: 720,
        options: [150, 180, 240], optionView: 'clock', range: [0, 719], speech: [{ clip: 'frag.klokken_er' }, { clock: { minutes: 180, style: 'analog', form: 'end' } }],
      }),
    },
    {
      id: 'choice-weight', title: 'Tungest (billeder)', wrong: 'obj:balloon',
      task: mk('wgt:7', {
        skill: 'weightCompare', kind: 'choice', prompt: { scene: 'compareObjects', objects: ['balloon', 'stone'], sizes: [6, 3], aligned: true, mode: 'weight' },
        answer: 'obj:stone', options: ['obj:balloon', 'obj:stone'], optionView: 'picture', distractorTags: tags({ 'obj:balloon': 'sizeIsWeight' }),
        speech: [{ free: 'Hvad er tungest?' }], contrast: 'conflict',
      }),
    },
  ],
  keypad: [
    {
      id: 'keypad-38+45', title: '38 + 45 (glemt mente)', wrong: 73,
      task: mk('add:38+45', {
        skill: 'add100Carry', kind: 'keypad', family: 'TOplusTOcarry', masteryKey: 'add100Carry/TOplusTOcarry', prompt: eq(38, '+', 45), answer: 83,
        range: [0, 100], maxDigits: 3, distractorTags: tags({ '73': 'forgotCarry', '84': 'near', '38': 'operand', '45': 'operand' }), speech: ask(38, 'op.plus', 45),
      }),
    },
    {
      id: 'keypad-hear53', title: 'Hør 53 (byttede cifre)', wrong: 35,
      task: mk('h100:53', {
        skill: 'hear100', kind: 'keypad', prompt: { scene: 'hear' }, answer: 53, range: [0, 100], maxDigits: 3,
        distractorTags: tags({ '35': 'digitSwap', '54': 'near' }), speech: [{ num: 53, form: 'end' }],
      }),
    },
    {
      id: 'keypad-52-37', title: '52 − 37 (mindste fra største)', wrong: 25,
      task: mk('sub:52-37', {
        skill: 'sub100Borrow', kind: 'keypad', prompt: eq(52, '−', 37), answer: 15, range: [0, 100], maxDigits: 3,
        distractorTags: tags({ '25': 'smallerFromLarger', '16': 'near' }), speech: ask(52, 'op.minus', 37),
      }),
    },
    {
      id: 'keypad-kr', title: 'Mønter i alt (kr)', wrong: 1600,
      task: mk('cc:1700', {
        skill: 'countCoins', kind: 'keypad', prompt: { scene: 'coins', ore: [1000, 500, 200] }, answer: 1700, answerType: 'ore',
        entryScale: 100, unit: 'kr', range: [0, 5000], maxDigits: 2, speech: [{ clip: 'frag.hvor_mange_penge' }, { free: 'er der?' }],
      }),
    },
    {
      id: 'keypad-cm', title: 'Lineal (cm)', wrong: 10,
      task: mk('rul:9', {
        skill: 'rulerRead', kind: 'keypad', prompt: { scene: 'ruler', object: 'pencil', startCm: 0, lengthCm: 9 }, answer: 9, unit: 'cm',
        range: [0, 15], maxDigits: 2, speech: [{ free: 'Hvor lang er blyanten?' }],
      }),
    },
  ],
  countTap: [
    {
      id: 'count-7', title: 'Læg 7 i kurven', wrong: 6,
      task: mk('c10:scatter:7', {
        skill: 'count10', kind: 'countTap', prompt: { scene: 'objects', n: 12, layout: 'row', thing: 'carrot' }, answer: 7, range: [0, 12],
        speech: [{ clip: 'frag.laeg' }, { num: 7, form: 'mid' }, { clip: 'noun.thing.carrot.pl' }, { clip: 'frag.i_kurven' }],
      }),
    },
    {
      id: 'count-14', title: 'Læg 14 æbler', wrong: 13,
      task: mk('c20:loose:14', {
        skill: 'count20', kind: 'countTap', prompt: { scene: 'objects', n: 24, layout: 'row', thing: 'apple' }, answer: 14, range: [0, 24],
        speech: [{ clip: 'frag.laeg' }, { num: 14, form: 'mid' }, { clip: 'noun.thing.apple.pl' }, { clip: 'frag.i_kurven' }],
      }),
    },
  ],
  pair: [
    {
      id: 'pair-3', title: 'Tiervenner: 3', wrong: 6,
      task: mk('ten:3', {
        skill: 'tenFriends', kind: 'pair', prompt: { scene: 'objects', n: 3, layout: 'tenframe', thing: 'ball' },
        answer: 7, options: [6, 7, 8, 2], range: [0, 10], distractorTags: tags({ '6': 'near', '8': 'near' }), speech: [{ clip: 'q.ten:3' }],
      }),
    },
  ],
  numberline: [
    {
      id: 'line-37', title: 'Hvor er 37? (0–100)', wrong: 55,
      task: mk('nl100:37', {
        skill: 'numberLine100', kind: 'numberline', family: 'placeAny', prompt: { scene: 'line', min: 0, max: 100 }, answer: 37,
        tolerance: 5, range: [0, 100], maxDigits: 3, speech: [{ clip: 'frag.find_tallet' }, { num: 37, form: 'end' }],
      }),
    },
    {
      id: 'line-after7', title: 'Tallet efter 7 (0–10)', wrong: 6,
      task: mk('o20:after:7', {
        skill: 'order20', kind: 'numberline', family: 'after', masteryKey: 'order20/after', prompt: { scene: 'line', min: 0, max: 10 }, answer: 8,
        range: [0, 10], distractorTags: tags({ '7': 'operand', '9': 'near', '6': 'near' }), speech: [{ clip: 'frag.hvilket_tal_kommer_efter' }, { num: 7, form: 'end' }],
      }),
    },
    {
      id: 'line-600', title: 'Hvor er 600? (0–1000)', wrong: 300,
      task: mk('nl1000:600', {
        skill: 'numberLine1000', kind: 'numberline', prompt: { scene: 'line', min: 0, max: 1000 }, answer: 600,
        tolerance: 50, range: [0, 1000], maxDigits: 4, speech: [{ clip: 'frag.find_tallet' }, { num: 600, form: 'end' }],
      }),
    },
  ],
  trueFalse: [
    {
      id: 'tf-balance', title: 'Vippebræt 4 + 3 = 7', wrong: 'no',
      task: mk('eq:4+3=7', {
        skill: 'equalSides', kind: 'trueFalse', prompt: { scene: 'balance', left: [{ n: 4 }, { op: '+' }, { n: 3 }], right: [{ n: 7 }] },
        answer: 'yes', options: ['yes', 'no'], optionView: 'yesNo', speech: [{ free: 'Er der lige meget på begge sider?' }],
      }),
    },
    {
      id: 'tf-half', title: 'Delt i to lige store?', wrong: 'yes',
      task: mk('half:circle:u', {
        skill: 'halfShape', kind: 'trueFalse', prompt: { scene: 'shape', shape: 'circle', variant: 0, cut: 'unequal' },
        answer: 'no', options: ['yes', 'no'], optionView: 'yesNo', speech: [{ free: 'Er figuren delt i to lige store dele?' }],
      }),
    },
  ],
  sortOrder: [
    {
      id: 'sort-numbers', title: 'Mindste først', wrong: '5|12|8|19',
      task: mk('o100:sort', {
        skill: 'order100', kind: 'sortOrder', prompt: { scene: 'hear' }, answer: '5|8|12|19', answerType: 'token',
        options: [12, 5, 19, 8], range: [0, 100], speech: [{ free: 'Sæt tallene i rækkefølge. Det mindste først.' }],
      }),
    },
    {
      id: 'sort-lengths', title: 'Længste først', wrong: 'obj:brush|obj:ribbon|obj:pencil|obj:straw',
      task: mk('lng:o3', {
        skill: 'compareLength', kind: 'sortOrder',
        prompt: { scene: 'compareObjects', objects: ['pencil', 'ribbon', 'straw', 'brush'], sizes: [6, 9, 4, 7], aligned: false, mode: 'length', starts: [3, 0, 5, 4] } as Prompt,
        answer: 'obj:ribbon|obj:brush|obj:pencil|obj:straw', answerType: 'set', options: ['obj:pencil', 'obj:straw', 'obj:ribbon', 'obj:brush'], optionView: 'picture',
        distractorTags: tags({ 'obj:brush|obj:ribbon|obj:pencil|obj:straw': 'lengthByEnd' }), speech: [{ free: 'Sæt tingene i rækkefølge. Start med den længste.' }], contrast: 'conflict',
      }),
    },
  ],
  multiSelect: [
    {
      id: 'multi-triangles', title: 'Alle trekanter', wrong: 's1',
      task: mk('shp:sel:tri', {
        skill: 'shapes2D', kind: 'multiSelect',
        prompt: { scene: 'shapes', items: [
          { id: 's0', shape: 'circle', variant: 0 }, { id: 's1', shape: 'triangle', variant: 0 }, { id: 's2', shape: 'square', variant: 1 },
          { id: 's3', shape: 'rectangle', variant: 2 }, { id: 's4', shape: 'triangle', variant: 2 }, { id: 's5', shape: 'triangle', variant: 4 },
        ] },
        answer: 's1|s4|s5', answerType: 'set', options: ['s0', 's1', 's2', 's3', 's4', 's5'], optionView: 'shape',
        speech: [{ free: 'Tryk på alle trekanterne.' }],
      }),
    },
    {
      id: 'multi-heavier', title: 'Tungere end bamsen', wrong: 'o0|o3',
      task: mk('wgt:sel:2', {
        skill: 'weightCompare', kind: 'multiSelect',
        prompt: { scene: 'compareObjects', objects: ['teddy', 'pillow', 'stone', 'book', 'balloon', 'marble', 'feather'], sizes: [4, 7, 2, 4, 6, 1, 3], aligned: true, mode: 'weight' },
        answer: 'o1|o2', answerType: 'set', options: ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'], optionView: 'picture',
        distractorTags: tags({ 'o0|o3': 'sizeIsWeight' }), speech: [{ free: 'Tryk på alle dem, der er tungere end bamsen.' }], contrast: 'conflict',
      }),
    },
    {
      // unitChoice's own task (buildTask for enh:length:bus, seed 1): the prompt is the loudspeaker, the
      // six thing cards show a picture and the word (QA2 P3-8) and are read aloud
      id: 'multi-unit', title: 'Ting man måler i meter (billede og ord)', wrong: 'mt:bus|mt:ship|mt:spoon',
      task: mk('enh:length:bus', {
        skill: 'unitChoice', kind: 'multiSelect', family: 'length', prompt: { scene: 'hear' },
        answer: 'mt:bus|mt:ship', answerType: 'set', options: ['mt:spoon', 'mt:ship', 'mt:pencil', 'mt:worm', 'mt:bus', 'mt:comb'],
        optionView: 'token', optionClips: ['noun.mt.spoon', 'noun.mt.ship', 'noun.mt.pencil', 'noun.mt.worm', 'noun.mt.bus', 'noun.mt.comb'],
        range: [0, 1], maxDigits: 1, speech: [{ clip: 's.unitChoice.tapM' }],
      }),
    },
  ],
  fillSlots: [
    {
      id: 'fill-pattern', title: 'Perlemønster', wrong: 'pat:blue|pat:red',
      task: mk('pat:ab:1', {
        skill: 'patterns', kind: 'fillSlots', prompt: { scene: 'row', cells: ['pat:red', 'pat:blue', 'pat:red', 'pat:blue', null, null] },
        answer: 'pat:red|pat:blue', options: ['pat:red', 'pat:blue', 'pat:yellow'], optionView: 'patternToken', speech: [{ free: 'Hvad kommer så?' }],
      }),
    },
    {
      id: 'fill-skip', title: 'Tæl med 2', wrong: '7|8',
      task: mk('skip:2:2', {
        skill: 'skipCount', kind: 'fillSlots', prompt: { scene: 'row', cells: [2, 4, 6, null, null], step: 2 },
        answer: '8|10', options: [7, 8, 9, 10, 11, 12], speech: [{ free: 'Tæl videre med to ad gangen.' }],
      }),
    },
    {
      id: 'fill-fraction', title: 'Brøk: tæller og nævner', wrong: '4|3',
      task: mk('frac:3/4', {
        skill: 'fractionShape', kind: 'fillSlots', prompt: { scene: 'fraction', shape: 'circle', parts: 4, colored: 3, equal: true },
        answer: '3|4', options: [1, 2, 3, 4, 5, 6, 7, 8], optionView: 'fraction', speech: [{ free: 'Hvor stor en del er farvet?' }],
      }),
    },
  ],
  buildBase: [
    {
      id: 'base-34', title: 'Byg 34', wrong: 43,
      task: mk('to:34', {
        skill: 'tensOnes', kind: 'buildBase', family: 'build', prompt: { scene: 'equation', terms: [{ n: 34 }] }, answer: 34, range: [0, 99],
        distractorTags: tags({ '43': 'digitSwap' }), speech: [{ free: 'Byg tallet' }, { num: 34, form: 'end' }],
      }),
    },
    {
      id: 'base-205', title: 'Byg 205', wrong: 250,
      task: mk('pv:205', {
        skill: 'placeValue1000', kind: 'buildBase', family: 'zeroPlace', prompt: { scene: 'hear' }, answer: 205, range: [0, 999], maxDigits: 5,
        distractorTags: tags({ '250': 'zeroPlaceholder' }), speech: [{ free: 'Byg tallet' }, { num: 205, form: 'end' }],
      }),
    },
  ],
  clockSet: [
    {
      id: 'clock-half', title: 'Halv tre ("halv" ved næste time)', wrong: 210,
      task: mk('clk:150', {
        skill: 'clockHalf', kind: 'clockSet', prompt: { scene: 'clock', minutes: null, step: 30 }, answer: 150, answerType: 'minutes',
        modulo: 720, range: [0, 719], maxDigits: 3, distractorTags: tags({ '210': 'halfPastNext', '330': 'handsSwapped' }),
        speech: [{ clip: 'frag.stil_uret_saa_klokken_er' }, { clock: { minutes: 150, style: 'analog', form: 'end' } }],
      }),
    },
    {
      id: 'clock-hour', title: 'Klokken fire (hele timer)', wrong: 300,
      task: mk('clk:240', {
        skill: 'clockHour', kind: 'clockSet', prompt: { scene: 'clock', minutes: null, step: 60 }, answer: 240, answerType: 'minutes',
        modulo: 720, range: [0, 719], maxDigits: 3, distractorTags: tags({ '300': 'near', '180': 'near' }),
        speech: [{ clip: 'frag.stil_uret_saa_klokken_er' }, { clock: { minutes: 240, style: 'analog', form: 'end' } }],
      }),
    },
    {
      id: 'clock-quarter', title: 'Kvart i tre (kvarter)', wrong: 195,
      task: mk('clk:165', {
        skill: 'clockQuarter', kind: 'clockSet', prompt: { scene: 'clock', minutes: null, step: 15 }, answer: 165, answerType: 'minutes',
        modulo: 720, range: [0, 719], maxDigits: 3, distractorTags: tags({ '195': 'quarterDirection' }),
        speech: [{ clip: 'frag.stil_uret_saa_klokken_er' }, { clock: { minutes: 165, style: 'analog', form: 'end' } }],
      }),
    },
    {
      id: 'clock-digital', title: '14:30 fra det digitale ur (5 min)', wrong: 890,
      task: mk('cdig:870', {
        skill: 'clockDigital', kind: 'clockSet', family: 'digital24', masteryKey: 'clockDigital/digital24',
        prompt: { scene: 'clock', minutes: 870, digital: true, h24: true, step: 5 }, answer: 870, answerType: 'minutes',
        modulo: 1440, range: [0, 1439], maxDigits: 4, speech: [{ free: 'Stil uret, så det viser det samme som det digitale ur.' }],
      }),
    },
  ],
  pay: [
    {
      id: 'pay-17', title: 'Betal 17 kr', wrong: 1600,
      task: mk('pay:1700', {
        skill: 'payExact', kind: 'pay', family: 'to20', masteryKey: 'payExact/to20',
        prompt: { scene: 'shop', thing: 'apple', priceOre: 1700, purse: [2000, 1000, 500, 200, 100] }, answer: 1700, answerType: 'ore',
        unit: 'kr', range: [0, 2000], maxDigits: 2, distractorTags: tags({ '1600': 'near', '1800': 'near' }),
        speech: [{ clip: 'frag.betal' }, { money: { ore: 1700, form: 'end' } }],
      }),
    },
    {
      id: 'pay-fewest', title: 'Færrest mønter: 27 kr (mønt-sæt)', wrong: 'c1000|c1000|c500|c200',
      task: mk('pay:few:2700', {
        skill: 'payExact', kind: 'pay', family: 'fewestCoins', masteryKey: 'payExact/fewestCoins',
        prompt: { scene: 'shop', thing: 'ball', priceOre: 2700, purse: [2000, 1000, 500, 200, 100] }, answer: 'c2000|c500|c200', answerType: 'set',
        unit: 'kr', range: [0, 5000], speech: [{ clip: 'frag.betal' }, { money: { ore: 2700, form: 'end' } }, { free: 'med så få mønter som muligt.' }],
      }),
    },
    {
      id: 'pay-1250', title: 'Kroner og øre: 12,50 kr (sum som støtte)', wrong: 1200,
      task: mk('kro:1250', {
        skill: 'kronerOre', kind: 'pay', family: 'readAmount', masteryKey: 'kronerOre/readAmount', scaffold: true,
        prompt: { scene: 'shop', thing: 'strawberry', priceOre: 1250, purse: [2000, 1000, 500, 200, 100, 50] }, answer: 1250, answerType: 'ore',
        unit: 'kr', range: [0, 2000], speech: [{ clip: 'frag.betal' }, { money: { ore: 1250, form: 'end' } }],
      }),
    },
    {
      id: 'pay-75', title: 'Med sedler: 75 kr', wrong: 7000,
      task: mk('pay:7500', {
        skill: 'payExact', kind: 'pay', family: 'to100', masteryKey: 'payExact/to100',
        prompt: { scene: 'shop', thing: 'fish', priceOre: 7500, purse: [10000, 5000, 2000, 1000, 500, 200, 100] }, answer: 7500, answerType: 'ore',
        unit: 'kr', range: [0, 10000], speech: [{ clip: 'frag.betal' }, { money: { ore: 7500, form: 'end' } }],
      }),
    },
  ],
  share: [
    {
      id: 'share-12-3', title: 'Del 12 gulerødder på 3', wrong: -1,
      task: mk('div:12/3', {
        skill: 'shareEqually', kind: 'share', prompt: { scene: 'share', total: 12, recipients: 3, thing: 'carrot' }, answer: 4,
        range: [0, 12], speech: [{ free: 'Del gulerødderne lige mellem de tre tallerkener.' }],
      }),
    },
    {
      id: 'share-half-10', title: 'Halvdelen af 10 jordbær', wrong: -1,
      task: mk('fos:half:10', {
        skill: 'fractionOfSet', kind: 'share', family: 'halfOf', masteryKey: 'fractionOfSet/halfOf',
        prompt: { scene: 'share', total: 10, recipients: 2, thing: 'strawberry' }, answer: 5, range: [0, 10],
        speech: [{ clip: 'frag.halvdelen_af' }, { num: 10, form: 'end' }],
      }),
    },
    {
      id: 'share-20-4', title: 'Del 20 æbler på 4', wrong: -1,
      task: mk('div:20/4', {
        skill: 'shareEqually', kind: 'share', prompt: { scene: 'share', total: 20, recipients: 4, thing: 'apple' }, answer: 5,
        range: [0, 20], speech: [{ free: 'Del æblerne lige mellem de fire tallerkener.' }],
      }),
    },
  ],
  colorParts: [
    {
      id: 'parts-3/4', title: 'Farv 3/4 af cirklen', wrong: 'frac:1/4',
      task: mk('fs:3/4:circle', {
        skill: 'fractionShape', kind: 'colorParts', prompt: { scene: 'fraction', shape: 'circle', parts: 4, colored: 0, equal: true },
        answer: 'frac:3/4', optionView: 'fraction', distractorTags: tags({ 'frac:1/4': 'other' }),
        speech: [{ free: 'Farv' }, { frac: { n: 3, d: 4, form: 'end' } }],
      }),
    },
    {
      id: 'parts-1/2-rect', title: 'Farv 1/2 af rektanglet (4 dele)', wrong: 'frac:3/4',
      task: mk('fs:1/2:rect', {
        skill: 'fractionShape', kind: 'colorParts', prompt: { scene: 'fraction', shape: 'rect', parts: 4, colored: 0, equal: true },
        answer: 'frac:1/2', accept: ['frac:2/4'], optionView: 'fraction', speech: [{ free: 'Farv' }, { frac: { n: 1, d: 2, form: 'end' } }],
      }),
    },
    {
      id: 'parts-2/3-bar', title: 'Farv 2/3 af stangen', wrong: 'frac:1/3',
      task: mk('fs:2/3:bar', {
        skill: 'fractionShape', kind: 'colorParts', prompt: { scene: 'fraction', shape: 'bar', parts: 3, colored: 0, equal: true },
        answer: 'frac:2/3', optionView: 'fraction', speech: [{ free: 'Farv' }, { frac: { n: 2, d: 3, form: 'end' } }],
      }),
    },
    {
      id: 'parts-1/4-square', title: 'Farv 1/4 af kvadratet (foreslået form)', wrong: 'frac:2/4',
      task: mk('fs:1/4:square', {
        skill: 'fractionShape', kind: 'colorParts', prompt: { scene: 'fraction', shape: 'square', parts: 4, colored: 0, equal: true } as unknown as Prompt,
        answer: 'frac:1/4', optionView: 'fraction', speech: [{ free: 'Farv' }, { frac: { n: 1, d: 4, form: 'end' } }],
      }),
    },
  ],
  grid: [],
}

export const EXAMPLE_KINDS = (Object.keys(EXAMPLES) as TaskKind[]).filter((k) => EXAMPLES[k].length > 0)

export function exampleById(id: string): Example | undefined {
  for (const list of Object.values(EXAMPLES)) for (const e of list) if (e.id === id) return e
  return undefined
}

/** Display texts for clip ids the harness tasks use that no catalogue owns yet. */
export const DEV_TEXTS: Record<string, string> = {
  'noun.thing.carrot.pl': 'gulerødder',
  'noun.thing.apple.pl': 'æbler',
  'hint.addTo10': 'Læg dem sammen, og tæl dem alle.',
  'hint.add100Carry': 'Regn enerne først. Ti enere bliver til en tier.',
  'hint.weightCompare': 'Det store er ikke altid det tungeste.',
  'hint.hear20': 'Lyt efter, hvor mange tiere der er.',
  's.weight.heaviest': 'Hvad er tungest?',
  's.weight.heavierThanTeddy': 'Tryk på alle dem, der er tungere end bamsen.',
}

export type { SkillId }
