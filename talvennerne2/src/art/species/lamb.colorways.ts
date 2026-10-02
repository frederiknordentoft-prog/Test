// Lammets farver (katalogets SPECIES): c1 hvid, c2 creme, c3 sort, c4 grå, c5 brun, c6 lyserød uld.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Ulden (krop, uldtop og hale)
// er pelsens farve; `hoof` er de mørke klove, og `belly` den lyse mule.
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const LAMB_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  // Hvid: flødehvid uld med varm, gråbrun kontur, lyserøde ører og næse og mørke klove.
  c1: {
    id: 'c1',
    name: 'hvid',
    fur: '#FFFBF4',
    overrides: { outline: '#9A8273', shade: '#EFE4D8', belly: '#FFFFFF', inner: '#FFC2CF', nose: '#EE9AB0', hoof: '#5E4A52', iris: '#8C6A58' },
  },
  // Creme: varm havreuld med karamelkontur.
  c2: {
    id: 'c2',
    name: 'creme',
    fur: '#F6E2BF',
    overrides: { outline: '#8E683E', shade: '#E9D0A6', belly: '#FFF6E6', inner: '#F8B7AE', nose: '#D98C8C', hoof: '#57412F', iris: '#7A4E2A' },
  },
  // Sort: blød blåsort uld med lys kontur (kantlys som den sorte kat), lys næse og gyldne øjne.
  c3: {
    id: 'c3',
    name: 'sort',
    fur: '#4A4559',
    overrides: {
      outline: '#9A92B4', shade: '#3F3A4E', belly: '#5C566C', inner: '#D99AB6', nose: '#CBBEDB', hoof: '#2B2438',
      iris: '#E5AE48', cheek: '#FF8AA8',
    },
  },
  // Grå: lys skifergrå uld.
  c4: {
    id: 'c4',
    name: 'grå',
    fur: '#BEBBCB',
    overrides: { outline: '#5E5A71', shade: '#ACA8BA', belly: '#E4E2EC', inner: '#F2BCCB', nose: '#8A6378', hoof: '#46405A', iris: '#5E63A6' },
  },
  // Brun: mørk nøddebrun uld med lys mule.
  c5: {
    id: 'c5',
    name: 'brun',
    fur: '#A8775A',
    overrides: { outline: '#56321D', shade: '#966549', belly: '#E9CDB8', inner: '#EFA69E', nose: '#4A2C2A', hoof: '#3A2622', iris: '#6E3B1E' },
  },
  // Lyserød uld: sukkerspinds-lyserød med hindbærkontur.
  c6: {
    id: 'c6',
    name: 'lyserød uld',
    fur: '#FFD3E0',
    overrides: { outline: '#AE5C7C', shade: '#F5BDD0', belly: '#FFF0F5', inner: '#FF9FBA', nose: '#E8789A', hoof: '#7A4A62', iris: '#B05A80' },
  },
}
