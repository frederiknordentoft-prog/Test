// SpeechPart[] → clip ids, silences and digit-free Danish text (SPEC §10.1–10.2). Shared by the
// runtime voice (src/audio/voice.ts), the listening page and the voice build scripts.
//
// Silences between clips (the gap between the audible end of one clip and the start of the next):
//   20 ms  after a hundred head (`hog.*` → tail): "tre hundrede og | syvogfyrre"
//   30 ms  before a noun bound to the number before it (`noun.*`: "tolv | kroner", "tre | fjerdedele")
//   40 ms  between words inside a phrase ("Hvad er | tre")
//  120 ms  after a mid-form clip (`.mid` ids, generated with a trailing comma)
//  250 ms  after an end-form clip or a sentence (`.end`, `t.half.*`, `q.*`, text ending in . ? !),
//          and before a clip that starts a sentence (capitalised text, names excepted)
//
// `{ free }` text (a child's name) can never be recorded, and one statement is never spoken in two
// voices mid-sentence, so free text becomes its own utterance for the device voice.
import type { ClipId, SpeechForm, SpeechPart } from '../engine/types'
import { clipForm, clipText, hasClip } from './catalog'
import { clockClips, clockWords } from './clock'
import { fractionClips, fractionWords } from './fractions'
import { measureClips, measureWords } from './measure'
import { moneyClips, moneyWords } from './money'
import { numberClips, numberWords } from './numberWords'

export const GAP_MS = { seam: 20, bound: 30, phrase: 40, mid: 120, sentence: 250 } as const

/** A run of clips in the recorded voice, or free text for the device voice. */
export type Utterance =
  | { kind: 'clips'; clips: ClipId[]; gapsMs: number[] }
  | { kind: 'free'; text: string }

export interface Compiled {
  /** Every clip, in speaking order (free text excluded). */
  clips: ClipId[]
  /** gapsMs[i] is the silence after clips[i]; one shorter than clips. */
  gapsMs: number[]
  /** The whole statement as Danish text, never with digits. */
  text: string
  /** What to play, in order, with free text split out. */
  utterances: Utterance[]
  /** Clip ids not in the catalogue; the voice reads the whole statement with the device voice. */
  missing: ClipId[]
}

export type ClipClass = 'seam' | 'mid' | 'end' | 'phrase'

/** How a clip ends, which decides the silence after it. */
export function clipClass(id: ClipId): ClipClass {
  if (id.startsWith('hog.')) return 'seam'
  const form = clipForm(id)
  if (form) return form
  if (id.startsWith('q.')) return 'end'
  const text = hasClip(id) ? clipText(id) : ''
  if (/[.?!]$/.test(text)) return 'end'
  if (/,$/.test(text)) return 'mid'
  return 'phrase'
}

/**
 * True for clips whose text opens a sentence ("Hvad er", "Tryk på fluebenet …"). Names (`name.*`:
 * Trine, Plusengen) are capitalised mid-sentence too, so they never open one.
 */
export function startsSentence(id: ClipId): boolean {
  return !id.startsWith('name.') && hasClip(id) && /^[A-ZÆØÅ]/.test(clipText(id))
}

/** Silence between two consecutive clips of one utterance. */
export function gapAfter(prev: ClipId, next: ClipId): number {
  const cls = clipClass(prev)
  if (cls === 'seam') return GAP_MS.seam
  if (cls === 'end' || startsSentence(next)) return GAP_MS.sentence
  if (next.startsWith('noun.')) return GAP_MS.bound
  return cls === 'mid' ? GAP_MS.mid : GAP_MS.phrase
}

export function gapsFor(clips: readonly ClipId[]): number[] {
  const gaps: number[] = []
  for (let i = 0; i + 1 < clips.length; i++) gaps.push(gapAfter(clips[i], clips[i + 1]))
  return gaps
}

interface Piece {
  clips: ClipId[]
  words: string
  startsSentence: boolean
  endsSentence: boolean
  free?: string
}

/** Digits in free text are read as words, so the text never shows a digit. */
function digitFree(text: string): string {
  return text.replace(/\d+/g, (m) => numberWords(Number(m)))
}

function piece(part: SpeechPart): Piece {
  if ('clip' in part) {
    return {
      clips: [part.clip],
      words: hasClip(part.clip) ? clipText(part.clip) : '',
      startsSentence: startsSentence(part.clip),
      endsSentence: clipClass(part.clip) === 'end',
    }
  }
  if ('free' in part) {
    const text = digitFree(part.free.trim())
    return { clips: [], words: text, startsSentence: false, endsSentence: /[.?!]$/.test(text), free: text }
  }
  const [clips, words, form] = spoken(part)
  return { clips, words, startsSentence: false, endsSentence: form === 'end' }
}

