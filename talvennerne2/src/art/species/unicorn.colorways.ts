// Enhjørningens farver (spildesign §3.1): c1 hvid, c2 rosa, c3 lilla, c4 mint, c5 himmelblå, c6 sølv.
// Hver farve har en pastelmanke med striber i en anden farve (mane2) og et gyldent horn (sølv: perle).
// Stjernehvid (Stjernefølet, kun racen `foal`) er spillets mest eftertragtede dyr: perlehvid pels,
// manke i blålilla og rosa, gyldent horn og gyldne hove, gyldne stjernemærker og glimmer.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint).
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const UNICORN_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { starwhite: ColorwayDef } = {
  c1: {
    id: 'c1',
    name: 'hvid',
    fur: '#FFFDFB',
    overrides: {
      outline: '#8E7BA6', shade: '#EEE6F2', belly: '#FFFFFF', mane: '#F6A9D2', mane2: '#C7A8F4', horn: '#F7CC58',
      hoof: '#EBC0D8', muzzle: '#FCE6EF', inner: '#FFC1DA', iris: '#8663C7',
    },
  },
  c2: {
    id: 'c2',
    name: 'rosa',
    fur: '#FFD5E6',
    overrides: {
      outline: '#A0628A', belly: '#FFF2F7', mane: '#A88BEB', mane2: '#FFF4FA', horn: '#F7CC58', hoof: '#D9A0C4',
      muzzle: '#FFC2DA', inner: '#FF9DC2', nose: '#E8628C', cheek: '#E8628C', iris: '#9A5FB8',
    },
  },
  c3: {
    id: 'c3',
    name: 'lilla',
    fur: '#DCCCFF',
    overrides: {
      outline: '#6B54A6', belly: '#F4EEFF', mane: '#FF9DCA', mane2: '#FFE68C', horn: '#FFDB6E', hoof: '#B49DE6',
      muzzle: '#EEE4FF', inner: '#FFB3D6', iris: '#7A4FC9',
    },
  },
  c4: {
    id: 'c4',
    name: 'mint',
    fur: '#C8F1E0',
    overrides: {
      outline: '#3D8A78', belly: '#EFFCF6', mane: '#8FC0FF', mane2: '#F7A8D8', horn: '#F7CC58', hoof: '#8FD3BB',
      muzzle: '#E2F8EF', inner: '#FFB6CF', iris: '#2F9E86',
    },
  },
  c5: {
    id: 'c5',
    name: 'himmelblå',
    fur: '#CFE6FF',
    overrides: {
      outline: '#4C76AD', belly: '#F1F8FF', mane: '#FFB1D0', mane2: '#FFF0A0', horn: '#F7CC58', hoof: '#9DC4EC',
      muzzle: '#E6F2FF', inner: '#FFB8D2', iris: '#3F78C6',
    },
  },
  c6: {
    id: 'c6',
    name: 'sølv',
    fur: '#E3E6EF',
    overrides: {
      outline: '#5C6485', shade: '#CED3E1', belly: '#F6F7FB', mane: '#9DAEE7', mane2: '#FFFFFF', horn: '#F4F5FB',
      hornShade: '#C9CFE2', hoof: '#B7BCCF', muzzle: '#F1F2F8', inner: '#E8B9D2', iris: '#5967A8',
    },
  },
  starwhite: {
    id: 'starwhite',
    name: 'stjernehvid',
    fur: '#FBFAFF',
    pattern: 'stars',
    patternColor: '#FFD24D',
    overrides: {
      outline: '#7A80C6', shade: '#E2E5FA', belly: '#FFFFFF', mane: '#D3DEFF', mane2: '#F6C4EC', horn: '#FFD24D',
      hornShade: '#F2B32E', hoof: '#FFE08A', muzzle: '#F4F1FF', inner: '#F8C6E4', iris: '#5B6FD6', nose: '#F08CB4',
    },
    sparkle: '#FFFFFF',
  },
}
