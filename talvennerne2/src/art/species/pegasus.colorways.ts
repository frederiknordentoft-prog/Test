// Pegasussens farver (katalogets rækkefølge): c1 hvid, c2 sky, c3 rosa, c4 lavendel, c5 sølv, c6 perle.
// Hver farve har en manke i en anden pastel (mane) og vingefjer i en lys tone (mane2), så vingerne skiller sig
// fra kroppen: den hvide får himmelblå manke og blålige fjer, sky-pegasussen hvid skymanke og hvide vinger, perlen
// lyserød manke og mintskinnende fjer. Regnbuen får sin egen abrikos krop (aldrig en hvid pegasus med stribet manke,
// som kunne forveksles med c1), og guldet lyse guldfjer.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint).
import { MAGIC, RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const PEGASUS_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  c1: {
    id: 'c1',
    name: 'hvid',
    fur: '#FBFBFF',
    overrides: {
      outline: '#8584B5', shade: '#E6E6F5', belly: '#FFFFFF', mane: '#9FCBFF', mane2: '#DDEBFF', hoof: '#C7CCEA',
      muzzle: '#F1F0FF', inner: '#FFC4DA', iris: '#6A7CD0',
    },
  },
  c2: {
    id: 'c2',
    name: 'sky',
    fur: '#C9E4FF',
    overrides: {
      outline: '#4A78B0', shade: '#B2D2F4', belly: '#EEF7FF', mane: '#FFFFFF', mane2: '#FFFFFF', hoof: '#98BFEA',
      muzzle: '#E3F0FF', inner: '#FFB6D0', iris: '#3D74C2',
    },
  },
  c3: {
    id: 'c3',
    name: 'rosa',
    fur: '#FFD6E5',
    overrides: {
      outline: '#A65C88', belly: '#FFF0F6', mane: '#F27FAE', mane2: '#FFEEF5', hoof: '#E6A4C2', muzzle: '#FFE6EF',
      inner: '#FF97BE', nose: '#E8628C', iris: '#B0558C',
    },
  },
  c4: {
    id: 'c4',
    name: 'lavendel',
    fur: '#E2D8FF',
    overrides: {
      outline: '#6A55A8', belly: '#F6F2FF', mane: '#8E78EC', mane2: '#F4EFFF', hoof: '#B9A8EC', muzzle: '#F0EAFF',
      inner: '#FFB3D6', iris: '#6E50C8',
    },
  },
  c5: {
    id: 'c5',
    name: 'sølv',
    fur: '#E1E5EE',
    overrides: {
      outline: '#56607F', shade: '#CBD1DF', belly: '#F5F7FB', mane: '#7D8BB6', mane2: '#FFFFFF', hoof: '#AEB6CC',
      muzzle: '#EFF1F7', inner: '#E8B6CF', iris: '#55649F',
    },
  },
  c6: {
    id: 'c6',
    name: 'perle',
    fur: '#F6EEE3',
    overrides: {
      outline: '#93777E', shade: '#E9DCCB', belly: '#FFFBF4', mane: '#F2B3CC', mane2: '#D3F0E8', hoof: '#DDC3BE',
      muzzle: '#FCF2EA', inner: '#FFBCD3', iris: '#8C68B8',
    },
  },
  gold: {
    ...MAGIC.gold,
    overrides: { ...MAGIC.gold.overrides, mane2: '#FFF1BF', muzzle: '#FFE7A1' },
  },
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#FFE3D3',
    overrides: {
      outline: '#9A5B6C', shade: '#F6CAB4', belly: '#FFF5EE', iris: '#8A5BC8', inner: '#FFB6C8', hoof: '#E6AE98', muzzle: '#FFEDE3',
    },
    gradient: RAINBOW_STOPS,
  },
}
