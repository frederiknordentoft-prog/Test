/**
 * Things every sky layer agrees on: the sky's own coordinate frame, the bake's
 * projection and the trick that pins sky geometry to the far plane.
 *
 * SKY SPACE: the pole is −Y and it is the camera's base view axis, so "around
 * the pole" on the sky is "around the instrument" on screen. The sky turns
 * about Y. Screen-right is +X and screen-up is −Z at angle 0.
 */
import * as THREE from 'three';

/** Draw order inside the sky. All far below 0 so the sky is always first. */
export const ORDER = { dome: -1000, stars: -990, heroes: -989, comet: -988, meteors: -987 } as const;

/** Radians per second: one turn in 25 minutes. Slow enough to be felt rather than seen. */
export const SKY_RATE = (Math.PI * 2) / 1500;

/**
 * Normal of the Milky Way's plane in sky space. Lying almost in XZ puts the
 * band through the pole (behind the instrument), running lower-left to
 * upper-right at angle 0; the small Y keeps it from being perfectly centred.
 */
export const MILKY_WAY_NORMAL = new THREE.Vector3(1, 0.16, 1).normalize();

/**
 * Hemi-octahedral map of the hemisphere around the pole onto the unit square.
 * The pole sits at the centre of the texture where texel density is highest,
 * there is no pinch anywhere the camera can look, and the far hemisphere is
 * the mirror image so the sky still closes behind the camera.
 */
export const OCT_GLSL = /* glsl */ `
  vec2 skyOct(vec3 d) {
    d.y = -abs(d.y);
    vec2 p = d.xz / (abs(d.x) - d.y + abs(d.z));
    return vec2(p.x + p.y, p.x - p.y) * 0.5 + 0.5;
  }
  vec3 skyOctDecode(vec2 uv) {
    vec2 e = uv * 2.0 - 1.0;
    vec2 t = vec2(e.x + e.y, e.x - e.y) * 0.5;
    return normalize(vec3(t.x, abs(t.x) + abs(t.y) - 1.0, t.y));
  }
`;

/**
 * Sky geometry is written at the far plane: it can never be clipped by the
 * camera's far distance and the depth test hides it behind anything real.
 */
export const FAR_Z_GLSL = /* glsl */ `gl_Position.z = gl_Position.w * 0.999999;`;

/**
 * Where the instrument sits in the view's tangent plane (view-space x/y at
 * depth 1): xy = centre, z = radius. Layers use it to stay quiet behind it.
 */
export const BOARD_GLSL = /* glsl */ `
  vec3 skyBoard() {
    vec4 o = viewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float d = max(-o.z, 0.001);
    return vec3(o.xy / d, FIT_RADIUS / d);
  }
`;

/** Uniforms shared by several layers. One object each, so one write updates all. */
export interface SkyShared {
  /** Tangent-plane units per device pixel. */
  uPxTan: { value: number };
  /** Device pixel ratio of the render target. */
  uDpr: { value: number };
  /** 0 = observatory night, 1 = Kometnat. */
  uMode: { value: number };
  /** Sky → world rotation without the turn (the base tilt only). */
  uTilt: { value: THREE.Matrix3 };
}

export function makeTriangle(): THREE.BufferGeometry {
  // One oversized triangle covers the viewport with no diagonal seam.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}
