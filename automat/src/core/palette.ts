// Single source for colours. Hex numbers for Pixi, strings for CSS.
export const PAL = {
  // base "Nordlys"
  night0: 0x050b1a, night1: 0x0b1b3a, airglow: 0x0f3b2e,
  green: 0x3dffb0, teal: 0x19e3d6, violet: 0x8a5cff, redTop: 0xff3d6e,
  ice: 0xeaf8ff, frost: 0x9cc9ff, muted: 0x7f93b2, klint: 0x0b1022, chalk: 0xc9d3e6,
  gold: 0xffd36b, mote: 0xcfefff,
  // extreme "Solstorm"
  void0: 0x0a0204, void1: 0x3a0010, liftBlack: 0x1a0006,
  crimson: 0xff1e3c, magenta: 0xff2bd6, molten: 0xff6a00, whiteHot: 0xfff4e0, stormGold: 0xffc23d, cyan: 0x3af2ff,
  // symbols
  sym: [0x5ce1ff, 0x3dffb0, 0x8a5cff, 0xff5c9a, 0xe6eeff, 0xfff7e0, 0xffb547, 0x3dffb0, 0xffd36b],
} as const;

export const css = (n: number) => '#' + n.toString(16).padStart(6, '0');
export const rgb = (n: number): [number, number, number] => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
