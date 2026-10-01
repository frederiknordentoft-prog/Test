// Hestens farver (spildesign §3.1): c1 fuks, c2 skimmel, c3 sort, c4 isabel, c5 broget, c6 palomino.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). Aftegningerne (blis,
// æbleskimmel, broget) tegnes af shared/equine.tsx og klippes til hoved og krop.
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const HORSE_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> = {
  // Fuks: kobberrød med mørkere rødbrun manke, hvid blis og lys mule.
  c1: {
    id: 'c1',
    name: 'fuks',
    fur: '#CF7A42',
    pattern: 'blaze',
    patternColor: '#FFF8F0',
    overrides: { mane: '#94401F', muzzle: '#F2C9A8', hoof: '#6B4A3C', inner: '#E89A8C', outline: '#7A3818', iris: '#7A4A1E' },
  },
  // Skimmel: lys grå med æbleskimmel, mørkere manke og grå mule.
  c2: {
    id: 'c2',
    name: 'skimmel',
    fur: '#DCDFE9',
    pattern: 'dapple',
    patternColor: '#C3C8D8',
    overrides: { mane: '#7E8399', muzzle: '#A6AABB', hoof: '#6D6A79', inner: '#C9A9B8', outline: '#5B5F78', shade: '#C9CDDB', iris: '#5D6B94' },
  },
  // Sort: blød blåsort (aldrig ren sort) med en lille hvid stjerne i panden og lysere mule.
  c3: {
    id: 'c3',
    name: 'sort',
    fur: '#46405A',
    pattern: 'blaze',
    patternColor: '#FFF8F2',
    overrides: {
      mane: '#2C2839', muzzle: '#6C6585', hoof: '#2C2839', inner: '#A9839D', outline: '#211C30', shade: '#3B3650',
      belly: '#6A6383', iris: '#E7B04A',
    },
  },
  // Isabel: lys creme-gylden pels med en lidt mørkere, gylden manke.
  c4: {
    id: 'c4',
    name: 'isabel',
    fur: '#F1DEB3',
    overrides: { mane: '#D1A65E', muzzle: '#E7C7A0', hoof: '#9C8164', inner: '#E9AE9F', outline: '#8A6A3E', iris: '#8A5C2A' },
  },
  // Broget: hvid med store brune plader og brun manke.
  c5: {
    id: 'c5',
    name: 'broget',
    fur: '#FFFAF3',
    pattern: 'pinto',
    patternColor: '#A4693F',
    overrides: { mane: '#8E5532', muzzle: '#F2D3C6', hoof: '#B3988A', inner: '#F2B3BE', outline: '#6E4A33', shade: '#EFE3DA', iris: '#8A5A3A' },
  },
  // Palomino: gylden pels med hvid manke.
  c6: {
    id: 'c6',
    name: 'palomino',
    fur: '#E9B35A',
    overrides: { mane: '#FFF6E6', muzzle: '#F4D29C', hoof: '#9E7448', inner: '#F2A99A', outline: '#87561C', iris: '#8A5420' },
  },
}

/** Fjordhestens blakkede tone: pelsen blandes mod creme og manken får en mørk midterstribe. */
export const FJORD_CREAM = '#F4E4C1'
export const FJORD_DARK = '#3B302B'
