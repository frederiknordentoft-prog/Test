/**
 * The orrery: four turned brass-and-enamel rings around the central star, a
 * fixed bezel with eight spoke lamps, and the clockwork under it.
 *
 * Draw calls (main pass): 4 ring brass + 4 enamel + fixed brass + jewels +
 * plate + clockwork + star + corona = 14. Ring brass and fixed brass also
 * render into the key light's shadow map.
 */
import * as THREE from 'three';
import { PALETTE, RINGS, RING_RADII, RING_Y, SPOKES, STAR_Y, STEP_ANGLE, SYMBOL_Y } from '../core/config';
import type { Quality } from '../core/types';
import { makeBrass, makeEnamel, makeJewels, makePlate } from './orrery/materials';
import { buildClockwork, buildFixedBrass, buildJewels, buildPlate, buildRingBrass, buildRingEnamel } from './orrery/parts';
import { Star } from './orrery/star';
import { buildBrassTexture, buildEnamelTexture, buildPlateTexture } from './orrery/textures';
import type { Stage } from './stage';

export interface RingRig {
  readonly index: number;
  /** Rotates about Y. Bands, rims and sockets are children. */
  readonly group: THREE.Group;
  /** SPOKES anchors at the cell centres (y = SYMBOL_Y) for angle 0. Symbols are parented here. */
  readonly sockets: THREE.Object3D[];
  /** Radians, clockwise-positive. Setter writes group.rotation.y = -angle. */
  angle: number;
  /** 0..1 edge glow (win, hint, drag). */
  glow: number;
  /** 0..1 whirl energy: rims heat up while the ring spins. */
  heat: number;
}

export interface CentralStar {
  readonly group: THREE.Group;
  readonly light: THREE.PointLight;
  /** 0..1 Nova charge: size, whiteness, corona turbulence. */
  charge: number;
  /** 0..2 transient boost (stardust arriving, nova swell). Decays by itself toward 0. */
  energy: number;
  /** World position of the star's centre. */
  readonly position: THREE.Vector3;
}

/** How far the rings rise when unlocked. */
const LIFT = 0.03;

class Ring implements RingRig {
  readonly group = new THREE.Group();
  readonly sockets: THREE.Object3D[] = [];
  readonly uGlow = { value: 0 };
  readonly uHeat = { value: 0 };
  private a = 0;

  constructor(readonly index: number) {
    this.group.name = `ring-${index}`;
    for (let s = 0; s < SPOKES; s++) {
      const o = new THREE.Object3D();
      const ang = s * STEP_ANGLE;
      o.name = `socket-${index}-${s}`;
      o.userData.spoke = s;
      o.position.set(Math.sin(ang) * RING_RADII[index], RING_Y[index] + SYMBOL_Y, -Math.cos(ang) * RING_RADII[index]);
      this.group.add(o);
      this.sockets.push(o);
    }
  }

  get angle(): number {
    return this.a;
  }
  set angle(v: number) {
    this.a = v;
    this.group.rotation.y = -v;
  }
  get glow(): number {
    return this.uGlow.value;
  }
  set glow(v: number) {
    this.uGlow.value = v;
  }
  get heat(): number {
    return this.uHeat.value;
  }
  set heat(v: number) {
    this.uHeat.value = v;
  }
}

export class Orrery {
  readonly group = new THREE.Group();
  readonly rings: RingRig[] = [];
  readonly star: CentralStar;
  /** 0..1 "unlocked" look for the nudge: rings lift a hair, rims shimmer. */
  unlocked = 0;
  /** 0 = base, 1 = Kometnat. Cooler metal, comet-lit. */
  modeBlend = 0;

