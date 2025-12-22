
import React, { useMemo, useEffect, useState, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, Environment, Grid, Line, Float, ContactShadows, useProgress, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { StoreConfig, Product, PathNode, Department, Shelf } from '../types';
import { Loader2 } from 'lucide-react';

interface Store3DProps {
  config: StoreConfig;
  targetProduct: Product | null;
  path: PathNode[];
  currentFloor: number;
  allProducts?: Product[];
  showAllProducts?: boolean;
  showLabels?: boolean;
  targetDepartmentId?: string | null;
  disableFocus?: boolean;
}

const DEPARTMENT_COLORS = [
  '#f59e0b', // Amber (Bakery/Deli)
  '#10b981', // Emerald (Fresh/Produce)
  '#3b82f6', // Blue (Frozen/Dairy)
  '#8b5cf6', // Violet (Beauty/Health)
  '#ec4899', // Pink (Kids/Toys)
  '#06b6d4', // Cyan (Electronics)
  '#f97316', // Orange (Snacks)
  '#ef4444', // Red (Meats)
  '#6366f1', // Indigo (Home)
  '#84cc16', // Lime (Garden)
];

const Loader = () => {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4 bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white">
        <Loader2 className="text-blue-600 animate-spin" size={40} />
        <div className="text-center">
          <p className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-1">Constructing 3D Space</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{Math.round(progress)}% Loaded</p>
        </div>
      </div>
    </Html>
  );
};

const Door: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.25, 0]}>
      <boxGeometry args={[3.2, 2.5, 0.2]} />
      <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 1.15, 0]}>
      <boxGeometry args={[2.8, 2.2, 0.1]} />
      <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} metalness={1} roughness={0} />
    </mesh>
  </group>
);

const Elevator: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.25, 0]}>
      <boxGeometry args={[4, 2.5, 4]} />
      <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
    </mesh>
    <mesh position={[0, 1.25, 2.05]}>
      <boxGeometry args={[3, 2.2, 0.1]} />
      <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0.2} />
    </mesh>
    <Billboard
      position={[0, 2.6, 2.1]}
    >
      <Text fontSize={0.5} color="#1e40af" fontWeight="black" outlineWidth={0.03} outlineColor="#ffffff">ELEVATOR</Text>
    </Billboard>
  </group>
);

const AnimatedProductRow: React.FC<{ position: [number, number, number]; args: [number, number, number]; color: string; isHighlight: boolean }> = ({ position, args, color, isHighlight }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const startColor = useMemo(() => new THREE.Color(color), [color]);
  const highlightColor = useMemo(() => new THREE.Color('#fbbf24'), []); // Amber Highlight

  useFrame((state) => {
    if (isHighlight && materialRef.current) {
      const t = (Math.sin(state.clock.elapsedTime * 8) + 1) / 2; // 0 to 1
      materialRef.current.color.lerpColors(startColor, highlightColor, t);
      materialRef.current.emissive.set(highlightColor);
      materialRef.current.emissiveIntensity = t * 0.8;
    } else if (materialRef.current) {
      materialRef.current.color.copy(startColor);
      materialRef.current.emissiveIntensity = 0;
    }
  });

  return (
    <mesh position={position} ref={meshRef}>
      <boxGeometry args={args} />
      <meshStandardMaterial ref={materialRef} color={color} />
    </mesh>
  );
};

