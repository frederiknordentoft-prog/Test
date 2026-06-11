import { useMemo } from 'react'
import * as THREE from 'three'
import { APRON_SLOPE, WHEEL } from '../lib/wheel'

/**
 * Everything STATIONARY: outer bowl, banked ball track, apron, deflectors,
 * and the world-angle-zero reference marker. The ball lives in this frame
 * until it is captured by the rotor.
 */

const W = WHEEL

function bowlProfile(): THREE.Vector2[] {
  // Single polyline from the outer bottom, up over the rim, down the banked
  // track and apron, to the inner lip next to the rotor.
  return [
    new THREE.Vector2(W.bowlOuterRadius, 0),
    new THREE.Vector2(W.bowlOuterRadius, W.bowlRimHeight - 0.05),
    new THREE.Vector2(1.0, W.bowlRimHeight),
    new THREE.Vector2(0.97, W.bowlRimHeight - 0.03),
    // banked ball track
    new THREE.Vector2(W.trackOuterRadius, W.trackOuterY),
    new THREE.Vector2(W.trackInnerRadius, W.trackInnerY),
    // small ridge between track and apron
    new THREE.Vector2(W.apronOuterRadius + 0.01, W.apronOuterY + 0.012),
    new THREE.Vector2(W.apronOuterRadius, W.apronOuterY),
    // apron (deflector slope)
    new THREE.Vector2(W.apronInnerRadius, W.apronInnerY),
    // inner lip, straight down beside the rotor
    new THREE.Vector2(0.6, 0.12),
    new THREE.Vector2(0.595, 0),
  ]
}

function Deflectors() {
  const items = useMemo(() => {
    const slopeT = (W.apronOuterRadius - W.deflectorRadius) / (W.apronOuterRadius - W.apronInnerRadius)
    const y = W.apronOuterY - slopeT * (W.apronOuterY - W.apronInnerY)
    return Array.from({ length: W.deflectorCount }, (_, j) => ({
      angle: (j + 0.5) * ((Math.PI * 2) / W.deflectorCount),
      y,
      vertical: j % 2 === 0,
    }))
  }, [])

  return (
    <>
      {items.map(({ angle, y, vertical }, j) => (
        <group key={j} rotation={[0, angle, 0]}>
          {/* tilt to lie on the apron slope, nudged slightly along the surface normal */}
          <mesh
            position={[0, y + 0.005 * Math.cos(APRON_SLOPE), W.deflectorRadius - 0.005 * Math.sin(APRON_SLOPE)]}
            rotation={[-APRON_SLOPE, 0, 0]}
            scale={vertical ? [0.022, 0.075, 0.018] : [0.075, 0.022, 0.018]}
            castShadow
          >
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#cfd2d8" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function BowlGroup() {
  const bowlGeometry = useMemo(() => new THREE.LatheGeometry(bowlProfile(), 128), [])

  return (
    <group name="BowlGroup">
      <mesh geometry={bowlGeometry} receiveShadow castShadow>
        <meshStandardMaterial color="#6e4523" roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* closes the gap under the rotor */}
      <mesh position={[0, -0.011, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.02, 64]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.9} />
      </mesh>

      <Deflectors />

      {/* Reference marker: world angle 0 (+Z). The debug tool rotates the rotor
          so a chosen number sits exactly under this arrow. */}
      <group name="referenceMarker" position={[0, 0.2, (W.numberRingInnerRadius + W.numberRingOuterRadius) / 2]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.02, 0.06, 16]} />
          <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  )
}
