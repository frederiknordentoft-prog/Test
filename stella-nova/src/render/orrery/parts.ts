/**
 * Geometry of the instrument. Everything brass is batched into as few
 * buffers as possible: one per ring (rims + the eight settings ride the ring),
 * one for all fixed brass (hub, bezel, markers, numerals), one for the
 * clockwork (gears turn in the vertex shader via aGear).
 */
import * as THREE from 'three';
import { BEZEL_INNER, BEZEL_OUTER, HUB_RADIUS, PALETTE, RING_RADII, RING_WIDTH, RING_Y, SPOKES, STEP_ANGLE, SYMBOL_DIAMETER } from '../../core/config';
import type { Quality } from '../../core/types';
import { GeoBuilder, arcPoints, type ProfilePoint, type RGB } from './builder';
import { CHANNEL_HALF, MILL_PERIODS, PLATE_R0, PLATE_R1, RIM_W } from './textures';

export const GAUGE_SEGMENTS = 16;
/** Top of the base plate. Ring and bezel walls run down into it. */
export const PLATE_Y = -0.13;
const BOTTOM = PLATE_Y - 0.005;
/** Radius and height of the spoke lamps on the bezel. */
export const LAMP_RADIUS = 4.8;
const LAMP_Y = 0.13;

const lin = (hex: number, k = 1): RGB => {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

const C_BRASS = lin(PALETTE.brass);
const C_LIGHT = lin(PALETTE.brassLight);
const C_DARK = lin(PALETTE.brassDark);
const C_POL = mix(C_BRASS, C_LIGHT, 0.65);
const C_BODY = mix(C_BRASS, C_LIGHT, 0.15);
const C_SHADE = mix(C_DARK, C_BRASS, 0.35);
const C_FACE = scale(C_BRASS, 0.78);

const segK = (q: Quality): number => (q === 'low' ? 0.5 : q === 'medium' ? 0.75 : 1);

type ClawSpec = readonly (readonly [dr: number, y: number, halfWidth: number, halfDepth: number])[];

/** A faceted prong at ring-local angle `a`, leaning toward the axis as it rises. */
function claw(b: GeoBuilder, a: number, rho: number, spec: ClawSpec): void {
  const s = Math.sin(a);
  const c = Math.cos(a);
  const sections = spec.map(([dr, y, hw, hd]) => {
    const r = rho + dr;
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([t, d]) => [s * (r + d) + c * t, y, -c * (r + d) + s * t]);
  });
  b.loft(sections, true, false);
}

const SOCKET_CLAW: ClawSpec = [
  [0.012, 0.008, 0.022, 0.016],
  [0.004, 0.062, 0.017, 0.013],
  [-0.02, 0.09, 0.01, 0.008],
];
const HUB_CLAW: ClawSpec = [
  [0, 0.19, 0.036, 0.022],
  [0.045, 0.36, 0.028, 0.018],
  [0.03, 0.5, 0.02, 0.014],
  [-0.035, 0.6, 0.011, 0.009],
];

