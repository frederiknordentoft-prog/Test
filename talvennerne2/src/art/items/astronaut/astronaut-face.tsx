// Astronaut · ansigt: rumbriller. Ét bredt, buet visirglas går hen over begge øjne som et lille rumvisir, med et hak
// over næseryggen forneden og en runde lampe-pude i hver ende. Visiret omslutter øjnene med luft til, at pupillerne
// kan kigge rundt (3 enheder i tænker) og de lukkede øjnes vipper går fri (som støvbrillernes glas), så stellet aldrig
// dækker øjnene (fit-regel 6). Glasset er kun svagt tonet (16 %) med et skråt hvidt glimt i det øverste ydre hjørne
// uden for øjet. Enderne holder sig inden for hovedets omrids (babyens store øjne giver et kortere visir). Alt regnes
// ud fra bærerens øjenankre og stadiets øjenskala, så brillerne sidder ens på alle arter og stadier. I butikken er
// glasset tydeligere tonet, så ikonet læses som glas. (0,0) = headCenter, tegnet ved headWidth 100.
import { WHITE } from '../../rig/palette'
import type { Vec } from '../../rig/shapes'
import type { ItemArt } from '../../rig/types'
import { cws, def, draw, eyeUnits, fitAt, S } from '../ridder/kit/mestring'

/** Glassets tone på dyret (højst ca. 20 %, review G1-r4, T1) og i butikken. */
const TINT = 0.16
const SOLO_TINT = 0.55

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  // Glasenhederne som støvbrillernes: øjet plus luft plus et halvt stel.
  const { L, R, k, ux, uy, side } = eyeUnits({ a, local, stage, sw })
  const cy = (L.y + R.y) / 2
  const mid = (L.x + R.x) / 2
  // Over og under øjnene med ekstra luft til blikket i tænker (øjet løftes op til 3 enheder).
  const top = cy - uy - 2.6 * k
  const bot = cy + uy + 1.2 * k
  // Enderne: uden for øjnenes glasenheder, men inden for hovedets omrids (minus stellets bredde).
  const end = Math.min(mid - L.x + ux * 1.32, Math.max(mid - L.x + ux * 1.04, mid - side - sw * 1.2))
  const x0 = mid - end
  const x1 = mid + end
  // Næsehakket forneden mellem øjnene.
  const gap = (R.x - L.x) / 2
  const notch = cy + uy * 0.42
  const half: Vec[] = [
    [mid, top - 1.2 * k],
    [mid - gap * 0.9, top],
    [x0 + 3 * k, top + 2.4 * k],
    [x0, cy - uy * 0.2],
    [x0 + 1.6 * k, cy + uy * 0.62],
    [x0 + 7 * k, bot],
    [mid - gap * 0.62, bot - 0.6 * k],
    [mid - gap * 0.3, notch + 2.6 * k],
    [mid, notch],
  ]
  const visor = S.blob(S.symmetric(half, mid), 0.62)
  // Lampe-puderne i enderne og glimtet i det øverste ydre hjørne (uden for øjet).
  const pr = 4.4 * k
  const pods = S.join(S.circle(x0 - pr * 0.25, cy - uy * 0.1, pr), S.circle(x1 + pr * 0.25, cy - uy * 0.1, pr))
  const lights = S.join(S.circle(x0 - pr * 0.25, cy - uy * 0.1, pr * 0.42), S.circle(x1 + pr * 0.25, cy - uy * 0.1, pr * 0.42))
  const glare = S.join(...[L.x - ux * 0.62, R.x - ux * 0.62].map((x) => S.ellipse(x, top + 3.4 * k, 1.1 * k, 3.4 * k, 62)))
  return draw(
    [visor, c.trim, , , { opacity: solo ? SOLO_TINT : TINT }],
    [glare, c.highlight === 'none' ? 'none' : WHITE, , , { opacity: 0.85 }],
    [visor, 'none', c.outline, sw * 2.2],
    [visor, 'none', c.main, sw * 1.05],
    [pods, c.main, c.outline, sw * 0.9],
    [lights, c.accent, c.accentOutline, sw * 0.4],
  )
}

export const astronautFace = def('astronaut-face', {
  colorways: cws('hvid|hvid|snow|gold|sky', 'orange|orange|orange|sky|navy', 'lilla|lilla|violet|mint|sunflower'),
  art: { front },
  fit: fitAt('headCenter', 'headWidth', 100),
  icon: { box: [-50, -21, 100, 40] },
})

export default astronautFace
