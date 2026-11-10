/**
 * One pooled GPU particle system for every spark, shard, mote of dust and pop.
 *
 * A ring buffer of instanced quads. Each particle is written once at spawn
 * (origin, velocity or path, birth, life, colour, size, seed, kind) and from
 * then on its whole life is evaluated in the vertex shader from the shared
 * clock, so update() costs nothing per particle and a spawn uploads only the
 * slots it touched. A birth time in the future is a delayed spawn, which is
 * how streams and scheduled impacts are staggered without callbacks.
 */
import * as THREE from 'three';
import type { Stage } from '../stage';
import { additive, VFX_RENDER_ORDER } from './common';

/** Ballistic soft glow. aux = (gravity, drag, -), a = end-size factor. */
export const P_GLOW = 0;
/** Ballistic streak aligned to its velocity. aux = (gravity, drag, -), a = stretch per unit of screen speed. */
export const P_SPARK = 1;
/** Tumbling angular sliver that falls and bounces once. aux = (gravity, -, floorY), b = spin rad/s. */
export const P_SHARD = 2;
/** Ring lying flat on the board, expanding to `size`. a = start radius as a fraction. */
export const P_RING = 3;
/** Glitter spiralling into a point. pos = from, aux = to, vel = (swing rad, arc height, lift-off height), a = ease power, b = scatter radius. */
export const P_DUST = 4;
/** Static bloom pop with star rays. a = ray strength. */
export const P_FLASH = 5;
/** Ballistic twinkling four-point glint. aux = (gravity, drag, -), a = twinkle rate. */
export const P_GLINT = 6;
/** Hot head on a bezier path. pos/vel/aux = P0/P1/P2, a = ease power. */
export const P_HEAD = 7;

const STRIDE = 20;

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec3 iAux;
attribute vec2 iTime;
attribute vec4 iColor;
attribute vec4 iMisc;
uniform float uTime;
uniform vec2 uView;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vInfo;

vec3 bez(vec3 a, vec3 b, vec3 c, float s) {
  float i = 1.0 - s;
  return a * (i * i) + b * (2.0 * i * s) + c * (s * s);
}

