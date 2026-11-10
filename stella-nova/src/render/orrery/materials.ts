/**
 * Materials of the instrument. Brass, enamel and plate are three.js PBR
 * materials patched through onBeforeCompile (so they keep lights, shadows and
 * the PMREM environment); the jewels are a small unlit HDR shader.
 */
import * as THREE from 'three';
import type { Quality } from '../../core/types';
import { GAUGE_SEGMENTS } from './parts';

type Uniforms = Record<string, THREE.IUniform>;

/**
 * Polished brass tinted per vertex. aFx drives the emissive accents:
 * x = hairline on the rim crest (glow / heat), y = light leaking up from the
 * gaps, z = rim top (lifts with glow, carries the unlocked shimmer), w = angle.
 */
export function makeBrass(tex: THREE.Texture, uniforms: Uniforms, gears = false): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 1,
    roughness: 0.36,
    map: tex,
    bumpMap: tex,
    bumpScale: 0.8,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aFx;
varying vec4 vFx;
varying vec3 vSnW;
${gears ? 'attribute vec4 aGear;\nuniform float uGearT;' : ''}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
${
  gears
    ? `float snA = aGear.z * uGearT + aGear.w;
float snC = cos(snA);
float snS = sin(snA);
objectNormal = vec3(objectNormal.x * snC - objectNormal.z * snS, objectNormal.y, objectNormal.z * snC + objectNormal.x * snS);`
    : ''
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFx = aFx;
${
  gears
    ? `vec2 snO = transformed.xz - aGear.xy;
transformed.xz = aGear.xy + vec2(snO.x * snC - snO.y * snS, snO.y * snC + snO.x * snS);`
    : ''
}`,
      )
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec4 vFx;
varying vec3 vSnW;
uniform float uGlow, uHeat, uUnlock, uMode, uUnder, uShim;
uniform vec3 uUnderColor, uLaneColor;
uniform float uSpoke[8];
${LANE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.86, 1.02), uMode);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 snGold = vec3(1.0, 0.82, 0.5);
  float snWave = pow(0.5 + 0.5 * sin(vFx.w * 3.0 - uShim * 1.3), 10.0);
  totalEmissiveRadiance += vFx.x * (uGlow * 1.6 * snGold + uHeat * 0.9 * vec3(1.0, 0.32, 0.06));
  totalEmissiveRadiance += vFx.z * (uGlow * 0.04 * snGold + uHeat * 0.1 * vec3(1.0, 0.45, 0.12) + uUnlock * (0.05 + 1.2 * snWave) * snGold);
  // The lit spoke runs down the brass as well, so the lane reads between the symbols.
  totalEmissiveRadiance += vFx.z * snLaneAt(vSnW, 0.5) * uLaneColor * 0.6;
  totalEmissiveRadiance += vFx.y * vFx.y * uUnder * uUnderColor * 1.6;
}`,
      );
  };
  if (gears) {
    // The movement is background: broad, dim highlights so it never competes with the rings.
    m.roughness = 0.58;
    m.envMapIntensity = 0.6;
  }
  m.customProgramCacheKey = () => (gears ? 'sn-brass-gears' : 'sn-brass');
  return m;
}

const LANE_GLSL = /* glsl */ `
float snLaneAt(vec3 w, float halfWidth) {
  float f = atan(w.x, -w.z) / 0.7853981634;
  float i = floor(f + 0.5);
  float d = abs(f - i) * 0.7853981634 * length(w.xz);
  return uSpoke[int(mod(i + 8.0, 8.0))] * (1.0 - smoothstep(0.04, halfWidth, d));
}`;

/**
 * Fired enamel: deep blue glass over engine-turned metal with gold inlay.
 * The data texture rides the bumpMap slot (R = inlay and height, G = tone);
 * colours come from uniforms so Kometnat can re-tint without new textures.
 */
export function makeEnamel(tex: THREE.Texture, uniforms: Uniforms, quality: Quality): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.55,
    envMapIntensity: 0.6,
    bumpMap: tex,
    bumpScale: 1.1,
    clearcoat: quality === 'low' ? 0 : 1,
    clearcoatRoughness: 0.07,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSnW;
