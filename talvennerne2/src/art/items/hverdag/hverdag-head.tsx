// Hverdag · hoved: strikhue med ombuk og kvast. earMode 'through': ørerne stikker op gennem
// to huller (riggen tegner ørerne over huen; huen tegner hullernes kanter ved ørebaserne).
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, litCopy, ribs, scallop, softBand, spline, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemDef } from '../../rig/types'

/** Kuplen (venstre halvdel, top → bund på midterlinjen). (0,0) = headTop. */
const DOME = symmetric([
  [0, -11], [-18, -9.2], [-34, -2.6], [-46, 7.6], [-52.5, 18.5], [-54, 27], [0, 27],
])
/** Strik-linjer, der følger kuplen. */
const KNIT: Vec[][] = [-30, -15, 0, 15, 30].map((x) => [
  [x * 1.2, 16],
  [x * 1.02, 5],
  [x * 0.62, -5],
  [x * 0.22, -9],
])

const front: ItemArt = ({ c, sw, a, local, solo }) => {
  const lit = litCopy(DOME, [-26, -8], 0.9)
  // Hullerne sidder hvor ørerne krydser hovedets kontur (lidt over ørebasen).
  const hole = (p: { x: number; y: number }, s: number) => {
    const q = local({ x: p.x, y: p.y - 3 })
    return ellipse(q.x, q.y, 12.5, 5.2, s * 28)
  }
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      <path d={blob(DOME, 0.9)} fill={c.mainShade} />
      <path d={blob(lit, 0.9)} fill={c.main} />
      <path d={join(...KNIT.map((k) => spline(k)))} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.55} strokeLinecap="round" />
      <path d={blob(DOME, 0.9)} fill="none" {...stroke} />
      {!solo && <path d={join(hole(a.earBaseL, -1), hole(a.earBaseR, 1))} fill={c.outline} opacity={0.8} />}
      <path d={softBand(-54, 54, 12.5, 27.5, 4, 3)} fill={c.trim} {...stroke} />
      <path d={ribs(-52, 52, 15.5, 25.5, 14, 3.5)} fill="none" stroke={c.trimShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={scallop(0, -15, 10.5, 10, 8, 0.62, -90)} fill={c.accent} {...stroke} />
      <path d={join(ellipse(-24, 0, 7.5, 3.6, -30), ellipse(-5, -14.5, 3.4, 2.4, -20))} fill={c.highlight} />
    </>
  )
}

export const hverdagHead: ItemDef = {
  id: 'hverdag-head',
  set: 'hverdag',
  slot: 'head',
  nameClip: 'item.hverdag-head',
  source: { kind: 'level', level: 2 },
  colorways: [
    fabric('tomat', 'tomatrød', 'tomato', 'cream', 'cream'),
    fabric('himmel', 'himmelblå', 'sky', 'snow', 'sunflower'),
    fabric('mint', 'mintgrøn', 'mint', 'cream', 'rose'),
  ],
  art: { front },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 116, earMode: 'through' },
  hides: ['mane-front'],
}

export default hverdagHead
