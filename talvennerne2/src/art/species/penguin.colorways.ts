// Pingvinens farver (katalogets SPECIES): c1 klassisk, c2 kejser, c3 klippe, c4 blå, c5 grå, c6 creme.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `fur` er ryggen, hætten og lufferne;
// `belly` er den lyse ansigtsmaske og maven; `nose` er næbbet og `inner` fødderne. `patternColor` er artens accent:
// kejserpingvinens gyldne øreplet og klippepingvinens gule fjerbryn (c2 og c3; de andre har ingen accent). En mørk
// pingvin har en lysere kontur end pelsen (kantlys som den sorte kat), så luffer, krop og hoved skilles ad.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const PENGUIN_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  // Klassisk: blæksort-blå ryg og hvid front med orange næb og fødder.
  c1: {
    id: 'c1',
    name: 'klassisk',
    fur: '#3C405E',
    overrides: {
      outline: '#8C8EB8', shade: '#313450', belly: '#FCFCFF', nose: '#FF9A3C', inner: '#FFA24A', iris: '#7D93E6',
      cheek: '#FF8AA8',
    },
  },
  // Kejser: lysere skiferblå ryg, et varmt gult skær på brystet og gyldne ørepletter.
  c2: {
    id: 'c2',
    name: 'kejser',
    fur: '#5B6886',
    patternColor: '#FFB838',
    overrides: {
      outline: '#2F3852', shade: '#4E5A78', belly: '#FFF6DA', nose: '#F2875A', inner: '#59607A', iris: '#E0A23A',
    },
  },
  // Klippe: varm koksgrå med gule fjerbryn, rødorange næb og lyserøde fødder.
  c3: {
    id: 'c3',
    name: 'klippe',
    fur: '#4A4552',
    patternColor: '#FFD43B',
    overrides: {
      outline: '#9E95AE', shade: '#3F3A47', belly: '#FFFCF7', nose: '#F0613A', inner: '#F7A3AC', iris: '#E5674F',
      cheek: '#FF8AA8',
    },
  },
  // Blå: den lille blå pingvin i klar skiferblå med lys front og ferskenfarvede fødder.
  c4: {
    id: 'c4',
    name: 'blå',
    fur: '#4F88CC',
    overrides: { outline: '#28497A', shade: '#447AB9', belly: '#F6FAFF', nose: '#F5A04C', inner: '#F7B9A3', iris: '#3F6FB8' },
  },
  // Grå: blød sølvgrå som en dunet unge, med mørkt næb og gråviolette fødder.
  c5: {
    id: 'c5',
    name: 'grå',
    fur: '#A3A7B9',
    overrides: { outline: '#51556B', shade: '#9296A9', belly: '#FFFFFF', nose: '#5A5E74', inner: '#C3A8B6', iris: '#7179A8' },
  },
  // Creme: varm sand-creme ryg med koralnæb og abrikosfødder.
  c6: {
    id: 'c6',
    name: 'creme',
    fur: '#EBD5AE',
    overrides: { outline: '#8C6A3E', shade: '#DCC198', belly: '#FFFCF3', nose: '#FF8A5C', inner: '#FFB277', iris: '#A0703F' },
  },
  // Guld: guldfjer med ravkontur og ravskygge, lysere guld foran og ravorange næb og fødder.
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    overrides: { outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF2C2', nose: '#E8744A', inner: '#E9953A', iris: '#A0561B' },
    sparkle: '#FFF7CF',
  },
  // Regnbue: blød syrenlilla ryg (ingen naturlig farve er lilla); maven bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#CDC3F4',
    overrides: { outline: '#6A5AAE', shade: '#BCB0EC', belly: '#FFFFFF', nose: '#FFAA52', inner: '#FFB35C', iris: '#7A62C9' },
    gradient: RAINBOW_STOPS,
  },
}
