// Colorblind-safe colormap LUTs (256×1 RGBA8) for field overlays.
// Sequential: viridis (polynomial fit). Diverging: blue → near-white → orange.

function viridis(t: number): [number, number, number] {
  const c0 = [0.2777273272234177, 0.005407344544966578, 0.334099805335306];
  const c1 = [0.1050930431085774, 1.404613529898575, 1.384590162594685];
  const c2 = [-0.3308618287255563, 0.214847559468213, 0.09509516302823659];
  const c3 = [-4.634230498983486, -5.799100973351585, -19.33244095627987];
  const c4 = [6.228269936347081, 14.17993336680509, 56.69055260068105];
  const c5 = [-4.776384997670288, -13.74514537774601, -65.35303263337234];
  const c6 = [2.8925094318239616, 3.761550990870633, 26.312243529809412];
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] = c0[i] + t * (c1[i] + t * (c2[i] + t * (c3[i] + t * (c4[i] + t * (c5[i] + t * c6[i])))));
    out[i] = Math.min(1, Math.max(0, out[i]));
  }
  return out;
}

function divergingBlueOrange(t: number): [number, number, number] {
  // #1d5fa8 → #dfe5ec (dim near-white, fits the dark UI) → #e66101
  const stops: [number, [number, number, number]][] = [
    [0, [0.114, 0.373, 0.659]],
    [0.5, [0.62, 0.65, 0.68]],
    [1, [0.902, 0.38, 0.004]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const f = (t - a[0]) / (b[0] - a[0] || 1);
  return [0, 1, 2].map((i) => a[1][i] + (b[1][i] - a[1][i]) * f) as [number, number, number];
}

function toLut(fn: (t: number) => [number, number, number]): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = fn(i / 255);
    data[i * 4] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}

export function seqLutData(): Uint8Array {
  return toLut(viridis);
}

export function divLutData(): Uint8Array {
  return toLut(divergingBlueOrange);
}

export { viridis };
