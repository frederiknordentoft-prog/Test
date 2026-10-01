// The colour of each set (and of the decor), for frames, placeholders and headings in the wardrobe
// and the shop. Only token names: the colours themselves live in src/ui/design/tokens.css.
import type { CSSProperties } from 'react'
import type { DecorId, SetId } from '../../../../engine/types'

export type Tone =
  | 'number' | 'place' | 'addsub' | 'muldiv' | 'algebra' | 'fractions' | 'shapes' | 'clock' | 'money' | 'measure'
  | 'primary' | 'star' | 'steel'

const DOMAIN_TONES: readonly Tone[] = ['number', 'place', 'addsub', 'muldiv', 'algebra', 'fractions', 'shapes', 'clock', 'money', 'measure']

/** Main, deep (text and lines on white) and soft (backgrounds) as CSS custom properties. */
function toneVars(tone: Tone): [string, string, string] {
  if (DOMAIN_TONES.includes(tone)) return [`--color-d-${tone}`, `--color-d-${tone}-deep`, `--color-d-${tone}-soft`]
  if (tone === 'primary') return ['--color-primary', '--color-primary-deep', '--color-primary-soft']
  if (tone === 'star') return ['--color-star', '--color-star-deep', '--color-star-soft']
  return ['--color-ink-2', '--color-ink', '--color-stone']
}

export const SET_TONE: Readonly<Record<SetId | 'milepael', Tone>> = {
  hverdag: 'number',
  opdager: 'shapes',
  rytter: 'place',
  kongelig: 'muldiv',
  astronaut: 'algebra',
  ridder: 'steel',
  talmagiker: 'primary',
  pirat: 'clock',
  fodbold: 'addsub',
  vinter: 'measure',
  fest: 'fractions',
  milepael: 'star',
}

export const DECOR_TONE: Readonly<Record<DecorId, Tone>> = {
  'pynt-blomsterbed': 'fractions',
  'pynt-lygte': 'money',
  'pynt-baenk': 'place',
  'pynt-gynge': 'addsub',
  'pynt-dam': 'number',
  'pynt-traehus': 'shapes',
  'pynt-springvand': 'measure',
  'pynt-regnbuebue': 'muldiv',
}

/** `--tone`, `--tone-deep` and `--tone-soft` for an element and everything in it. */
export function toneStyle(tone: Tone): CSSProperties {
  const [main, deep, soft] = toneVars(tone)
  return { '--tone': `var(${main})`, '--tone-deep': `var(${deep})`, '--tone-soft': `var(${soft})` } as CSSProperties
}
