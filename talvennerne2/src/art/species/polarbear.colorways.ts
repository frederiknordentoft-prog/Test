// Isbjørnens farver (katalogets SPECIES): c1 hvid, c2 creme, c3 isblå, c4 sølv, c5 sne, c6 perle.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Seks lyse farver skal kunne skelnes
// (review G2-r1 §5: uglens sne og perlehvid var næsten ens), så hver har sin egen tone og konturfarve: hvid er neutral
// med grålilla kontur, creme varm gul, isblå klart lyseblå, sølv mørkere grå, sne kølig lavendel og perle lyserød
// perlemor. Kontur og cel-skygge bærer formen på papirfarven. `patternColor` er trædepuder og kløer, `inner` ørernes
// inderside, `nose` den store næse.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const POLARBEAR_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  c1: {
    id: 'c1',
    name: 'hvid',
    fur: '#FBFAF6',
    patternColor: '#5F5B72',
    overrides: { outline: '#7A7B96', shade: '#E2E4EC', belly: '#FFFFFF', inner: '#E4C6CF', nose: '#2E2C3E', iris: '#7A86C8' },
  },
  c2: {
    id: 'c2',
    name: 'creme',
    fur: '#FFEEC8',
    patternColor: '#7E6450',
    overrides: { outline: '#9A7646', shade: '#F1D9A6', belly: '#FFF9E8', inner: '#F2C2AE', nose: '#4A372C', iris: '#B07A3C' },
  },
  c3: {
    id: 'c3',
    name: 'isblå',
    fur: '#D6EBFF',
    patternColor: '#4E6488',
    overrides: { outline: '#46719F', shade: '#BCD5F0', belly: '#F2F9FF', inner: '#F2C0D3', nose: '#2A3854', iris: '#4F82C8' },
  },
  c4: {
    id: 'c4',
    name: 'sølv',
    fur: '#D3D6E0',
    patternColor: '#585B70',
    overrides: { outline: '#555A73', shade: '#BCC0CE', belly: '#EEF0F5', inner: '#E0BACA', nose: '#30324A', iris: '#6E7598' },
  },
  c5: {
    id: 'c5',
    name: 'sne',
    fur: '#EEEAFF',
    patternColor: '#6A5F9E',
    overrides: { outline: '#7469B4', shade: '#D9D2F6', belly: '#FFFFFF', inner: '#F5C4DD', nose: '#352E5C', iris: '#7C66D0' },
  },
  c6: {
    id: 'c6',
    name: 'perle',
    fur: '#FBE6E3',
    patternColor: '#8E6470',
    overrides: { outline: '#A26A77', shade: '#F0CFCC', belly: '#FFF7F5', inner: '#F8BCC9', nose: '#4C2E37', iris: '#B0607E' },
  },
  // Guld: guldpels med ravkontur og ravskygge; trædepuderne og næsen i dyb rav.
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    patternColor: '#9A5E16',
    overrides: { outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF0B8', inner: '#FFC98F', nose: '#6B3A0E', iris: '#A0561B' },
    sparkle: '#FFF7CF',
  },
  // Regnbue: en lys mintgrøn pels (ingen naturlig farve er grøn); maven bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#E2F7EC',
    patternColor: '#5C8A84',
    overrides: { outline: '#4D8A78', shade: '#C9EBDA', belly: '#FFFFFF', inner: '#FFC4DC', nose: '#2F4F4A', iris: '#7A62C9' },
    gradient: RAINBOW_STOPS,
  },
}
