import { describe, expect, it } from 'vitest'
import { allClips, clipInfo, clipText, duplicateClips, generationText, hasClip } from './catalog'
import { compile, toDanishText } from './compile'
import { equationSpeech } from './equation'
import { RECALL_QUESTIONS, questionClip } from './recallQuestions'

describe('clip catalogue', () => {
  it('has no id defined twice', () => {
    expect(duplicateClips()).toEqual([])
  })

  it('has digit-free Danish texts without × or ÷', () => {
    for (const c of allClips()) {
      expect(c.text, c.id).not.toMatch(/\d/)
      expect(c.text, c.id).not.toMatch(/[×÷]/)
      expect(c.text.trim(), c.id).toBe(c.text)
      expect(c.text.length, c.id).toBeGreaterThan(0)
    }
  })

  it('answers clipText and hasClip, echoing unknown ids', () => {
    expect(clipText('n.end.47')).toBe('syvogfyrre')
    expect(clipText('hog.300')).toBe('tre hundrede og')
    expect(clipText('t.end.145')).toBe('fem minutter i halv tre')
    expect(clipText('op.plus')).toBe('plus')
    expect(hasClip('frag.hvad_er')).toBe(true)
    expect(hasClip('nope')).toBe(false)
    expect(clipText('nope')).toBe('nope')
  })

  it('has every number, time and half-form clip from SPEC §10.2', () => {
    const ids = new Set(allClips().map((c) => c.id))
    const count = (re: RegExp) => [...ids].filter((id) => re.test(id)).length
    expect(count(/^n\.(mid|end)\.\d+$/)).toBe(2 * 101 + 2) // 0–100 and 1000
    expect(count(/^n\.(mid|end)\.1\.et$/)).toBe(2)
    expect(count(/^(h\.(mid|end)|hog)\.\d+$/)).toBe(27)
    expect(count(/^t\.end\.\d+$/)).toBe(144)
    expect(count(/^t\.half\.\d+$/)).toBe(24)
    expect(count(/^noun\.digit\./)).toBe(20)
  })

  it('adds the form punctuation for the TTS generator', () => {
    expect(generationText('n.mid.3')).toBe('tre,')
    expect(generationText('n.end.3')).toBe('tre.')
    expect(generationText('t.half.200')).toBe('ti minutter i halv fire.')
    expect(generationText('q.add:3+4')).toBe('Hvad er tre plus fire?')
    expect(generationText('op.plus')).toBe('plus')
  })

  it('assigns waves and packs', () => {
    expect(clipInfo('n.end.7')).toMatchObject({ wave: 1, pack: 'n0-20' })
    expect(clipInfo('n.end.47')).toMatchObject({ wave: 1, pack: 'n21-100' })
    expect(clipInfo('hog.300')).toMatchObject({ wave: 2, pack: 'hundreds' })
    expect(clipInfo('op.plus')).toMatchObject({ wave: 1, pack: 'core' })
    expect(clipInfo('t.end.30')).toMatchObject({ wave: 2, pack: 'clock-2' })
    expect(clipInfo('t.end.25')).toMatchObject({ wave: 3, pack: 'clock-3' })
    expect(clipInfo('q.add:3+4')).toMatchObject({ wave: 1, pack: 'addsub-1' })
    expect(clipInfo('q.mp:3+?=7')).toMatchObject({ wave: 2, pack: 'algebra-2' })
    for (const c of allClips()) expect([1, 2, 3], c.id).toContain(c.wave)
  })
})

