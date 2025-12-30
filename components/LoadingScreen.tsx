
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, Float, ContactShadows, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

const TechCore = () => {
    const coreRef = useRef<THREE.Group>(null);
    const outerRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.y = t * 0.5;
        }
        if (outerRef.current) {
            outerRef.current.rotation.x = t * 0.3;
            outerRef.current.rotation.z = t * 0.2;
        }
        if (innerRef.current) {
            innerRef.current.rotation.x = -t * 0.5;
            innerRef.current.rotation.y = -t * 0.4;
        }
    });

    return (
        <group ref={coreRef}>
            {/* Central Intelligent Core */}
            <mesh ref={innerRef}>
                <octahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                    color="#3b82f6"
                    emissive="#1d4ed8"
                    emissiveIntensity={2}
                    metalness={1}
                    roughness={0}
                />
            </mesh>

            {/* Outer Tech Shell - Wireframe */}
            <mesh ref={outerRef}>
                <boxGeometry args={[2.5, 2.5, 2.5]} />
                <meshStandardMaterial
                    color="#6366f1"
                    wireframe
                    transparent
                    opacity={0.3}
                />
            </mesh>

            {/* Floating Data Points */}
            {Array.from({ length: 12 }).map((_, i) => (
                <Float key={i} speed={2} rotationIntensity={2} floatIntensity={1}>
                    <mesh position={[
                        Math.sin(i * 1.5) * 3,
                        Math.cos(i * 1.5) * 3,
                        Math.sin(i * 3) * 1
                    ]}>
                        <sphereGeometry args={[0.05, 16, 16]} />
                        <meshBasicMaterial color="#3b82f6" />
                    </mesh>
                </Float>
            ))}
        </group>
    );
};

const GridFloor = () => {
    const gridRef = useRef<THREE.LineSegments>(null);

    useFrame((state) => {
        if (gridRef.current) {
            gridRef.current.position.z = (state.clock.getElapsedTime() * 0.5) % 2;
        }
    });

    return (
        <group position={[0, -2, 0]}>
            <gridHelper args={[40, 20, '#1e293b', '#0f172a']} ref={gridRef} />
        </group>
    );
};

const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 overflow-hidden">
            {/* Sophisticated Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,rgba(2,6,23,1)_70%)]" />

            <div className="relative flex flex-col items-center justify-center w-full max-w-2xl">
                {/* 3D Content Wrapper - Centered vertically and broadened for context */}
                <div className="w-full h-[400px] md:h-[500px]">
                    <Canvas shadows>
                        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={30} />
                        <ambientLight intensity={0.2} />
                        <pointLight position={[10, 10, 10]} intensity={1.5} color="#3b82f6" />
                        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />

                        <TechCore />
                        <GridFloor />

                        <ContactShadows
                            position={[0, -2, 0]}
                            opacity={0.5}
                            scale={20}
                            blur={3}
                            far={4.5}
                        />

                        <Environment preset="night" />
                    </Canvas>
                </div>

                {/* Branding Content - Positioned relatively to the core with precise spacing */}
                <div className="mt-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-px bg-gradient-to-r from-transparent to-blue-500/50" />
                        <h2 className="text-xl md:text-2xl font-black text-white tracking-[0.4em] uppercase opacity-90">
                            Store Navigator
                        </h2>
                        <div className="w-8 h-px bg-gradient-to-l from-transparent to-blue-500/50" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.5em] opacity-80">
                            Powered by Impact Analytics
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
