
import React, { useMemo, useEffect, useState, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, Environment, Grid, Line, Float, ContactShadows, useProgress, Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { StoreConfig, Product, PathNode, Bay, Shelf } from '../types';
import { getAllBays, findBayById, getAllFloors, getAisleIdForBay, getAisleColor, getAisleBounds, getBaysForAisle } from '../utils/storeHelpers';
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
  targetAisleId?: string | null;
  targetShelfId?: string | null;
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

// Custom OrbitControls with zoom-to-mouse-pointer functionality and boundary constraints
const ZoomToPointerControls: React.FC<{ 
  minDistance?: number; 
  maxDistance?: number; 
  maxPolarAngle?: number;
  storeConfig?: StoreConfig;
}> = ({ 
  minDistance = 3, 
  maxDistance = 300, 
  maxPolarAngle = Math.PI / 2.2,
  storeConfig
}) => {
  const { camera, gl, raycaster } = useThree();
  const controlsRef = useRef<any>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isZoomingRef = useRef(false);

  // Calculate store boundaries with padding (accounting for scene offset)
  const storeBounds = useMemo(() => {
    if (!storeConfig) return null;
    const padding = 5; // Padding outside store boundaries
    const centerX = storeConfig.gridSize.width / 2;
    const centerZ = storeConfig.gridSize.depth / 2;
    // Scene is offset by [-centerX, 0, -centerZ], so adjust world coordinates
    return {
      minX: -centerX - padding,
      maxX: storeConfig.gridSize.width - centerX + padding,
      minZ: -centerZ - padding,
      maxZ: storeConfig.gridSize.depth - centerZ + padding,
    };
  }, [storeConfig]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Normalize mouse coordinates to -1 to 1
      const rect = gl.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    gl.domElement.addEventListener('mousemove', handleMouseMove);
    return () => gl.domElement.removeEventListener('mousemove', handleMouseMove);
  }, [gl]);

  useEffect(() => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    
    // Override the zoom behavior
    const handleWheel = (event: WheelEvent) => {
      if (!controls.enabled) return;
      
      event.preventDefault();
      isZoomingRef.current = true;
      
      // Get mouse position in normalized device coordinates
      const mouse = new THREE.Vector2(mouseRef.current.x, mouseRef.current.y);
      
      // Create a raycaster from the camera through the mouse position
      raycaster.setFromCamera(mouse, camera);
      
      // Intersect with a plane at y=0 (ground level)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectionPoint = new THREE.Vector3();
      const hasIntersection = raycaster.ray.intersectPlane(plane, intersectionPoint);
      
      if (hasIntersection) {
        // Calculate zoom delta
        const delta = event.deltaY * 0.01;
        const zoomFactor = 1 + delta;
        
        // Get current camera position and target
        const currentTarget = controls.target.clone();
        const currentPosition = camera.position.clone();
        const currentDistance = currentPosition.distanceTo(currentTarget);
        
        // Calculate new distance after zoom
        const newDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance * zoomFactor));
        
        // Check if intersection point is outside store boundary
        // If outside, use store center (0, 0, 0 in centered coordinates) as zoom target
        let zoomTargetPoint = intersectionPoint;
        if (storeBounds) {
          const isOutsideBounds = 
            intersectionPoint.x < storeBounds.minX || 
            intersectionPoint.x > storeBounds.maxX ||
            intersectionPoint.z < storeBounds.minZ || 
            intersectionPoint.z > storeBounds.maxZ;
          
          if (isOutsideBounds) {
            // Use store center as zoom target (center is at 0,0,0 in centered coordinate system)
            zoomTargetPoint = new THREE.Vector3(0, 0, 0);
          }
        }
        
        // Calculate how much to adjust target based on mouse position
        // When mouse is at center, don't adjust. When at edge, adjust more.
        const mouseDistanceFromCenter = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);
        const adjustStrength = Math.min(1, mouseDistanceFromCenter * 0.5);
        
        // Calculate the offset from current target to zoom target point
        const targetOffset = zoomTargetPoint.clone().sub(currentTarget);
        
        // Adjust target towards zoom target point (more adjustment = more zoom towards pointer/center)
        let adjustedTarget = currentTarget.clone().add(targetOffset.multiplyScalar(adjustStrength * 0.2));
        
        // Clamp target to store boundaries
        if (storeBounds) {
          adjustedTarget.x = Math.max(storeBounds.minX, Math.min(storeBounds.maxX, adjustedTarget.x));
          adjustedTarget.z = Math.max(storeBounds.minZ, Math.min(storeBounds.maxZ, adjustedTarget.z));
        }
        
        // Calculate new camera position
        const direction = currentPosition.clone().sub(adjustedTarget).normalize();
        let newPosition = adjustedTarget.clone().add(direction.multiplyScalar(newDistance));
        
        // Clamp camera position to ensure it doesn't go too far outside bounds
        if (storeBounds) {
          const maxCameraDistance = Math.max(storeBounds.maxX - storeBounds.minX, storeBounds.maxZ - storeBounds.minZ) * 0.8;
          const cameraBounds = {
            minX: storeBounds.minX - maxCameraDistance,
            maxX: storeBounds.maxX + maxCameraDistance,
            minZ: storeBounds.minZ - maxCameraDistance,
            maxZ: storeBounds.maxZ + maxCameraDistance,
          };
          newPosition.x = Math.max(cameraBounds.minX, Math.min(cameraBounds.maxX, newPosition.x));
          newPosition.z = Math.max(cameraBounds.minZ, Math.min(cameraBounds.maxZ, newPosition.z));
        }
        
        // Apply the changes
        controls.target.copy(adjustedTarget);
        camera.position.copy(newPosition);
        controls.update();
      } else {
        // Fallback to normal zoom behavior if no intersection
        const delta = event.deltaY * 0.01;
        const zoomFactor = 1 + delta;
        const currentDistance = camera.position.distanceTo(controls.target);
        const newDistance = Math.max(minDistance, Math.min(maxDistance, currentDistance * zoomFactor));
        
        const direction = camera.position.clone().sub(controls.target).normalize();
        let newPosition = controls.target.clone().add(direction.multiplyScalar(newDistance));
        
        // Clamp camera position to boundaries
        if (storeBounds) {
          const maxCameraDistance = Math.max(storeBounds.maxX - storeBounds.minX, storeBounds.maxZ - storeBounds.minZ) * 0.8;
          const cameraBounds = {
            minX: storeBounds.minX - maxCameraDistance,
            maxX: storeBounds.maxX + maxCameraDistance,
            minZ: storeBounds.minZ - maxCameraDistance,
            maxZ: storeBounds.maxZ + maxCameraDistance,
          };
          newPosition.x = Math.max(cameraBounds.minX, Math.min(cameraBounds.maxX, newPosition.x));
          newPosition.z = Math.max(cameraBounds.minZ, Math.min(cameraBounds.maxZ, newPosition.z));
        }
        
        camera.position.copy(newPosition);
        controls.update();
      }
      
      // Reset zoom flag after a short delay
      setTimeout(() => {
        isZoomingRef.current = false;
      }, 100);
    };

    gl.domElement.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      gl.domElement.removeEventListener('wheel', handleWheel);
    };
  }, [camera, gl, raycaster, minDistance, maxDistance, storeBounds]);

  // Continuously clamp camera and target to boundaries for smooth constraint
  useFrame(() => {
    if (!controlsRef.current || !storeBounds) return;
    
    const controls = controlsRef.current;
    const target = controls.target;
    const position = camera.position;
    
    // Smoothly clamp target to boundaries
    const targetClamped = new THREE.Vector3(
      Math.max(storeBounds.minX, Math.min(storeBounds.maxX, target.x)),
      target.y,
      Math.max(storeBounds.minZ, Math.min(storeBounds.maxZ, target.z))
    );
    
    // Only update if there's a significant difference to avoid jitter
    if (target.distanceTo(targetClamped) > 0.01) {
      target.lerp(targetClamped, 0.1);
      controls.update();
    }
    
    // Clamp camera position to reasonable bounds
    const maxCameraDistance = Math.max(storeBounds.maxX - storeBounds.minX, storeBounds.maxZ - storeBounds.minZ) * 0.8;
    const cameraBounds = {
      minX: storeBounds.minX - maxCameraDistance,
      maxX: storeBounds.maxX + maxCameraDistance,
      minZ: storeBounds.minZ - maxCameraDistance,
      maxZ: storeBounds.maxZ + maxCameraDistance,
    };
    
    const positionClamped = new THREE.Vector3(
      Math.max(cameraBounds.minX, Math.min(cameraBounds.maxX, position.x)),
      position.y,
      Math.max(cameraBounds.minZ, Math.min(cameraBounds.maxZ, position.z))
    );
    
    if (position.distanceTo(positionClamped) > 0.01) {
      position.lerp(positionClamped, 0.1);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={maxPolarAngle}
      enableDamping={true}
      dampingFactor={0.08}
      enablePan={true}
      panSpeed={0.8}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
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

// Generate product texture with vertical and horizontal lines
const generateProductTexture = (baseColor: string, seed: number = 0): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base color fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Vertical lines - evenly spaced
  ctx.strokeStyle = `rgba(0, 0, 0, 0.15)`;
  ctx.lineWidth = 1;
  const verticalSpacing = 32;
  for (let x = 0; x <= canvas.width; x += verticalSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines - evenly spaced
  ctx.strokeStyle = `rgba(0, 0, 0, 0.15)`;
  ctx.lineWidth = 1;
  const horizontalSpacing = 32;
  for (let y = 0; y <= canvas.height; y += horizontalSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Subtle gradient for depth
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `rgba(255, 255, 255, 0.05)`);
  gradient.addColorStop(0.5, `rgba(0, 0, 0, 0)`);
  gradient.addColorStop(1, `rgba(0, 0, 0, 0.05)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

// Component to show label only on camera-facing side
const CameraFacingLabel: React.FC<{
  shelfName: string;
  width: number;
  depth: number;
  height: number;
  closedSides?: ('left' | 'right' | 'front' | 'back')[];
}> = ({ shelfName, width, depth, height, closedSides }) => {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const [visibleSide, setVisibleSide] = useState<'front' | 'back' | 'left' | 'right' | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Get camera world position
    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);
    
    // Get shelf center world position
    const shelfWorldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(shelfWorldPos);
    
    // Calculate direction from shelf to camera
    const directionToCamera = cameraWorldPos.clone().sub(shelfWorldPos).normalize();
    
    // Get shelf's world rotation to transform normals
    const shelfWorldQuat = new THREE.Quaternion();
    groupRef.current.getWorldQuaternion(shelfWorldQuat);
    
    // Calculate which side is most facing the camera
    const sides: Array<{ name: 'front' | 'back' | 'left' | 'right'; normal: THREE.Vector3; isOpen: boolean }> = [
      { name: 'front', normal: new THREE.Vector3(0, 0, 1), isOpen: !closedSides?.includes('front') },
      { name: 'back', normal: new THREE.Vector3(0, 0, -1), isOpen: !(closedSides === undefined || (closedSides.length > 0 && closedSides.includes('back'))) },
      { name: 'left', normal: new THREE.Vector3(-1, 0, 0), isOpen: !closedSides?.includes('left') },
      { name: 'right', normal: new THREE.Vector3(1, 0, 0), isOpen: !closedSides?.includes('right') },
    ];
    
    // Transform normals to world space
    sides.forEach(side => {
      side.normal.applyQuaternion(shelfWorldQuat);
    });
    
    // Find the open side with highest dot product (most facing camera)
    let bestSide: 'front' | 'back' | 'left' | 'right' | null = null;
    let bestDot = -Infinity;
    
    for (const side of sides) {
      if (side.isOpen) {
        const dot = directionToCamera.dot(side.normal);
        if (dot > bestDot) {
          bestDot = dot;
          bestSide = side.name;
        }
      }
    }
    
    setVisibleSide(bestSide);
  });

  const UNIT_HEIGHT = height;
  const labelY = UNIT_HEIGHT / 2 + 0.3;

  return (
    <group ref={groupRef}>
      {visibleSide === 'front' && (
        <group position={[0, labelY, depth / 2 - 0.6]}>
          <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000">
            {shelfName}
          </Text>
        </group>
      )}
      {visibleSide === 'back' && (
        <group position={[0, labelY, -depth / 2 + 0.6]} rotation={[0, Math.PI, 0]}>
          <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000">
            {shelfName}
          </Text>
        </group>
      )}
      {visibleSide === 'left' && (
        <group position={[-width / 2 + 0.6, labelY, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000">
            {shelfName}
          </Text>
        </group>
      )}
      {visibleSide === 'right' && (
        <group position={[width / 2 - 0.6, labelY, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Text fontSize={0.3} color="#ffffff" fontWeight="black" outlineWidth={0.03} outlineColor="#000000">
            {shelfName}
          </Text>
        </group>
      )}
    </group>
  );
};

const AnimatedProductRow: React.FC<{ position: [number, number, number]; args: [number, number, number]; color: string; isHighlight: boolean }> = ({ position, args, color, isHighlight }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const startColor = useMemo(() => new THREE.Color(color), [color]);
  const highlightColor = useMemo(() => new THREE.Color('#fbbf24'), []); // Amber Highlight
  
  // Generate texture with seed based on color for consistency
  const texture = useMemo(() => {
    const seed = color.charCodeAt(0) + color.charCodeAt(color.length - 1);
    return generateProductTexture(color, seed);
  }, [color]);

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
      <meshStandardMaterial 
        ref={materialRef} 
        color={color}
        map={texture}
        roughness={0.7}
        metalness={0.1}
        side={THREE.FrontSide}
        transparent={true}
        opacity={0.75}
      />
    </mesh>
  );
};

const DetailedShelfUnit: React.FC<{
  width: number;
  height: number;
  depth: number;
  frontConfig?: { color: string; isTarget: boolean; targetLevels?: number[]; name: string; levelCount: number };
  backConfig?: { color: string; isTarget: boolean; targetLevels?: number[]; name: string; levelCount: number };
  closedSides?: ('left' | 'right' | 'front' | 'back')[];
}> = ({ width, height, depth, frontConfig, backConfig, closedSides }) => {
  const shelfCount = frontConfig?.levelCount || 5;
  const shelfThickness = 0.05;
  const shelfSpacing = (height - 0.2) / shelfCount;

  // By default, back side is closed. Other sides are open unless specified in closedSides
  // If closedSides is undefined, back is closed by default (default state)
  // If closedSides is an empty array [], it means user explicitly unchecked back (all open)
  // If closedSides includes a side, that side has a panel
  const showLeftSide = closedSides?.includes('left') || false;
  const showRightSide = closedSides?.includes('right') || false;
  const showFrontSide = closedSides?.includes('front') || false;
  // Back is closed by default (when undefined) or when explicitly included
  // If closedSides is an empty array [], it means user explicitly set all sides open
  const showBackSide = closedSides === undefined || (closedSides.length > 0 && closedSides.includes('back'));

  return (
    <group>
      {/* Left Side */}
      {showLeftSide && (
        <mesh position={[-width / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, height, depth]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      )}

      {/* Right Side */}
      {showRightSide && (
        <mesh position={[width / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, height, depth]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      )}

      {/* Front Side */}
      {showFrontSide && (
        <mesh position={[0, 0, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[width, height, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      )}

      {/* Back Side */}
      {showBackSide && (
        <mesh position={[0, 0, -depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[width, height, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      )}

      {/* Horizontal Shelves & Products */}
      {Array.from({ length: shelfCount }).map((_, i) => {
        const y = -height / 2 + 0.2 + (i * shelfSpacing);

        const showFront = frontConfig && i < frontConfig.levelCount;
        // Highlight if it's the target shelf - blink rows that match the product's levels
        // If targetLevels is provided and not empty, only highlight those specific levels
        // If targetLevels is undefined/null/empty, highlight all levels on target shelf
        const frontHighlight = showFront && frontConfig.isTarget && (
          !frontConfig.targetLevels || 
          frontConfig.targetLevels.length === 0 || 
          frontConfig.targetLevels.includes(i)
        );
        
        // Debug logging for blinking - log for any target product
        if (frontConfig?.isTarget && i < 3) {
          console.log(`Row ${i} highlight check for ${frontConfig.name}:`, {
            showFront,
            isTarget: frontConfig.isTarget,
            targetLevels: frontConfig.targetLevels,
            levelIndex: i,
            shouldHighlight: frontHighlight,
            levelCount: frontConfig.levelCount
          });
        }

        return (
          <group key={i} position={[0, y, 0]}>
            {/* Shelf Board */}
            <mesh receiveShadow castShadow>
              <boxGeometry args={[width - 0.04, shelfThickness, depth]} />
              <meshStandardMaterial color="#475569" metalness={0.1} roughness={0.8} />
            </mesh>

            {/* Front Products */}
            {showFront && (
              <group>
                <AnimatedProductRow
                  position={[0, 0.2, 0]}
                  args={[width - 0.2, 0.35, depth - 0.3]}
                  color={frontConfig.color}
                  isHighlight={!!frontHighlight}
                />
              </group>
            )}
          </group>
        );
      })}

      {/* Highlight Frame */}
      {frontConfig?.isTarget && (
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

// Aisle Highlight Component - renders a floor highlight for the entire aisle
const AisleHighlight: React.FC<{ aisleId: string; config: StoreConfig; currentFloor: number }> = ({ aisleId, config, currentFloor }) => {
  const bounds = getAisleBounds(config, aisleId);
  if (!bounds || bounds.floor !== currentFloor) return null;

  const aisleColor = getAisleColor(aisleId);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  return (
    <group position={[centerX, -0.65, centerZ]}>
      {/* Semi-transparent floor highlight */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial 
          color={aisleColor} 
          transparent 
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Thick boundary outline around entire aisle */}
      <Line
        points={[
          [-width / 2, 0.02, -depth / 2],
          [width / 2, 0.02, -depth / 2],
          [width / 2, 0.02, depth / 2],
          [-width / 2, 0.02, depth / 2],
          [-width / 2, 0.02, -depth / 2]
        ]}
        color={aisleColor}
        lineWidth={12}
      />
    </group>
  );
};

const BayComponent: React.FC<{ bay: Bay; aisleId: string | null; isTarget: boolean; targetProduct?: Product | null; disableFocus?: boolean }> = ({ bay, aisleId, isTarget, targetProduct, disableFocus }) => {
  const shelfSpacing = bay.shelfSpacing ?? 0; // Default spacing is 0
  const numShelves = bay.shelves.length;
  const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1); // Total spacing between all shelves
  const availableWidth = bay.width - totalSpacing; // Width available for shelves after spacing
  const unitWidth = numShelves > 0 ? availableWidth / numShelves : bay.width;
  const UNIT_HEIGHT = 2.2;
  const Y_SHIFT = 0.35;

  // Use aisle color for all shelves in this bay
  const aisleColor = aisleId ? getAisleColor(aisleId) : '#64748b';

  const getShelfConfig = (shelf: Shelf) => {
    // If the product's shelfId is missing in this bay, fallback to highlight all shelves in the target bay
    const shelfExistsInBay = bay.shelves.some(s => s.id === targetProduct?.shelfId);
    const isTargetShelf = isTarget && (shelfExistsInBay ? targetProduct?.shelfId === shelf.id : true);
    // Use aisle color instead of bay hash color - all shelves in same aisle have same color
    const config = {
      color: aisleColor,
      isTarget: isTargetShelf,
      targetLevels: isTargetShelf && targetProduct?.levels ? targetProduct.levels : undefined,
      name: shelf.name,
      levelCount: shelf.levelCount || 5
    };
    
    // Debug logging for blinking - log for any target product
    if (isTargetShelf && targetProduct) {
      console.log(`Shelf config for ${targetProduct.name}:`, {
        shelfId: shelf.id,
        productShelfId: targetProduct.shelfId,
        isTarget: config.isTarget,
        targetLevels: config.targetLevels,
        productLevels: targetProduct.levels,
        levelCount: config.levelCount
      });
    }
    
    return config;
  };

  return (
    <group position={[bay.column + bay.width / 2, 0.75, bay.row + bay.depth / 2]}>
      <mesh castShadow receiveShadow position={[0, -0.7, 0]}>
        <boxGeometry args={[bay.width, 0.1, bay.depth]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      {bay.shelves.map((shelf, idx) => {
        // Calculate position: start from left edge, add half unit width, then add spacing and unit width for each previous shelf
        const xPos = -bay.width / 2 + unitWidth / 2 + (idx * (unitWidth + shelfSpacing));
        const frontConfig = getShelfConfig(shelf);

        return (
          <group key={shelf.id} position={[xPos, Y_SHIFT, 0]}>
            <DetailedShelfUnit
              width={unitWidth - 0.4}
              height={UNIT_HEIGHT}
              depth={bay.depth - 0.5}
              frontConfig={frontConfig}
              backConfig={undefined}
              closedSides={shelf.closedSides}
            />

            {/* Label - Show only on camera-facing side */}
            {frontConfig && (
              <CameraFacingLabel
                shelfName={frontConfig.name}
                width={unitWidth - 0.4}
                depth={bay.depth - 0.5}
                height={UNIT_HEIGHT}
                closedSides={shelf.closedSides}
              />
            )}
          </group>
        );
      })}
      {/* Bay Name Label - Raised higher */}
      <Billboard position={[0, 2.8, 0]}>
        <Text
          fontSize={0.6}
          color="#1e293b"
          fontWeight="black"
          anchorY="bottom"
          outlineWidth={0.08}
          outlineColor="#ffffff"
        >
          {bay.name.toUpperCase()}
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
    // Debug logging for path display
    if (points.length > 0 && floorPoints.length < 2) {
      console.log('PathLine: Points exist but not on current floor', {
        totalPoints: points.length,
        floorPoints: floorPoints.length,
        currentFloor,
        pointFloors: [...new Set(points.map(p => p.floor))]
      });
    }
    if (floorPoints.length < 2) return [];
    const currentCount = Math.max(2, Math.floor(floorPoints.length * progress));
    return floorPoints.slice(0, currentCount).map(p => new THREE.Vector3(p.x, 0.02, p.z));
  }, [points, progress, currentFloor]);

  if (animatedPoints.length < 2) return null;
  return (
    <group>
      <Line points={animatedPoints} color="#3b82f6" lineWidth={6} transparent opacity={0.9} />
      <Line points={animatedPoints} color="#93c5fd" lineWidth={12} transparent opacity={0.25} />
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

const ProductMarker: React.FC<{ product: Product; bay: Bay; type?: 'default' | 'ai'; showLabel?: boolean }> = ({ product, bay, type = 'default', showLabel = false }) => {
  const markerColor = type === 'ai' ? '#6366f1' : '#facc15';
  const pos = useMemo(() => {
    const shelfIndex = bay.shelves.findIndex(s => s.id === product.shelfId);
    const validShelfIndex = shelfIndex === -1 ? 0 : shelfIndex;

    const numShelves = bay.shelves.length;
    const shelfSpacing = bay.shelfSpacing ?? 0;
    const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
    const availableWidth = bay.width - totalSpacing;
    const unitWidth = numShelves > 0 ? availableWidth / numShelves : bay.width;

    // X: Center of the specific shelf (matching BayComponent calculation)
    // Bay group is centered at: bay.column + bay.width / 2
    // Shelf position relative to center: -bay.width / 2 + unitWidth / 2 + (idx * (unitWidth + shelfSpacing))
    // Absolute X = bay.column + unitWidth / 2 + (idx * (unitWidth + shelfSpacing))
    const offsetX = bay.column + (unitWidth / 2) + (validShelfIndex * (unitWidth + shelfSpacing));
    // Z: Products are displayed on the front side of each shelf
    // Bay group is centered at: bay.row + bay.depth / 2
    // Products are at: bay.depth / 2 - 0.25 (relative) + (bay.depth - 0.5) / 4
    // Absolute Z = bay.row + bay.depth / 2 + ((bay.depth - 0.5) / 4)
    const offsetZ = bay.row + bay.depth / 2 + ((bay.depth - 0.5) / 4);

    return { x: offsetX, z: offsetZ };
  }, [bay, product]);

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
  const userInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetPointRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const defaultPosition = useMemo(() => {
    const size = Math.max(config.gridSize.width, config.gridSize.depth);
    return new THREE.Vector3(0, size * 1.2, size * 1.2);
  }, [config.gridSize]);

  useEffect(() => {
    if (!controls) return;

    const orbitControls = controls as any;
    
    // Track user interaction
    const onStart = () => {
      userInteractingRef.current = true;
      setIsAnimating(false); // Stop auto-animation when user interacts
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };

    const onEnd = () => {
      // Wait a bit after user stops interacting before allowing auto-animation again
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      interactionTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 2000); // 2 second delay after user stops interacting
    };

    orbitControls.addEventListener('start', onStart);
    orbitControls.addEventListener('end', onEnd);

    return () => {
      orbitControls.removeEventListener('start', onStart);
      orbitControls.removeEventListener('end', onEnd);
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [controls]);

  useEffect(() => {
    // Only animate if user is not interacting
    if (userInteractingRef.current) return;

    const targetKey = targetPoint ? `${targetPoint.x},${targetPoint.y},${targetPoint.z}` : 'default';
    if (targetKey !== lastTargetKeyRef.current) {
      lastTargetKeyRef.current = targetKey;
      setIsAnimating(true);
      if (targetPoint) targetPointRef.current.copy(targetPoint);
      else targetPointRef.current.copy(defaultTarget);
    }
  }, [targetPoint, defaultTarget]);

  useFrame(() => {
    if (!controls || !isAnimating || userInteractingRef.current) return;

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

const StoreScene: React.FC<Store3DProps> = ({ config, targetProduct, path, currentFloor, allProducts = [], showAllProducts = false, showLabels = false, targetDepartmentId, targetAisleId, targetShelfId, disableFocus }) => {
  const centerX = config.gridSize.width / 2;
  const centerZ = config.gridSize.depth / 2;

  const selectedBay = useMemo(() => targetDepartmentId ? findBayById(config, targetDepartmentId) : undefined, [config, targetDepartmentId]);
  const targetBay = useMemo(() => {
    if (!targetProduct) return undefined;
    // Support both new (bayId) and legacy (departmentId) product references
    return findBayById(config, targetProduct.bayId || targetProduct.departmentId || '');
  }, [config, targetProduct]);

  const shelfBay = useMemo(() => {
    if (!targetShelfId) return null;
    // Find the bay that contains this shelf
    const allBaysList = getAllBays(config);
    return allBaysList.find(bay => bay.shelves.some(s => s.id === targetShelfId)) || null;
  }, [config, targetShelfId]);

  const cameraTargetPoint = useMemo(() => {
    let point: THREE.Vector3 | null = null;
    
    // Priority: Shelf > Bay > Aisle > Product
    if (targetShelfId && (selectedBay || shelfBay)) {
      // Focus on specific shelf within bay
      const bay = selectedBay || shelfBay;
      if (bay) {
        const shelfIdx = bay.shelves.findIndex(s => s.id === targetShelfId);
        const validIdx = shelfIdx === -1 ? 0 : shelfIdx;

        const numShelves = bay.shelves.length;
        const shelfSpacing = bay.shelfSpacing ?? 0;
        const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
        const availableWidth = bay.width - totalSpacing;
        const unitWidth = numShelves > 0 ? availableWidth / numShelves : bay.width;

        const x = bay.column + (unitWidth / 2) + (validIdx * (unitWidth + shelfSpacing));
        const z = bay.row + bay.depth / 2;
        point = new THREE.Vector3(x, 0, z);
      }
    } else if (selectedBay) {
      // Focus on bay center
      point = new THREE.Vector3(selectedBay.column + selectedBay.width / 2, 0, selectedBay.row + selectedBay.depth / 2);
    } else if (targetAisleId) {
      // Focus on aisle center
      const bounds = getAisleBounds(config, targetAisleId);
      if (bounds && bounds.floor === currentFloor) {
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        point = new THREE.Vector3(centerX, 0, centerZ);
      }
    } else if (targetProduct && targetBay) {
      // Focus on product shelf
      const idx = targetBay.shelves.findIndex(s => s.id === targetProduct.shelfId);
      const validIdx = idx === -1 ? 0 : idx;

      const numShelves = targetBay.shelves.length;
      const shelfSpacing = targetBay.shelfSpacing ?? 0;
      const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
      const availableWidth = targetBay.width - totalSpacing;
      const unitWidth = numShelves > 0 ? availableWidth / numShelves : targetBay.width;

      const x = targetBay.column + (unitWidth / 2) + (validIdx * (unitWidth + shelfSpacing));
      const productZ = targetBay.row + targetBay.depth / 2 + ((targetBay.depth - 0.5) / 4);
      const z = productZ + 0.3;

      point = new THREE.Vector3(x, 0, z);
    }

    if (point) {
      // Convert to world coordinates (centered)
      return new THREE.Vector3(point.x - centerX, 0, point.z - centerZ);
    }
    return null;
  }, [targetProduct, targetBay, selectedBay, targetAisleId, targetShelfId, shelfBay, config, currentFloor, centerX, centerZ]);

  const floorProducts = useMemo(() => {
    if (!showAllProducts) return [];
    return allProducts.filter(p => {
      const bayId = p.bayId || p.departmentId;
      const bay = bayId ? findBayById(config, bayId) : undefined;
      return bay && bay.floor === currentFloor && p.id !== targetProduct?.id;
    });
  }, [allProducts, showAllProducts, config, currentFloor, targetProduct]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} />
      <ZoomToPointerControls 
        minDistance={3} 
        maxDistance={300} 
        maxPolarAngle={Math.PI / 2.2}
        storeConfig={config}
      />
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

          {/* Render aisle highlights first (behind bays) - shows the entire aisle area */}
          {(() => {
            const aisleIds = new Set<string>();
            getAllBays(config).filter(b => b.floor === currentFloor).forEach(b => {
              const aid = getAisleIdForBay(config, b.id);
              if (aid) aisleIds.add(aid);
            });
            return Array.from(aisleIds).map(aisleId => (
              <AisleHighlight key={aisleId} aisleId={aisleId} config={config} currentFloor={currentFloor} />
            ));
          })()}

          {/* Render bays */}
          {getAllBays(config).filter(b => b.floor === currentFloor).map(b => {
            const aisleId = getAisleIdForBay(config, b.id);
            return <BayComponent key={b.id} bay={b} aisleId={aisleId} isTarget={(targetProduct?.bayId || targetProduct?.departmentId) === b.id || targetDepartmentId === b.id} targetProduct={targetProduct} disableFocus={disableFocus} />;
          })}

          <PathLine points={path} currentFloor={currentFloor} />
          <WalkingAvatar points={path} currentFloor={currentFloor} />

          {floorProducts.map(p => {
            const bayId = p.bayId || p.departmentId;
            const bay = bayId ? findBayById(config, bayId) : undefined;
            return bay ? <ProductMarker key={p.id} product={p} bay={bay} type="ai" showLabel={showLabels} /> : null;
          })}

          {targetBay && targetProduct && targetBay.floor === currentFloor && cameraTargetPoint && (
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
