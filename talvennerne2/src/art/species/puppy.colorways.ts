// Hvalpens farver (katalogets SPECIES): c1 golden, c2 sort-hvid, c3 brun, c4 plettet, c5 creme, c6 rødbrun.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Ørerne er en tone mørkere
// end hovedet (som på en golden retriever), så de hængende ører altid står tydeligt mod kinderne.
// Aftegningerne (blis på sort-hvid, pletter og øjenplet på plettet) tegnes af puppy.tsx.
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const PUPPY_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  // Golden: varm abrikos-honning (mere orange end guldfarven, der er gul med ravkontur og glimmer).
  c1: {
    id: 'c1',
    name: 'golden',
    fur: '#EDAE68',
    overrides: { earFur: '#D88E4A', belly: '#FFF1DE', outline: '#874F1E', inner: '#F7A99C', nose: '#4A2F33', iris: '#8A4F22' },
  },
  // Sort-hvid: blød blåsort med hvid blis, mule, bryst og halespids. Konturen er lysere lilla-grå end
  // pelsen (kantlys som den sorte kat), så ben, krop og ører skilles ad.
  c2: {
    id: 'c2',
    name: 'sort-hvid',
    fur: '#4E4964',
    pattern: 'blaze',
    patternColor: '#FFFAF4',
    overrides: {
      outline: '#8E86AB', shade: '#423D57', belly: '#FFFAF4', earFur: '#3F3A54', inner: '#D99AB6', nose: '#2B2144',
      iris: '#E5AE48', cheek: '#FF8AA8',
    },
  },
  // Brun: chokoladebrun med lys mule og bryst.
  c3: {
    id: 'c3',
    name: 'brun',
    fur: '#9C6A4E',
    overrides: { earFur: '#7F5139', belly: '#F6E3D3', outline: '#55301E', shade: '#8A5A40', inner: '#EFA69E', nose: '#3E2626', iris: '#6E3B1E' },
  },
  // Plettet: hvid med mørke pletter, en plet om venstre øje og mørke ører.
  c4: {
    id: 'c4',
    name: 'plettet',
    fur: '#FFFBF6',
    pattern: 'pinto',
    patternColor: '#6A5552',
    overrides: { earFur: '#6A5552', outline: '#6B5458', shade: '#EEE3DE', belly: '#FFFFFF', inner: '#F6B0BE', nose: '#3B2C33', iris: '#8A5A34' },
  },
  // Creme: lys flødefarve med lysebrune ører.
  c5: {
    id: 'c5',
    name: 'creme',
    fur: '#F6E2C4',
    overrides: { earFur: '#E2BC8C', belly: '#FFFAF1', outline: '#8C6740', shade: '#EACFAB', inner: '#F8B2A8', nose: '#5A3B35', iris: '#7A4E2A' },
  },
  // Rødbrun: dyb rødbrun (setter) med mørkere ører og lys mule.
  c6: {
    id: 'c6',
    name: 'rødbrun',
    fur: '#C4643A',
    overrides: { earFur: '#A54C29', belly: '#FCE3CF', outline: '#6E2C14', inner: '#F3A08E', nose: '#3F2424', iris: '#7A3A18' },
  },
}