  private readonly stage: Stage;
  private readonly sun: Star;
  private readonly spoke = new Float32Array(SPOKES);
  private readonly u = {
    uShim: { value: 0 },
    uUnlock: { value: 0 },
    uMode: { value: 0 },
    uUnder: { value: 0.6 },
    uUnderColor: { value: new THREE.Color() },
    uGearT: { value: 0 },
    uCharge: { value: 0 },
    uSpoke: { value: this.spoke },
    uEnDark: { value: new THREE.Color() },
    uEnLight: { value: new THREE.Color() },
    uEnGold: { value: new THREE.Color(PALETTE.gold) },
    uLaneColor: { value: new THREE.Color() },
    uGlow: { value: 0 },
    uHeat: { value: 0 },
  };
  private readonly enamelMats: THREE.MeshPhysicalMaterial[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private quality: Quality;

  // Palette anchors for the mode blend (albedo is lifted so the lit result lands on the palette).
  private readonly cEnDark = [new THREE.Color(PALETTE.enamel).multiplyScalar(1.0), new THREE.Color(PALETTE.nebulaViolet).multiplyScalar(0.24)];
  private readonly cEnLight = [new THREE.Color(PALETTE.enamelLight).multiplyScalar(0.8), new THREE.Color(PALETTE.nebulaTeal).multiplyScalar(0.6)];
  private readonly cUnder = [new THREE.Color(PALETTE.starWarm), new THREE.Color(PALETTE.comet)];
  private readonly cLane = [new THREE.Color(PALETTE.gold), new THREE.Color(PALETTE.comet).lerp(new THREE.Color(PALETTE.starCore), 0.35)];

  constructor(stage: Stage) {
    this.stage = stage;
    const q = (this.quality = stage.quality);
    this.group.name = 'orrery';
    const aniso = Math.min(q === 'low' ? 2 : 8, stage.renderer.capabilities.getMaxAnisotropy());
    const u = this.u;
    const keep = <T extends { dispose(): void }>(x: T): T => {
      this.disposables.push(x);
      return x;
    };
    const brassTex = keep(buildBrassTexture(aniso));

    for (let r = 0; r < RINGS; r++) {
      const ring = new Ring(r);
      const own = { ...u, uGlow: ring.uGlow, uHeat: ring.uHeat };
      const brass = new THREE.Mesh(keep(buildRingBrass(r, q)), keep(makeBrass(brassTex, own)));
      brass.castShadow = true;
      const enamelMat = keep(makeEnamel(keep(buildEnamelTexture(r, aniso)), own, q));
      this.enamelMats.push(enamelMat);
      const enamel = new THREE.Mesh(keep(buildRingEnamel(r, q)), enamelMat);
      enamel.receiveShadow = true;
      ring.group.add(brass, enamel);
      this.group.add(ring.group);
      this.rings.push(ring);
    }

    const fixed = new THREE.Mesh(keep(buildFixedBrass(q)), keep(makeBrass(brassTex, u)));
    fixed.castShadow = true;
    const jewels = new THREE.Mesh(keep(buildJewels(q)), keep(makeJewels({ uSpoke: u.uSpoke, uCharge: u.uCharge, uShim: u.uShim, uEnv: { value: stage.env.cube } })));
    const plate = new THREE.Mesh(keep(buildPlate(q)), keep(makePlate(keep(buildPlateTexture(aniso)), u)));
    plate.receiveShadow = true;
    const clockwork = new THREE.Mesh(keep(buildClockwork(q)), keep(makeBrass(brassTex, u, true)));
    this.group.add(fixed, jewels, plate, clockwork);

    this.sun = new Star(stage);
    this.star = this.sun;
    this.group.add(this.sun.group);
    this.update(0);
  }

  /** 0..1 glow of the fixed spoke marker on the bezel and the lane it points down. */
  setSpokeGlow(spoke: number, v01: number): void {
    this.spoke[((spoke % SPOKES) + SPOKES) % SPOKES] = Math.min(1, Math.max(0, v01));
  }

  update(dt: number): void {
    const stage = this.stage;
    const rm = stage.reducedMotion;
    const u = this.u;
    const sun = this.sun;
    sun.update(dt);
    sun.position.set(0, STAR_Y, 0);
    this.group.localToWorld(sun.position);

    const mode = Math.min(1, Math.max(0, this.modeBlend));
    const un = Math.min(1, Math.max(0, this.unlocked));
    const c = Math.min(1, Math.max(0, sun.charge));
    if (!rm) {
      u.uShim.value = stage.time;
      u.uGearT.value += dt;
    }
    // The light under the rings breathes with the star and swells with its surges.
    u.uUnder.value = Math.min(1.35, 0.5 + 0.3 * c + 0.4 * sun.energy) * (rm ? 1 : 1 + 0.16 * Math.sin(stage.time * 0.9));
    u.uUnlock.value = un;
    u.uMode.value = mode;
    u.uCharge.value = c;
    u.uUnderColor.value.lerpColors(this.cUnder[0], this.cUnder[1], mode);
    u.uEnDark.value.lerpColors(this.cEnDark[0], this.cEnDark[1], mode);
    u.uEnLight.value.lerpColors(this.cEnLight[0], this.cEnLight[1], mode);
    u.uLaneColor.value.lerpColors(this.cLane[0], this.cLane[1], mode);
    for (let r = 0; r < RINGS; r++) this.rings[r].group.position.y = un * LIFT;

    if (stage.quality !== this.quality) {
      // Clearcoat is the one per-fragment cost worth dropping on low.
      this.quality = stage.quality;
      for (const m of this.enamelMats) {
        m.clearcoat = this.quality === 'low' ? 0 : 1;
        m.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
    this.sun.dispose();
  }
}
