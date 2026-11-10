/**
 * The dome: one full-screen triangle that turns each pixel into a sky
 * direction and looks the nebula up in the bake. Two samples, a little
 * arithmetic, no noise: this is the only sky shader that touches every pixel.
 *
 * Gas A and the Milky Way sit at infinity. Gas B and the veil sit on a shell
 * of finite radius around the instrument, so camera dollies and shakes slide
 * the two against each other and the nebula has depth.
 */
import * as THREE from 'three';
import { FIT_RADIUS, PALETTE } from '../../core/config';
import { BOARD_GLSL, FAR_Z_GLSL, OCT_GLSL, ORDER, makeTriangle, type SkyShared } from './shared';
import { displayColor, emissive } from './tone';

/** Radius of the shell gas B lives on, world units. */
const NEAR_SHELL = 210;

const VERT = /* glsl */ `
  uniform mat3 uSkyA;
  uniform mat3 uSkyB;
  uniform float uShell;
  varying vec3 vDirA;
  varying vec3 vDirB;
  varying vec2 vTan;
  varying vec3 vBoard;

  ${BOARD_GLSL}

  void main() {
    // View ray through this corner, built from the projection itself so the
    // layout's off-centre view offset is honoured.
    vec3 rv = vec3(
      (position.x + projectionMatrix[2][0]) / projectionMatrix[0][0],
      (position.y + projectionMatrix[2][1]) / projectionMatrix[1][1],
      -1.0);
    vec3 rw = rv * mat3(viewMatrix);
    vDirA = uSkyA * rw;
    // A ray from the camera meets a large shell around the origin at roughly
    // origin + dir * R + cameraPosition, hence the parallax term.
    vDirB = uSkyB * (rw + cameraPosition * (1.06 / uShell));
    vTan = rv.xy;
    vBoard = skyBoard();
    gl_Position = vec4(position.xy, 1.0, 1.0);
    ${FAR_Z_GLSL}
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uBake;
  uniform float uMode;
  uniform float uEnergy;
  uniform float uLife;
  uniform vec4 uPhase;
  uniform vec3 uNight0;
  uniform vec3 uNight1;
  uniform vec3 uNight2;
  uniform vec3 uTeal;
  uniform vec3 uViolet;
  uniform vec3 uRose;
  uniform vec3 uCyan;
  uniform vec3 uMilk;
  varying vec3 vDirA;
  varying vec3 vDirB;
  varying vec2 vTan;
  varying vec3 vBoard;

  ${OCT_GLSL}

  void main() {
    vec3 a = normalize(vDirA);
    vec3 b = normalize(vDirB);

    // Life: the two layers breathe against each other on slow, incommensurate
    // sines. A few arc minutes, far below anything that reads as movement.
    a = normalize(a + uLife * 0.006 * sin(a.yzx * 4.3 + uPhase.yzx));
    b = normalize(b + uLife * 0.012 * sin(b.zxy * 5.7 + uPhase.xyz));

    vec4 sa = texture2D(uBake, skyOct(a));
    vec4 sb = texture2D(uBake, skyOct(b));
    float gasA = sa.r * sa.r;
    float milk = sa.b * sa.b;
    float gasB = sb.g * sb.g;
    float veil = sb.a * sb.a;

    // The calm pool: 0 at the instrument's centre, 1 at its rim, opening up
    // beyond. The nebula is held down inside it so the board always sits on
    // quiet darkness, at any zoom.
    float rim = length(vTan - vBoard.xy) / vBoard.z;
    float open = smoothstep(0.85, 1.45, rim);
    float pool = mix(0.16, 1.0, open);

    float breath = 1.0 + 0.09 * uLife * sin(uPhase.w + gasB * 5.0 + a.x * 3.0);
    float lift = (1.0 + 0.40 * uEnergy) * breath;

    // Observatory night: teal billows, violet filaments, a pale navy river.
    vec3 night = uTeal * gasA * 0.95
               + uViolet * gasB * 0.85
               + uTeal * gasA * gasB * 0.60
               + uMilk * milk;

    // Kometnat: the billows turn rose, the filaments deepen, and the veil
    // lights up as an aurora fanning out from behind the instrument.
    vec3 komet = uRose * gasA * 1.15
               + uViolet * gasB * 1.55
               + uRose * gasA * gasB * 0.9
               + mix(uMilk, uViolet, 0.45) * milk * 1.15;
    if (uMode > 0.001) {
      float az = atan(b.z, b.x);
      float ray = 3.0 * sin(az * 7.0 + 1.0) + 2.0 * sin(az * 13.0 + 4.0);
      float shimmer = 0.5 + 0.5 * sin(ray - (1.0 + b.y) * 26.0 + uPhase.w * 3.0 + gasA * 2.0);
      float glow = veil * (0.45 + 0.75 * shimmer);
      komet += mix(uTeal, uCyan, shimmer * veil * 0.55) * glow * 1.25;
    }

    vec3 nebula = mix(night, komet, uMode) * lift * pool;

    // The void itself: night0 behind the board, rising to night1 at the frame
    // edge, with a breath of night2 wherever there is any gas at all.
    float haze = clamp(gasA * 0.5 + gasB * 0.3 + milk * 0.8, 0.0, 1.0);
    vec3 col = mix(uNight0, uNight1, open * 0.85);
    col = mix(col, uNight2, haze * open * 0.55);
    col = mix(col, col + uViolet * 0.10, uMode * open);

    gl_FragColor = vec4(col + nebula, 1.0);
  }
`;

