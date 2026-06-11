import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { BowlGroup } from './BowlGroup'
import { RotorGroup } from './RotorGroup'

// dev convenience: ?cam=top gives a straight top-down view for checking the
// number <-> angle mapping in screenshots
const TOP_DOWN = new URLSearchParams(window.location.search).get('cam') === 'top'

export function Scene() {
  return (
    <Canvas
      shadows
      camera={{ position: TOP_DOWN ? [0, 2.4, 0.0001] : [0, 1.5, 1.9], fov: 42 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <color attach="background" args={['#0e0e12']} />

      {/* placeholder lighting; Phase 3 replaces this with HDRI + key light */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[2.5, 4, 2]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={10}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
      />
      <pointLight position={[-2, 2.5, -2]} intensity={0.6} />

      <BowlGroup />
      <RotorGroup />

      <OrbitControls
        target={[0, 0.1, 0]}
        minDistance={0.7}
        maxDistance={5}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
      />
    </Canvas>
  )
}