void main() {
  float age = uTime - iTime.x;
  float t = age / iTime.y;
  if (age < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float seed = iMisc.x;
  float type = iMisc.y;
  float pa = iMisc.z;
  float pb = iMisc.w;
  vec2 c = position.xy;
  float size = iColor.w;

  bool isSpark = type > 0.5 && type < 1.5;
  bool isShard = type > 1.5 && type < 2.5;
  bool isRing = type > 2.5 && type < 3.5;
  bool isDust = type > 3.5 && type < 4.5;
  bool isFlash = type > 4.5 && type < 5.5;
  bool isGlint = type > 5.5 && type < 6.5;
  bool isHead = type > 6.5;

  vec3 P = iPos;
  vec3 V = vec3(0.0, 1.0, 0.0);
  float extra = 0.0;
  float pathS = 0.0;

  if (isHead) {
    pathS = pow(t, pa);
    P = bez(iPos, iVel, iAux, pathS);
  } else if (isDust) {
    // A true inward spiral about the target: the radius collapses while the
    // bearing swings clockwise, so streams from one spoke wind like galaxy arms.
    pathS = pow(t, pa);
    vec3 rel = iPos - iAux;
    float swing = iVel.x * (1.0 - pow(1.0 - pathS, 1.5));
    float cs = cos(swing);
    float sn = sin(swing);
    float shrink = 1.0 - pathS;
    P.x = iAux.x + (rel.x * cs - rel.z * sn) * shrink;
    P.z = iAux.z + (rel.x * sn + rel.z * cs) * shrink;
    P.y = mix(iPos.y, iAux.y, pathS) + iVel.y * sin(3.14159 * pow(pathS, 0.6)) + iVel.z * smoothstep(0.0, 0.35, t) * shrink;
    // Loose glitter around the stream, tightening as the star takes it.
    float ang = seed * 6.2831 + t * 9.0;
    float rad = pb * shrink * smoothstep(0.0, 0.3, t);
    P += vec3(cos(ang), sin(ang * 1.3) * 0.6, sin(ang)) * rad;
  } else if (isShard) {
    // Drag-free arc with one bounce on the board, then it lies still.
    float g = iAux.x;
    float floorY = iAux.z;
    float h = max(iPos.y - floorY, 0.0);
    float vy = iVel.y;
    float tl = (vy + sqrt(vy * vy + 2.0 * g * h)) / g;
    if (age < tl) {
      P = iPos + iVel * age;
      P.y = iPos.y + vy * age - 0.5 * g * age * age;
    } else {
      float t2 = age - tl;
      float vy2 = (g * tl - vy) * 0.36;
      float tb = 2.0 * vy2 / g;
      float th = min(t2, tb);
      P.xz = iPos.xz + iVel.xz * (tl + th * 0.5);
      P.y = floorY + max(0.0, vy2 * th - 0.5 * g * th * th);
      extra = t2 > tb ? 1.0 : 0.0;
    }
  } else if (!isRing && !isFlash) {
    // Linear drag with gravity, solved in closed form.
    float g = iAux.x;
    float k = max(iAux.y, 0.02);
    vec3 vT = vec3(0.0, -g / k, 0.0);
    float e = exp(-k * age);
    P = iPos + (iVel - vT) * ((1.0 - e) / k) + vT * age;
    V = (iVel - vT) * e + vT;
  }

  float fade = 1.0;
  float bias = 0.0;
  vec4 mv;

  if (isRing) {
    float grow = 1.0 - pow(1.0 - t, 3.0);
    P += vec3(c.x, 0.0, c.y) * size * mix(pa, 1.0, grow);
    mv = viewMatrix * vec4(P, 1.0);
    fade = pow(1.0 - t, 1.7);
  } else {
    mv = viewMatrix * vec4(P, 1.0);
    // Buffer pixels per world unit at this depth: keeps tiny sparks from
    // aliasing away and near ones from filling the lens.
    float px = projectionMatrix[1][1] * uView.y * 0.5 / max(0.1, -mv.z);
    vec2 off;
    if (isSpark) {
      vec3 vv = mat3(viewMatrix) * V;
      float sp = length(vv.xy);
      vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
      float w = max(size, 1.25 / px);
      fade = pow(1.0 - t, 1.25) * min(1.0, size / w + 0.25);
      off = dir * c.x * w * (1.0 + pa * sp) + vec2(-dir.y, dir.x) * c.y * w;
      extra = 1.0 + pa * sp;
    } else if (isShard) {
      float moving = 1.0 - extra;
      float ang = seed * 6.2831 + pb * age * (0.25 + 0.75 * moving);
      // Rotation about the long axis: the sliver thins, then flashes face-on.
      float flip = cos(age * pb * 1.9 + seed * 40.0);
      float w = max(size, 1.6 / px);
      vec2 q = vec2(c.x * w, c.y * w * (0.2 + 0.34 * abs(flip)));
      float ca = cos(ang);
      float sa = sin(ang);
      off = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
      fade = (1.0 - smoothstep(0.6, 1.0, t)) * (0.55 + 1.5 * pow(abs(flip), 5.0));
      extra = flip;
    } else {
      float s = size;
      float maxPx = uView.y * 0.09;
      if (isFlash) {
        // Snap open, then shrink while it decays.
        float open = 1.0 - pow(1.0 - min(t / 0.16, 1.0), 2.0);
        s *= (0.45 + 0.55 * open) * (1.0 - 0.3 * t);
        fade = pow(1.0 - t, 2.1);
        bias = 0.9;
        maxPx = uView.y;
        extra = pa;
      } else if (isDust) {
        s *= 1.0 - 0.55 * pathS;
        fade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.93, 1.0, t));
        extra = pathS;
      } else if (isGlint) {
        fade = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.1);
        extra = pa;
      } else if (isHead) {
        fade = smoothstep(0.0, 0.12, t);
        bias = 0.5;
        maxPx = uView.y * 0.3;
      } else {
        s *= mix(1.0, pa, t);
        fade = smoothstep(0.0, 0.05, t) * pow(1.0 - t, 1.6);
        bias = min(s, 0.9);
        maxPx = uView.y * 0.6;
      }
      float sPx = s * px;
      fade *= clamp(sPx / 1.4, 0.3, 1.0);
      s = clamp(sPx, 1.4, maxPx) / px;
      off = c * s;
    }
    mv.xy += off;
  }

  gl_Position = projectionMatrix * mv;
  if (bias > 0.0) {
    // Big glows are light, not cards: pull their depth toward the lens so the
    // board never slices a hard line through them.
    vec4 nearer = projectionMatrix * (mv + vec4(0.0, 0.0, bias, 0.0));
    gl_Position.z = nearer.z / nearer.w * gl_Position.w;
  }
  vUv = c;
  vColor = iColor.rgb * fade;
  vInfo = vec4(type, seed, t, extra);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vInfo;

