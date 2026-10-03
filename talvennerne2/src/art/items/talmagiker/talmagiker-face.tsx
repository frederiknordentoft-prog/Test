// Talmagiker · ansigt: stjernebriller. To femtakkede stjerner med klart glas omslutter øjnene, og deres takker
// mod næsen mødes midt over næseryggen og danner broen. Stjernens indre hak ligger uden for øjet med luft til,
// at pupillerne kan kigge rundt og de lukkede øjnes vipper går fri (som støvbrillernes glas), så stellet aldrig
// dækker øjnene (fit-regel 6). Glasset er kun svagt tonet (16 %) med et hvidt højlys i den øverste ydre tak, og
// to små glimt funkler ved stjernerne.
// Alt regnes ud fra bærerens øjenankre og stadiets øjenskala, så brillerne sidder ens på alle arter og
// stadier. I butikken er glasset tydeligere tonet, så ikonet læses som glas.
import { WHITE } from '../../rig/palette'
import type { Vec } from '../../rig/shapes'
 import type { ItemArt } from '../../rig/types'
import { cws, def, draw, eyeUnits, fitAt, S } from '../ridder/kit/mestring'

/** Glassets tone på dyret (højst ca. 20 %, review G1-r4, T1) og i butikken. */
const TINT = 0.16
const SOLO_TINT = 0.55
/** Stjernens takker i forhold til hakkene (en tydelig, lidt buttet stjerne). */
const TIP = 1.55

/**
 * En stjerne om (cx, cy) med takker i radius `r` og hak i radius `v`; den første tak peger i vinklen `rot`
 * (grader) med radius `r0` (næsetakken, der møder den anden stjernes tak midt over næseryggen).
 */
function starPts(cx: number, cy: number, v: number, r: number, r0: number, rot: number): Vec[] {
  return Array.from({ length: 10 }, (_, i) => {
    const t = ((rot + i * 36) * Math.PI) / 180
    const rad = i === 0 ? r0 : i % 2 === 0 ? r : v
    return [cx + rad * Math.cos(t), cy + rad * Math.sin(t)] as Vec
  })
}

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  // Glasenhederne som støvbrillernes: øjet plus luft plus et halvt stel.
  const { L, R, k, ux, uy, side } = eyeUnits({ a, local, stage, sw })
  // Hakkene ligger uden for øjet (også i stjernens skrå sider mellem hak og tak).
  const v = Math.max(1.04 * ux, uy + 2.3 * k)
  // Takkerne ud mod siderne holder sig inden for hovedets omrids (de ydre takker peger 36° op og ned fra vandret).
  const room = (L.x - side - sw) / Math.cos(Math.PI / 5)
  const r = Math.max(v * 1.25, Math.min(v * TIP, room))
  // Næsetakkerne mødes (og overlapper en anelse) midt mellem øjnene, så de danner broen.
  const r0 = Math.max(v * 1.05, (R.x - L.x) / 2 + sw * 0.6)
  // Venstre stjerne: en tak peger mod næsen (0°); højre spejlet (180°).
  const left = starPts(L.x, L.y, v, r, r0, 0)
  const right = starPts(R.x, R.y, v, r, r0, 180)
  const frames = S.join(S.blob(left, 0.3), S.blob(right, 0.3))
  // Højlys i den øverste ydre tak (uden for øjet) og glimt ved de nederste ydre takker.
  const glare = S.join(...([[L.x, 216], [R.x, -36]] as const).map(([x, deg]) => {
    const t = (deg * Math.PI) / 180
    return S.ellipse(x + (Math.cos(t) * (v + r)) / 2, L.y + (Math.sin(t) * (v + r)) / 2, 1.4 * k, 2.8 * k, deg > 0 ? 30 : -30)
  }))
  const glints = S.join(S.star(L.x - r * 0.36, L.y - r * 1.02, 3.8 * k, 0.9 * k), S.star(R.x + r * 0.36, R.y - r * 1.02, 3.8 * k, 0.9 * k))
  return draw(
    [frames, c.trim, , , { opacity: solo ? SOLO_TINT : TINT }],
    [glare, c.highlight === 'none' ? 'none' : WHITE, , , { opacity: 0.85 }],
    [frames, 'none', c.outline, sw * 2.2],
    [frames, 'none', c.main, sw * 1.05],
    [glints, c.accent, c.accentOutline, sw * 0.4],
  )

}

export const talmagikerFace = def('talmagiker-face', {
  colorways: cws('guld|guld|sunflower|sky|snow', 'rosa|rosa|rose|lilac|sunflower', 'turkis|turkis|mint|violet|gold'),
  art: { front },
  fit: fitAt('headCenter', 'headWidth', 100),
  icon: { box: [-54, -27, 108, 50] },
})

export default talmagikerFace
