import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { POCKET_COUNT, POCKET_STEP, WHEEL } from '../lib/wheel'
import { makeNumberRingTexture, makePocketFloorTexture } from '../lib/textures'
import { useWheelStore } from '../store'

/**
 * Everything that ROTATES: pocket floors, frets, number ring, center cone +
 * turret. Only this group's rotation.y changes to set the outcome.
 */

const W = WHEEL
const POCKET_MID_RADIUS = (W.pocketInnerRadius + W.pocketOuterRadius) / 2
const FRET_LENGTH = W.pocketOuterRadius - W.pocketInnerRadius

function Frets() {
  const ref = useRef<THREE.InstancedMesh>(null!)

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < POCKET_COUNT; i++) {
      // frets sit on the pocket boundaries, halfway between pocket centers
      const a = (i + 0.5) * POCKET_STEP
      dummy.position.set(
        Math.sin(a) * POCKET_MID_RADIUS,
        W.pocketFloorY + W.fretHeight / 2,
        Math.cos(a) * POCKET_MID_RADIUS,
      )
      dummy.rotation.set(0, a, 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, POCKET_COUNT]} castShadow receiveShadow>
      <boxGeometry args={[W.fretWidth, W.fretHeight, FRET_LENGTH]} />
      <meshStandardMaterial color="#d4d6dc" metalness={0.9} roughness={0.3} />
    </instancedMesh>
  )
}

export function RotorGroup() {
  const groupRef = useRef<THREE.Group>(null!)

  const numberRingTexture = useMemo(() => makeNumberRingTexture(), [])
  const pocketFloorTexture = useMemo(() => makePocketFloorTexture(), [])

  const numberRingGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(W.numberRingInnerRadius, W.numberRingInnerY),
          new THREE.Vector2(W.numberRingOuterRadius, W.numberRingOuterY),
        ],
        296,
      ),
    [],
  )

  const pocketFloorGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(W.pocketInnerRadius, W.pocketFloorY + 0.001),
          new THREE.Vector2(W.pocketOuterRadius, W.pocketFloorY + 0.001),
        ],
        296,
      ),
    [],
  )

  const coneGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(W.pocketInnerRadius, W.coneBaseY),
          new THREE.Vector2(0.2, 0.105),
          new THREE.Vector2(0.105, 0.135),
          // decorative turret / spindle
          new THREE.Vector2(0.095, 0.165),
          new THREE.Vector2(0.04, 0.185),
          new THREE.Vector2(0.055, 0.215),
          new THREE.Vector2(0.022, 0.245),
          new THREE.Vector2(0.034, 0.275),
          new THREE.Vector2(0.0005, W.turretTopY),
        ],
        96,
      ),
    [],
  )

  // Drive rotation from the store every frame (later phases animate this value).
  useFrame(() => {
    groupRef.current.rotation.y = useWheelStore.getState().rotorAngle
  })

  return (
    <group name="RotorGroup" ref={groupRef}>
      {/* base disc */}
      <mesh position={[0, -0.01, 0]}>
        <cylinderGeometry args={[W.rotorRadius, W.rotorRadius, 0.02, 96]} />
        <meshStandardMaterial color="#241409" roughness={0.6} />
      </mesh>

      {/* pocket floors (colored per number) */}
      <mesh geometry={pocketFloorGeometry} receiveShadow>
        <meshStandardMaterial map={pocketFloorTexture} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* pocket outer wall (under the number ring) */}
      <mesh position={[0, (W.pocketFloorY + W.numberRingInnerY) / 2, 0]}>
        <cylinderGeometry
          args={[
            (W.pocketOuterRadius + W.numberRingInnerRadius) / 2,
            (W.pocketOuterRadius + W.numberRingInnerRadius) / 2,
            W.numberRingInnerY - W.pocketFloorY,
            96,
            1,
            true,
          ]}
        />
        <meshStandardMaterial color="#1c1c20" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* pocket inner wall (under the cone) */}
      <mesh position={[0, (W.pocketFloorY + W.coneBaseY) / 2, 0]}>
        <cylinderGeometry
          args={[W.pocketInnerRadius, W.pocketInnerRadius, W.coneBaseY - W.pocketFloorY, 96, 1, true]}
        />
        <meshStandardMaterial color="#1c1c20" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* number ring (conical, textured) */}
      <mesh geometry={numberRingGeometry} receiveShadow>
        <meshStandardMaterial map={numberRingTexture} roughness={0.45} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* polished rotor rim band */}
      <mesh position={[0, W.numberRingOuterY - 0.03, 0]}>
        <cylinderGeometry args={[W.rotorRadius + 0.004, W.rotorRadius + 0.004, 0.08, 96, 1, true]} />
        <meshStandardMaterial color="#8a6a3a" metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>

      <Frets />

      {/* center cone + turret */}
      <mesh geometry={coneGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#b8b9bf" metalness={0.85} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
