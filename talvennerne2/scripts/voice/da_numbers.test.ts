// Cross-check of the two independent Danish number implementations (SPEC §10.4, G1): the app's
// numberWords.ts writes every number 0–1000, the pipeline's scripts/tts/da_numbers.py parses it back.
// The Python parser was written from the grammar, not from numberWords.ts, so agreement here means
// both follow SPEC §10.1. Skipped when python3 is missing.
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/speech/compile'
import { numberWords } from '../../src/speech/numberWords'

const PARSER = fileURLToPath(new URL('../tts/da_numbers.py', import.meta.url))
const hasPython = spawnSync('python3', ['--version']).status === 0

function check(lines: string[]): string {
  return execFileSync('python3', [PARSER, '--check'], { input: lines.join('\n') + '\n', encoding: 'utf8' })
}

describe.skipIf(!hasPython)('da_numbers.py against numberWords.ts', () => {
  it('passes its own grammar cases', () => {
    const out = execFileSync('python3', [PARSER, '--selftest'], { encoding: 'utf8' })
    const m = /(\d+)\/(\d+) grammatiktilfælde/.exec(out)
    expect(m && m[1] === m[2]).toBe(true)
  })

  it('parses every number 0–1000 in both genders back to itself', () => {
    const lines: string[] = []
    for (let n = 0; n <= 1000; n++) {
      lines.push(`${n}\t${numberWords(n)}`, `${n}\t${numberWords(n, 'n')}`)
    }
    expect(check(lines)).toContain(`${lines.length}/${lines.length} rigtige`)
  })

  it('parses the compiled text of 101–999 (what the composition test hears) back to n', () => {
    const lines: string[] = []
    for (let n = 101; n <= 999; n++) lines.push(`${n}\t${compile([{ num: n, form: 'end' }]).text}`)
    expect(check(lines)).toContain('899/899 rigtige')
  })

  it('reads ASR spellings: digits, glued words and a dropped "og"', () => {
    const variants = ['347\t3 hundrede og 47', '347\ttrehundredeogsyvogfyrre', '347\ttre hundrede syv og fyrre', '120\t120']
    expect(check(variants)).toContain('4/4 rigtige')
  })
})

describe('parser file', () => {
  it('lives next to the other pipeline scripts', () => {
    expect(path.basename(path.dirname(PARSER))).toBe('tts')
  })
})
