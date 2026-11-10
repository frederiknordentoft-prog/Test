/**
 * Stars. Two draw calls:
 *
 *   points  thousands of small stars in three depth layers (infinity and two
 *           shells around the instrument), so a camera dolly spreads them apart
 *   heroes  a few dozen bright stars as billboards with diffraction spikes
 *
 * The catalogue is generated from a fixed seed: the sky is a designed
 * backdrop and must look the same every session.
 */
import * as THREE from 'three';
import { FIT_RADIUS, PALETTE, SYMBOLS } from '../../core/config';
import { Rng } from '../../core/rng';
import type { Quality } from '../../core/types';
import { BOARD_GLSL, FAR_Z_GLSL, MILKY_WAY_NORMAL, ORDER, type SkyShared } from './shared';

export const STAR_COUNT: Record<Quality, number> = { low: 5200, medium: 9000, high: 14000 };
const MAX_STARS = STAR_COUNT.high;
/** Share of all stars per depth layer: infinity, far shell, near shell. */
const LAYER_SHARE = [0.64, 0.24, 0.12];
/** Shell radii (world units, min..max) of the two finite layers. */
const SHELLS: [number, number][] = [
  [150, 250],
  [62, 105],
];
/** How much faster each layer turns than the sky itself. Nearer = faster. */
export const LAYER_TURN = [1, 1.16, 1.42];

const DEG = Math.PI / 180;

/** Direction at `polar` from the pole and screen azimuth `az` (0 = right, counter-clockwise) at sky angle 0. */
function skyDir(polar: number, az: number, out: THREE.Vector3): THREE.Vector3 {
  const s = Math.sin(polar);
  return out.set(s * Math.cos(az), -Math.cos(polar), -s * Math.sin(az));
}

interface Tint {
  r: number;
  g: number;
  b: number;
}

function mixTint(hex: number, amount: number): Tint {
  const c = new THREE.Color(hex);
  return { r: 1 + (c.r - 1) * amount, g: 1 + (c.g - 1) * amount, b: 1 + (c.b - 1) * amount };
}

// A believable spread of star colours from the palette: most are near white,
// a fifth blue-white, some warm, a few orange, the odd icy one.
const TINTS: { until: number; tint: Tint }[] = [
  { until: 0.56, tint: mixTint(PALETTE.starCore, 0.7) },
  { until: 0.77, tint: mixTint(SYMBOLS[0].accent, 0.75) },
  { until: 0.91, tint: mixTint(PALETTE.starWarm, 0.6) },
  { until: 0.975, tint: mixTint(PALETTE.starHot, 0.62) },
  { until: 1.01, tint: mixTint(PALETTE.comet, 0.5) },
];

function pickTint(u: number): Tint {
  for (const t of TINTS) if (u < t.until) return t.tint;
  return TINTS[0].tint;
}

const POINT_VERT = /* glsl */ `
  attribute vec4 aLook;
  attribute vec4 aTint;
  uniform mat3 uTilt;
  uniform vec3 uCos;
  uniform vec3 uSin;
  uniform float uTime;
  uniform float uDpr;
  uniform float uMode;
  uniform float uTwinkle;
  varying vec3 vCol;
  varying float vHalf;

  ${BOARD_GLSL}

  void main() {
    float layer = aTint.w;
    float c = layer < 0.5 ? uCos.x : (layer < 1.5 ? uCos.y : uCos.z);
    float s = layer < 0.5 ? uSin.x : (layer < 1.5 ? uSin.y : uSin.z);
    vec3 p = vec3(c * position.x + s * position.z, position.y, c * position.z - s * position.x);
    // w = 0 strips the camera's translation: that layer is at infinity.
    vec4 mv = viewMatrix * vec4(uTilt * p, layer < 0.5 ? 0.0 : 1.0);
    gl_Position = projectionMatrix * vec4(mv.xyz, 1.0);
    ${FAR_Z_GLSL}

    float tw = 1.0 + uTwinkle * (0.6 * sin(uTime * aLook.w + aLook.z) + 0.4 * sin(uTime * aLook.w * 1.73 + aLook.z * 2.1));

    vec3 board = skyBoard();
    float rim = length(mv.xy / max(-mv.z, 0.0001) - board.xy) / board.z;
    float quiet = mix(0.35, 1.0, smoothstep(0.85, 1.35, rim));

    float size = aLook.x * uDpr;
    gl_PointSize = size;
    vHalf = size * 0.5;
    vCol = aTint.rgb * (aLook.y * tw * quiet * (1.0 + 0.22 * uMode));
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform float uDpr;
  varying vec3 vCol;
  varying float vHalf;

  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(q, q);
    // The core keeps a fixed width in pixels however large the sprite is, so
    // stars stay points; bigger sprites only add a faint halo around it.
    float sigma = 0.9 * uDpr;
    float core = exp(-r2 * vHalf * vHalf / (2.0 * sigma * sigma));
    float halo = 0.10 * exp(-r2 * 4.0) * smoothstep(2.2, 5.0, vHalf / uDpr);
    float edge = 1.0 - smoothstep(0.7, 1.0, r2);
    gl_FragColor = vec4(vCol * ((core + halo) * edge), 1.0);
  }
`;

