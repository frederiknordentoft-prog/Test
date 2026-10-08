// SpeechPart[] → the text shown next to the voice. Like compile() (src/speech/compile.ts) it closes
// sentences after end-form parts and capitalises them, but it writes numbers as numerals: children
// recognise "13" long before "tretten", and the strategy text sits next to pictures of the numbers.
import type { ClipId, SpeechPart } from '../../engine/types'
import { formatMoney, formatNumber } from '../task/answers'

const UNIT_SHORT: Record<string, string> = { cm: 'cm', m: 'm', g: 'g', kg: 'kg' }

/**
 * An analog time is read off a 12-hour face (quarter past twelve is 12.15, not 0.15). "kl." is left out
 * after words that end in "klokken" ("… er klokken 10.15", never "klokken kl. 10.15", QA3a P3-3).
 */
function clockText(minutes: number, style: 'analog' | 'analogHalfForm' | 'digital' = 'analog', afterKlokken = false): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const hour = style === 'digital' ? h : ((h + 11) % 12) + 1
  return `${afterKlokken ? '' : 'kl. '}${hour}.${String(m % 60).padStart(2, '0')}`
}

/**
 * "c divideret med d q" (3. klasse, SPEC A19), where the two numbers would stand side by side ("Så giver
 * 18 divideret med 3 6"), is written as the equation: "Så giver 18 : 3 = 6" (QA3a P3-2). The voice
 * keeps its words.
 */
function divisionsAsEquations(parts: readonly SpeechPart[]): SpeechPart[] {
  const out: SpeechPart[] = []
  for (let i = 0; i < parts.length; i++) {
    const [c, op, d, q] = parts.slice(i, i + 4)
    const division = c && op && d && q && 'num' in c && 'clip' in op && op.clip === 'op.divideret_med' && 'num' in d && d.form === 'mid' && 'num' in q
    if (division && q.num * d.num === c.num) {
      out.push({ free: `${formatNumber(c.num)} : ${formatNumber(d.num)} = ${formatNumber(q.num)}${q.form === 'end' ? '.' : ''}` })
      i += 3
    } else out.push(parts[i])
  }
  return out
}

/**
 * A clock strategy says the dial's numbers in its own words ("Ved hele timer peger den lange viser på
 * tolv."), and its { num } parts are numerals: on screen both are numerals, like the dial beside them
 * (QA2 P3-2: "… på tolv. Den lille viser peger på 12."). The voice keeps the words. Only the hour
 * words: "en halv time" and "et kvarter" stay as they are.
 */
const DIAL_WORDS: Readonly<Record<string, string>> = {
  to: '2', tre: '3', fire: '4', fem: '5', seks: '6', syv: '7', otte: '8', ni: '9', ti: '10', elleve: '11', tolv: '12',
}
const DIAL_WORD = /(?<![\p{L}\d])(to|tre|fire|fem|seks|syv|otte|ni|ti|elleve|tolv)(?![\p{L}\d])/gu

export function dialNumerals(text: string): string {
  return text.replace(DIAL_WORD, (w) => DIAL_WORDS[w] ?? w)
}

const QUESTION = /^(hv[a-zæøå]*|er|kan|har|passer|bliver|giver|tæller|skal|vil|må)(?=[\s,]|$)|(^|\s)hvad(?=[\s,?]|$)/i

function close(words: string[]): string | null {
  const s = words.join(' ').replace(/\s+/g, ' ').replace(/\s+([,.?!])/g, '$1').trim()
  if (!s) return null
  const done = /[.?!]$/.test(s) ? s : `${s}${QUESTION.test(s) ? '?' : '.'}`
  return done.charAt(0).toUpperCase() + done.slice(1)
}

/**
 * Display text for speech parts. `textOf` resolves clip ids (the catalogue, or a SpeechProvider's
 * override). Clips whose text starts with a capital open a new sentence; end forms close one.
 */
export function displayText(parts: readonly SpeechPart[], textOf: (id: ClipId) => string): string {
  const sentences: string[] = []
  let words: string[] = []
  const flush = () => {
    const s = close(words)
    if (s) sentences.push(s)
    words = []
  }
  for (const p of divisionsAsEquations(parts)) {
    if ('clip' in p) {
      const said = textOf(p.clip)
      if (!said || said === p.clip) continue
      const text = p.clip.startsWith('hint.clock.') ? dialNumerals(said) : said
      if (/^[A-ZÆØÅ]/.test(text) && !p.clip.startsWith('name.') && words.length > 0) flush()
      words.push(text)
      if (/[.?!]$/.test(text) || /(^|\.)end(\.|$)/.test(p.clip) || p.clip.startsWith('q.')) flush()
      continue
    }
    if ('free' in p) {
      words.push(p.free.trim())
      if (/[.?!]$/.test(p.free.trim())) flush()
      continue
    }
    let text: string
    let form: 'mid' | 'end'
    if ('num' in p) {
      text = formatNumber(p.num)
      form = p.form
    } else if ('money' in p) {
      // "kr." keeps its full stop in the middle of a sentence too ("14 kr. plus 14 kr. giver 28 kr.",
      // QA3b); at the end it closes the sentence, so there is never a second one
      text = formatMoney(p.money.ore)
      form = p.money.form
    } else if ('clock' in p) {
      text = clockText(p.clock.minutes, p.clock.style, /klokken$/i.test(words[words.length - 1] ?? ''))
      form = p.clock.form
    } else if ('measure' in p) {
      text = `${formatNumber(p.measure.value)} ${UNIT_SHORT[p.measure.unit] ?? p.measure.unit}`
      form = p.measure.form
    } else {
      text = `${p.frac.n}/${p.frac.d}`
      form = p.frac.form
    }
    words.push(text)
    if (form === 'end') flush()
  }
  flush()
  return sentences.join(' ')
}