/** Clips, words and form of the generated parts (numbers, clock, money, measure, fractions). */
function spoken(part: Exclude<SpeechPart, { clip: ClipId } | { free: string }>): [ClipId[], string, SpeechForm] {
  if ('num' in part) {
    const gender = part.gender ?? 'c'
    return [numberClips(part.num, part.form, gender), numberWords(part.num, gender), part.form]
  }
  if ('clock' in part) {
    const { minutes, style, form } = part.clock
    return [clockClips(minutes, style, form), clockWords(minutes, style), form]
  }
  if ('money' in part) {
    const { ore, form } = part.money
    return [moneyClips(ore, form), moneyWords(ore), form]
  }
  if ('measure' in part) {
    const { value, unit, form } = part.measure
    return [measureClips(value, unit, form), measureWords(value, unit), form]
  }
  const { n, d, form } = part.frac
  return [fractionClips(n, d, form), fractionWords(n, d), form]
}

const QUESTION_START = /^(hv(?!is(?=[\s,]|$))[a-zæøå]*|er|kan|har|passer|bliver|giver|tæller|skal|vil|må)(?=[\s,]|$)/
const HAS_HVAD = /(^|\s)hvad(?=[\s,?]|$)/

/** A sentence is a question when it starts like one or asks "hvad" ("fire plus hvad giver ti"). */
export function isQuestion(sentence: string): boolean {
  const s = sentence.toLowerCase()
  return QUESTION_START.test(s) || HAS_HVAD.test(s)
}

function closeSentence(words: string[]): string | null {
  const s = words.join(' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  const punctuated = /[.?!]$/.test(s) ? s : `${s}${isQuestion(s) ? '?' : '.'}`
  return punctuated.charAt(0).toUpperCase() + punctuated.slice(1)
}

/** Numbers, amounts, times and fractions: said one after another they are a list. */
const isAmount = (p: SpeechPart) => !('clip' in p) && !('free' in p)

export function compile(parts: readonly SpeechPart[]): Compiled {
  const pieces = parts.map(piece)
  // A list ("seksten, atten, tyve"): three amounts or more in a row get a comma in the text and a
  // comma's pause between them (UI-fund 7). Two in a row are not a list: "Så giver tolv minus fem syv".
  const runLength = (i: number): number => {
    let a = i
    let b = i
    while (a > 0 && isAmount(parts[a - 1])) a--
    while (b + 1 < parts.length && isAmount(parts[b + 1])) b++
    return b - a + 1
  }
  const listEnd = parts.map((p, i) =>
    i + 1 < parts.length && isAmount(p) && isAmount(parts[i + 1]) && !pieces[i].endsSentence && runLength(i) >= 3)
  pieces.forEach((p, i) => {
    if (listEnd[i] && p.words) pieces[i] = { ...p, words: `${p.words},` }
  })

  // Text: sentences close after an end-form element and at the end.
  const sentences: string[] = []
  let words: string[] = []
  for (const p of pieces) {
    if (p.startsSentence && words.length > 0) {
      const s = closeSentence(words)
      if (s) sentences.push(s)
      words = []
    }
    if (p.words) words.push(p.words)
    if (p.endsSentence) {
      const s = closeSentence(words)
      if (s) sentences.push(s)
      words = []
    }
  }
  const last = closeSentence(words)
  if (last) sentences.push(last)

  // Audio: runs of clips, free text on its own.
  const utterances: Utterance[] = []
  let run: ClipId[] = []
  let commas: number[] = []
  const flush = () => {
    if (run.length > 0) {
      const gaps = gapsFor(run)
      for (const at of commas) if (at < gaps.length) gaps[at] = Math.max(gaps[at], GAP_MS.mid)
      utterances.push({ kind: 'clips', clips: run, gapsMs: gaps })
    }
    run = []
    commas = []
  }
  pieces.forEach((p, i) => {
    if (p.free !== undefined) {
      flush()
      if (p.free) utterances.push({ kind: 'free', text: p.free })
    } else {
      run.push(...p.clips)
      if (listEnd[i] && p.clips.length > 0) commas.push(run.length - 1)
    }
  })
  flush()

  const clips: ClipId[] = []
  const gapsMs: number[] = []
  for (const u of utterances) {
    if (u.kind !== 'clips') continue
    if (clips.length > 0) gapsMs.push(GAP_MS.sentence)
    clips.push(...u.clips)
    gapsMs.push(...u.gapsMs)
  }

  return {
    clips,
    gapsMs,
    text: digitFree(sentences.join(' ')),
    utterances,
    missing: [...new Set(clips.filter((id) => !hasClip(id)))],
  }
}

/** The statement as Danish text without digits (device voice, listening page, ASR reference). */
export function toDanishText(parts: readonly SpeechPart[]): string {
  return compile(parts).text
}
