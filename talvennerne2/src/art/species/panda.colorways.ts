// Pandaens farver (katalogets SPECIES): c1 klassisk, c2 brun, c3 rød, c4 grå, c5 creme, c6 lilla.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `fur` er den lyse pels;
// `patternColor` er pandaens aftegning: ørerne, øjenpletterne, næsen, skulderbåndet, armene og benene
// (tegnes af panda.tsx i alle farver). `inner` er trædepuderne. Guld og regnbue har pandaens egne udgaver, så
// aftegningen også står på de magiske farver.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

/** Bambusstænglen i pandaens pote (samme i alle farver). */
export const BAMBOO = { stalk: '#9CCB6B', leaf: '#6FBF5E', node: '#5E9A48', outline: '#3D6B32' } as const

export const PANDA_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { gold: ColorwayDef; rainbow: ColorwayDef } = {
  // Klassisk: varm hvid pels og blød sort-violet aftegning (aldrig ren sort).
  c1: {
    id: 'c1',
    name: 'klassisk',
    fur: '#FFFCF6',
    patternColor: '#3B3549',
    overrides: { outline: '#6A6280', shade: '#ECE6E6', belly: '#FFFFFF', inner: '#D9B9C6', nose: '#2E2939', iris: '#C98A4E' },
  },
  // Brun: Qinling-pandaen med chokoladebrun aftegning på flødefarvet pels.
  c2: {
    id: 'c2',
    name: 'brun',
    fur: '#FBF0E2',
    patternColor: '#7B4F3A',
    overrides: { outline: '#7A5844', shade: '#EEDDCB', belly: '#FFF9F1', inner: '#E6B7A8', nose: '#4E2F24', iris: '#E0A35A' },
  },
  // Rød: rustrød aftegning (som en rød panda) på en lys, fersken-hvid pels.
  c3: {
    id: 'c3',
    name: 'rød',
    fur: '#FFF4EC',
    patternColor: '#B9512F',
    overrides: { outline: '#8C4A33', shade: '#F4E0D3', belly: '#FFFBF7', inner: '#F2B4A6', nose: '#5A2516', iris: '#F0B85E' },
  },
  // Grå: skifergrå aftegning på en kølig, lysegrå pels.
  c4: {
    id: 'c4',
    name: 'grå',
    fur: '#F1F1F7',
    patternColor: '#6A6A80',
    overrides: { outline: '#5E5C74', shade: '#DFDEEA', belly: '#FFFFFF', inner: '#D7BCCB', nose: '#3A3949', iris: '#8FB2E0' },
  },
  // Creme: lys karamel-aftegning på cremefarvet pels (den blødeste panda).
  c5: {
    id: 'c5',
    name: 'creme',
    fur: '#FFF2D9',
    patternColor: '#B9865A',
    overrides: { outline: '#86603D', shade: '#F2DFBF', belly: '#FFFAEE', inner: '#EFB9A2', nose: '#5E3D27', iris: '#7A4A22' },
  },
  // Lilla: blommelilla aftegning på en lys lavendelhvid pels.
  c6: {
    id: 'c6',
    name: 'lilla',
    fur: '#FBF6FF',
    patternColor: '#6E4F9C',
    overrides: { outline: '#665487', shade: '#E8DFF5', belly: '#FFFFFF', inner: '#E2B4D9', nose: '#3B2A57', iris: '#F0B85E' },
  },
  // Guld: guldpels med ravbrun aftegning, ravkontur og ravskygge (glansbånd og glimmer lægges på af riggen).
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    patternColor: '#B06F1C',
    overrides: { outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF0B8', inner: '#FFC98F', nose: '#6B3A0E', iris: '#A0561B' },
    sparkle: '#FFF7CF',
  },
  // Regnbue: lys lilla-hvid pels med lavendel aftegning; maven bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#F8F3FF',
    patternColor: '#A58BD6',
    overrides: { outline: '#7E68B0', shade: '#E4D9F7', belly: '#FFFFFF', iris: '#7A62C9', inner: '#FFC4DC', nose: '#5B4592' },
    gradient: RAINBOW_STOPS,
  },
}
