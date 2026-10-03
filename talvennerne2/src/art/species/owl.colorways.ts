// Uglens farver (katalogets SPECIES): c1 brun, c2 sne, c3 grå, c4 perlehvid, c5 kanel, c6 nat.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `belly` er ansigtsskiven og
// brystet; `mane2` er vingerne (en tone mørkere end kroppen); `nose` er næbbet og fødderne; `iris` er uglens
// rav-gule iris i husets øjne.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const OWL_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  // Brun: kirkeugle-brun med lys, varm ansigtsskive.
  c1: {
    id: 'c1',
    name: 'brun',
    fur: '#A9764D',
    overrides: { belly: '#F8E9D2', outline: '#55301A', mane2: '#8B5B37', shade: '#94643E', nose: '#F2A33A', iris: '#E8962B' },
  },
  // Sne: sneugle i næsten hvid med kølig, grålilla kontur og mørkt næb.
  c2: {
    id: 'c2',
    name: 'sne',
    fur: '#FBFAFF',
    overrides: { belly: '#FFFFFF', outline: '#76738F', mane2: '#E3E1EE', shade: '#E9E7F2', nose: '#4A4660', iris: '#E8B42A' },
  },
  // Grå: duegrå ugle med lys ansigtsskive.
  c3: {
    id: 'c3',
    name: 'grå',
    fur: '#9D99AF',
    overrides: { belly: '#F1EFF6', outline: '#4D4962', mane2: '#827E96', shade: '#8B879E', nose: '#EBA23C', iris: '#E8962B' },
  },
  // Perlehvid: en varm perlerosa (tydeligt anden tone end den kølige sne, review G2-r1 §5) med rosenbrun kontur,
  // lyserødt næb og lilla iris.
  c4: {
    id: 'c4',
    name: 'perlehvid',
    fur: '#F4DCD8',
    overrides: { belly: '#FFF6F2', outline: '#966570', mane2: '#E6C3C0', shade: '#E8CAC6', nose: '#EE9DB3', iris: '#9C7BD6' },
  },
  // Kanel: lys, varm kanel med et rødt skær (lysere og rødere end brun, review G2-r1 §5) og creme ansigtsskive.
  c5: {
    id: 'c5',
    name: 'kanel',
    fur: '#DB8650',
    overrides: { belly: '#FDEBD6', outline: '#6E3216', mane2: '#C26B3A', shade: '#C67443', nose: '#F5B44A', iris: '#E8962B' },
  },
  // Nat: dyb natblå-violet med lys lavendel skive og lys kontur (kantlys som den sorte kat).
  c6: {
    id: 'c6',
    name: 'nat',
    fur: '#41406A',
    overrides: { belly: '#D9D3F2', outline: '#A29CD0', mane2: '#33325A', shade: '#37365D', nose: '#F4C350', iris: '#F2C230', cheek: '#FF8AA8' },
  },
  // Guld: guldfjer med ravkontur og ravskygge; vingerne en tone dybere.
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    overrides: { outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF0B8', mane2: '#E9AE2E', nose: '#E8744A', iris: '#A0561B' },
    sparkle: '#FFF7CF',
  },
  // Regnbue: lys lilla-hvid ugle; brystet bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#F6F0FF',
    overrides: { outline: '#7E68B0', shade: '#E2D6F7', belly: '#FFFFFF', mane2: '#E3D7F8', nose: '#F5B44A', iris: '#7A62C9', inner: '#FFC4DC' },
    gradient: RAINBOW_STOPS,
  },
}