const DetailedShelfUnit: React.FC<{
  width: number;
  height: number;
  depth: number;
  frontConfig?: { color: string; isTarget: boolean; targetLevels?: number[]; name: string; levelCount: number };
  backConfig?: { color: string; isTarget: boolean; targetLevels?: number[]; name: string; levelCount: number };
}> = ({ width, height, depth, frontConfig, backConfig }) => {
  const shelfCount = Math.max(frontConfig?.levelCount || 5, backConfig?.levelCount || 5);
  const shelfThickness = 0.05;
  const shelfSpacing = (height - 0.2) / shelfCount;

  return (
    <group>
      {/* Vertical Uprights (T-Posts) - Open Sides */}
      <group>
        <mesh position={[-width / 2 + 0.04, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, height, 0.15]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-width / 2 + 0.04, -height / 2 + 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.2, depth - 0.1]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>

        <mesh position={[width / 2 - 0.04, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, height, 0.15]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[width / 2 - 0.04, -height / 2 + 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.2, depth - 0.1]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Central Divider (Gondola Backing) */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.1, height, 0.05]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      {/* Horizontal Shelves & Products */}
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = -height / 2 + 0.2 + (i * shelfSpacing);

        const showFront = frontConfig && i < frontConfig.levelCount;
        const frontHighlight = showFront && frontConfig.targetLevels?.includes(i);
        const showBack = backConfig && i < backConfig.levelCount;
        const backHighlight = showBack && backConfig.targetLevels?.includes(i);

        return (
          <group key={i} position={[0, y, 0]}>
            {/* Shelf Board */}
            <mesh receiveShadow castShadow>
              <boxGeometry args={[width - 0.04, shelfThickness, depth]} />
              <meshStandardMaterial color="#475569" metalness={0.1} roughness={0.8} />
            </mesh>

            {/* Front Products */}
            {showFront && i < shelfCount - 1 && (
              <group>
                <AnimatedProductRow
                  position={[0, 0.2, depth / 4]}
                  args={[width - 0.2, 0.35, depth / 2 - 0.2]}
                  color={frontConfig.color}
                  isHighlight={!!frontHighlight}
                />
              </group>
            )}

            {/* Back Products */}
            {showBack && i < shelfCount - 1 && (
              <group>
                <AnimatedProductRow
                  position={[0, 0.2, -depth / 4]}
                  args={[width - 0.2, 0.35, depth / 2 - 0.2]}
                  color={backConfig.color}
                  isHighlight={!!backHighlight}
                />
              </group>
            )}
          </group>
        );
      })}

      {/* Highlight Frame */}
      {(frontConfig?.isTarget || backConfig?.isTarget) && (
        <group>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[width + 0.2, height + 0.2, depth + 0.2]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(width + 0.2, height + 0.2, depth + 0.2)]} />
            <lineBasicMaterial color="#3b82f6" linewidth={2} transparent opacity={0.6} />
          </lineSegments>
        </group>
      )}
    </group>
  );
};

