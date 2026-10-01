// Hverdag · ansigt: solbriller, der er gledet ned på næsen, så øjnene kigger frem over dem. Glassene
// er mørke med en skrå glans og en prik, og stellets overkant ligger lige under øjnenes nederste kant
// (plus en lille luft), så intet nogensinde dækker øjnene (fit-regel 6). Broen hviler på næseryggen
// lige over næsen, og stængerne forsvinder mod hovedets sider. Alt regnes ud fra bærerens øjenankre og
// stadiets øjenskala (babyens øjne er større), så brillerne sidder ens på alle arter og stadier.
import { STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, circle, join, poly, quad, spline, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef, Pt } from '../../rig/types'

/** Glassene i øjenmål (øjets rx/ry): halv bredde, højde og luften ned til øjet (modelenheder). */
const LENS = { rx: 1.34, h: 0.98, gap: 1.8 }
/** Glassenes hjørner (superellipse-eksponent) og den let skrå overkant (ydre hjørne op). */
const E = 3
const TILT = 5

/** Superellipse som punkter (lukket løkke), drejet `rot` grader om centrum. */
function squircle(cx: number, cy: number, rx: number, ry: number, rot: number): Vec[] {
  const pts: Vec[] = []
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push([Math.sign(c) * Math.abs(c) ** (2 / E) * rx, Math.sign(s) * Math.abs(s) ** (2 / E) * ry])
  }
  return xf(pts, { rot, dx: cx, dy: cy })
}

const front: ItemArt = ({ c, sw, a, local, stage }) => {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  // Modelenheder → lokale (genstanden er skaleret med hovedbredden).
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const rx = a.eyeRx * es * k
  const ry = a.eyeRy * es * k
  // Stellets overkant (inkl. halv stelbredde) ligger `gap` under øjets nederste kant.
  const half = (sw * 1.7) / 2
  const lens = (e: Pt, side: 1 | -1) => {
    const h = (LENS.h * ry) / 2
    return { x: e.x, y: e.y + ry + LENS.gap * k + half + h, rx: LENS.rx * rx, ry: h, rot: side * TILT }
  }
  const gl = lens(L, 1)
  const gr = lens(R, -1)
  // Den skrå overkant løfter det ydre hjørne; sænk glasset tilsvarende, så det indre hjørne går fri.
  const lift = Math.sin((TILT * Math.PI) / 180) * gl.rx
  gl.y += lift
  gr.y += lift
  const glass = join(blob(squircle(gl.x, gl.y, gl.rx, gl.ry, gl.rot), 1), blob(squircle(gr.x, gr.y, gr.rx, gr.ry, gr.rot), 1))
  // Broen over næseryggen og stængerne mod hovedets sider (lidt opad mod ørerne).
  const by = gl.y - gl.ry * 0.5
  const bridge = quad([gl.x + gl.rx * 0.92, by + lift * 0.6], [(gl.x + gr.x) / 2, by - 3.4 * k], [gr.x - gr.rx * 0.92, by + lift * 0.6])
  const hc = local(a.headCenter)
  const hw = a.headRx * 0.92 * k
  const ty = gl.y - gl.ry * 0.62 - lift
  const temples = join(
    spline([[gl.x - gl.rx * 0.96, ty], [hc.x - hw * 0.95, ty - 2.6 * k], [hc.x - hw, ty - 4.6 * k]]),
    spline([[gr.x + gr.rx * 0.96, ty], [hc.x + hw * 0.95, ty - 2.6 * k], [hc.x + hw, ty - 4.6 * k]]),
  )
  const frame = join(glass, bridge, temples)
  // Glansen: en skrå stribe og en lille prik i hvert glas.
  const glare = join(
    ...[gl, gr].map((g) =>
      join(
        poly([
          [g.x - g.rx * 0.66, g.y + g.ry * 0.3],
          [g.x - g.rx * 0.3, g.y - g.ry * 0.62],
          [g.x - g.rx * 0.06, g.y - g.ry * 0.62],
          [g.x - g.rx * 0.42, g.y + g.ry * 0.3],
        ]),
        circle(g.x + g.rx * 0.5, g.y + g.ry * 0.22, g.ry * 0.17),
      ),
    ),
  )
  const studs = join(circle(gl.x - gl.rx * 0.96, ty, 1.6 * k), circle(gr.x + gr.rx * 0.96, ty, 1.6 * k))
  return (
    <>
      <path d={glass} fill={c.trim} />
      <path d={glare} fill={c.highlight} />
      <path d={frame} fill="none" stroke={c.outline} strokeWidth={sw * 1.7} strokeLinecap="round" strokeLinejoin="round" />
      <path d={frame} fill="none" stroke={c.main} strokeWidth={sw * 0.74} strokeLinecap="round" strokeLinejoin="round" />
      <path d={studs} fill={c.accent} stroke={c.outline} strokeWidth={sw * 0.35} />
    </>
  )
}

export const hverdagFace: ItemDef = {
  id: 'hverdag-face',
  set: 'hverdag',
  slot: 'face',
  nameClip: 'name.item.hverdag-face',
  source: { kind: 'level', level: 7 },
  colorways: [
    fabric('sol', 'solgul', 'sunflower', 'charcoal', 'tomato'),
    fabric('rosa', 'rosa', 'berry', 'violet', 'rose'),
    fabric('himmel', 'himmelblå', 'sky', 'navy', 'snow'),
  ],
  art: { front },
  fit: { anchor: 'headCenter', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-55, 9, 110, 24] },
}

export default hverdagFace
