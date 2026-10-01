// Speech for equation prompts (SPEC §10.1 "Regnetegn"), so every skill reads sums the same way:
//   3 + 4 = □      → "Hvad er tre plus fire?"        (the = of a question is not read)
//   3 + □ = 7      → "Tre plus hvad giver syv?"      (missing part, 0.–1. klasse)
//   □ + 4 = 7      → "Hvad plus fire giver syv?"
//   3 + 4 = 7      → "Tre plus fire er lig med syv." (balance and true/false)
//   8 + 4 = □ + 5  → "Otte plus fire er lig med hvad plus fem?"
// Numbers in sums use "en" for 1. Term texts ({ text: ClipId }) are spoken as their clip.
import type { ClipId, Op, SpeechPart, Term } from '../engine/types'

export const OP_CLIPS: Readonly<Record<Op, ClipId>> = {
  '+': 'op.plus',
  '−': 'op.minus',
  '·': 'op.gange',
  ':': 'op.divideret_med',
  '=': 'op.er_lig_med',
  '<': 'op.mindre_end',
  '>': 'op.stoerre_end',
}

export function opClip(op: Op): ClipId {
  return OP_CLIPS[op]
}

const isBlank = (t: Term): t is { blank: true } => 'blank' in t
const isEquals = (t: Term) => 'op' in t && t.op === '='

/** Maps terms one to one; the last number takes end form. */
function readTerms(terms: readonly Term[], equalsClip: ClipId): SpeechPart[] {
  const lastNum = terms.map((t) => 'n' in t).lastIndexOf(true)
  return terms.map((t, i): SpeechPart => {
    if ('n' in t) return { num: t.n, form: i === lastNum ? 'end' : 'mid' }
    if ('op' in t) return { clip: t.op === '=' ? equalsClip : opClip(t.op) }
    if ('text' in t) return { clip: t.text }
    return { clip: 'frag.hvad' }
  })
}

export function equationSpeech(terms: readonly Term[]): SpeechPart[] {
  const eq = terms.findIndex(isEquals)
  const blank = terms.findIndex(isBlank)
  const left = eq < 0 ? terms : terms.slice(0, eq)
  const right = eq < 0 ? [] : terms.slice(eq + 1)

  // Result asked for: "Hvad er <left>?"
  if (eq >= 0 && blank === eq + 1 && right.length === 1) {
    return [{ clip: 'frag.hvad_er' }, ...readTerms(left, 'op.er_lig_med')]
  }
  // Missing part on the left with a single number on the right: "<a> plus hvad giver <c>?"
  if (eq >= 0 && blank >= 0 && blank < eq && right.length === 1 && 'n' in right[0]) {
    const merged: Term[] = blank === eq - 1 ? [...left.slice(0, -1), { text: 'frag.hvad_giver' }, ...right] : terms.slice()
    return readTerms(merged, 'op.giver')
  }
  return readTerms(terms, 'op.er_lig_med')
}