export function buildRingBrass(ring: number, q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const R = RING_RADII[ring];
  const Y = RING_Y[ring];
  const D = SYMBOL_DIAMETER[ring];
  const rIn = R - RING_WIDTH / 2;
  const rOut = R + RING_WIDTH / 2;
  const cIn = rIn + RIM_W;
  const cOut = rOut - RIM_W;
  const segs = Math.round([96, 128, 176, 224][ring] * segK(q));

  // Half-round bead: the crest carries the emissive hairline (fx.x).
  // The flank that faces a gap (first or last point) picks up the light leaking from below (fx.y).
  const bead = (cx: number, gapAt: 0 | 6): ProfilePoint[] => {
    const pts = arcPoints(cx, Y + 0.024, 0.024, 180, 0, 6, { c: C_POL });
    pts.forEach((p, i) => {
      const g = Math.abs(i - gapAt);
      p.fx = [i === 3 ? 1 : i === 2 || i === 4 ? 0.12 : 0, g === 0 ? 0.45 : g === 1 ? 0.2 : 0, 1];
    });
    return pts;
  };
  const mill: RGB = [0, 0, 0.5];
  b.color = C_BODY;
  b.lathe(
    [
      [
        { r: rIn, y: BOTTOM, fx: [0, 1, 0] },
        { r: rIn, y: Y + 0.024, fx: [0, 0.45, 0] },
      ],
      bead(rIn + 0.024, 0),
      [
        { r: rIn + 0.048, y: Y + 0.02, v: 0.43, fx: mill },
        { r: cIn - 0.006, y: Y + 0.011, v: 0.27, fx: mill },
      ],
      [
        { r: cIn - 0.006, y: Y + 0.011, c: C_SHADE },
        { r: cIn + 0.002, y: Y - 0.004, c: C_SHADE },
      ],
      [
        { r: cOut - 0.002, y: Y - 0.004, c: C_SHADE },
        { r: cOut + 0.006, y: Y + 0.011, c: C_SHADE },
      ],
      [
        { r: cOut + 0.006, y: Y + 0.011, v: 0.27, fx: mill },
        { r: rOut - 0.048, y: Y + 0.02, v: 0.43, fx: mill },
      ],
      bead(rOut - 0.024, 6),
      [
        { r: rOut, y: Y + 0.024, fx: [0, 0.45, 0] },
        { r: rOut, y: BOTTOM, fx: [0, 1, 0] },
      ],
    ],
    segs,
    { u0: 0, u1: Math.round((Math.PI * 2 * R) / 0.03) / MILL_PERIODS, vScale: 0, angleInFx: true },
  );

  // Settings: a low collar around each socket, clipped where it meets the rims,
  // with four claws. Low enough that a symbol wider than the collar clears it.
  const m = new THREE.Matrix4();
  const rc = D / 2 + 0.03;
  const rb = rc + 0.014;
  const zmax = CHANNEL_HALF + 0.02;
  const full = rb <= zmax;
  const phi = full ? Math.PI / 2 : Math.asin(zmax / rb);
  const collarSegs = Math.max(6, Math.round((full ? 36 : 12) * segK(q)));
  const collar: ProfilePoint[][] = [
    [
      { r: rc - 0.024, y: -0.003, c: C_DARK },
      { r: rc, y: 0.03, c: C_SHADE },
    ],
    arcPoints(rb, 0.03, 0.014, 180, 0, 3, { c: C_POL, fx: [0.05, 0, 0.6] }),
    [
      { r: rb + 0.014, y: 0.03 },
      { r: rb + 0.027, y: -0.003 },
    ],
  ];
  for (let s = 0; s < SPOKES; s++) {
    const a = s * STEP_ANGLE;
    m.makeRotationY(-a).setPosition(Math.sin(a) * R, Y, -Math.cos(a) * R);
    b.setMatrix(m);
    b.fxW = a;
    b.color = C_BODY;
    b.fx = [0, 0, 0.3];
    if (full) b.lathe(collar, collarSegs, { vScale: 0 });
    else for (const mid of [Math.PI / 2, Math.PI * 1.5]) b.lathe(collar, collarSegs, { vScale: 0, a0: mid - phi, a1: mid + phi, caps: true });
    b.color = C_POL;
    b.fx = [0, 0, 0.5];
    for (const ca of [Math.PI / 2 - 0.72, Math.PI / 2 + 0.72, Math.PI * 1.5 - 0.72, Math.PI * 1.5 + 0.72]) claw(b, ca, rb, SOCKET_CLAW);
  }
  return b.build({ fx: true });
}

export function buildRingEnamel(ring: number, q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const R = RING_RADII[ring];
  const Y = RING_Y[ring];
  b.lathe(
    [
      [
        { r: R - CHANNEL_HALF, y: Y, v: 0 },
        { r: R + CHANNEL_HALF, y: Y, v: 1 },
      ],
    ],
    Math.round([96, 128, 176, 224][ring] * segK(q)),
    { u0: 0.25, u1: 4.25 },
  );
  return b.build({ color: false });
}

