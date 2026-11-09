/** Placeholder board to validate the stage: framing, bloom, tone curve, picking. */
import * as THREE from 'three';
import { BEZEL_INNER, BEZEL_OUTER, FIT_RADIUS, HUB_RADIUS, RING_RADII, RING_WIDTH, RINGS, SPOKES, SYMBOLS, SYMBOL_DIAMETER, SYMBOL_Y, cellXZ } from '../core/config';
import { createSandbox, sandboxReady } from './harness';

const { stage, onUpdate } = createSandbox();
const brass = new THREE.MeshStandardMaterial({ color: 0xb8923f, metalness: 1, roughness: 0.32 });
const enamel = new THREE.MeshStandardMaterial({ color: 0x0a1230, metalness: 0.2, roughness: 0.25 });

for (let r = 0; r < RINGS; r++) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_RADII[r] - RING_WIDTH / 2, RING_RADII[r] + RING_WIDTH / 2, 96), enamel);
  ring.rotation.x = -Math.PI / 2;
  ring.receiveShadow = true;
  stage.scene.add(ring);
  for (const edge of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_RADII[r] + (edge * RING_WIDTH) / 2, 0.035, 12, 128), brass);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    stage.scene.add(rim);
  }
  for (let s = 0; s < SPOKES; s++) {
    const meta = SYMBOLS[(r * 3 + s * 5) % 8];
    const { x, z } = cellXZ(r, s);
    const gem = new THREE.Mesh(
      new THREE.IcosahedronGeometry(SYMBOL_DIAMETER[r] / 2, 0),
      new THREE.MeshStandardMaterial({ color: meta.color, emissive: meta.color, emissiveIntensity: 0.55, metalness: 0.0, roughness: 0.22, flatShading: true }),
    );
    gem.position.set(x, SYMBOL_Y + 0.0, z);
    gem.castShadow = true;
    stage.scene.add(gem);
  }
}
const bezel = new THREE.Mesh(new THREE.RingGeometry(BEZEL_INNER, BEZEL_OUTER, 128), brass);
bezel.rotation.x = -Math.PI / 2;
stage.scene.add(bezel);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS, 0.2, 48), brass);
stage.scene.add(hub);
const star = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c8).multiplyScalar(6) }));
star.position.y = 0.45;
stage.scene.add(star);

// Fit guide: thin circle at FIT_RADIUS (should touch the free rect's edges).
const guide = new THREE.Mesh(new THREE.RingGeometry(FIT_RADIUS - 0.01, FIT_RADIUS + 0.01, 128), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
guide.rotation.x = -Math.PI / 2;
stage.scene.add(guide);

onUpdate(() => {
  star.scale.setScalar(1 + Math.sin(stage.time * 2) * 0.05);
});
sandboxReady();
