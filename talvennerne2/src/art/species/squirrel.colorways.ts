// Egernets farver (katalogets SPECIES): c1 rød, c2 grå, c3 sort, c4 brun, c5 lys, c6 orange.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `belly` er den lyse mave, mulen og
// halens lyse kant; `mane2` er halens mørkere inderside; `inner` er ørernes inderside og trædepuderne.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const SQUIRREL_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  // Rød: det danske egern i varm rustrød med creme mave.
  c1: {
    id: 'c1',
    name: 'rød',
    fur: '#D8703A',
    overrides: { belly: '#FFF1DF', outline: '#7E3412', mane2: '#B9572A', inner: '#FFC7B0', nose: '#5A2A1E', iris: '#7A3A16' },
  },
  // Grå: gråegern i kølig duegrå med hvid mave og en sølvlys halekant.
  c2: {
    id: 'c2',
    name: 'grå',
    fur: '#A3A1B4',
    overrides: { belly: '#F7F6FB', outline: '#545269', shade: '#918FA3', mane2: '#878599', inner: '#F4BFD0', nose: '#3E3B4F', iris: '#5E6AA8' },
  },
  // Sort: sort egern i blåsort med lys kontur (kantlys som den sorte kat), så hale, krop og ører skilles ad.
  c3: {
    id: 'c3',
    name: 'sort',
    fur: '#46415A',
    overrides: { belly: '#E9E3F2', outline: '#9C93B8', shade: '#3B364D', mane2: '#37324A', inner: '#D9A3C0', nose: '#2B2144', iris: '#E5AE48', cheek: '#FF8AA8' },
  },
  // Brun: nøddebrunt egern med lys sandfarvet mave.
  c4: {
    id: 'c4',
    name: 'brun',
    fur: '#9C6440',
    overrides: { belly: '#F8E7D2', outline: '#4F2A13', mane2: '#81502F', inner: '#F4C1B0', nose: '#3B2218', iris: '#5E3216' },
  },
  // Lys: blond, honningfarvet egern med næsten hvid mave.
  c5: {
    id: 'c5',
    name: 'lys',
    fur: '#E9C08A',
    overrides: { belly: '#FFF9EE', outline: '#8A5F2C', shade: '#D9AC74', mane2: '#D3A66C', inner: '#FFC9BC', nose: '#5E3D27', iris: '#8A5420' },
  },
  // Orange: klar mandarinorange, tydeligt lysere og mere gul end det rustrøde c1 – også ved 48 px (review G2-r2 §3.4) –
  // og rødere og mere mættet end guldets citrongule pels (review G2-r3 §4 og §7.5: OKLab-afstanden til guld var 0,044).
  // squirrel.colorways.test.ts holder pelsens afstand til guld og til de andre farver på mindst 0,08.
  c6: {
    id: 'c6',
    name: 'orange',
    fur: '#FFA22C',
    overrides: { belly: '#FFF8E4', outline: '#8A520E', mane2: '#F08C22', inner: '#FFD2AC', nose: '#5C3012', iris: '#8A4C14' },
  },
  // Guld: guldpels med ravkontur og ravskygge; halen lidt dybere guld.
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    overrides: { outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF0B8', mane2: '#E9AE2E', inner: '#FFC98F', nose: '#6B3A0E', iris: '#A0561B' },
    sparkle: '#FFF7CF',
  },
  // Regnbue: lys lilla-hvid pels; halen bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#F6F0FF',
    overrides: { outline: '#7E68B0', shade: '#E2D6F7', belly: '#FFFFFF', mane2: '#E3D7F8', iris: '#7A62C9', inner: '#FFC4DC', nose: '#5B4592' },
    gradient: RAINBOW_STOPS,
  },
}
