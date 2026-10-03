// Rævens farver (katalogets SPECIES): c1 rød, c2 polar, c3 sølv, c4 brun, c5 guldrød, c6 mørk og regnbuen.
// Colorway-filer er, sammen med palette.ts, de eneste steder med rå hex (lint). `patternColor` er rævens
// mørke "sokker" og ørespidser (tegnes af fox.tsx i alle farver); `belly` er masken, brystet og halespidsen.
import { RAINBOW_STOPS } from '../rig/palette'
import type { ColorwayDef, NaturalColorwayId } from '../rig/types'

export const FOX_COLORWAYS: Record<NaturalColorwayId, ColorwayDef> & { rainbow: ColorwayDef } = {
  // Rød: klassisk rødræv i dyb, varm orange med hvid maske og næsten sorte sokker.
  c1: {
    id: 'c1',
    name: 'rød',
    fur: '#EC7436',
    patternColor: '#4A3036',
    overrides: { belly: '#FFF6EC', outline: '#88360F', inner: '#FFE4D2', nose: '#33232B', iris: '#8C3E14', cheek: '#FF7E8E' },
  },
  // Polar: snehvid fjeldræv med isblå-grå sokker, ørespidser og kontur (kølig blå, ikke lavendel som regnbuens
  // krop, review G2-r1 §5).
  c2: {
    id: 'c2',
    name: 'polar',
    fur: '#F7F9FC',
    patternColor: '#AFBDD0',
    overrides: { belly: '#FFFFFF', outline: '#667891', shade: '#DFE6EF', inner: '#FBD3E0', nose: '#3E4A60', iris: '#5E86C4' },
  },
  // Sølv: sølvræv i blågrå med mørke sokker og en lysere maske.
  c3: {
    id: 'c3',
    name: 'sølv',
    fur: '#8F94AC',
    patternColor: '#3E4055',
    overrides: { belly: '#EEF0F6', outline: '#474A63', shade: '#7D8299', inner: '#F2C4D4', nose: '#2E2A3C', iris: '#4E5D9E' },
  },
  // Brun: korsræv i mørk nøddebrun med creme maske.
  c4: {
    id: 'c4',
    name: 'brun',
    fur: '#A9683F',
    patternColor: '#3C2824',
    overrides: { belly: '#F8E8D6', outline: '#582D14', inner: '#F6CFC0', nose: '#2F2124', iris: '#6E3A1A' },
  },
  // Guldrød: lys abrikos-guld (mere rød end guldfarven, som er gul med ravkontur og glimmer).
  c5: {
    id: 'c5',
    name: 'guldrød',
    fur: '#F4AE5A',
    patternColor: '#5B3A2C',
    overrides: { belly: '#FFF8EA', outline: '#8E5418', inner: '#FFE2CC', nose: '#3C2A2A', iris: '#8A5420' },
  },
  // Mørk: sort-violet ræv med lys kontur (kantlys som den sorte kat), så ben, krop og hale skilles ad.
  c6: {
    id: 'c6',
    name: 'mørk',
    fur: '#4B4559',
    patternColor: '#2C2638',
    overrides: { belly: '#ECE6F3', outline: '#978FB0', shade: '#403A4E', inner: '#D9A4C0', nose: '#2B2144', iris: '#E5AE48', cheek: '#FF8AA8' },
  },
  // Regnbue: en varm creme ræv (aldrig den kølige, hvide polarræv, review G2-r2 §3.4) med lyse lilla sokker og
  // ørespidser og en varm, rosenbrun kontur; halen og kraven bærer de fire flade pastelstriber.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#FFE6C4',
    patternColor: '#C7A9E3',
    overrides: { outline: '#8C5A62', shade: '#F4D2A8', belly: '#FFF8EE', inner: '#FFC4DC', nose: '#5B3A4A', iris: '#7A62C9' },
    gradient: RAINBOW_STOPS,
  },
}
