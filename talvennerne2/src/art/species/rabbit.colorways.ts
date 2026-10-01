// Kaninens farver (spildesign §3.1): c1 hvid, c2 grå, c3 brun, c4 hollænder, c5 karamel, c6 rosa.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint).
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const RABBIT_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  c1: {
    id: 'c1',
    name: 'hvid',
    fur: '#FFFBF7',
    overrides: { outline: '#8C7790', shade: '#EEE1EB', belly: '#FFFFFF', iris: '#8663C7' },
  },
  c2: {
    id: 'c2',
    name: 'grå',
    fur: '#C3C4D6',
    overrides: { belly: '#F1F1F8', inner: '#F7B3C6' },
  },
  c3: {
    id: 'c3',
    name: 'brun',
    fur: '#B98363',
    overrides: { belly: '#F6E4D4', inner: '#F5B0B8' },
  },
  c4: {
    id: 'c4',
    name: 'hollænder',
    fur: '#FFFBF7',
    pattern: 'dutch',
    patternColor: '#7B7288',
    // Én konturfarve for hele figuren: mellemmørk plomme, der bærer både hvid pels og grå plader.
    overrides: { outline: '#6A5670', shade: '#EEE3EB', belly: '#FFFFFF', iris: '#8663C7' },
  },
  c5: {
    id: 'c5',
    name: 'karamel',
    fur: '#F2AE6B',
    overrides: { belly: '#FFF1DC', inner: '#FFB8B0' },
  },
  c6: {
    id: 'c6',
    name: 'rosa',
    fur: '#FBC6DA',
    // Næse og kinder med tydelig kontrast på den lyserøde pels (review G0-r1, fund 11).
    overrides: { belly: '#FFF0F6', inner: '#FF9DBB', nose: '#E8628C', cheek: '#E8628C' },
  },
}