uniform vec3 uEnDark, uEnLight, uEnGold, uLaneColor;
uniform float uGlow;
uniform float uSpoke[8];
${LANE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 snT = texture2D(bumpMap, vBumpMapUv).rgb;
vec3 snEnamel = mix(uEnDark, uEnLight, snT.g);
diffuseColor.rgb = mix(snEnamel, uEnGold, snT.r);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = snT.r;
roughnessFactor = mix(roughnessFactor, 0.36, snT.r);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  float snLane = snLaneAt(vSnW, 0.5);
  // A little light from inside the glass so the blue never dies to black.
  totalEmissiveRadiance += snEnamel * 0.2;
  totalEmissiveRadiance += uLaneColor * snLane * snLane * (0.22 + 0.4 * snT.g);
  totalEmissiveRadiance += uEnGold * snT.r * (uGlow * 0.35 + snLane * 0.6);
}`,
      );
  };
  m.customProgramCacheKey = () => 'sn-enamel';
  return m;
}

/** Base plate: dim star chart. The diffuser strips in the gaps are lit here, by radius. */
export function makePlate(tex: THREE.Texture, uniforms: Uniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, metalness: 0.6, roughness: 0.5 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSnW;
uniform float uUnder, uShim;
uniform vec3 uUnderColor;
uniform float uSpoke[8];
${LANE_GLSL}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  float snR = length(vSnW.xz);
  float snGap = (1.0 - smoothstep(0.022, 0.05, abs(snR - 0.76))) + (1.0 - smoothstep(0.022, 0.05, abs(snR - 4.74)))
    + (1.0 - smoothstep(0.022, 0.05, abs(fract(snR - 0.25) - 0.5))) * step(1.2, snR) * step(snR, 4.2);
  float snFlow = 0.82 + 0.18 * sin(atan(vSnW.x, vSnW.z) * 5.0 + snR * 2.0 - uShim * 0.6);
  totalEmissiveRadiance += snGap * step(0.0, vSnW.y + 0.1) * uUnderColor * (uUnder * snFlow * 1.7 + snLaneAt(vSnW, 0.4) * 1.6);
}`,
      );
  };
  m.customProgramCacheKey = () => 'sn-plate';
  return m;
}

/**
 * Lamps and gauge tiles: lit from within, so unlit HDR with a glassy
 * reflection. Level comes from uSpoke (lamps) or uCharge (gauge) per vertex.
 */
export function makeJewels(uniforms: Uniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aFx;
      uniform float uSpoke[8];
      uniform float uCharge, uShim;
      varying vec3 vN;
      varying vec3 vV;
      varying float vLvl;
      varying float vKind;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        vKind = aFx.x;
        if (aFx.x < 0.5) {
          vLvl = uSpoke[int(aFx.w + 0.5)];
        } else {
          float full = smoothstep(0.985, 1.0, uCharge);
          vLvl = clamp(uCharge * ${GAUGE_SEGMENTS.toFixed(1)} - aFx.w, 0.0, 1.0) * (1.0 + full * 0.3 * sin(uShim * 6.0 - aFx.w * 0.4));
        }
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube uEnv;
      varying vec3 vN;
      varying vec3 vV;
      varying float vLvl;
      varying float vKind;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float nv = clamp(dot(n, v), 0.0, 1.0);
        float fres = pow(1.0 - nv, 3.0);
        vec3 refl = textureCube(uEnv, reflect(-v, n)).rgb;
        vec3 off = mix(vec3(0.62, 0.15, 0.03), vec3(0.075, 0.024, 0.006), vKind);
        vec3 on = mix(vec3(1.0, 0.86, 0.56) * 5.0, vec3(1.0, 0.6, 0.2) * 1.25, vKind);
        float l = vLvl * vLvl;
        vec3 c = mix(off * (0.5 + 0.5 * nv), on, clamp(l, 0.0, 1.4));
        c += refl * (0.05 + 0.6 * fres) * (1.0 - 0.7 * min(l, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
