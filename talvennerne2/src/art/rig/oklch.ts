// OKLCH til og fra sRGB (Björn Ottosson, OKLab). Ren talmatematik – ingen farvekonstanter her.

export interface Oklch {
  L: number
  C: number
  /** Grader 0–360. */
  h: number
}

type Rgb = readonly [number, number, number]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** Lineær sRGB (0–1, kan ligge uden for gamut) fra OKLCH. */
export function oklchToLinearRgb({ L, C, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function linearRgbToOklch([r, g, b]: Rgb): Oklch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { L, C, h: C < 1e-6 ? 0 : h }
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)

/** Gamut-map ved at sænke kroma (binær søgning), så lyshed og tone bevares. */
export function clampToGamut(c: Oklch): Rgb {
  const L = Math.min(1, Math.max(0, c.L))
  let rgb = oklchToLinearRgb({ ...c, L })
  if (inGamut(rgb)) return rgb
  let lo = 0
  let hi = c.C
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const t = oklchToLinearRgb({ L, C: mid, h: c.h })
    if (inGamut(t)) {
      lo = mid
      rgb = t
    } else hi = mid
  }
  return oklchToLinearRgb({ L, C: lo, h: c.h })
}

const hex2 = (v: number) =>
  Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255)
    .toString(16)
    .padStart(2, '0')

export function oklchToHex(c: Oklch): string {
  const [r, g, b] = clampToGamut(c)
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()
}

export function hexToOklch(hex: string): Oklch {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Ugyldig farve: ${hex}`)
  const n = parseInt(m[1], 16)
  const rgb: Rgb = [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)]
  return linearRgbToOklch(rgb)
}

/** Blanding i OKLab (t = 0 → a, t = 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToOklch(a)
  const B = hexToOklch(b)
  const la = [A.L, A.C * Math.cos((A.h * Math.PI) / 180), A.C * Math.sin((A.h * Math.PI) / 180)]
  const lb = [B.L, B.C * Math.cos((B.h * Math.PI) / 180), B.C * Math.sin((B.h * Math.PI) / 180)]
  const L = la[0] + (lb[0] - la[0]) * t
  const x = la[1] + (lb[1] - la[1]) * t
  const y = la[2] + (lb[2] - la[2]) * t
  let h = (Math.atan2(y, x) * 180) / Math.PI
  if (h < 0) h += 360
  return oklchToHex({ L, C: Math.hypot(x, y), h })
}