describe('whole recall questions', () => {
  const bySkill = (skill: string) => RECALL_QUESTIONS.filter((q) => q.skill === skill)

  it('has 271 questions with the SPEC counts per skill', () => {
    expect(RECALL_QUESTIONS).toHaveLength(271)
    const counts = Object.fromEntries(
      ['addTo10', 'subTo10', 'tenFriends', 'doubles', 'halves', 'addTo20', 'subTo20', 'missingPart10'].map((s) => [s, bySkill(s).length]),
    )
    expect(counts).toEqual({ addTo10: 66, subTo10: 66, tenFriends: 11, doubles: 10, halves: 10, addTo20: 36, subTo20: 36, missingPart10: 36 })
    expect(new Set(RECALL_QUESTIONS.map((q) => q.factId)).size).toBe(271)
    for (const q of RECALL_QUESTIONS) expect(clipText(q.clip)).toBe(q.text)
    expect(allClips().filter((c) => c.id.startsWith('q.') && c.wave === 1)).toHaveLength(143)
  })

  it('uses the fact ids and sentences from the brief', () => {
    const text = (factId: string) => RECALL_QUESTIONS.find((q) => q.factId === factId)?.text
    expect(text('add:3+4')).toBe('Hvad er tre plus fire?')
    expect(text('sub:9-5')).toBe('Hvad er ni minus fem?')
    expect(text('ten:4')).toBe('Fire plus hvad giver ti?')
    expect(text('dbl:6')).toBe('Hvad er det dobbelte af seks?')
    expect(text('hlf:14')).toBe('Hvad er halvdelen af fjorten?')
    expect(text('mp:3+?=7')).toBe('Tre plus hvad giver syv?')
    expect(text('add:1+1')).toBe('Hvad er en plus en?')
    expect(text('add:8+5')).toBe('Hvad er otte plus fem?')
    expect(text('sub:13-5')).toBe('Hvad er tretten minus fem?')
    expect(questionClip('add:3+4')).toBe('q.add:3+4')
    expect(questionClip('add:38+45')).toBeNull()
  })

  it('covers exactly the fact sets', () => {
    const ids = (skill: string) => bySkill(skill).map((q) => q.factId).sort()
    const pairs = (from: number, to: number, keep: (a: number, b: number) => boolean, id: (a: number, b: number) => string) => {
      const out: string[] = []
      for (let a = from; a <= to; a++) for (let b = from; b <= to; b++) if (keep(a, b)) out.push(id(a, b))
      return out.sort()
    }
    expect(ids('addTo10')).toEqual(pairs(0, 10, (a, b) => a + b <= 10, (a, b) => `add:${a}+${b}`))
    expect(ids('subTo10')).toEqual(pairs(0, 10, (a, b) => b <= a, (a, b) => `sub:${a}-${b}`))
    expect(ids('addTo20')).toEqual(pairs(2, 9, (a, b) => a + b > 10, (a, b) => `add:${a}+${b}`))
    expect(ids('subTo20')).toEqual(pairs(2, 18, (a, b) => a >= 11 && b <= 9 && a - b >= 2 && a - b < 10, (a, b) => `sub:${a}-${b}`))
    expect(ids('missingPart10')).toEqual(pairs(1, 9, (a, c) => a < c, (a, c) => `mp:${a}+?=${c}`))
    // missingPart10 and tenFriends never overlap: c < 10 here, c = 10 there.
    for (const q of bySkill('missingPart10')) expect(Number(q.factId.split('=')[1])).toBeLessThan(10)
  })
})

describe('equationSpeech', () => {
  it('reads the four equation shapes of SPEC §10.1', () => {
    expect(toDanishText(equationSpeech([{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }]))).toBe('Hvad er tre plus fire?')
    expect(toDanishText(equationSpeech([{ n: 3 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 7 }]))).toBe('Tre plus hvad giver syv?')
    expect(toDanishText(equationSpeech([{ blank: true }, { op: '+' }, { n: 4 }, { op: '=' }, { n: 7 }]))).toBe('Hvad plus fire giver syv?')
    expect(toDanishText(equationSpeech([{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { n: 7 }]))).toBe('Tre plus fire er lig med syv.')
    expect(toDanishText(equationSpeech([{ n: 8 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }, { op: '+' }, { n: 5 }])))
      .toBe('Otte plus fire er lig med hvad plus fem?')
    expect(toDanishText(equationSpeech([{ n: 12 }, { op: ':' }, { n: 3 }, { op: '=' }, { blank: true }]))).toBe('Hvad er tolv divideret med tre?')
    expect(toDanishText(equationSpeech([{ n: 7 }, { op: '<' }, { n: 9 }]))).toBe('Syv mindre end ni.')
  })

  it('only uses catalogue clips', () => {
    const c = compile(equationSpeech([{ n: 38 }, { op: '−' }, { blank: true }, { op: '=' }, { n: 12 }]))
    expect(c.missing).toEqual([])
    expect(c.clips).toEqual(['n.mid.38', 'op.minus', 'frag.hvad_giver', 'n.end.12'])
  })
})