const DepartmentComponent: React.FC<{ department: Department; isTarget: boolean; targetProduct?: Product | null; disableFocus?: boolean }> = ({ department, isTarget, targetProduct, disableFocus }) => {
  const shelfPairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < department.shelves.length; i += 2) {
      pairs.push([department.shelves[i], department.shelves[i + 1]]);
    }
    return pairs;
  }, [department.shelves]);

  const unitWidth = department.width / shelfPairs.length;
  const UNIT_HEIGHT = 2.2;
  const Y_SHIFT = 0.35;

  return (
    <group position={[department.column + department.width / 2, 0.75, department.row + department.depth / 2]}>
      <mesh castShadow receiveShadow position={[0, -0.7, 0]}>
        <boxGeometry args={[department.width, 0.1, department.depth]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      {shelfPairs.map((pair, idx) => {
        const frontShelf = pair[0];
        const backShelf = pair[1]; // may be undefined
        const xPos = -department.width / 2 + unitWidth / 2 + (idx * unitWidth);

        const getShelfConfig = (shelf: Shelf | undefined) => {
          if (!shelf) return undefined;
          const isTargetShelf = isTarget && targetProduct?.shelfId === shelf.id;
          const deptHash = department.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const themeColor = DEPARTMENT_COLORS[deptHash % DEPARTMENT_COLORS.length];
          return {
            color: themeColor,
            isTarget: isTargetShelf,
            targetLevels: isTargetShelf ? targetProduct?.levels : undefined,
            name: shelf.name,
            levelCount: shelf.levelCount || 5
          };
        };

        const frontConfig = getShelfConfig(frontShelf);
        const backConfig = getShelfConfig(backShelf);

        return (
          <group key={frontShelf.id} position={[xPos, Y_SHIFT, 0]}>
            <DetailedShelfUnit
              width={unitWidth - 0.4}
              height={UNIT_HEIGHT}
              depth={department.depth - 0.5}
              frontConfig={frontConfig}
              backConfig={backConfig}
            />

            {/* Labels - Front */}
            {frontConfig && (
              <group position={[0, UNIT_HEIGHT / 2 + 0.3, department.depth / 2 - 0.25]}>
                <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000">
                  {frontConfig.name}
                </Text>
              </group>
            )}

            {/* Labels - Back */}
            {backConfig && (
              <group position={[0, UNIT_HEIGHT / 2 + 0.3, -department.depth / 2 + 0.25]}>
                <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000" rotation={[0, Math.PI, 0]}>
                  {backConfig.name}
                </Text>
              </group>
            )}
          </group>
        );
      })}
      {/* Department Name Label - Raised higher */}
      <Billboard position={[0, 2.8, 0]}>
        <Text
          fontSize={0.6}
          color="#1e293b"
          fontWeight="black"
          anchorY="bottom"
          outlineWidth={0.08}
          outlineColor="#ffffff"
        >
          {department.name.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
};

const PathLine: React.FC<{ points: PathNode[]; currentFloor: number }> = ({ points, currentFloor }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    let start = Date.now();
    const duration = 800; // Faster path drawing
    const animate = () => {
      const elapsed = Date.now() - start;
      const nextProgress = Math.min(1, elapsed / duration);
      setProgress(nextProgress);
      if (nextProgress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [points, currentFloor]);

  const animatedPoints = useMemo(() => {
    const floorPoints = points.filter(p => p.floor === currentFloor);
    if (floorPoints.length < 2) return [];
    const currentCount = Math.max(2, Math.floor(floorPoints.length * progress));
    return floorPoints.slice(0, currentCount).map(p => new THREE.Vector3(p.x, 0.02, p.z));
  }, [points, progress, currentFloor]);

  if (animatedPoints.length < 2) return null;
  return (
    <group>
      <Line points={animatedPoints} color="#3b82f6" lineWidth={12} transparent opacity={0.9} />
      <Line points={animatedPoints} color="#93c5fd" lineWidth={26} transparent opacity={0.3} />
    </group>
  );
};

const WalkingAvatar: React.FC<{ points: PathNode[]; currentFloor: number }> = ({ points, currentFloor }) => {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);

  const floorPoints = useMemo(() => points.filter(p => p.floor === currentFloor), [points, currentFloor]);

  useFrame((state) => {
    if (!group.current || floorPoints.length < 2) return;

    // Looping walking path (12s walk + 3s wait)
    const cycleTime = 15;
    const t = (state.clock.elapsedTime % cycleTime) / cycleTime;
    const walkProgress = Math.min(1, t * (cycleTime / 12)); // Walk for first 12s

    const totalPoints = floorPoints.length;
    const pathTotalDist = totalPoints - 1;

    // Find index, but cap it so we stop ~1.2 units before the final "touching" point
    const stopOffset = totalPoints > 5 ? 1.2 / pathTotalDist : 0.1;
    const cappedT = walkProgress * (1 - stopOffset);

    const exactIndex = cappedT * pathTotalDist;
    const index = Math.floor(exactIndex);
    const nextIndex = Math.min(index + 1, totalPoints - 1);
    const alpha = exactIndex - index;

    const p1 = floorPoints[index];
    const p2 = floorPoints[nextIndex];

    if (p1 && p2) {
      const currentPos = new THREE.Vector3(
        p1.x + (p2.x - p1.x) * alpha,
        0,
        p1.z + (p2.z - p1.z) * alpha
      );
      group.current.position.copy(currentPos);

      const lookTarget = (walkProgress < 1) ? new THREE.Vector3(p2.x, 0, p2.z) : new THREE.Vector3(floorPoints[totalPoints - 1].x, 0, floorPoints[totalPoints - 1].z);
      if (group.current.position.distanceTo(lookTarget) > 0.05) {
        const targetRotation = new THREE.Matrix4().lookAt(lookTarget, currentPos, new THREE.Vector3(0, 1, 0));
        const q = new THREE.Quaternion().setFromRotationMatrix(targetRotation);
        group.current.quaternion.slerp(q, 0.1);
      }
    }

    // Walking animation cycle (only while walking)
    const isWalking = walkProgress < 1 && walkProgress > 0;
    const speedMultiplier = 4.0;
    const swingFactor = isWalking ? Math.sin(state.clock.elapsedTime * speedMultiplier) : 0;
    const legSwing = swingFactor * 0.4;
    const armSwing = -swingFactor * 0.35;
    const bounce = isWalking ? Math.abs(Math.cos(state.clock.elapsedTime * speedMultiplier)) * 0.05 : 0;

    if (leftLeg.current) leftLeg.current.rotation.x = legSwing;
    if (rightLeg.current) rightLeg.current.rotation.x = -legSwing;
    if (leftArm.current) leftArm.current.rotation.x = armSwing;
    if (rightArm.current) rightArm.current.rotation.x = -armSwing;

    if (group.current.children[0]) {
      // Apply bounce to the torso/head
      group.current.children[0].position.y = bounce;
      // Subtract bounce from legs to keep them grounded (pivot stays at 0.95 world height)
      if (leftLeg.current) leftLeg.current.position.y = 0.95 - bounce;
      if (rightLeg.current) rightLeg.current.position.y = 0.95 - bounce;
      // Slight side-to-side sway
      group.current.children[0].rotation.z = swingFactor * 0.02;
    }
  });

  if (floorPoints.length < 2) return null;

  return (
    <group ref={group}>
      <group>
        {/* Torso - Shirt */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.38, 0.55, 0.22]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        {/* Head & Neck */}
        <group position={[0, 1.6, 0]}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.12, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
        {/* Legs - Pants */}
        <group ref={leftLeg} position={[-0.11, 0.95, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <boxGeometry args={[0.16, 0.9, 0.16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, -0.9, 0.06]} castShadow>
            <boxGeometry args={[0.17, 0.1, 0.28]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.11, 0.95, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <boxGeometry args={[0.16, 0.9, 0.16]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, -0.9, 0.06]} castShadow>
            <boxGeometry args={[0.17, 0.1, 0.28]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
        {/* Arms */}
        <group ref={leftArm} position={[-0.26, 1.45, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.26, 1.45, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        </group>
      </group>
      <ContactShadows opacity={0.6} scale={4} blur={2.8} far={1} />
    </group>
  );
};

const ProductMarker: React.FC<{ product: Product; department: Department; type?: 'default' | 'ai'; showLabel?: boolean }> = ({ product, department, type = 'default', showLabel = false }) => {
  const markerColor = type === 'ai' ? '#6366f1' : '#facc15';
  const pos = useMemo(() => {
    const shelfIndex = department.shelves.findIndex(s => s.id === product.shelfId);
    const validShelfIndex = shelfIndex === -1 ? 0 : shelfIndex;

    const pairIndex = Math.floor(validShelfIndex / 2);
    const isBack = validShelfIndex % 2 === 1;

    const numPairs = Math.ceil(department.shelves.length / 2);
    const unitWidth = department.width / numPairs;

    const offsetX = department.column + (pairIndex * unitWidth) + (unitWidth / 2);
    // Front is +Z, Back is -Z relative to unit center.
    // Unit center Z is department.row + department.depth/2
    const offsetZ = isBack
      ? (department.row + department.depth / 2) - ((department.depth - 0.5) / 4)
      : (department.row + department.depth / 2) + ((department.depth - 0.5) / 4);

    return { x: offsetX, z: offsetZ };
  }, [department, product]);

  return (
    <group position={[pos.x, 0.5, pos.z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshStandardMaterial color={markerColor} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[type === 'ai' ? 0.25 : 0.15, 16, 16]} />
        <meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={1} />
      </mesh>
      {showLabel && (
        <Billboard
          position={[0, 1.4, 0]}
        >
          <Text
            fontSize={0.35}
            color={markerColor}
            fontWeight="black"
            anchorY="bottom"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            {type === 'ai' ? `✨ ${product.name}` : product.name}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

const CameraController: React.FC<{ config: StoreConfig; targetPoint: THREE.Vector3 | null }> = ({ config, targetPoint }) => {
  const { camera, controls } = useThree();
  const centerX = config.gridSize.width / 2;
  const centerZ = config.gridSize.depth / 2;

  const lastTargetKeyRef = useRef<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const targetPointRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const defaultPosition = useMemo(() => {
    const size = Math.max(config.gridSize.width, config.gridSize.depth);
    return new THREE.Vector3(0, size * 1.2, size * 1.2);
  }, [config.gridSize]);

  useEffect(() => {
    const targetKey = targetPoint ? `${targetPoint.x},${targetPoint.y},${targetPoint.z}` : 'default';
    if (targetKey !== lastTargetKeyRef.current) {
      lastTargetKeyRef.current = targetKey;
      setIsAnimating(true);
      if (targetPoint) targetPointRef.current.copy(targetPoint);
      else targetPointRef.current.copy(defaultTarget);
    }
  }, [targetPoint, defaultTarget]);

  useFrame(() => {
    if (!controls || !isAnimating) return;

    const target = targetPoint ? targetPointRef.current : defaultTarget;
    const posTarget = targetPoint
      ? new THREE.Vector3(targetPoint.x, targetPoint.y + 8, targetPoint.z + 8)
      : defaultPosition;

    (controls as any).target.lerp(target, 0.1);
    camera.position.lerp(posTarget, 0.1);
    (controls as any).update();

    if (camera.position.distanceTo(posTarget) < 0.1 && (controls as any).target.distanceTo(target) < 0.1) {
      setIsAnimating(false);
    }
  });

  return null;
};

const StoreScene: React.FC<Store3DProps> = ({ config, targetProduct, path, currentFloor, allProducts = [], showAllProducts = false, showLabels = false, targetDepartmentId, disableFocus }) => {
  const centerX = config.gridSize.width / 2;
  const centerZ = config.gridSize.depth / 2;

  const selectedDepartment = useMemo(() => config.departments.find(d => d.id === targetDepartmentId), [config.departments, targetDepartmentId]);
  const targetDepartment = useMemo(() => config.departments.find(d => d.id === targetProduct?.departmentId), [config.departments, targetProduct]);

  const cameraTargetPoint = useMemo(() => {
    let point: THREE.Vector3 | null = null;
    if (targetProduct && targetDepartment) {
      const idx = targetDepartment.shelves.findIndex(s => s.id === targetProduct.shelfId);
      const validIdx = idx === -1 ? 0 : idx;

      const pairIndex = Math.floor(validIdx / 2);
      const isBack = validIdx % 2 === 1;
      const numPairs = Math.ceil(targetDepartment.shelves.length / 2);
      const unitWidth = targetDepartment.width / numPairs;

      const x = targetDepartment.column + (pairIndex * unitWidth) + (unitWidth / 2);
      const z = isBack
        ? (targetDepartment.row + targetDepartment.depth / 2) - ((targetDepartment.depth - 0.5) / 4)
        : (targetDepartment.row + targetDepartment.depth / 2) + ((targetDepartment.depth - 0.5) / 4);

      point = new THREE.Vector3(x, 0, z);

    } else if (selectedDepartment) {
      point = new THREE.Vector3(selectedDepartment.column + selectedDepartment.width / 2, 0, selectedDepartment.row + selectedDepartment.depth / 2);
    }

    if (point) {
      // Convert to world coordinates (centered)
      return new THREE.Vector3(point.x - centerX, 0, point.z - centerZ);
    }
    return null;
  }, [targetProduct, targetDepartment, selectedDepartment, centerX, centerZ]);

  const floorProducts = useMemo(() => {
    if (!showAllProducts) return [];
    return allProducts.filter(p => {
      const d = config.departments.find(sh => sh.id === p.departmentId);
      return d && d.floor === currentFloor && p.id !== targetProduct?.id;
    });
  }, [allProducts, showAllProducts, config.departments, currentFloor, targetProduct]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} />
      <OrbitControls makeDefault minDistance={3} maxDistance={300} maxPolarAngle={Math.PI / 2.2} />
      <CameraController config={config} targetPoint={disableFocus ? null : cameraTargetPoint} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[10, 50, 10]} intensity={1.8} castShadow />
      <Suspense fallback={<Loader />}>
        <Environment preset="city" />

        <group position={[-centerX, 0, -centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.01, centerZ]} receiveShadow>
            <planeGeometry args={[config.gridSize.width + 500, config.gridSize.depth + 500]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </mesh>
          <Grid position={[centerX, 0, centerZ]} args={[config.gridSize.width, config.gridSize.depth]} cellSize={1} sectionSize={5} sectionColor="#cbd5e1" cellColor="#e2e8f0" infiniteGrid={false} />

          {/* Perimeter Boundary */}
          <Line
            points={[
              [0, 0.05, 0],
              [config.gridSize.width, 0.05, 0],
              [config.gridSize.width, 0.05, config.gridSize.depth],
              [0, 0.05, config.gridSize.depth],
              [0, 0.05, 0]
            ]}
            color="#3b82f6"
            lineWidth={3}
          />
          <Line
            points={[
              [0, 0.05, 0],
              [config.gridSize.width, 0.05, 0],
              [config.gridSize.width, 0.05, config.gridSize.depth],
              [0, 0.05, config.gridSize.depth],
              [0, 0.05, 0]
            ]}
            color="#93c5fd"
            lineWidth={1}
            transparent
            opacity={0.5}
          />

          {config.entrance.floor === currentFloor && (
            <group position={[config.entrance.x, 0, config.entrance.z]}>
              <Door position={[0, 0, 0]} />
              <Billboard position={[0, 2.8, 0]}>
                <Text fontSize={0.6} color="#166534" fontWeight="black">ENTRANCE</Text>
              </Billboard>
            </group>
          )}

          {config.elevators.map((e, idx) => (
            <Elevator key={`elevator-${idx}`} position={[e.x, 0, e.z]} />
          ))}

          {config.departments.filter(d => d.floor === currentFloor).map(d => <DepartmentComponent key={d.id} department={d} isTarget={targetProduct?.departmentId === d.id || targetDepartmentId === d.id} targetProduct={targetProduct} disableFocus={disableFocus} />)}

          <PathLine points={path} currentFloor={currentFloor} />
          <WalkingAvatar points={path} currentFloor={currentFloor} />

          {floorProducts.map(p => <ProductMarker key={p.id} product={p} department={config.departments.find(d => d.id === p.departmentId)!} type="ai" showLabel={showLabels} />)}

          {targetDepartment && targetProduct && targetDepartment.floor === currentFloor && cameraTargetPoint && (
            <group position={[cameraTargetPoint.x + centerX, 0, cameraTargetPoint.z + centerZ]}>
              <mesh position={[0, 2, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
                <meshStandardMaterial color="#ef4444" transparent opacity={0.3} />
              </mesh>
              <group position={[0, 4, 0]}>
                <mesh rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.6, 1.2, 4]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} />
                </mesh>
                <Billboard position={[0, 1.5, 0]}>
                  <Text fontSize={1} color="#dc2626" fontWeight="black" outlineWidth={0.05} outlineColor="#ffffff">
                    {targetProduct.name.toUpperCase()}
                  </Text>
                </Billboard>
              </group>
            </group>
          )}
        </group>
      </Suspense>
    </>
  );
};

const Store3D: React.FC<Store3DProps> = (props) => (
  <div className="w-full h-full bg-[#f1f5f9] overflow-hidden relative">
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, stencil: false, depth: true, powerPreference: "high-performance" }}>
      <StoreScene {...props} />
    </Canvas>
  </div>
);

export default Store3D;
