// What is asked only in the voice is on the screen too (QA3b P2–P5): the bubble's words for three
// quarters on two plates, along or up, and the biggest or the smallest, and the card's "¾ af 12" over a
// heap and the way asked of a coordinate net (with the point a placePoint question names).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { factsOf, registeredSkills, skillRegistry } from '../../engine/registry'
import { hashSeed, makeRng } from '../../engine/rng'
import { buildTask } from '../../engine/tasks'
import type { SpeechPart, Task, TaskKind } from '../../engine/types'
import { clipText, hasClip } from '../../speech/catalog'
import { toDanishText } from '../../speech/compile'
import { familyInstruction, instructionClip, shortInstruction } from '../../speech/clips/ui/kinds'
import { displayText } from '../hint/displayText'
import { coordAsk, heapFraction } from './AskLines'
import { PromptScene } from './PromptScene'

const reg = skillRegistry()
function tasksOf(skill: string, kind: TaskKind): Task[] {
  const def = reg.get(skill as never)!
  return factsOf(def).map((f, i) => buildTask(def, f, kind, makeRng(hashSeed(`${f.id}:${i}`)), 0).task)
}
const bubble = (t: Task) => displayText(shortInstruction(t.kind, t.skill, t.family, t.speech), clipText)
const ends = (t: Task, own: readonly SpeechPart[]) => toDanishText(t.speech).toLowerCase().endsWith(toDanishText(own).toLowerCase().replace(/^\s+/, ''))

describe('the bubble says what only the voice said (QA3b)', () => {
  it('three quarters on two plates: "Den ene skal have 3/4 og den anden resten."', () => {
    const tasks = tasksOf('fractionOfSet', 'share')
    for (const t of tasks.filter((x) => x.family === 'threeQuartersOf')) {
      expect(bubble(t), t.factId).toBe('Den ene skal have 3/4 og den anden resten.')
      const own = familyInstruction(t.kind, t.skill, t.family, t.speech)!
      expect(ends(t, own), toDanishText(t.speech)).toBe(true)
    }
    // a fair deal keeps "Del lige."
    for (const t of tasks.filter((x) => x.family !== 'threeQuartersOf')) expect(bubble(t), t.factId).toBe('Del lige.')
  })

  it('along or up, as the question asks it', () => {
    for (const t of tasksOf('gridCoords', 'choice')) {
      const b = bubble(t)
      const along = toDanishText(t.speech).includes('hen')
      expect(b, t.factId).toMatch(along ? /^Hvor langt hen / : /^Hvor langt op /)
      expect(ends(t, familyInstruction(t.kind, t.skill, t.family, t.speech)!), t.factId).toBe(true)
    }
    // on the net the kind's own words stay
    for (const t of tasksOf('gridCoords', 'grid')) expect(shortInstruction(t.kind, t.skill, t.family, t.speech)).toEqual([{ clip: instructionClip('grid', 'short') }])
  })

  it('the biggest or the smallest fraction', () => {
    const tasks = tasksOf('fractionCompare', 'choice')
    expect(new Set(tasks.map(bubble))).toEqual(new Set(['Hvilken brøk er størst?', 'Hvilken brøk er mindst?']))
    for (const t of tasks) expect(bubble(t), t.factId).toBe(t.family === 'pairSmaller' ? 'Hvilken brøk er mindst?' : 'Hvilken brøk er størst?')
    // the row keeps its own words (FIX3a writes the ends on the places)
    for (const t of tasksOf('fractionCompare', 'sortOrder')) expect(bubble(t)).toBe('Sæt dem i rækkefølge.')
  })

  it('the fewest coins on cards: "Med færrest mønter og sedler?"', () => {
    const tasks = tasksOf('payExact', 'choice')
    for (const t of tasks.filter((x) => x.family === 'fewestCoins')) {
      expect(bubble(t), t.factId).toBe('Med færrest mønter og sedler?')
      expect(ends(t, familyInstruction(t.kind, t.skill, t.family, t.speech)!), toDanishText(t.speech)).toBe(true)
    }
    for (const t of tasks.filter((x) => x.family !== 'fewestCoins')) expect(bubble(t), t.factId).toBe('Tryk på svaret.')
  })

  it('uses recorded clips only', () => {
    for (const [skill, kind] of [['fractionOfSet', 'share'], ['gridCoords', 'choice'], ['fractionCompare', 'choice'], ['payExact', 'choice']] as const) {
      for (const t of tasksOf(skill, kind)) {
        for (const p of shortInstruction(t.kind, t.skill, t.family, t.speech)) if ('clip' in p) expect(hasClip(p.clip), p.clip).toBe(true)
      }
    }
  })
})

describe('the card shows the fraction of the heap (QA3b P3)', () => {
  it('"¾ af 12" over the heap, on cards and keys', () => {
    for (const kind of ['choice', 'keypad'] as const) {
      for (const t of tasksOf('fractionOfSet', kind)) {
        const [, nd, total] = t.factId.split(':')
        const [n, d] = nd.split('/').map(Number)
        expect(heapFraction(t), t.factId).toEqual({ n, d, total: Number(total) })
        const html = renderToStaticMarkup(<PromptScene prompt={t.prompt} task={t} />)
        expect(html).toContain('data-ask="heap"')
        expect(html).toContain(`<span class="tv-frac__n">${n}</span>`)
        expect(html).toContain(`<span class="tv-frac__d">${d}</span>`)
        expect(html).toContain(`<span class="tv-ask__num">${total}</span>`)
      }
    }
  })

  it('no other card gets a line (0.–2. kl. unchanged)', () => {
    for (const def of registeredSkills()) {
      if (def.id === 'fractionOfSet' || def.id === 'gridCoords') continue
      for (const kind of def.kinds) {
        for (const f of factsOf(def).slice(0, 40)) {
          const t = buildTask(def, f, kind, makeRng(hashSeed(f.id)), 0).task
          expect(heapFraction(t), `${def.id} ${kind} ${f.id}`).toBeNull()
          expect(coordAsk(t), `${def.id} ${kind} ${f.id}`).toBeNull()
        }
      }
    }
  })
})

describe('the card shows the way asked of the net (QA3b P4)', () => {
  it('→ ? or ↑ ? as the question asks, and the point a placePoint question names', () => {
    for (const t of tasksOf('gridCoords', 'choice')) {
      const [, fam, xy] = t.factId.split(':')
      const [x, y] = xy.split(',').map(Number)
      const a = coordAsk(t)!
      const along = (x + y) % 2 === 0
      expect(a.axis, t.factId).toBe(along ? 'x' : 'y')
      expect(t.answer).toBe(along ? x : y)
      expect(a.named, t.factId).toEqual(fam === 'p' ? [x, y] : null)
      const html = renderToStaticMarkup(<PromptScene prompt={t.prompt} task={t} />)
      expect(html).toContain(`data-ask="${a.axis}"`)
      if (fam === 'p') expect(html).toContain(`(${x}, ${y})`)
      // the read point is drawn, never written: the card never says its numbers
      else expect(html).not.toContain('tv-ask__pair')
    }
    // the grid kind draws its own net and pair
    for (const t of tasksOf('gridCoords', 'grid')) expect(coordAsk(t)).toBeNull()
  })
})
