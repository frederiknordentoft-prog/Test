/**
 * Vitest's TS transform makes the engine's hot loops ~8× slower than the real (bundled) app.
 * Statistical tests that simulate hundreds of matches import this rolldown bundle instead.
 */
import { build } from 'rolldown';
import { fileURLToPath } from 'node:url';

export default async function setup(): Promise<void> {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  await build({
    input: `${root}tests/setup/entry.ts`,
    output: { file: `${root}tests/.cache/engine.mjs`, format: 'esm' },
    logLevel: 'silent',
  });
}
