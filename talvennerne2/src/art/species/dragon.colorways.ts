// Dragens farver (katalogets rækkefølge): c1 grøn, c2 rød, c3 blå, c4 lilla, c5 sort, c6 turkis.
// Hver farve har en lys, varm mave (belly), glatte horn og kløer i benfarve (horn) og en flyvehud i en
// kontrastfarve (patternColor), som også farver finnerne indvendigt og halens spade: den grønne har abrikos hud,
// den røde orange, den blå lys himmelblå, den lilla lyserød, den sorte violet og den turkise lys guld.
// Røgpusten er en lille, lys sky (SMOKE), aldrig ild.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint).
import { MAGIC, RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

/** Røgpustens lille sky: lys grålilla med en blød kontur (samme i alle farver). */
export const SMOKE = { fill: '#F4F1FA', line: '#9A93B5' } as const

export const DRAGON_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  c1: {
    id: 'c1',
    name: 'grøn',
    fur: '#7CCB80',
    patternColor: '#FFC98C',
    overrides: { belly: '#FFF1BF', horn: '#FFF2CF', hornShade: '#F1D9A6', inner: '#FFB3C8', iris: '#2F8A55' },
  },
  c2: {
    id: 'c2',
    name: 'rød',
    fur: '#F2766A',
    patternColor: '#FFB27A',
    overrides: { belly: '#FFE6BD', horn: '#FFF3D9', hornShade: '#F3D7AE', inner: '#FFC2C8', cheek: '#FF6F8E', iris: '#B2423A' },
  },
  c3: {
    id: 'c3',
    name: 'blå',
    fur: '#73A9EE',
    patternColor: '#AEE3FF',
    overrides: { belly: '#E8F5FF', horn: '#FFF1CC', hornShade: '#EFD9A8', inner: '#FFB6D0', iris: '#2F62B8' },
  },
  c4: {
    id: 'c4',
    name: 'lilla',
    fur: '#AB8DEB',
    patternColor: '#FFB8DC',
    overrides: { belly: '#F7EDFF', horn: '#FFEBB0', hornShade: '#F0CF86', inner: '#FFB8DC', iris: '#6A45C2' },
  },
  c5: {
    id: 'c5',
    name: 'sort',
    fur: '#4C4663',
    patternColor: '#9273D2',
    overrides: {
      outline: '#211C33', shade: '#3B3552', belly: '#B6AED3', horn: '#F2E8D4', hornShade: '#D8CAB0', inner: '#C4A7F0',
      iris: '#8E72E0', cheek: '#FF8AB0',
    },
  },
  c6: {
    id: 'c6',
    name: 'turkis',
    fur: '#45C9BB',
    patternColor: '#FFE59A',
    overrides: { belly: '#E8FFF8', horn: '#FFF2CC', hornShade: '#F0D9A2', inner: '#FFB9CF', iris: '#1F8C82' },
  },
  gold: {
    ...MAGIC.gold,
    patternColor: '#FFE69A',
    overrides: { ...MAGIC.gold.overrides, horn: '#FFF7DA', hornShade: '#F3D58E' },
  },
  rainbow: {
    ...MAGIC.rainbow,
    overrides: { ...MAGIC.rainbow.overrides, horn: '#FFF4D2', hornShade: '#F2DCAE' },
    gradient: RAINBOW_STOPS,
  },
}
