// Hamsterens farver (katalogets SPECIES): c1 abrikos, c2 hvid, c3 grå, c4 sort-hvid, c5 karamel, c6 plettet.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `belly` er de lyse kindposer,
// mulen og maven; `inner` er de lyserøde ører, hænder og fødder. Aftegningerne (blis på sort-hvid og
// pletterne på plettet) tegnes af hamster.tsx.
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const HAMSTER_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  // Guld: klassisk guldhamster i varm abrikos-orange (mere orange end guldfarven, der er gul med ravkontur).
  c1: {
    id: 'c1',
    name: 'abrikos',
    fur: '#F2A04E',
    overrides: { belly: '#FFF8EE', outline: '#874A16', inner: '#FFB3C2', nose: '#E8728F', iris: '#8A4A1C' },
  },
  // Hvid: flødehvid med varm, gråbrun kontur og lyserøde detaljer.
  c2: {
    id: 'c2',
    name: 'hvid',
    fur: '#FFFAF2',
    overrides: { belly: '#FFFFFF', outline: '#9E8676', shade: '#EFE3D8', inner: '#FFBFCD', nose: '#F08AA4', iris: '#8C6A58' },
  },
  // Grå: blød duegrå med hvide kindposer.
  c3: {
    id: 'c3',
    name: 'grå',
    fur: '#A7A3B6',
    overrides: { belly: '#F4F2F8', outline: '#56526A', shade: '#96929F', inner: '#F7B9CA', nose: '#E58EA6', iris: '#5E63A6' },
  },
  // Sort-hvid: blåsort med hvide kindposer, mule, mave og en hvid blis; lys kontur (kantlys).
  c4: {
    id: 'c4',
    name: 'sort-hvid',
    fur: '#4C475E',
    pattern: 'blaze',
    patternColor: '#FFFAF4',
    overrides: { belly: '#FFFAF4', outline: '#9A92B4', shade: '#413C52', inner: '#E9A3BE', nose: '#F08AA4', iris: '#E5AE48', cheek: '#FF8AA8' },
  },
  // Karamel: lys nøddebrun med creme kindposer.
  c5: {
    id: 'c5',
    name: 'karamel',
    fur: '#BD875F',
    overrides: { belly: '#FFF3E4', outline: '#5E3519', shade: '#AA7550', inner: '#F7AFA8', nose: '#D9707F', iris: '#6E3B1E' },
  },
  // Plettet: hvid med karamelbrune pletter på hoved og flanker (review G2-r1 §5: pletter, ikke et pandamønster
  // med øjenpletter); ørerne i pletternes farve og en varm, brun kontur.
  c6: {
    id: 'c6',
    name: 'plettet',
    fur: '#FFFBF6',
    pattern: 'pinto',
    patternColor: '#D08E55',
    overrides: { belly: '#FFFFFF', outline: '#7E5A44', shade: '#F1E6DC', earFur: '#D08E55', inner: '#F2A9BC', nose: '#E8869E', iris: '#6E4A2E' },
  },
}
