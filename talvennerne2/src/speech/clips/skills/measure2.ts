// Clips for the measure skills of 1.–2. klasse (SK2-MEAS: measureUnits, rulerRead, weightCompare,
// unitChoice, readChart): the Kan-bog lines, the questions and the strategy hints. compareLength (0.
// klasse) has its own file, clips/skills/measure.ts. Numbers are { num } parts and lengths { measure }
// parts (the unit words `noun.unit.*` live in clips/nouns.ts), so no text here has a digit.
//
// Wave 2 (Målebakken and Linealstien), in the measure sprite with the unit words. unitChoice's weight
// family (gram or kilogram) is 3. klasse (Markedet): its sentences and things are wave 3.
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'
import { ORDINALS, UNIT_THINGS } from '../../../engine/skills/measure/kit2'

const WAVE2: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.measureUnits': 'Jeg kan måle med klodser og clips.',
  's.cando.rulerRead': 'Jeg kan måle med en lineal.',
  's.cando.weightCompare': 'Jeg kan se, hvad der er tungest.',
  's.cando.unitChoice': 'Jeg kan vælge den rigtige enhed.',
  's.cando.readChart': 'Jeg kan aflæse søjlediagrammer og piktogrammer.',

  // measureUnits: "Tæl klodserne under tingen. Peg på hver klods, mens du tæller. Tingen er syv klodser lang."
  's.measureUnits.howManyCubes': 'Hvor mange klodser lang er tingen?',
  's.measureUnits.howManyClips': 'Hvor mange clips lang er tingen?',
  'hint.measureUnits.countCubes': 'Tæl klodserne under tingen. Peg på hver klods, mens du tæller.',
  'hint.measureUnits.countClips': 'Tæl clipsene under tingen. Peg på hver clips, mens du tæller.',
  'hint.measureUnits.thingIs': 'Tingen er',
  'hint.measureUnits.cubesLong': 'klodser lang.',
  'hint.measureUnits.clipsLong': 'clips lang.',
  'hint.measureUnits.eachOnce': 'Tæl langsomt, og tæl hver enkelt en gang.',

  // rulerRead: "Tingen starter ved to. Den starter ikke ved nul. Tæl centimeterne fra to til ni. Så er den
  // syv centimeter lang."
  's.rulerRead.howLong': 'Hvor mange centimeter lang er tingen?',
  'hint.rulerRead.startsAtZero': 'Tingen starter ved nul.',
  'hint.rulerRead.endsAt': 'Den slutter ved',
  'hint.rulerRead.soItIs': 'Så er den',
  'hint.rulerRead.long': 'lang.',
  'hint.rulerRead.startsAt': 'Tingen starter ved',
  'hint.rulerRead.notAtZero': 'Den starter ikke ved nul.',
  'hint.rulerRead.countFrom': 'Tæl centimeterne fra',
  'hint.rulerRead.to': 'til',
  // rulerEnd (said before the strategy, the thing moved to nul)
  'hint.rulerRead.endIsNotLength': 'Tallet, hvor tingen slutter, er kun længden, når tingen starter ved nul.',
  'hint.rulerRead.startIsNotLength': 'Tallet, hvor tingen starter, er ikke længden.',
  'hint.rulerRead.countSpaces': 'Tæl mellemrummene mellem stregerne, ikke stregerne.',

  // weightCompare
  's.weightCompare.heaviest': 'Hvilken ting er tungest?',
  's.weightCompare.heavierThanTeddy': 'Tryk på alle de ting, der er tungere end bamsen.',
  'hint.weightCompare.thinkHold': 'Tænk på, hvordan tingene føles, når du holder dem.',
  'hint.weightCompare.thinkTeddy': 'Tænk på hver ting for sig. Er den tungere at holde end bamsen?',
  // sizeIsWeight
  'hint.weightCompare.bigNotHeavy': 'Store ting er ikke altid tunge. En ballon er stor, men den er let.',
  'hint.weightCompare.heavy.stone': 'En sten er tung.',
  'hint.weightCompare.heavy.bottle': 'En flaske med vand er tung.',
  'hint.weightCompare.heavy.book': 'En bog er tung.',
  'hint.weightCompare.heavyEvenSmall.stone': 'En sten er tung, selv når den er lille.',
  'hint.weightCompare.heavyEvenSmall.bottle': 'En flaske med vand er tung, selv når den er lille.',
  'hint.weightCompare.heavyEvenSmall.book': 'En bog er tung, selv når den er lille.',

  // unitChoice (length): "Små ting måler vi i centimeter, og store ting måler vi i meter. En bus måler man i meter."
  's.unitChoice.tapCm': 'Tryk på alle de ting, man måler i centimeter.',
  's.unitChoice.tapM': 'Tryk på alle de ting, man måler i meter.',
  'hint.unitChoice.lengthRule': 'Små ting måler vi i centimeter, og store ting måler vi i meter.',
  'hint.unitChoice.measuredIn': 'måler man i',
  'hint.unitChoice.lengthUnits': 'Centimeter og meter bruger vi til at måle, hvor langt noget er.',

  // readChart: questions by place or by the extremes
  's.readChart.pictoLongest': 'Hvor mange stjerner er der i den længste række?',
  's.readChart.pictoShortest': 'Hvor mange stjerner er der i den korteste række?',
  's.readChart.barHighest': 'Hvor høj er den højeste søjle?',
  's.readChart.barLowest': 'Hvor høj er den laveste søjle?',
  's.readChart.pictoDiff': 'Hvor mange flere stjerner er der i den længste række end i den korteste?',
  's.readChart.barDiff': 'Hvor meget højere er den højeste søjle end den laveste?',
  // "Find rækken, og tæl stjernerne en ad gangen. Der er fem stjerner."
  'hint.readChart.countStars': 'Tæl stjernerne i rækken en ad gangen.',
  'hint.readChart.thereAre': 'Der er',
  'hint.readChart.stars': 'stjerner.',
  'hint.readChart.countSlowly': 'Tæl langsomt, og tæl hver stjerne en gang.',
  'hint.readChart.rightRow': 'Find den rigtige række først.',
  // "Følg toppen af søjlen hen til tallene ved siden af. Søjlen når op til fem."
  'hint.readChart.followTop': 'Følg toppen af søjlen hen til tallene ved siden af.',
  'hint.readChart.reachesUpTo': 'Søjlen når op til',
  'hint.readChart.lineAtTop': 'Se på stregen lige ud for toppen af søjlen.',
  'hint.readChart.rightBar': 'Find den rigtige søjle først.',
  'hint.readChart.findLongest': 'Find den længste række først.',
  'hint.readChart.findShortest': 'Find den korteste række først.',
  'hint.readChart.findHighest': 'Find den højeste søjle først.',
  'hint.readChart.findLowest': 'Find den laveste søjle først.',
  // difference: "Den højeste søjle når op til otte og den laveste når op til tre. Otte minus tre giver fem."
  'hint.readChart.highestReaches': 'Den højeste søjle når op til',
  'hint.readChart.lowestReaches': 'og den laveste når op til',
  'hint.readChart.longestHas': 'Den længste række har',
  'hint.readChart.shortestHas': 'og den korteste har',
  // wrongOperation
  'hint.readChart.howManyMore': 'Når du skal finde ud af, hvor mange flere der er, skal du trække fra.',
  'hint.readChart.bothNumbers': 'Du skal bruge begge tal.',
}

