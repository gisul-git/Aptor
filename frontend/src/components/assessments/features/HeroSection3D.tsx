'use client';
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const HeroModel = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Group>(null);
  useFrame((state) => { if (meshRef.current) meshRef.current.rotation.y += 0.01; });
  return <group ref={meshRef}><primitive object={scene} scale={1.3} position={[0, -1.0, 0]} rotation={[0, 0, 0]} /></group>;
};

export const HeroSection3D = () => (
  <div 
    className="relative w-full h-[300px] -mt-10 mb-4 animate-logo-pop pointer-events-none" 
    style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}
  >
    <Canvas camera={{ position: [0, 0, 7], fov: 40 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}><Suspense fallback={null}><HeroModel url="/hero-model.glb" /></Suspense></Float>
        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2.5} far={4} color="#1E5A3B" />
        <Environment preset="city" />
    </Canvas>
  </div>
);