/** A raised stroke of an applied numeral, in the marker frame (x = clockwise, up = outward). */
function stroke(b: GeoBuilder, rho0: number, x0: number, up0: number, x1: number, up1: number, w: number): void {
  const sec = (y: number): number[][] => [
    [x1 - w / 2, y, -(rho0 + up1)],
    [x1 + w / 2, y, -(rho0 + up1)],
    [x0 + w / 2, y, -(rho0 + up0)],
    [x0 - w / 2, y, -(rho0 + up0)],
  ];
  b.loft([sec(0.058), sec(0.077)], true, false);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function numeral(b: GeoBuilder, text: string, rho0: number, h: number): void {
  const wI = 0.064;
  const wV = 0.122;
  const gap = 0.012;
  let total = -gap;
  for (const ch of text) total += (ch === 'I' ? wI : wV) + gap;
  let x = -total / 2;
  const serif = 0.012;
  for (const ch of text) {
    if (ch === 'I') {
      const xc = x + wI / 2;
      stroke(b, rho0, xc, 0, xc, h, 0.027);
      stroke(b, rho0, xc, 0, xc, serif, wI);
      stroke(b, rho0, xc, h - serif, xc, h, wI);
      x += wI + gap;
    } else {
      const xc = x + wV / 2;
      stroke(b, rho0, xc, 0, xc - 0.042, h, 0.031);
      stroke(b, rho0, xc, 0, xc + 0.044, h, 0.014);
      stroke(b, rho0, xc - 0.042, h - serif, xc - 0.042, h, 0.062);
      stroke(b, rho0, xc + 0.044, h - serif, xc + 0.044, h, 0.046);
      x += wV + gap;
    }
  }
}

export function buildFixedBrass(q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const k = segK(q);

  // Hub: a gilded cup under the star, a lip, the gauge shoulder, an edge bead.
  b.color = C_BODY;
  b.lathe(
    [
      [
        { r: 0, y: 0.085, c: C_DARK },
        { r: 0.3, y: 0.1, c: C_DARK },
        { r: 0.46, y: 0.15, c: C_BRASS },
        { r: 0.52, y: 0.2, c: C_BRASS },
      ],
      arcPoints(0.545, 0.2, 0.025, 180, 0, 6, { c: C_POL }),
      [
        { r: 0.57, y: 0.2, c: C_FACE },
        { r: 0.705, y: 0.165, c: C_FACE },
      ],
      arcPoints(0.7225, 0.158, 0.0175, 160, 0, 5, { c: C_POL }),
      [
        { r: HUB_RADIUS, y: 0.158, fx: [0, 0.3, 0] },
        { r: HUB_RADIUS, y: BOTTOM, fx: [0, 1, 0] },
      ],
    ],
    Math.round(72 * k),
    { vScale: 0 },
  );
  b.color = C_POL;
  for (let i = 0; i < SPOKES; i++) claw(b, (i + 0.5) * STEP_ANGLE, 0.56, HUB_CLAW);

  // Bezel: heavier section, satin face for the scale, knurled foot.
  b.color = C_BODY;
  b.lathe(
    [
      [
        { r: BEZEL_INNER, y: BOTTOM, fx: [0, 1, 0] },
        { r: BEZEL_INNER, y: 0.078, fx: [0, 0.3, 0] },
      ],
      arcPoints(BEZEL_INNER + 0.022, 0.078, 0.022, 180, 0, 5, { c: C_POL }),
      [
        { r: 4.804, y: 0.078 },
        { r: 4.815, y: 0.062 },
      ],
      [
        { r: 4.815, y: 0.062, v: 0.55, c: C_FACE },
        { r: 5.065, y: 0.062, v: 0.95, c: C_FACE },
      ],
      [
        { r: 5.065, y: 0.062 },
        { r: 5.076, y: 0.08 },
      ],
      arcPoints(5.098, 0.08, 0.022, 180, 0, 5, { c: C_POL }),
      [
        { r: BEZEL_OUTER, y: 0.08 },
        { r: BEZEL_OUTER, y: 0.012 },
      ],
      [
        { r: BEZEL_OUTER, y: 0.012, v: 0.43, c: C_SHADE },
        { r: 5.19, y: -0.012, v: 0.27, c: C_SHADE },
      ],
      [
        { r: 5.19, y: -0.012 },
        { r: 5.2, y: -0.03 },
        { r: 5.2, y: BOTTOM },
      ],
    ],
    Math.round(224 * k),
    { u0: 0, u1: 8, vScale: 0 },
  );

  // Spoke markers: a boss that carries the lamp, an index pointing down the lane, an applied numeral.
  const m = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const t = new THREE.Matrix4();
  for (let s = 0; s < SPOKES; s++) {
    m.makeRotationY(-s * STEP_ANGLE);
    b.setMatrix(m);
    b.color = C_POL;
    const tri = (pts: readonly (readonly [number, number])[], y: number): number[][] => pts.map(([x, rho]) => [x, y, -rho]);
    const tip = [
      [0, 4.662],
      [0.046, 4.728],
      [-0.046, 4.728],
    ] as const;
    b.loft([tri(tip, 0.09), tri(tip, 0.122)], true, false);
    numeral(b, ROMAN[s], 4.918, 0.137);

    m2.copy(m).multiply(t.makeTranslation(0, 0, -LAMP_RADIUS));
    b.setMatrix(m2);
    b.lathe(
      [
        [
          { r: 0.066, y: LAMP_Y - 0.008, c: C_SHADE },
          { r: 0.072, y: LAMP_Y + 0.006 },
        ],
        [
          { r: 0.072, y: LAMP_Y + 0.006 },
          { r: 0.094, y: LAMP_Y + 0.006 },
        ],
        [
          { r: 0.094, y: LAMP_Y + 0.006 },
          { r: 0.106, y: LAMP_Y - 0.01 },
        ],
        [
          { r: 0.106, y: LAMP_Y - 0.01, c: C_BODY },
          { r: 0.106, y: 0.06, c: C_BODY },
        ],
      ],
      Math.round(20 * k),
      { vScale: 0 },
    );
  }
  return b.build({ fx: true });
}

/** Spoke lamps (aFx.x = 0, aFx.w = spoke) and Nova gauge tiles (aFx.x = 1, aFx.w = segment). */
export function buildJewels(q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const m = new THREE.Matrix4();
  const dome: ProfilePoint[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = ((90 - i * 18) * Math.PI) / 180;
    dome.push({ r: Math.cos(a) * 0.068, y: LAMP_Y - 0.004 + Math.sin(a) * 0.05 });
  }
  for (let s = 0; s < SPOKES; s++) {
    const a = s * STEP_ANGLE;
    m.makeTranslation(Math.sin(a) * LAMP_RADIUS, 0, -Math.cos(a) * LAMP_RADIUS);
    b.setMatrix(m);
    b.fx = [0, 0, 0];
    b.fxW = s;
    b.lathe([dome], Math.round(16 * segK(q)), { vScale: 0 });
  }
  b.setMatrix(null);
  b.fx = [1, 0, 0];
  const pitch = (Math.PI * 2) / GAUGE_SEGMENTS;
  const P = (a: number, r: number): number[] => [Math.sin(a) * r, 0.205 - (r - 0.57) * 0.259, -Math.cos(a) * r];
  for (let i = 0; i < GAUGE_SEGMENTS; i++) {
    b.fxW = i;
    for (let j = 0; j < 3; j++) {
      const a0 = (i + 0.13 + (j / 3) * 0.74) * pitch;
      const a1 = (i + 0.13 + ((j + 1) / 3) * 0.74) * pitch;
      b.face([P(a0, 0.592), P(a1, 0.592), P(a1, 0.69), P(a0, 0.69)], 0, 1, 0);
    }
  }
  return b.build({ color: false, fx: true });
}

/**
 * Base plate plus the light strips: a glowing diffuser sits just below the
 * rim crests in every gap (the plate shader lights them by radius), because the
 * plate itself is too deep to be seen through a 0.06 slot from a tilted camera.
 */
export function buildPlate(q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.lathe(
    [
      [
        { r: 0, y: PLATE_Y, v: 0 },
        { r: PLATE_R0, y: PLATE_Y, v: 0 },
        { r: PLATE_R1, y: PLATE_Y, v: 1 },
      ],
    ],
    Math.round(96 * segK(q)),
    { u0: 0, u1: 8 },
  );
  const strips: [number, number, number][] = [[HUB_RADIUS - 0.005, RING_RADII[0] - RING_WIDTH / 2 + 0.005, RING_Y[0] + 0.01]];
  for (let r = 1; r < RING_RADII.length; r++) strips.push([RING_RADII[r - 1] + RING_WIDTH / 2 - 0.005, RING_RADII[r] - RING_WIDTH / 2 + 0.005, RING_Y[r] + 0.01]);
  strips.push([RING_RADII[3] + RING_WIDTH / 2 - 0.005, BEZEL_INNER + 0.005, RING_Y[3] + 0.01]);
  for (const [r0, r1, y] of strips) {
    b.lathe(
      [
        [
          { r: r0, y, v: 0 },
          { r: r1, y, v: 0 },
        ],
      ],
      Math.round(128 * segK(q)),
      { u0: 0, u1: 0 },
    );
  }
  return b.build({ color: false });
}

const C_DIM = scale(C_BRASS, 0.42);
const C_DIM_POL = scale(C_POL, 0.5);
const C_DIM_WEB = scale(C_DARK, 0.45);
const GEAR_Y = -0.07;
const GEAR_T = 0.05;

function teeth(b: GeoBuilder, n: number, rr: number, rt: number): void {
  const pa = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const sec = (y: number): number[][] =>
      [
        [rr - 0.004, -0.27],
        [rt, -0.13],
        [rt, 0.13],
        [rr - 0.004, 0.27],
      ].map(([r, f]) => {
        const a = (i + f) * pa;
        return [Math.sin(a) * r, y, -Math.cos(a) * r];
      });
    b.loft([sec(GEAR_Y - GEAR_T), sec(GEAR_Y)], true, false);
  }
}