const HERO_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute vec4 aLook;
  attribute vec3 aTint;
  uniform mat3 uTilt;
  uniform vec3 uCos;
  uniform vec3 uSin;
  uniform float uTime;
  uniform float uPxTan;
  uniform float uMode;
  uniform float uTwinkle;
  varying vec2 vQ;
  varying vec3 vTint;
  varying vec3 vLook;

  ${BOARD_GLSL}

  void main() {
    vec3 p = vec3(uCos.x * aDir.x + uSin.x * aDir.z, aDir.y, uCos.x * aDir.z - uSin.x * aDir.x);
    vec3 v = mat3(viewMatrix) * (uTilt * p);
    if (v.z > -0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 c = v.xy / -v.z;
    float tw = 1.0 + uTwinkle * (0.6 * sin(uTime * 1.3 + aLook.z) + 0.4 * sin(uTime * 2.7 + aLook.z * 1.9));
    float halfSize = aLook.x * (0.92 + 0.08 * tw);

    vec3 board = skyBoard();
    float rim = length(c - board.xy) / board.z;
    float quiet = mix(0.22, 1.0, smoothstep(0.9, 1.4, rim));

    gl_Position = projectionMatrix * vec4(c + position.xy * halfSize, -1.0, 1.0);
    ${FAR_Z_GLSL}
    vQ = position.xy;
    vTint = aTint;
    vLook = vec3(halfSize / uPxTan, aLook.w * tw, aLook.y * quiet * (0.9 + 0.1 * tw) * (1.0 + 0.2 * uMode));
  }
`;

const HERO_FRAG = /* glsl */ `
  uniform float uDpr;
  varying vec2 vQ;
  varying vec3 vTint;
  varying vec3 vLook;   // half size in device px, spike amount, intensity

  void main() {
    float r = length(vQ);
    float rp = r * vLook.x;
    float sigma = 1.15 * uDpr;
    float core = exp(-rp * rp / (2.0 * sigma * sigma));
    float halo = (exp(-r * 7.0) * 0.22 + exp(-r * r * 12.0) * 0.05) * (1.0 - smoothstep(0.7, 1.0, r));
    // Four soft diffraction spikes, one pixel thick, aligned to the frame like
    // the vanes of the telescope that is looking.
    vec2 ap = abs(vQ);
    float thick = 0.8 * uDpr;
    float sx = exp(-pow(vQ.y * vLook.x / thick, 2.0)) * pow(max(0.0, 1.0 - ap.x), 2.4);
    float sy = exp(-pow(vQ.x * vLook.x / thick, 2.0)) * pow(max(0.0, 1.0 - ap.y), 2.4);
    float spikes = (sx + sy) * vLook.y * 0.8;
    vec3 col = vec3(1.0, 0.98, 0.94) * core + vTint * (halo + spikes) * 0.36;
    gl_FragColor = vec4(col * vLook.z, 1.0);
  }
`;

interface HeroSpec {
  dir: THREE.Vector3;
  /** Half size of the billboard in tangent units (≈ radians). */
  size: number;
  intensity: number;
  spike: number;
  tint: Tint;
}

/**
 * Cassiopeia, the constellation Tycho's new star appeared in, with the nova
 * itself where he measured it. Offsets in degrees on a chart, north up.
 */
const CASSIOPEIA: { x: number; y: number; mag: number; nova?: boolean }[] = [
  { x: 6.28, y: -1.35, mag: 2.28 },
  { x: 2.4, y: -3.96, mag: 2.24 },
  { x: 0.41, y: 0.22, mag: 2.15 },
  { x: -3.18, y: -0.26, mag: 2.68 },
  { x: -6.7, y: 3.17, mag: 3.35 },
  { x: 4.27, y: 3.64, mag: 0.4, nova: true },
];

function buildHeroes(rng: Rng): HeroSpec[] {
  const heroes: HeroSpec[] = [];
  const tmp = new THREE.Vector3();
  const minSep = Math.cos(4.5 * DEG);
  const farEnough = (d: THREE.Vector3) => heroes.every((h) => h.dir.dot(d) < minSep);

  // The asterism sits in the upper right of the frame at sky angle 0.
  const centre = skyDir(27.5 * DEG, 40 * DEG, new THREE.Vector3());
  // Screen-up (−Z) projected onto the sky at the asterism, so the W stands upright.
  const up = new THREE.Vector3(0, 0, -1).addScaledVector(centre, centre.z).normalize();
  const right = new THREE.Vector3().crossVectors(centre, up).normalize();
  const chartScale = 0.52 * DEG;
  for (const s of CASSIOPEIA) {
    const dir = centre.clone().addScaledVector(right, s.x * chartScale).addScaledVector(up, s.y * chartScale).normalize();
    const b = Math.pow(2.512, 2.6 - s.mag);
    heroes.push({
      dir,
      size: s.nova ? 0.07 : 0.022 + 0.008 * b,
      intensity: s.nova ? 4.6 : 1.7 + 0.5 * b,
      spike: s.nova ? 1 : 0.55,
      tint: s.nova ? mixTint(PALETTE.starWarm, 0.45) : mixTint(SYMBOLS[0].accent, 0.5),
    });
  }

  // The rest are spread over belts around the pole. The first belt is the part
  // of the sky that shows around the instrument at rest, so it gets the most.
  const belts: [number, number, number][] = [
    [17, 33, 11],
    [33, 60, 17],
    [60, 100, 9],
  ];
  for (const [from, to, count] of belts) {
    let placed = 0;
    for (let guard = 0; placed < count && guard < 400; guard++) {
      const c = Math.cos(from * DEG) + rng.next() * (Math.cos(to * DEG) - Math.cos(from * DEG));
      skyDir(Math.acos(c), rng.next() * Math.PI * 2, tmp);
      if (!farEnough(tmp)) continue;
      const big = Math.pow(rng.next(), 2.2);
      heroes.push({
        dir: tmp.clone(),
        size: 0.022 + 0.046 * big,
        intensity: 1.5 + 2.6 * big,
        spike: 0.4 + 0.6 * big,
        tint: pickTint(rng.next()),
      });
      placed++;
    }
  }
  return heroes;
}

export class StarField {
  readonly points: THREE.Points;
  readonly heroes: THREE.Mesh;
  private readonly uCos = { value: new THREE.Vector3(1, 1, 1) };
  private readonly uSin = { value: new THREE.Vector3() };
  private readonly uTwinkle = { value: 0.28 };

  constructor(shared: SkyShared, uTime: { value: number }) {
    const rng = new Rng(0x1572_1111);

    // ── points ──────────────────────────────────────────────────────────
    const pos = new Float32Array(MAX_STARS * 3);
    const look = new Float32Array(MAX_STARS * 4);
    const tint = new Float32Array(MAX_STARS * 4);
    const dir = new THREE.Vector3();
    const capCos = Math.cos(86 * DEG);

    // A handful of open clusters: tight knots of stars read as "real sky".
    const clusters: { dir: THREE.Vector3; sigma: number; left: number }[] = [];
    for (let i = 0; i < 6; i++) {
      clusters.push({
        dir: skyDir((19 + rng.next() * 44) * DEG, rng.next() * Math.PI * 2, new THREE.Vector3()),
        sigma: (0.7 + rng.next() * 1.1) * DEG,
        left: 22 + rng.int(26),
      });
    }

    for (let i = 0; i < MAX_STARS; i++) {
      const u = rng.next();
      const layer = u < LAYER_SHARE[0] ? 0 : u < LAYER_SHARE[0] + LAYER_SHARE[1] ? 1 : 2;
      let boost = 1;

      // Every 40th star belongs to a cluster, so any prefix of the buffer
      // (a lower quality level) keeps its share of them.
      const cluster = i % 40 === 7 ? clusters.find((c) => c.left > 0) : undefined;
      if (cluster && layer === 0) {
        cluster.left--;
        const g = Math.sqrt(-2 * Math.log(1 - rng.next())) * cluster.sigma;
        const a = rng.next() * Math.PI * 2;
        dir.set(Math.cos(a) * g, 0, Math.sin(a) * g);
        dir.addScaledVector(cluster.dir, -dir.dot(cluster.dir)).add(cluster.dir).normalize();
        boost = 1.8;
      } else {
        for (let guard = 0; guard < 24; guard++) {
          // Most stars go where the camera can look; a share covers the rest of
          // the sphere so the sky still closes all the way round.
          const everywhere = layer === 0 && rng.next() < 0.14;
          const c = everywhere ? 1 - rng.next() * 2 : 1 - rng.next() * (1 - capCos);
          const s = Math.sqrt(Math.max(0, 1 - c * c));
          const a = rng.next() * Math.PI * 2;
          dir.set(s * Math.cos(a), -c, s * Math.sin(a));
          const h = dir.dot(MILKY_WAY_NORMAL);
          // Denser along the Milky Way.
          if (rng.next() < (0.36 + Math.exp((-h * h) / (2 * 0.17 * 0.17))) / 1.36) break;
        }
      }

      const radius = layer === 0 ? 1 : rng.range(SHELLS[layer - 1][0], SHELLS[layer - 1][1]);
      pos[i * 3] = dir.x * radius;
      pos[i * 3 + 1] = dir.y * radius;
      pos[i * 3 + 2] = dir.z * radius;

      // Power-law brightness: for every bright star there are dozens of faint ones.
      const flux = Math.min(420, Math.pow(1 - rng.next(), -1 / 1.12) * boost);
      const t = pickTint(rng.next());
      // Faint stars are whiter: there is too little light in them to show colour.
      const sat = Math.min(1, 0.45 + 0.2 * Math.log2(flux));
      look[i * 4] = 4.4 + 0.8 * Math.log2(flux);
      look[i * 4 + 1] = 0.12 * Math.pow(flux, 0.55);
      look[i * 4 + 2] = rng.next() * Math.PI * 2;
      look[i * 4 + 3] = 0.5 + rng.next() * 1.9;
      tint[i * 4] = 1 + (t.r - 1) * sat;
      tint[i * 4 + 1] = 1 + (t.g - 1) * sat;
      tint[i * 4 + 2] = 1 + (t.b - 1) * sat;
      tint[i * 4 + 3] = layer;
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pointGeo.setAttribute('aLook', new THREE.BufferAttribute(look, 4));
    pointGeo.setAttribute('aTint', new THREE.BufferAttribute(tint, 4));
    const defines = { FIT_RADIUS: FIT_RADIUS.toFixed(4) };
    const pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: {
        uTilt: shared.uTilt,
        uCos: this.uCos,
        uSin: this.uSin,
        uTime,
        uDpr: shared.uDpr,
        uMode: shared.uMode,
        uTwinkle: this.uTwinkle,
      },
      defines,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(pointGeo, pointMat);
    this.points.name = 'sky.stars';
    this.points.frustumCulled = false;
    this.points.renderOrder = ORDER.stars;

    // ── heroes ──────────────────────────────────────────────────────────
    const specs = buildHeroes(rng);
    const heroGeo = new THREE.InstancedBufferGeometry();
    heroGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    heroGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const hDir = new Float32Array(specs.length * 3);
    const hLook = new Float32Array(specs.length * 4);
    const hTint = new Float32Array(specs.length * 3);
    specs.forEach((h, i) => {
      h.dir.toArray(hDir, i * 3);
      hLook.set([h.size, h.intensity, rng.next() * Math.PI * 2, h.spike], i * 4);
      hTint.set([h.tint.r, h.tint.g, h.tint.b], i * 3);
    });
    heroGeo.setAttribute('aDir', new THREE.InstancedBufferAttribute(hDir, 3));
    heroGeo.setAttribute('aLook', new THREE.InstancedBufferAttribute(hLook, 4));
    heroGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(hTint, 3));
    heroGeo.instanceCount = specs.length;
    const heroMat = new THREE.ShaderMaterial({
      vertexShader: HERO_VERT,
      fragmentShader: HERO_FRAG,
      uniforms: {
        uTilt: shared.uTilt,
        uCos: this.uCos,
        uSin: this.uSin,
        uTime,
        uPxTan: shared.uPxTan,
        uDpr: shared.uDpr,
        uMode: shared.uMode,
        uTwinkle: this.uTwinkle,
      },
      defines,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    this.heroes = new THREE.Mesh(heroGeo, heroMat);
    this.heroes.name = 'sky.heroStars';
    this.heroes.frustumCulled = false;
    this.heroes.renderOrder = ORDER.heroes;
  }

  setQuality(q: Quality): void {
    this.points.geometry.setDrawRange(0, STAR_COUNT[q]);
  }

  /** angles: the three layers' current turn, radians. */
  setFrame(angles: readonly number[], reducedMotion: boolean): void {
    this.uCos.value.set(Math.cos(angles[0]), Math.cos(angles[1]), Math.cos(angles[2]));
    this.uSin.value.set(Math.sin(angles[0]), Math.sin(angles[1]), Math.sin(angles[2]));
    this.uTwinkle.value = reducedMotion ? 0.12 : 0.28;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.heroes.geometry.dispose();
    (this.heroes.material as THREE.Material).dispose();
  }
}