ORDINALS.forEach((word, i) => {
  WAVE2[`s.readChart.pictoRow.${i + 1}`] = `Hvor mange stjerner er der i den ${word} række?`
  WAVE2[`s.readChart.barCol.${i + 1}`] = `Hvor høj er den ${word} søjle?`
})

const WAVE3: Record<ClipId, string> = {
  // unitChoice (weight, 3. klasse): "Lette ting vejer vi i gram … En hund vejer man i kilogram."
  's.unitChoice.tapG': 'Tryk på alle de ting, man vejer i gram.',
  's.unitChoice.tapKg': 'Tryk på alle de ting, man vejer i kilogram.',
  'hint.unitChoice.weightRule': 'Lette ting vejer vi i gram, og tunge ting vejer vi i kilogram.',
  'hint.unitChoice.weighedIn': 'vejer man i',
  'hint.unitChoice.weightUnits': 'Gram og kilogram bruger vi til at måle, hvor tungt noget er.',
}

// unitChoice: one question per thing ("Hvad måler man længden af en bus i?") and the thing as a card
for (const [family, table] of Object.entries(UNIT_THINGS)) {
  const into = family === 'length' ? WAVE2 : WAVE3
  for (const [thing, [, noun]] of Object.entries(table)) {
    into[`s.unitChoice.q.${thing}`] = `Hvad måler man ${family === 'length' ? 'længden' : 'vægten'} af ${noun} i?`
    into[`noun.mt.${thing}`] = noun
  }
}

export const clips: Readonly<Record<ClipId, string>> = { ...WAVE2, ...WAVE3 }

export function wave(id: ClipId): Wave {
  return id in WAVE3 ? 3 : 2
}

/** The measure sprite of each wave, beside the unit words (clips/nouns.ts). */
export function pack(id: ClipId): string {
  return `measure-${wave(id)}`
}