function wheel(b: GeoBuilder, m: THREE.Matrix4, cx: number, cz: number, n: number, mod: number, speed: number, phase: number): void {
  const rp = (n * mod) / 2;
  const rr = rp - 1.1 * mod;
  const rt = rp + 0.95 * mod;
  const y = GEAR_Y;
  b.gear = [cx, cz, speed, phase];
  b.setMatrix(m.makeTranslation(cx, 0, cz));
  b.color = C_DIM;
  const runs: ProfilePoint[][] = [
    [
      { r: 0, y: y + 0.036, c: C_DIM_POL },
      { r: 0.045, y: y + 0.031, c: C_DIM_POL },
      { r: 0.062, y: y + 0.014, c: C_DIM_POL },
    ],
  ];
  const crossed = rr - 0.1 > 0.24;
  if (crossed) {
    runs.push(
      [
        { r: 0.062, y: y + 0.014 },
        { r: 0.14, y: y + 0.014 },
      ],
      [
        { r: 0.14, y: y + 0.014 },
        { r: 0.15, y: y - 0.024 },
      ],
      [
        { r: 0.15, y: y - 0.024, c: C_DIM_WEB },
        { r: rr - 0.1, y: y - 0.024, c: C_DIM_WEB },
      ],
      [
        { r: rr - 0.1, y: y - 0.024 },
        { r: rr - 0.088, y },
      ],
      [
        { r: rr - 0.088, y },
        { r: rr, y },
      ],
    );
  } else {
    runs.push(
      [
        { r: 0.062, y: y + 0.014 },
        { r: 0.075, y },
      ],
      [
        { r: 0.075, y },
        { r: rr, y },
      ],
    );
  }
  runs.push([
    { r: rr, y },
    { r: rr, y: y - GEAR_T },
  ]);
  b.lathe(runs, Math.min(n, 40), { vScale: 0 });
  teeth(b, n, rr, rt);
  if (crossed) {
    // Crossings: five arms over the dark web read as a real clock wheel.
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const sec = (yy: number): number[][] =>
        [
          [-0.03, 0.13],
          [0.03, 0.13],
          [0.022, rr - 0.092],
          [-0.022, rr - 0.092],
        ].map(([t, r]) => [s * r + c * t, yy, -c * r + s * t]);
      b.loft([sec(y - 0.024), sec(y - 0.002)], true, false);
    }
  }
}

