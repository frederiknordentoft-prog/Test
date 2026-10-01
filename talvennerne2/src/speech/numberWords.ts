// Danish number words and their voice clips (SPEC §10.1–10.2).
//
// Words: 0–20 have their own words, 21–99 are one word ("enogtyve"), 100–999 are
// "[et|to|…] hundrede" with "og" only before the last group, and 1000 is "tusind".
// Gender only changes a final standalone 1: "en" alone, in sums and before common-gender nouns
// (krone, meter), "et" before neuter nouns (gram, kilogram) and in "klokken et".
//
// Clips: 0–100 and 1000 are whole clips (`n.<form>.<n>`, `n.<form>.1.et`); 101–999 are either
// `h.<form>.<H>` (round hundreds) or the head `hog.<H>` ("tre hundrede og") plus the tail
// `n.<form>.<n % 100>`, with H = 100, 200 … 900 as in ids.lock.json.
import type { ClipId, SpeechForm } from '../engine/types'

/** 'c' fælleskøn ("en"), 'n' intetkøn ("et"). */
export type Gender = 'c' | 'n'

const SMALL = [
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti',
  'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve',
] as const

const TENS = ['', '', 'tyve', 'tredive', 'fyrre', 'halvtreds', 'tres', 'halvfjerds', 'firs', 'halvfems'] as const

/** Largest number the pre-recorded clips cover. */
export const MAX_CLIP_NUMBER = 1000

/** True when `n` can be spoken with the number clips (an integer 0–1000). */
export function isClipNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= MAX_CLIP_NUMBER
}

function below100(n: number, gender: Gender): string {
  if (n === 1) return gender === 'n' ? 'et' : 'en'
  if (n <= 20) return SMALL[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return TENS[tens]
  // 1 inside a compound is always "en": enogtyve, enoghalvfems.
  return `${ones === 1 ? 'en' : SMALL[ones]}og${TENS[tens]}`
}

function below1000(n: number, gender: Gender): string {
  if (n < 100) return below100(n, gender)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  // "hundrede" is neuter: always "et hundrede".
  const head = `${hundreds === 1 ? 'et' : SMALL[hundreds]} hundrede`
  return rest === 0 ? head : `${head} og ${below100(rest, gender)}`
}

function wholeWords(n: number, gender: Gender): string {
  if (n < 1000) return below1000(n, gender)
  if (n === 1000) return 'tusind'
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    // "tusind" is neuter too (et tusind); a bare 1 000 is just "tusind".
    const head = thousands === 1 ? 'tusind' : `${below1000(thousands, 'n')} tusind`
    if (rest === 0) return head
    return rest < 100 ? `${head} og ${below100(rest, gender)}` : `${head} ${below1000(rest, gender)}`
  }
  // Outside anything the game shows: read digit by digit rather than invent a big-number grammar.
  return String(n).split('').map((d) => SMALL[Number(d)]).join(' ')
}

/**
 * Danish words for `n`. Integers 0–1000 follow SPEC §10.1 exactly; larger integers, negative
 * numbers and decimals ("to komma fem") are supported so fallback text never shows digits.
 */
export function numberWords(n: number, gender: Gender = 'c'): string {
  if (!Number.isFinite(n)) return 'ukendt tal'
  if (n < 0) return `minus ${numberWords(-n, gender)}`
  if (!Number.isInteger(n)) {
    const [whole, frac] = decimalParts(n)
    return `${wholeWords(whole, 'c')} komma ${fractionDigitsWords(frac)}`
  }
  return wholeWords(n, gender)
}

/** Splits a decimal into its whole part and the digits after the comma (max 3, no trailing zeros). */
function decimalParts(n: number): [number, string] {
  const fixed = n.toFixed(3).replace(/0+$/, '')
  const [whole, frac = ''] = fixed.split('.')
  return [Number(whole), frac]
}

/** "05" → "nul fem", "25" → "femogtyve", "5" → "fem". */
function fractionDigitsWords(frac: string): string {
  if (frac.startsWith('0')) return frac.split('').map((d) => SMALL[Number(d)]).join(' ')
  return wholeWords(Number(frac), 'c')
}

/** The clip for a number 0–100 or 1000, honouring the "et" form of 1. */
function wholeClip(n: number, form: SpeechForm, gender: Gender): ClipId {
  return n === 1 && gender === 'n' ? `n.${form}.1.et` : `n.${form}.${n}`
}

/**
 * Clip ids for `n` in the given form. Integers 0–1000 always map to catalogue clips. Anything else
 * yields ids that deliberately do not exist in the catalogue (e.g. `n.end.1234`), so the voice falls
 * back to the device voice for the whole utterance instead of saying something wrong.
 */
export function numberClips(n: number, form: SpeechForm, gender: Gender = 'c'): ClipId[] {
  if (Number.isInteger(n) && n < 0) return ['op.minus', ...numberClips(-n, form, gender)]
  if (!Number.isInteger(n)) {
    if (n < 0 || !Number.isFinite(n)) return [`n.${form}.${n}`]
    const [whole, frac] = decimalParts(n)
    const tail = frac.startsWith('0') || Number(frac) > 100 ? [`n.${form}.,${frac}`] : [wholeClip(Number(frac), form, 'c')]
    return [...numberClips(whole, 'mid', 'c'), 'op.komma', ...tail]
  }
  if (n <= 100 || n === 1000) return [wholeClip(n, form, gender)]
  if (n > 1000) return [`n.${form}.${n}`]
  const hundreds = n - (n % 100)
  const rest = n % 100
  if (rest === 0) return [`h.${form}.${hundreds}`]
  return [`hog.${hundreds}`, wholeClip(rest, form, gender)]
}
