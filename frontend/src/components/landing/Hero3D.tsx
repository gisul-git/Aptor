'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Float, MeshDistortMaterial, Sphere, Torus, Box } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

function DistortedSphere() {
  const meshRef = useRef<any>()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere ref={meshRef} args={[1, 64, 64]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#C9F4D4"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  )
}

function RotatingTorus() {
  const meshRef = useRef<any>()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.5
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <Torus ref={meshRef} args={[2, 0.3, 16, 100]} position={[0, 0, 0]}>
      <meshStandardMaterial
        color="#A8E8BC"
        metalness={0.6}
        roughness={0.3}
        wireframe
      />
    </Torus>
  )
}

function FloatingBox({ position, color }: { position: [number, number, number], color: string }) {
  const meshRef = useRef<any>()
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.3
    }
  })

  return (
    <Box ref={meshRef} args={[0.5, 0.5, 0.5]} position={position}>
      <meshStandardMaterial
        color={color}
        metalness={0.7}
        roughness={0.2}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </Box>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -10]} color="#9DE8B0" intensity={0.5} />
      <pointLight position={[10, 10, 10]} color="#D4E4F7" intensity={0.5} />
      <spotLight
        position={[0, 5, 0]}
        angle={0.5}
        penumbra={1}
        intensity={0.5}
        castShadow
      />
    </>
  )
}

export default function Hero3D() {
  return (
    <div className="w-full h-[500px] md:h-[600px] hero-3d-object">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Lights />
        <DistortedSphere />
        <RotatingTorus />
        <FloatingBox position={[-3, 2, 0]} color="#B0EFC0" />
        <FloatingBox position={[3, -2, 0]} color="#9DE8B0" />
        <FloatingBox position={[2, 2, -2]} color="#C9F4D4" />
        <Environment preset="sunset" />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}

