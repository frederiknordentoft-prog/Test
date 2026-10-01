// Kattens farver (spildesign §3.1): c1 rød, c2 sort, c3 grå-stribet, c4 calico, c5 hvid, c6 blå-grå.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Mønstrene (striber,
// calico-pletter) tegnes af cat.tsx og klippes til hoved og krop.
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const CAT_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  // Rød (ingefær) er næsten altid stribet: mørkere orange striber, creme mule og grønne øjne.
  c1: {
    id: 'c1',
    name: 'rød',
    fur: '#F6A55A',
    pattern: 'tabby',
    patternColor: '#DB7A35',
    overrides: { belly: '#FFF1DF', inner: '#FFB9A8', iris: '#5FA640', outline: '#8A4A1C' },
  },
  // Sort: blød blåsort (aldrig ren sort) med lysere mule, gule øjne og lyserøde inderører.
  c2: {
    id: 'c2',
    name: 'sort',
    fur: '#54506A',
    // Lysere lilla-grå kontur end pelsen (review G1-r2, C5), så ben, krop og hale skilles ad.
    overrides: {
      outline: '#8B83A8', shade: '#47425C', belly: '#6E6987', inner: '#C995B4', iris: '#F4C430',
      nose: '#D98AAA', cheek: '#FF8AA8',
    },
  },
  // Grå-stribet: kølig grå med mørke striber og grønne øjne.
  c3: {
    id: 'c3',
    name: 'grå-stribet',
    // Varm grå med kraftige striber, tydeligt forskellig fra c6 blå-grå (review G1-r2, C4).
    fur: '#BDB4AC',
    pattern: 'tabby',
    patternColor: '#5E554F',
    overrides: { belly: '#F5F1EC', inner: '#F6B3C4', iris: '#7DB547', outline: '#4E4640' },
  },
  // Calico: hvid med orange og mørke plader.
  c4: {
    id: 'c4',
    name: 'calico',
    fur: '#FFFBF6',
    pattern: 'calico',
    patternColor: '#F3A04F',
    patternColor2: '#5A5368',
    overrides: { outline: '#6B5560', shade: '#EFE4E2', belly: '#FFFFFF', iris: '#D79A2B', inner: '#FFB8C6' },
  },
  // Hvid: varm hvid med blå øjne og en plommefarvet kontur, der bærer på papir.
  c5: {
    id: 'c5',
    name: 'hvid',
    fur: '#FFFCF8',
    overrides: { outline: '#8C7790', shade: '#EEE3EA', belly: '#FFFFFF', iris: '#5B95DA', inner: '#FFB6C8' },
  },
  // Blå-grå (britisk blå): dueblå pels og kobberfarvede øjne.
  c6: {
    id: 'c6',
    name: 'blå-grå',
    fur: '#93A5D2',
    overrides: { belly: '#E4EAF8', inner: '#F2B3C6', iris: '#E39A3B', outline: '#3F5285' },
  },
}
