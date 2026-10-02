// Shared by the measure skills of 1.–2. klasse (measureUnits, rulerRead, weightCompare, unitChoice,
// readChart; SK2-MEAS): the long things that can be measured, speech helpers and the ordinal words.
// No SkillDef default export, so the registry skips it.
//
// Every procedure skill here keeps its instance in the fact id and reads it back with its own
// parse(): the round screen rebuilds a fact from its task (src/ui/hint/hintFor.ts factFor), which has
// the id but neither `data` nor the kind's own answer.
import type { ObjectId, SpeechForm, SpeechPart } from '../../types'

/** Long things drawn lying on their side (src/ui/scenes/objects.tsx LONG_IDS). */
export const LONG_THINGS = ['pencil', 'crayon', 'brush', 'rope', 'ribbon', 'stick', 'straw', 'worm', 'scarf'] as const satisfies readonly ObjectId[]
export type LongThing = (typeof LONG_THINGS)[number]
export const isLongThing = (id: string): id is LongThing => (LONG_THINGS as readonly string[]).includes(id)

/** "syv centimeter", "en meter" (SPEC §10.1: a measurement is one { measure } part). */
export const measureSays = (value: number, unit: 'cm' | 'm' | 'g' | 'kg', form: SpeechForm = 'end'): SpeechPart => ({ measure: { value, unit, form } })

/** Ordinals for a row or a bar counted from the start: 1 → 'første' … 4 → 'fjerde'. */
export const ORDINALS = ['første', 'anden', 'tredje', 'fjerde'] as const

/** Integers from lo to hi, both included. */
export const between = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

// ─── unitChoice ─────────────────────────────────────────────────────────────

export type UnitFamily = 'length' | 'weight'
export type ThingUnit = 'cm' | 'm' | 'g' | 'kg'

/**
 * unitChoice's things, with the unit a child should pick and their noun ("en bus") for the cards and
 * hints. Here and not in unitChoice.ts so the clip file (clips/skills/measure2.ts) can read them.
 */
export const UNIT_THINGS: Readonly<Record<UnitFamily, Readonly<Record<string, readonly [unit: ThingUnit, noun: string]>>>> = {
  length: {
    pencil: ['cm', 'en blyant'], eraser: ['cm', 'et viskelæder'], spoon: ['cm', 'en ske'], shoe: ['cm', 'en sko'],
    carrot: ['cm', 'en gulerod'], toothbrush: ['cm', 'en tandbørste'], worm: ['cm', 'en regnorm'], leaf: ['cm', 'et blad'],
    bus: ['m', 'en bus'], train: ['m', 'et tog'], pitch: ['m', 'en fodboldbane'], pool: ['m', 'et svømmebassin'],
    whale: ['m', 'en hval'], plane: ['m', 'en flyvemaskine'], gym: ['m', 'en gymnastiksal'], house: ['m', 'et hus'],
  },
  weight: {
    feather: ['g', 'en fjer'], strawberry: ['g', 'et jordbær'], key: ['g', 'en nøgle'], letter: ['g', 'et brev'],
    dog: ['kg', 'en hund'], bike: ['kg', 'en cykel'], potatoes: ['kg', 'en sæk kartofler'], suitcase: ['kg', 'en kuffert'],
  },
}

