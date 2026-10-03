// Ridder · ansigt: en heltemaske – en blød domino-maske i stof over øjenpartiet med vinger, der løfter sig i en
// spids ud mod hovedets sider, et lille hak over næseryggen og en guldstjerne midt i panden. Maskens to øjenhuller
// er åbne (ingen glas): de omslutter øjet med luft til, at det kan kigge 3 enheder til alle sider, og til de
// lukkede øjnes vipper, så masken aldrig dækker øjnene (fit-regel 6). Hullerne skæres ud med evenodd, så kun
// stoffet om øjnene tegnes, og vingerne holder sig inden for hovedets omrids. Cel-skygge: masken i skyggefarven med en lys kopi
// forskudt op mod venstre ovenpå (hullerne er med i begge), en smal glans og stjernen. Alt regnes ud fra
// bærerens øjenankre og stadiets øjenskala (babyens øjne er større), så masken sidder ens på alle arter og
// stadier. Alene (butik) tegnes masken på standardankrene.
import type { Vec } from '../../rig/shapes'
import type { ItemArt } from '../../rig/types'
import { cws, def, draw, eyeUnits, fitAt, S } from './kit/mestring'

const front: ItemArt = ({ c, sw, a, local, stage }) => {
  const { L, R, k, erx, ery, side } = eyeUnits({ a, local, stage, sw })
  // Øjenhullerne: øjet, der kan kigge 3 enheder til alle sider (blikket i humørerne), og det lukkede øjes vipper
  // (1,35 · øjets bredde ud mod siden) med en halv kant og lidt luft. Hullet er skubbet en anelse ud mod siden.
  const look = 3.4 * k
  const edge = sw / 2 + 0.8 * k
  const rx = Math.max(erx + look, erx * 1.35) + edge
  const ry = ery + look + edge
  const out = erx * 0.06
  const lx = L.x - out
  const rcx = R.x + out
  const cy = (L.y + R.y) / 2
  const holes = S.join(S.ellipse(lx, L.y, rx, ry), S.ellipse(rcx, R.y, rx, ry))
  // Maskens omrids (venstre halvdel fra midten foroven, rundt om hullet til midten forneden): stoffet går uden om
  // hullerne, vingen løfter sig i en spids ud mod hovedets side (aldrig uden for hovedet), og forneden er der et
  // hak over næsen.
  const mt = 9.5 * k
  const mb = 7.5 * k
  const mid = (lx + rcx) / 2
  // Vingerne går helt ud mod hovedets sider (mindst 6 enheder stof uden for hullet).
  const o = Math.min(lx - rx - 6 * k, Math.max(lx - rx - 14 * k, side + 2.6 * k))
  const left: Vec[] = [
    [mid, cy - ry - mt * 0.62],
    [lx + rx * 0.3, cy - ry - mt],
    [lx - rx * 0.5, cy - ry - mt * 0.92],
    [o + 3 * k, cy - ry - mt * 0.6],
    [o - 1.6 * k, cy - ry - mt * 1.45],
    [o - 1.6 * k, cy - ry * 0.4],
    [o + 1.6 * k, cy + ry * 0.5],
    [lx - rx * 0.5, cy + ry + mb * 0.9],
    [lx + rx * 0.5, cy + ry + mb * 0.8],
    [mid - 4 * k, cy + ry * 0.66],
    [mid, cy + ry * 0.44],
  ]
  const outline = [...left, ...left.slice(1, -1).reverse().map(([x, y]) => [2 * mid - x, y] as Vec)]
  // Den lyse kopi: omridset krympet mod lyset (øverst til venstre), så skyggen bliver en halvmåne forneden.
  const lit = S.xf(outline, { sx: 0.94, about: [lx - rx, cy - ry * 1.8] })
  const mask = S.blob(outline, 0.55)
  // Stjernen midt i panden mellem hullerne og glansen på den venstre vinge.
  const sr = 5.2 * k
  const shine = S.ellipse(lx - rx * 0.2, cy - ry - mt * 0.48, 5 * k, 1.3 * k, -10)
  return draw(
    [S.join(mask, holes), c.mainShade, , , { fillRule: 'evenodd' }],
    [S.join(S.blob(lit, 0.55), holes), c.main, , , { fillRule: 'evenodd' }],
    [shine, c.highlight],
    [S.join(mask, holes), 'none', c.outline, sw],
    [S.star(mid, cy - ry - mt * 0.25, sr, sr * 0.48, 5), c.accent, c.accentOutline, sw * 0.7],
  )

}

export const ridderFace = def('ridder-face', {
  colorways: cws('roed|rød|tomato|cream|gold', 'blaa|blå|navy|sky|sunflower', 'groen|grøn|teal|mint|silver'),
  art: { front },
  fit: fitAt('headCenter', 'headWidth', 100),
  icon: { box: [-50, -26, 100, 40] },
})

export default ridderFace