/** Decorative movement beyond the bezel: a great wheel around the instrument driving a ring of planets. */
export function buildClockwork(q: Quality): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const m = new THREE.Matrix4();
  const t = new THREE.Matrix4();
  const N0 = 152;
  const RP0 = 5.31;
  const mod = (2 * RP0) / N0;
  const w0 = 0.03;

  b.gear = [0, 0, w0, 0];
  b.color = C_DIM;
  const rr0 = RP0 - 1.1 * mod;
  b.lathe(
    [
      [
        { r: 5.19, y: GEAR_Y },
        { r: rr0, y: GEAR_Y },
      ],
      [
        { r: rr0, y: GEAR_Y },
        { r: rr0, y: GEAR_Y - GEAR_T },
      ],
    ],
    N0,
    { vScale: 0 },
  );
  teeth(b, N0, rr0, RP0 + 0.95 * mod);

  const planets: [number, number][] = [];
  for (let i = 0; i < SPOKES; i++) {
    const base = (i + 0.5) * 45;
    if (i % 2 === 0) planets.push([base, 36], [base + 20.5, 14]);
    else planets.push([base - 2, 26], [base + 17, 18]);
  }
  for (const [deg, n] of planets) {
    const th = (deg * Math.PI) / 180;
    const rp = (n * mod) / 2;
    const dist = RP0 + rp;
    const cx = Math.sin(th) * dist;
    const cz = -Math.cos(th) * dist;
    // Phase that puts a gap of the planet on the great wheel's tooth along the line of centres.
    const phase = th + Math.PI - ((Math.PI * 2) / n) * (0.5 - (th * N0) / (Math.PI * 2));
    wheel(b, m, cx, cz, n, mod, (-w0 * N0) / n, phase);

    if (q !== 'low' && n >= 26) {
      // Bridge with a pillar and screw, laid along the tangent so it clears the rail.
      b.gear = [0, 0, 0, 0];
      m.makeRotationY(-(th + Math.PI / 2)).setPosition(cx, 0, cz);
      b.setMatrix(m);
      b.color = C_DIM;
      const L = rp + 0.3;
      const sec = (y: number): number[][] => [
        [-0.05, y, 0.11],
        [0.05, y, 0.11],
        [0.05, y, -L],
        [-0.05, y, -L],
      ];
      b.loft([sec(GEAR_Y + 0.04), sec(GEAR_Y + 0.062)], true, false);
      b.setMatrix(t.copy(m).multiply(new THREE.Matrix4().makeTranslation(0, 0, -(L - 0.07))));
      b.lathe(
        [
          [
            { r: 0, y: GEAR_Y + 0.085 },
            { r: 0.04, y: GEAR_Y + 0.08 },
            { r: 0.055, y: GEAR_Y + 0.062 },
          ],
          [
            { r: 0, y: GEAR_Y + 0.04, c: C_DIM },
            { r: 0.075, y: GEAR_Y + 0.04, c: C_DIM },
          ],
          [
            { r: 0.075, y: GEAR_Y + 0.04, c: C_DIM },
            { r: 0.075, y: PLATE_Y, c: C_DIM },
          ],
        ],
        12,
        { vScale: 0 },
      );
    }
  }

  // Outer rail closing the plate.
  b.setMatrix(null);
  b.gear = [0, 0, 0, 0];
  b.color = scale(C_DIM, 0.6);
  b.lathe(
    [
      [
        { r: 7.98, y: PLATE_Y },
        { r: 7.98, y: -0.085 },
      ],
      arcPoints(8.02, -0.085, 0.04, 180, 0, 5, { c: scale(C_DIM, 0.7) }),
      [
        { r: 8.06, y: -0.085 },
        { r: PLATE_R1, y: -0.115 },
      ],
      [
        { r: PLATE_R1, y: -0.115 },
        { r: PLATE_R1, y: -0.3 },
      ],
    ],
    Math.round(160 * segK(q)),
    { vScale: 0 },
  );
  return b.build({ fx: true, gear: true });
}
