// Rytter · ansigt: støvbriller (ridebriller) på øjnene med klare glas (review G1-r4, T1/T2: briller sidder
// på øjnene, og glasset dæmper aldrig pupiller og højlys). To runde glas i et polstret stel omslutter øjet
// med luft til, at pupillerne kan kigge rundt og de lukkede øjnes vipper går fri, så stellet aldrig dækker
// øjnene (fit-regel 6). Glasset er kun svagt tonet (16 %) med et hvidt højlys i det øverste ydre hjørne
// uden for øjet. En polstret bro sidder over næseryggen, og et bredt elastikbånd med nitter går fra stellet
// ud til hovedets sider. Alt regnes ud fra bærerens øjenankre og stadiets øjenskala (babyens øjne er
// større), så brillerne sidder ens på alle arter og stadier. I butikken er glasset tydeligere tonet, så
// ikonet læses som glas.
import { STAGE_XF } from '../../rig/anchors'
import { WHITE, fabric } from '../../rig/palette'
import { circle, ellipse, join, poly, quad, spline } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/**
 * Glassets radius i glasenheder (øjet plus luft plus en halv stelbredde) og hvor meget glasset er skubbet
 * ud mod siden: inderkanten ved næsen ligger 1,12 enheder fra øjet, yderkanten 1,3, så de lukkede øjnes
 * vipper (der svinger ud og op i ydersiden) altid ligger inde i glasset.
 */
const LENS = { rx: 1.21, ry: 1.1, out: 0.09 }
/** Glassets tone på dyret (højst ca. 20 %, review G1-r4, T1) og i butikken. */
const TINT = 0.16
const SOLO_TINT = 0.55

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const erx = a.eyeRx * es * k
  const ery = a.eyeRy * es * k
  // Glasenhederne: øjet (de lukkede øjnes vipper er 1,3 · øjets bredde) plus luft plus et halvt polstret stel.
  const half = sw * 1.1
  const ux = Math.max(erx + 2.2 * k, erx * 1.3) + half
  const uy = ery + 1.6 * k + half
  const rx = LENS.rx * ux
  const ry = LENS.ry * uy
  // Glassenes centre (skubbet ud mod hovedets sider).
  const lx = L.x - LENS.out * ux
  const rcx = R.x + LENS.out * ux
  const rings = join(ellipse(lx, L.y, rx, ry), ellipse(rcx, R.y, rx, ry))
  // Broen over næseryggen (kun når glassene ikke rører hinanden).
  const bx0 = lx + rx * 0.84
  const bx1 = rcx - rx * 0.84
  const by = (L.y + R.y) / 2 - ry * 0.5
  const bridge = bx1 - bx0 > sw ? quad([bx0, by], [(bx0 + bx1) / 2, by - 3.4 * k], [bx1, by]) : ''
  // Elastikbåndet fra stellets yderside ud til hovedets sider (lidt over øjnenes midte).
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.93 * k
  const ty = (L.y + R.y) / 2 - 0.22 * ry
  // Båndet starter under stellets yderkant, så dets runde ende aldrig rækker ind mod de lukkede øjnes vipper,
  // og løber altid udad til hovedets side. Sidder glasset helt ude ved siden (babyens store øjne), er der
  // ikke plads: så ses kun nitterne på stellet, og båndet bøjer aldrig tilbage hen over glasset.
  const sx = rx + sw * 0.9
  const x0 = lx - sx
  const xEnd = hc.x - hw
  const room = x0 - xEnd
  const strapOn = room > 4 * k
  const x1 = x0 - room * 0.55
  const mirror = (x: number) => lx + rcx - x
  const strap = strapOn
    ? join(
        spline([[x0, ty], [x1, ty - 2.6 * k], [xEnd, ty - 4.8 * k]]),
        spline([[mirror(x0), ty], [mirror(x1), ty - 2.6 * k], [mirror(xEnd), ty - 4.8 * k]]),
      )
    : ''
  // Hvidt højlys: en skrå stribe i glassets øverste ydre hjørne og en prik forneden mod næsen, begge uden
  // for øjet.
  const glare = join(
    ...([[L.x, L.y, 1], [R.x, R.y, -1]] as const).map(([x, y, s]) =>
      join(
        poly([
          [x - s * 1.0 * ux, y - 0.46 * uy],
          [x - s * 0.62 * ux, y - 0.96 * uy],
          [x - s * 0.42 * ux, y - 0.98 * uy],
          [x - s * 0.84 * ux, y - 0.38 * uy],
        ]),
        circle(x + s * 0.56 * ux, y + 0.76 * uy, 0.09 * ux),
      ),
    ),
  )
  const studs = join(...(strapOn ? [x0, mirror(x0)] : [lx - rx, rcx + rx]).map((x) => circle(x, ty, 2.2 * k)))
  const round = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <>
      {strapOn && <path d={strap} fill="none" stroke={c.accentOutline} strokeWidth={sw * 2.7} {...round} />}
      {strapOn && <path d={strap} fill="none" stroke={c.accent} strokeWidth={sw * 1.5} {...round} />}
      <path d={rings} fill={c.trim} opacity={solo ? SOLO_TINT : TINT} />
      <path d={glare} fill={c.highlight === 'none' ? 'none' : WHITE} opacity={0.85} />
      <path d={join(rings, bridge)} fill="none" stroke={c.outline} strokeWidth={sw * 2.2} {...round} />
      <path d={join(rings, bridge)} fill="none" stroke={c.main} strokeWidth={sw * 1.05} {...round} />
      <path d={studs} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.45} />
    </>
  )
}

export const rytterFace: ItemDef = {
  id: 'rytter-face',
  set: 'rytter',
  slot: 'face',
  nameClip: 'name.item.rytter-face',
  source: { kind: 'chest', nodeId: 'w1-figurer-chest' },
  colorways: [
    fabric('laeder', 'læderbrun', 'cocoa', 'sky', 'sand'),
    fabric('roed', 'rød', 'tomato', 'mint', 'charcoal'),
    fabric('messing', 'messing', 'gold', 'lilac', 'navy'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-57, -19, 114, 46] },
}

export default rytterFace
