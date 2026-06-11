import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

function SpinningCube() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * 0.6
    ref.current.rotation.y += delta * 0.9
  })
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3e6b5e" roughness={0.5} metalness={0.1} />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas
      shadows="percentage"
      camera={{ position: [0, 1, 3.5], fov: 60 }}
      gl={{
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
        antialias: true,
      }}
    >
      <color attach="background" args={['#23282e']} />
      <ambientLight intensity={0.3} color="#5a6b78" />
      <directionalLight
        position={[4, 6, 3]}
        intensity={2.5}
        color="#ffd9a0"
        castShadow
      />
      <SpinningCube />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#8a8784" roughness={0.9} />
      </mesh>
    </Canvas>
  )
}
