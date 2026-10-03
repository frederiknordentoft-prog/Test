// Pindsvinets farver (katalogets SPECIES): c1 brun, c2 lys, c3 mørk, c4 rustrød, c5 mandel, c6 frost.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Farvenavnet sidder i
// pigkappen (`mane`, og `mane2` til det bageste piglag), mens ansigt, mave og poter er lyse (`fur`).
// Konturen er én farve for hele figuren, afledt af piggene, så den bærer både lys hud og mørke pigge.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const HEDGEHOG_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  // Brun: varme, nøddebrune pigge og et lyst, cremet ansigt.
  c1: {
    id: 'c1',
    name: 'brun',
    fur: '#F7E2CC',
    overrides: {
      mane: '#9C6B4C', mane2: '#7A5037', outline: '#5C3A27', shade: '#EACBAF', belly: '#FFF4E8', inner: '#F4ACA4',
      nose: '#3E2A2C', iris: '#7A4A2A',
    },
  },
  // Lys: blonde, sandfarvede pigge.
  c2: {
    id: 'c2',
    name: 'lys',
    fur: '#FFF5E8',
    overrides: {
      mane: '#E4CBA4', mane2: '#C8A77C', outline: '#86663F', shade: '#F3DFC6', belly: '#FFFCF6', inner: '#F8B4AE',
      nose: '#4A3432', iris: '#8A5A30',
    },
  },
  // Mørk: dybe chokoladegrå pigge; konturen er en tone lysere end piggene (kantlys), så de enkelte pigge ses.
  c3: {
    id: 'c3',
    name: 'mørk',
    fur: '#F1DCC8',
    overrides: {
      mane: '#5E4B4F', mane2: '#45373A', outline: '#6E5A5F', shade: '#E2C8B2', belly: '#FAEDE1', inner: '#EFA3A3',
      nose: '#3A2A2E', iris: '#7A4A3A',
    },
  },
  // Rustrød: klart rødorange pigge som et efterårsblad (review G1-r4: skilles tydeligt fra c1 brun og c5 mandel).
  c4: {
    id: 'c4',
    name: 'rustrød',
    fur: '#FDE6D2',
    overrides: {
      mane: '#DE5A2A', mane2: '#B23F18', outline: '#73240F', shade: '#F3CCAE', belly: '#FFF5EB', inner: '#F6A596',
      nose: '#3F2424', iris: '#7A3A18',
    },
  },
  // Mandel: lyse, rosa pigge som mandelblomst (tydeligt lyserød, så den ikke ligner c1 brun eller c4 rustrød).
  c5: {
    id: 'c5',
    name: 'mandel',
    fur: '#FFEDEB',
    overrides: {
      mane: '#E8A3AE', mane2: '#CC8090', outline: '#86475A', shade: '#F6D3D3', belly: '#FFF8F6', inner: '#F7A1B6',
      nose: '#4A2E36', iris: '#8A4E5C',
    },
  },
  // Frost: blågrå pigge med et køligt skær og et snehvidt ansigt.
  c6: {
    id: 'c6',
    name: 'frost',
    fur: '#FFFCFA',
    overrides: {
      mane: '#B5C1DA', mane2: '#8E9BBC', outline: '#55607F', shade: '#ECE9F2', belly: '#FFFFFF', inner: '#F6B4C6',
      nose: '#3A3550', iris: '#5B6FD6',
    },
  },
  // Guld: lys guldhud og rige guldpigge med ravkontur og ravskygge (glansbånd og glimmer lægges på af riggen).
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#FFE7A8',
    overrides: {
      mane: '#F1B532', mane2: '#D4931C', outline: '#7A4A10', shade: '#F4C96E', belly: '#FFF6D8', inner: '#FFC98F',
      nose: '#8A4A14', iris: '#A0561B',
    },
    sparkle: '#FFF7CF',
  },
  // Regnbue: pigkappen i fire flade pastelstriber; huden er lys lilla-hvid med lilla kontur.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#FBF6FF',
    overrides: { outline: '#7E68B0', shade: '#E6DCF7', belly: '#FFFFFF', iris: '#7A62C9', inner: '#FFC4DC', mane2: '#E3D7F8' },
    gradient: RAINBOW_STOPS,
  },
}