float cross4(vec2 p, float thin, float reach) {
  return exp(-abs(p.y) * thin - abs(p.x) * reach) + exp(-abs(p.x) * thin - abs(p.y) * reach);
}

void main() {
  float type = vInfo.x;
  float seed = vInfo.y;
  float t = vInfo.z;
  float ex = vInfo.w;
  vec2 p = vUv;
  float d2 = dot(p, p);
  float d = sqrt(d2);
  float edge = smoothstep(1.0, 0.72, d);
  vec3 col = vColor;
  float I;

  if (type < 0.5) {
    I = (exp(-d2 * 5.5) * 0.5 + exp(-d2 * 30.0) * 0.9) * edge;
  } else if (type < 1.5) {
    // Streak: hot at the head, thinning to nothing behind.
    float along = smoothstep(-1.0, 0.75, p.x);
    float w = mix(0.35, 1.0, along);
    float body = exp(-pow(p.y / w, 2.0) * 4.5);
    I = body * along * along * smoothstep(1.0, 0.8, p.x) * 1.5;
    // White-hot at birth, cooling to its own colour.
    float hot = (1.0 - t) * (1.0 - t);
    col = mix(col, vec3(max(col.r, max(col.g, col.b))), hot * 0.75);
  } else if (type < 2.5) {
    // Angular sliver: a hard-edged kite with one facet catching the light.
    float x = p.x > 0.0 ? p.x : p.x * 1.7;
    float e = 1.0 - (abs(x) + abs(p.y));
    float body = smoothstep(0.0, fwidth(e) * 1.5 + 0.04, e);
    float facet = 0.5 + 0.5 * step(0.0, p.y * ex);
    I = body * facet;
  } else if (type < 3.5) {
    float ring = exp(-pow((d - 0.86) / 0.06, 2.0));
    float inner = exp(-pow((d - 0.6) / 0.2, 2.0)) * 0.14;
    I = ring + inner;
  } else if (type < 4.5) {
    float tw = 0.5 + 0.5 * sin(uTime * 34.0 + seed * 90.0);
    float core = exp(-d2 * 24.0) * 1.3;
    float rays = cross4(p, 46.0, 4.0) * (0.3 + 0.7 * tw);
    I = (core + rays + exp(-d2 * 5.0) * 0.22) * edge;
    // Whitens as the star takes it.
    col = mix(col, vec3(max(col.r, max(col.g, col.b))), ex * ex * 0.6);
  } else if (type < 5.5) {
    float core = exp(-d2 * 15.0) * 1.5;
    float halo = exp(-d2 * 4.2) * 0.5;
    float a = seed * 3.1416;
    vec2 q = vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
    float rays = cross4(q, 30.0, 2.4) * 0.9 * ex;
    I = (core + halo + rays) * edge;
  } else if (type < 6.5) {
    float tw = 0.5 + 0.5 * sin(uTime * ex + seed * 120.0);
    float core = exp(-d2 * 28.0) * (0.7 + 0.8 * tw);
    float rays = cross4(p, 44.0, 4.0) * tw * 0.85;
    I = (core + rays + exp(-d2 * 6.0) * 0.12) * edge;
  } else {
    I = (exp(-d2 * 9.0) * 0.55 + exp(-d2 * 55.0) * 2.2 + cross4(p, 40.0, 3.0) * 0.5) * edge;
  }
  gl_FragColor = vec4(col * I, 0.0);
}
`;

export class ParticlePool {
  readonly mesh: THREE.Mesh;
  readonly capacity: number;
  private readonly data: Float32Array;
  private readonly buffer: THREE.InstancedInterleavedBuffer;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly view = new THREE.Vector2(1, 1);
  private head = 0;
  private used = 0;
  private latestDeath = -1;
  // Two reusable upload ranges (before and after the ring wraps), so a spawn
  // never allocates and never re-uploads the whole pool.
  private pending = false;
  private wrapped = false;
  private readonly rangeA = { start: 0, count: 0 };
  private readonly rangeB = { start: 0, count: 0 };

  constructor(private readonly stage: Stage, capacity = 8192) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * STRIDE);
    // Unused slots must read as dead: life 1, born long ago.
    for (let i = 0; i < capacity; i++) {
      this.data[i * STRIDE + 9] = -1e6;
      this.data[i * STRIDE + 10] = 1;
    }
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    this.buffer.onUpload(() => {
      this.pending = false;
      this.wrapped = false;
      this.buffer.updateRanges.length = 0;
    });

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', new THREE.InterleavedBufferAttribute(this.buffer, 3, 0));
    g.setAttribute('iVel', new THREE.InterleavedBufferAttribute(this.buffer, 3, 3));
    g.setAttribute('iAux', new THREE.InterleavedBufferAttribute(this.buffer, 3, 6));
    g.setAttribute('iTime', new THREE.InterleavedBufferAttribute(this.buffer, 2, 9));
    g.setAttribute('iColor', new THREE.InterleavedBufferAttribute(this.buffer, 4, 11));
    g.setAttribute('iMisc', new THREE.InterleavedBufferAttribute(this.buffer, 4, 15));
    g.instanceCount = 0;
    this.geometry = g;

    this.material = additive({
      uniforms: { uTime: stage.uTime, uView: { value: this.view } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = VFX_RENDER_ORDER + 2;
    this.mesh.visible = false;
  }

  /** Write one particle. Positional and allocation-free on purpose: this runs hundreds of times a second. */
  emit(
    type: number,
    px: number, py: number, pz: number,
    vx: number, vy: number, vz: number,
    ax: number, ay: number, az: number,
    birth: number, life: number,
    r: number, g: number, b: number,
    size: number, seed: number, pa: number, pb: number,
  ): void {
    const slot = this.head;
    const d = this.data;
    const o = slot * STRIDE;
    d[o] = px; d[o + 1] = py; d[o + 2] = pz;
    d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = ax; d[o + 7] = ay; d[o + 8] = az;
    d[o + 9] = birth; d[o + 10] = life;
    d[o + 11] = r; d[o + 12] = g; d[o + 13] = b; d[o + 14] = size;
    d[o + 15] = seed; d[o + 16] = type; d[o + 17] = pa; d[o + 18] = pb;

    this.head = slot + 1 === this.capacity ? 0 : slot + 1;
    if (this.used < this.capacity) {
      this.used++;
      this.geometry.instanceCount = this.used;
    }
    const death = birth + life;
    if (death > this.latestDeath) this.latestDeath = death;
    this.mesh.visible = true;

    const buf = this.buffer;
    if (!this.pending) {
      this.pending = true;
      this.wrapped = false;
      this.rangeA.start = o;
      this.rangeA.count = STRIDE;
      buf.updateRanges.length = 0;
      buf.updateRanges.push(this.rangeA);
      buf.needsUpdate = true;
    } else if (!this.wrapped && slot !== 0) {
      this.rangeA.count += STRIDE;
    } else if (!this.wrapped) {
      this.wrapped = true;
      this.rangeB.start = 0;
      this.rangeB.count = STRIDE;
      buf.updateRanges.push(this.rangeB);
    } else if (this.rangeB.count < this.data.length) {
      this.rangeB.count += STRIDE;
    }
  }

  /** Call once per frame: hides the mesh (zero draw calls) once the last particle has died. */
  update(): void {
    this.stage.renderer.getDrawingBufferSize(this.view);
    if (this.mesh.visible && this.stage.uTime.value > this.latestDeath) this.mesh.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
