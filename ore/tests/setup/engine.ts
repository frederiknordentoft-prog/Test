/** Typed access to the bundled engine (see bundle.ts). */
export type Engine = typeof import('../../src/engine/index');
export async function engine(): Promise<Engine> {
  // @ts-expect-error generated at test start by tests/setup/bundle.ts
  return (await import('../.cache/engine.mjs')) as Engine;
}
