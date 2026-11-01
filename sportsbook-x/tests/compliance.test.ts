import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Walk the UI source and return every .tsx/.ts/.css file under src. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts|css)$/.test(name) ? [p] : [];
  });
}

/** Strip comments so the rule checks what users can read, not developer notes. */
function visibleSource(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// Words that push urgency, chase or compulsion. Checked against the source the user can read.
const FORBIDDEN = [
  /\bSnart\b/,
  /\bcountdown\b/i,
  /\bact now\b/i,
  /\bvalue bet\b/i,
  /\bgood bet\b/i,
  /\bhot\b/i,
  /\bstreak\b/i,
  /\bKelly\b/,
  /\bpush (alert|notification|besked)/i,
  /\bboost\b/i,
];

describe('anti-compulsion copy rules', () => {
  const sources = files(join(process.cwd(), 'src')).map((p) => ({ p, text: visibleSource(p) }));

  it('no forbidden urgency or chase phrases in visible UI source', () => {
    const hits: string[] = [];
    for (const { p, text } of sources) {
      for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${p}: ${re}`);
    }
    expect(hits).toEqual([]);
  });

  it('no live win percentage is rendered in the match header', () => {
    const match = sources.find((s) => s.p.endsWith('screens/Match.tsx'))!.text;
    const header = match.slice(match.indexOf('className="hero"'), match.indexOf('className="section-title"'));
    expect(header).not.toMatch(/prob|%/);
  });

  it('no bet button inside the board or the curve', () => {
    const board = sources.find((s) => s.p.endsWith('screens/Board.tsx'))!.text;
    const curve = sources.find((s) => s.p.endsWith('components/ForecastCurve.tsx'))!.text;
    expect(board).not.toMatch(/Læg bet|onPlace/);
    expect(curve).not.toMatch(/Læg bet|onPlace/);
  });
});