export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    uBake: { value: THREE.Texture | null };
    uSkyA: { value: THREE.Matrix3 };
    uSkyB: { value: THREE.Matrix3 };
    uShell: { value: number };
    uMode: { value: number };
    uEnergy: { value: number };
    /** 1 = full life, 0 = reduced motion: no distortion, no breathing. */
    uLife: { value: number };
    uPhase: { value: THREE.Vector4 };
    [name: string]: THREE.IUniform;
  };
  private readonly rotY = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();

  constructor(shared: SkyShared) {
    this.uniforms = {
      uBake: { value: null },
      uSkyA: { value: new THREE.Matrix3() },
      uSkyB: { value: new THREE.Matrix3() },
      uShell: { value: NEAR_SHELL },
      uMode: shared.uMode,
      uEnergy: { value: 0 },
      uLife: { value: 1 },
      uPhase: { value: new THREE.Vector4() },
      uNight0: { value: displayColor(PALETTE.night0) },
      uNight1: { value: displayColor(PALETTE.night1) },
      uNight2: { value: displayColor(PALETTE.night2) },
      uTeal: { value: displayColor(PALETTE.nebulaTeal) },
      uViolet: { value: displayColor(PALETTE.nebulaViolet) },
      uRose: { value: displayColor(PALETTE.nebulaRose) },
      uCyan: { value: emissive(PALETTE.comet, 0.5) },
      // The Milky Way is starlight, not gas: a pale, cool grey-blue.
      uMilk: { value: displayColor(new THREE.Color(PALETTE.night2).lerp(new THREE.Color(PALETTE.uiDim), 0.3), 1.5) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      defines: { FIT_RADIUS: FIT_RADIUS.toFixed(4) },
      depthTest: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(makeTriangle(), material);
    this.mesh.name = 'sky.dome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = ORDER.dome;
  }

  /** World → sky rotations for the two gas layers. */
  setFrame(tilt: number, angleA: number, angleB: number): void {
    this.rotX.makeRotationX(-tilt);
    this.uniforms.uSkyA.value.setFromMatrix4(this.rotY.makeRotationY(-angleA).multiply(this.rotX));
    this.uniforms.uSkyB.value.setFromMatrix4(this.rotY.makeRotationY(-angleB).multiply(this.rotX));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
