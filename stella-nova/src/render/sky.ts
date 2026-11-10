/**
 * The sky: everything behind the instrument.
 *
 * Layers, back to front, at most five draw calls:
 *   dome     full-screen triangle sampling the baked nebula (two depth layers)
 *   stars    points at infinity and on two shells around the instrument
 *   heroes   bright stars with diffraction spikes
 *   comet    Kometnat only
 *   meteors  only while one is in flight
 *
 * The sky's pole is the camera's base view axis, so the whole sky turns
 * around the instrument. Nothing here competes with the board: the nebula is
 * held down in a pool behind it and everything stays below the bloom
 * threshold except star cores and the comet's nucleus.
 */
import * as THREE from 'three';
import { clamp01, damp } from '../core/ease';
import type { Quality } from '../core/types';
import type { Stage } from './stage';
import { bakeNebula, type NebulaBake } from './sky/bake';
import { SkyComet } from './sky/comet';
import { SkyDome } from './sky/dome';
import { SkyMeteors } from './sky/meteors';
import { SKY_RATE, type SkyShared } from './sky/shared';
import { LAYER_TURN, StarField } from './sky/stars';

/** Edge of the square bake per quality level. */
const BAKE_SIZE: Record<Quality, number> = { low: 1024, medium: 1536, high: 2048 };
/** Gas B turns a little slower than gas A, so the nebula never repeats a pose. */
const GAS_B_TURN = 0.82;
const TAU = Math.PI * 2;

export class Sky {
  readonly group = new THREE.Group();
  /** 0 = observatory night, 1 = Kometnat. */
  modeBlend = 0;
  /** 0..1 excitement: nebula brightness and flow. */
  energy = 0;

  private readonly stage: Stage;
  private readonly shared: SkyShared;
  private readonly dome: SkyDome;
  private readonly stars: StarField;
  private readonly comet: SkyComet;
  private readonly meteors: SkyMeteors;
  private bake: NebulaBake;
  private quality: Quality;
  private energySmooth = 0;
  private tilt = Number.NaN;
  /** Turn of gas A, gas B and the three star layers, each wrapped on its own. */
  private readonly turn = new Float64Array(5);
  private readonly starTurn = [0, 0, 0];
  private readonly phase = new Float64Array(4);
  private readonly size = new THREE.Vector2();
  private readonly rot = new THREE.Matrix4();

  constructor(stage: Stage) {
    this.stage = stage;
    this.quality = stage.quality;
    this.group.name = 'sky';
    this.shared = {
      uPxTan: { value: 0.001 },
      uDpr: { value: 1 },
      uMode: { value: 0 },
      uTilt: { value: new THREE.Matrix3() },
    };

    this.bake = bakeNebula(stage.renderer, BAKE_SIZE[this.quality]);
    this.dome = new SkyDome(this.shared);
    this.dome.uniforms.uBake.value = this.bake.texture;
    this.stars = new StarField(this.shared, stage.uTime);
    this.stars.setQuality(this.quality);
    this.comet = new SkyComet();
    this.meteors = new SkyMeteors(this.shared, stage.uTime, stage.rng);
    this.group.add(this.dome.mesh, this.stars.points, this.stars.heroes, this.comet.mesh, this.meteors.mesh);

    this.update(0);
  }

  /** The baked density fields (debug views, tooling). */
  get bakeTarget(): THREE.WebGLRenderTarget {
    return this.bake.target;
  }

  /** Launch a shooting star now. */
  spawnMeteor(): void {
    this.meteors.spawn(this.stage.camera, clamp01(this.modeBlend));
  }

  update(dt: number): void {
    const stage = this.stage;
    if (stage.quality !== this.quality) this.setQuality(stage.quality);

    const still = stage.reducedMotion;
    const mode = clamp01(this.modeBlend);
    this.energySmooth = damp(this.energySmooth, clamp01(this.energy), 0.3, dt);
    const e = this.energySmooth;
    this.shared.uMode.value = mode;

    // The sky turns. Energy and Kometnat hurry it a little; reduced motion slows it.
    const drift = dt * SKY_RATE * (still ? 0.35 : 1) * (1 + 1.5 * e + 0.4 * mode);
    const t = this.turn;
    t[0] = (t[0] + drift) % TAU;
    t[1] = (t[1] + drift * GAS_B_TURN) % TAU;
    for (let i = 0; i < 3; i++) this.starTurn[i] = t[2 + i] = (t[2 + i] + drift * LAYER_TURN[i]) % TAU;

    // Phases of the nebula's breathing, wrapped here in double precision so
    // the shader never sees a large argument.
    const flow = dt * (still ? 0.3 : 1) * (1 + 1.4 * e + 0.5 * mode);
    const p = this.phase;
    p[0] = (p[0] + flow * 0.21) % TAU;
    p[1] = (p[1] + flow * 0.17) % TAU;
    p[2] = (p[2] + flow * 0.26) % TAU;
    p[3] = (p[3] + flow * 0.33) % TAU;

    // The pole follows the camera's base tilt (it only changes with the layout).
    const tilt = stage.rig.tilt - stage.rig.tiltOffset;
    if (tilt !== this.tilt) {
      this.tilt = tilt;
      this.shared.uTilt.value.setFromMatrix4(this.rot.makeRotationX(tilt));
    }

    const u = this.dome.uniforms;
    this.dome.setFrame(tilt, t[0], t[1]);
    u.uEnergy.value = e;
    u.uLife.value = still ? 0 : 1;
    u.uPhase.value.set(p[0], p[1], p[2], p[3]);
    this.stars.setFrame(this.starTurn, still);

    const camera = stage.camera;
    stage.renderer.getDrawingBufferSize(this.size);
    this.shared.uDpr.value = stage.renderer.getPixelRatio();
    this.shared.uPxTan.value = 2 / (camera.projectionMatrix.elements[5] * Math.max(1, this.size.y));

    this.comet.update(dt, camera, mode, still);
    this.meteors.update(dt, camera, mode, still);
  }

  private setQuality(q: Quality): void {
    this.quality = q;
    this.stars.setQuality(q);
    if (BAKE_SIZE[q] !== this.bake.size) {
      this.bake.dispose();
      this.bake = bakeNebula(this.stage.renderer, BAKE_SIZE[q]);
      this.dome.uniforms.uBake.value = this.bake.texture;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.bake.dispose();
    this.dome.dispose();
    this.stars.dispose();
    this.comet.dispose();
    this.meteors.dispose();
  }
}
