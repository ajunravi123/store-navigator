
import { PathNode, StoreConfig } from '../types';
import { getAllBays } from '../utils/storeHelpers';

interface GridNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

// Inflate obstacles in a region by marking neighbors within a radius as blocked
const inflateObstaclesInRegion = (grid: boolean[][], minX: number, minZ: number, maxX: number, maxZ: number, radius: number = 1) => {
  const width = grid.length;
  const depth = width > 0 ? grid[0].length : 0;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sx = clamp(Math.floor(minX), 0, width - 1);
  const ex = clamp(Math.ceil(maxX), 0, width - 1);
  const sz = clamp(Math.floor(minZ), 0, depth - 1);
  const ez = clamp(Math.ceil(maxZ), 0, depth - 1);
  // Snapshot original region to avoid cascading inflation in a single pass
  const original: boolean[][] = [];
  for (let x = sx; x <= ex; x++) {
    original[x - sx] = [];
    for (let z = sz; z <= ez; z++) original[x - sx][z - sz] = grid[x][z];
  }
  for (let x = sx; x <= ex; x++) {
    for (let z = sz; z <= ez; z++) {
      if (!original[x - sx][z - sz]) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const nx = x + dx, nz = z + dz;
            if (nx >= 0 && nx < width && nz >= 0 && nz < depth) grid[nx][nz] = false;
          }
        }
      }
    }
  }
};

// Calculate distance from point to nearest obstacle
const getObstacleDistance = (grid: boolean[][], x: number, z: number, maxDist: number): number => {
  const width = grid.length;
  const depth = grid[0].length;
  
  for (let d = 1; d <= maxDist; d++) {
    // Check in a square pattern around the point
    for (let dx = -d; dx <= d; dx++) {
      for (let dz = -d; dz <= d; dz++) {
        const nx = Math.floor(x) + dx;
        const nz = Math.floor(z) + dz;
        
        if (nx >= 0 && nx < width && nz >= 0 && nz < depth && !grid[nx][nz]) {
          return d; // Return distance to nearest obstacle
        }
      }
    }
  }
  return maxDist; // No obstacle found within maxDist
};

// Calculate centerline bias for a point in the aisle
const getCenterlineBias = (x: number, z: number, grid: boolean[][], width: number, depth: number): number => {
  // Find nearest walls in all four directions
  let leftDist = 0, rightDist = 0, upDist = 0, downDist = 0;
  
  // Check left
  for (let i = Math.floor(x); i >= 0; i--) {
    if (!grid[i][Math.floor(z)]) {
      leftDist = x - i;
      break;
    }
  }
  
  // Check right
  for (let i = Math.ceil(x); i < width; i++) {
    if (!grid[i][Math.floor(z)]) {
      rightDist = i - x;
      break;
    }
  }
  
  // Check up
  for (let j = Math.floor(z); j >= 0; j--) {
    if (!grid[Math.floor(x)][j]) {
      upDist = z - j;
      break;
    }
  }
  
  // Check down
  for (let j = Math.ceil(z); j < depth; j++) {
    if (!grid[Math.floor(x)][j]) {
      downDist = j - z;
      break;
    }
  }
  
  // Calculate how centered we are in the aisle
  const horizontalBias = 1 - Math.abs((rightDist - leftDist) / (rightDist + leftDist || 1));
  const verticalBias = 1 - Math.abs((downDist - upDist) / (downDist + upDist || 1));
  
  // Return a score from 0 to 1, where 1 is perfectly centered
  return (horizontalBias + verticalBias) / 2;
};

// Check a grid cell and its neighbors within a given clearance are walkable
const isCellClear = (grid: boolean[][], cx: number, cz: number, clearance: number = 1): boolean => {
  const width = grid.length;
  const depth = width > 0 ? grid[0].length : 0;
  for (let dx = -clearance; dx <= clearance; dx++) {
    for (let dz = -clearance; dz <= clearance; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (x < 0 || x >= width || z < 0 || z >= depth) return false;
      if (!grid[x][z]) return false;
    }
  }
  return true;
};

// Clearance check for a floating point position
const isPointClear = (grid: boolean[][], x: number, z: number, clearance: number = 1): boolean => {
  return isCellClear(grid, Math.floor(x), Math.floor(z), clearance);
};

// Segment collision test with clearance using dense sampling
const isCollisionFree = (p1: PathNode, p2: PathNode, grid: boolean[][], clearance: number = 1): boolean => {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const steps = Math.max(1, Math.ceil(dist / 0.25));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = p1.x + t * dx;
    const z = p1.z + t * dz;
    if (!isPointClear(grid, x, z, clearance)) return false;
  }
  return true;
};

const smoothPath = (path: PathNode[], grid: boolean[][], iterations: number = 60, tolerance: number = 0.12): PathNode[] => {
  if (path.length <= 2) return path;

  let smoothedPath = [...path];

  for (let i = 0; i < iterations; i++) {
    for (let j = 1; j < smoothedPath.length - 2; j++) {
      const prev = smoothedPath[j - 1];
      const curr = smoothedPath[j];
      const next = smoothedPath[j + 1];

      const targetX = (prev.x + next.x) / 2;
      const targetZ = (prev.z + next.z) / 2;

      const dx = targetX - curr.x;
      const dz = targetZ - curr.z;

      const newX = curr.x + dx * tolerance;
      const newZ = curr.z + dz * tolerance;

      const newPoint = { ...curr, x: newX, z: newZ };

      if (isCollisionFree(prev, newPoint, grid, 2) && isCollisionFree(newPoint, next, grid, 2)) {
        smoothedPath[j] = newPoint;
      }
    }
  }

  return smoothedPath;
}

// Remove intermediate points when a direct line is collision-free with clearance
const shortcutPath = (path: PathNode[], grid: boolean[][], clearance: number = 1): PathNode[] => {
  if (path.length <= 2) return path;
  const result: PathNode[] = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let k = path.length - 1;
    // Find the farthest point reachable in a straight line
    for (; k > i + 1; k--) {
      if (isCollisionFree(path[i], path[k], grid, clearance)) break;
    }
    result.push(path[k]);
    i = k;
  }
  return result;
}

// Raycast from a point in a direction until hitting a blocked cell; returns distance in world units
const rayDistanceToObstacle = (grid: boolean[][], x: number, z: number, dirX: number, dirZ: number, maxDist: number = 6, step: number = 0.1): number => {
  let dist = 0;
  const len = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / len, uz = dirZ / len;
  while (dist <= maxDist) {
    const px = x + ux * dist;
    const pz = z + uz * dist;
    if (px < 0 || pz < 0 || px >= grid.length || pz >= (grid[0]?.length || 0)) return dist;
    const cx = Math.floor(px), cz = Math.floor(pz);
    if (!grid[cx]?.[cz]) return Math.max(0, dist - step); // back off a bit to stay inside free space
    dist += step;
  }
  return maxDist;
};

// Move intermediate points toward the medial axis of the local aisle using perpendicular sampling
const centerPathInAisles = (path: PathNode[], grid: boolean[][]): PathNode[] => {
  if (path.length <= 2) return path;
  const centered: PathNode[] = [...path];
  for (let i = 1; i < centered.length - 2; i++) {
    const prev = centered[i - 1];
    const curr = centered[i];
    const next = centered[i + 1];
    const vx = next.x - prev.x;
    const vz = next.z - prev.z;
    const vlen = Math.hypot(vx, vz);
    if (vlen < 1e-3) continue;
    const px = -vz / vlen;
    const pz =  vx / vlen;

    const left = rayDistanceToObstacle(grid, curr.x, curr.z, -px, -pz, 6, 0.1);
    const right = rayDistanceToObstacle(grid, curr.x, curr.z,  px,  pz, 6, 0.1);

    // Target the midpoint between left and right free distances
    let offset = (right - left) / 2;
    // Limit how far we shift in one step to avoid oscillations
    offset = Math.max(-1.5, Math.min(1.5, offset));

    const cx = curr.x + px * offset;
    const cz = curr.z + pz * offset;
    // Only accept if the new location and adjacent segments remain collision-free with clearance
    const candidate = { ...curr, x: cx, z: cz };
    if (
      cx >= 0 && cz >= 0 && cx < grid.length && cz < (grid[0]?.length || 0) &&
      isCollisionFree(prev, candidate, grid, 2) &&
      isCollisionFree(candidate, next, grid, 2)
    ) {
      centered[i] = candidate;
    }
  }
  return centered;
};

const simplifyPath = (path: PathNode[], grid: boolean[][]): PathNode[] => {
  if (path.length <= 2) return path;

  let simplified: PathNode[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    const dx1 = curr.x - prev.x;
    const dz1 = curr.z - prev.z;
    const dx2 = next.x - curr.x;
    const dz2 = next.z - curr.z;
    const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
    const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    if (len1 > 0.1 && len2 > 0.1) {
      const dotProduct = (dx1 * dx2 + dz1 * dz2) / (len1 * len2);
      if (dotProduct < 0.95) {
        simplified.push(curr);
      }
    }
  }
  simplified.push(path[path.length - 1]);

  // Shortcut first to remove unnecessary intermediate nodes
  let shortened = shortcutPath(simplified, grid, 1);
  // Then smooth and center
  let smoothed = smoothPath(shortened, grid);
  smoothed = centerPathInAisles(smoothed, grid);
  // Final shortcut to ensure minimal, clean segments with clearance
  const finalPath = shortcutPath(smoothed, grid, 1);
  return finalPath;
};

const runAStar = (config: StoreConfig, floor: number, start: PathNode, end: PathNode): PathNode[] => {
  const { width, depth } = config.gridSize;
  // Initialize grid with all cells walkable (true)
  const grid: boolean[][] = Array.from({ length: Math.ceil(width) }, () => 
    new Array(Math.ceil(depth)).fill(true)
  );

  // Cost grid: default cost 1 for normal tiles. Higher values penalize traversal through that tile.
  // Mark bay interior floor tiles with a penalty so A* favors routing around bays (aisles).
  const costGrid: number[][] = Array.from({ length: Math.ceil(width) }, () => 
    new Array(Math.ceil(depth)).fill(1)
  );
  const BAY_FLOOR_PENALTY = 6; // Higher value makes crossing bay floor less attractive

  const allBays = getAllBays(config);
  // Find nearest bay to the endpoint on the same floor (endpoint may be placed just outside bay bounds)
  let targetBay = undefined as ReturnType<typeof getAllBays>[number] | undefined;
  {
    const baysOnFloor = allBays.filter(b => b.floor === floor);
    let bestDist = Infinity;
    for (const b of baysOnFloor) {
      const rx1 = b.column, rx2 = b.column + b.width;
      const rz1 = b.row,    rz2 = b.row + b.depth;
      const dx = end.x < rx1 ? (rx1 - end.x) : (end.x > rx2 ? (end.x - rx2) : 0);
      const dz = end.z < rz1 ? (rz1 - end.z) : (end.z > rz2 ? (end.z - rz2) : 0);
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        bestDist = dist;
        targetBay = b;
      }
    }
    // Only accept if reasonably close to a bay
    if (bestDist > 3.0) targetBay = undefined;
  }

  allBays.forEach((bay) => {
    if (bay.floor !== floor) return;

    const shelfSpacing = bay.shelfSpacing ?? 0;
    const numShelves = bay.shelves.length;
    const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
    const availableWidth = bay.width - totalSpacing;
    const unitWidth = numShelves > 0 ? availableWidth / numShelves : bay.width;

    // Block individual shelves (not the entire bay) to allow paths through gaps
    // Removed space checking - paths will always be generated even through narrow spaces
    // Determine which shelf index is targeted for this bay based on endpoint X
    let targetShelfIdxForBay = -1;
    if (targetBay && targetBay.id === bay.id) {
      const shelfSpacingForIdx = bay.shelfSpacing ?? 0;
      const numShelvesForIdx = bay.shelves.length;
      const totalSpacingForIdx = shelfSpacingForIdx * Math.max(0, numShelvesForIdx - 1);
      const availableWidthForIdx = bay.width - totalSpacingForIdx;
      const unitWidthForIdx = numShelvesForIdx > 0 ? availableWidthForIdx / numShelvesForIdx : bay.width;
      // Compute nearest shelf section center index from endpoint X
      const baseCenterX = bay.column + unitWidthForIdx / 2;
      const stepX = unitWidthForIdx + shelfSpacingForIdx;
      let roughIdx = Math.round((end.x - baseCenterX) / (stepX || 1));
      roughIdx = Math.max(0, Math.min(numShelvesForIdx - 1, roughIdx));
      targetShelfIdxForBay = roughIdx;
    }

    bay.shelves.forEach((shelf, idx) => {
      const closedSides = shelf.closedSides ?? [];
      
      // Calculate shelf position
      const shelfCenterX = bay.column + (unitWidth / 2) + (idx * (unitWidth + shelfSpacing));
      const shelfLeftX = shelfCenterX - unitWidth / 2;
      const shelfRightX = shelfCenterX + unitWidth / 2;

      // Calculate exact shelf face positions (matching App.tsx calculation)
      const shelfCenterZ = bay.row + bay.depth / 2;
      const shelfDepth = bay.depth - 0.5;
      const frontFaceZ = shelfCenterZ + shelfDepth / 2;
      const backFaceZ = shelfCenterZ - shelfDepth / 2;

      // Block the shelf itself (the physical shelf unit) - STRICTLY block interior
      // Block everything from backFaceZ to frontFaceZ (the shelf interior)
      // Endpoint will be safely away (0.8 units) from the shelf face
      const buffer = 0.5; // Increased buffer to create a safety margin
      const safeDistance = 0.8; // Safe distance from shelf face (matches App.tsx)
      
      // Check if this is the target shelf (the one we're navigating to)
      const isTargetShelf = !!(targetBay && targetBay.id === bay.id && idx === targetShelfIdxForBay);
      
      for (let x = Math.floor(shelfLeftX - buffer); x <= Math.floor(shelfRightX + buffer); x++) {
        // Block entire shelf depth (from backFaceZ to frontFaceZ)
        for (let z = Math.floor(backFaceZ - buffer); z <= Math.floor(frontFaceZ + buffer); z++) {
          if (x < 0 || x >= width || z < 0 || z >= depth) continue;
          // No endpoint overrides inside shelf interior; always block

          grid[x][z] = false; // Block shelf interior - always block non-target shelves
        }
      }
      
      // Keep gaps between shelves accessible (if spacing exists)
      // Gaps are naturally accessible since we only block individual shelves above

      // Reduced blocking for closed faces - allow paths through narrow spaces
      // Only block immediate area around closed faces, not extended blocking zones
      // Skip closed face blocking for target shelf - endpoint area will handle it
      if (!isTargetShelf) {
        if (closedSides.includes('front')) {
          // Only block minimal area in front of closed front face
          for (let x = Math.floor(shelfLeftX - 0.3); x <= Math.floor(shelfRightX + 0.3); x++) {
            for (let z = Math.floor(frontFaceZ); z <= Math.floor(frontFaceZ + 0.5); z++) {
              if (x < 0 || x >= width || z < 0 || z >= depth) continue;
              grid[x][z] = false;
            }
          }
        }

        // Block back face area if back is closed - reduced blocking
        const isBackClosed = closedSides === undefined || closedSides.length === 0 || closedSides.includes('back');
        if (isBackClosed) {
          // Only block minimal area behind closed back face
          for (let x = Math.floor(shelfLeftX - 0.3); x <= Math.floor(shelfRightX + 0.3); x++) {
            for (let z = Math.floor(backFaceZ - 0.5); z <= Math.floor(backFaceZ); z++) {
              if (x < 0 || x >= width || z < 0 || z >= depth) continue;
              grid[x][z] = false;
            }
          }
        }
        
        // Block left/right face areas if they are closed - reduced blocking
        if (closedSides.includes('left')) {
          // Only block minimal area to the left of closed left face
          for (let x = Math.floor(shelfLeftX - 0.5); x <= Math.floor(shelfLeftX); x++) {
            for (let z = Math.floor(backFaceZ - 0.3); z <= Math.floor(frontFaceZ + 0.3); z++) {
              if (x < 0 || x >= width || z < 0 || z >= depth) continue;
              grid[x][z] = false;
            }
          }
        }
        
        if (closedSides.includes('right')) {
          // Only block minimal area to the right of closed right face
          for (let x = Math.floor(shelfRightX); x <= Math.floor(shelfRightX + 0.5); x++) {
            for (let z = Math.floor(backFaceZ - 0.3); z <= Math.floor(frontFaceZ + 0.3); z++) {
              if (x < 0 || x >= width || z < 0 || z >= depth) continue;
              grid[x][z] = false;
            }
          }
        }
      }
    });

    // Ensure aisle areas around bay remain accessible for better path routing
    // Aisles are the areas in front/behind the bay (outside shelf blocking zones)
    // These should remain open for natural path routing
    const aisleBuffer = 2.0; // Increased aisle width around bay for better pathfinding
    
    // Front aisle (in front of bay)
    for (let x = Math.floor(bay.column - aisleBuffer); x <= Math.floor(bay.column + bay.width + aisleBuffer); x++) {
      for (let z = Math.floor(bay.row + bay.depth + 0.5); z <= Math.floor(bay.row + bay.depth + aisleBuffer + 0.5); z++) {
        if (x >= 0 && x < width && z >= 0 && z < depth) {
          grid[x][z] = true; // Ensure front aisle is accessible
        }
      }
    }
    
    // Back aisle (behind bay)
    for (let x = Math.floor(bay.column - aisleBuffer); x <= Math.floor(bay.column + bay.width + aisleBuffer); x++) {
      for (let z = Math.floor(bay.row - aisleBuffer - 0.5); z <= Math.floor(bay.row - 0.5); z++) {
        if (x >= 0 && x < width && z >= 0 && z < depth) {
          grid[x][z] = true; // Ensure back aisle is accessible
        }
      }
    }
    
    // Side aisles (left and right of bay) - ensure paths can navigate around bays
    for (let z = Math.floor(bay.row - aisleBuffer); z <= Math.floor(bay.row + bay.depth + aisleBuffer); z++) {
      // Left side aisle
      for (let x = Math.floor(bay.column - aisleBuffer); x <= Math.floor(bay.column - 0.5); x++) {
        if (x >= 0 && x < width && z >= 0 && z < depth) {
          grid[x][z] = true; // Ensure left aisle is accessible
        }
      }
      // Right side aisle
      for (let x = Math.floor(bay.column + bay.width + 0.5); x <= Math.floor(bay.column + bay.width + aisleBuffer); x++) {
        if (x >= 0 && x < width && z >= 0 && z < depth) {
          grid[x][z] = true; // Ensure right aisle is accessible
        }
      }
    }

    // Penalize traversing across bay floor (prefer routing around aisles)
    for (let x = Math.floor(bay.column); x <= Math.floor(bay.column + bay.width); x++) {
      for (let z = Math.floor(bay.row); z <= Math.floor(bay.row + bay.depth); z++) {
        if (x >= 0 && x < width && z >= 0 && z < depth && grid[x][z]) {
          costGrid[x][z] = BAY_FLOOR_PENALTY;
        }
      }
    }
  });

  // Compute corrected endpoint with clearance and inflate obstacles for global buffer
  const endX = Math.min(width - 1, Math.max(0, Math.floor(end.x)));
  const endZ = Math.min(depth - 1, Math.max(0, Math.floor(end.z)));
  const CLEARANCE_CELLS = 1;
  inflateObstaclesInRegion(grid, 0, 0, width, depth, CLEARANCE_CELLS);

  // Default corrected goal and render end
  // correctedGoal: used by A* (guaranteed free cell outside inflated boundary)
  // renderEnd: exactly on the shelf/block physical boundary (epsilon outside)
  let correctedGoal: PathNode = { ...end, floor };
  let renderEnd: PathNode = { ...end, floor };
  if (targetBay) {
    const sp = targetBay.shelfSpacing ?? 0;
    const ns = targetBay.shelves.length;
    const totalSp = sp * Math.max(0, ns - 1);
    const availW = targetBay.width - totalSp;
    const uW = ns > 0 ? availW / ns : targetBay.width;
    const baseCenterX = targetBay.column + uW / 2;
    const stepX = uW + sp;
    let idx = Math.round((end.x - baseCenterX) / (stepX || 1));
    idx = Math.max(0, Math.min(ns - 1, idx));
    const shelfCenterX = targetBay.column + (uW / 2) + (idx * (uW + sp));
    const shelfLeftX = shelfCenterX - uW / 2;
    const shelfRightX = shelfCenterX + uW / 2;
    const shelfCenterZ = targetBay.row + targetBay.depth / 2;
    const shelfDepth = targetBay.depth - 0.5;
    const frontFaceZ = shelfCenterZ + shelfDepth / 2;
    const backFaceZ = shelfCenterZ - shelfDepth / 2;
    const closed = targetBay.shelves[idx]?.closedSides ?? [];
    const isFrontClosed = closed.includes('front');
    const isBackClosed = closed.length === 0 || closed.includes('back');
    const isLeftClosed = closed.includes('left');
    const isRightClosed = closed.includes('right');
    const frontOpen = !isFrontClosed;
    const backOpen = !isBackClosed;
    const leftOpen = !isLeftClosed;
    const rightOpen = !isRightClosed;

    // Prefer an open side that lies outside the bay interior (i.e., in an aisle) to avoid crossing bay floor.
    const candidateSides: Array<{ side: 'front'|'back'|'left'|'right', x: number, z: number, open: boolean }> = [];
    const offset = CLEARANCE_CELLS + 0.1;
    // front
    candidateSides.push({ side: 'front', x: shelfCenterX, z: frontFaceZ + offset, open: frontOpen });
    // back
    candidateSides.push({ side: 'back', x: shelfCenterX, z: backFaceZ - offset, open: backOpen });
    // right
    candidateSides.push({ side: 'right', x: shelfRightX + offset, z: shelfCenterZ, open: rightOpen });
    // left
    candidateSides.push({ side: 'left', x: shelfLeftX - offset, z: shelfCenterZ, open: leftOpen });

    // Check which candidate points are outside the bay interior rectangle
    const insideBay = (x: number, z: number) => {
      return x >= targetBay!.column && x <= (targetBay!.column + targetBay!.width) && z >= targetBay!.row && z <= (targetBay!.row + targetBay!.depth);
    };

    // Prefer open sides that are outside bay interior; if multiple, pick nearest to endpoint; else fallback to best reachable point logic below
    let chosen: typeof candidateSides[0] | null = null;
    let bestDist = Infinity;
    for (const c of candidateSides) {
      if (!c.open) continue;
      const cInside = insideBay(c.x, c.z);
      if (!cInside) {
        const d = Math.hypot(end.x - c.x, end.z - c.z);
        if (d < bestDist) { bestDist = d; chosen = c; }
      }
    }

    let approach: 'front' | 'back' | 'left' | 'right' = 'front';
    if (chosen) approach = chosen.side;
    else {
      // Fallback: choose by openness and width heuristics similar to original behavior
      const isWideShelf = uW > shelfDepth;
      if (isWideShelf) {
        if (frontOpen) approach = 'front'; else if (backOpen) approach = 'back'; else if (rightOpen) approach = 'right'; else if (leftOpen) approach = 'left';
      } else {
        if (rightOpen) approach = 'right'; else if (leftOpen) approach = 'left'; else if (frontOpen) approach = 'front'; else if (backOpen) approach = 'back';
      }
    }
    const EPS = 0.01; // tiny epsilon to sit exactly on the face without entering
    let candX = shelfCenterX;
    let candZ = shelfCenterZ;
    if (approach === 'front') candZ = frontFaceZ + (CLEARANCE_CELLS + 0.1);
    if (approach === 'back')  candZ = backFaceZ - (CLEARANCE_CELLS + 0.1);
    if (approach === 'right') candX = shelfRightX + (CLEARANCE_CELLS + 0.1);
    if (approach === 'left')  candX = shelfLeftX - (CLEARANCE_CELLS + 0.1);

    // Compute renderEnd on the exact face line (epsilon outward to remain outside)
    let faceX = shelfCenterX, faceZ = shelfCenterZ;
    if (approach === 'front') faceZ = frontFaceZ + EPS;
    if (approach === 'back')  faceZ = backFaceZ - EPS;
    if (approach === 'right') faceX = shelfRightX + EPS;
    if (approach === 'left')  faceX = shelfLeftX - EPS;
    let dirX = 0, dirZ = 0;
    if (approach === 'front') dirZ = 1;
    if (approach === 'back')  dirZ = -1;
    if (approach === 'right') dirX = 1;
    if (approach === 'left')  dirX = -1;
    let bestX = candX, bestZ = candZ;
    for (let s = 0; s <= 24; s++) {
      const px = candX + dirX * s * 0.25;
      const pz = candZ + dirZ * s * 0.25;
      const cx = Math.floor(px), cz = Math.floor(pz);
      if (cx >= 0 && cx < width && cz >= 0 && cz < depth && grid[cx][cz]) { bestX = px; bestZ = pz; break; }
    }
    correctedGoal = { x: Math.max(0, Math.min(bestX, width - 1)), z: Math.max(0, Math.min(bestZ, depth - 1)), floor };
    renderEnd = { x: Math.max(0, Math.min(faceX, width - 1)), z: Math.max(0, Math.min(faceZ, depth - 1)), floor };
  }
  const goalX = Math.min(width - 1, Math.max(0, Math.floor(correctedGoal.x)));
  const goalZ = Math.min(depth - 1, Math.max(0, Math.floor(correctedGoal.z)));

  // Ensure corrected goal vicinity isn't left with high penalty which could make reaching it difficult
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const gx = goalX + dx;
      const gz = goalZ + dz;
      if (gx >= 0 && gx < width && gz >= 0 && gz < depth) costGrid[gx][gz] = 1;
    }
  }

  // Ensure start point (entrance) is always accessible
  const startX = Math.min(width - 1, Math.max(0, Math.floor(start.x)));
  const startZ = Math.min(depth - 1, Math.max(0, Math.floor(start.z)));
  
  // Force start point and nearby cells to be accessible
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const nx = startX + dx;
      const nz = startZ + dz;
      if (nx >= 0 && nx < width && nz >= 0 && nz < depth) {
        grid[nx][nz] = true; // Force start area to be accessible
        costGrid[nx][nz] = 1; // Ensure start area has normal cost so penalty doesn't trap the route
      }
    }
  }

  const openList: GridNode[] = [];
  const closedList: Set<string> = new Set();

  const startH = Math.hypot(startX - goalX, startZ - goalZ);
  openList.push({ x: startX, z: startZ, g: 0, h: startH, f: startH, parent: null });

  while (openList.length > 0) {
    let currentIndex = 0;
    for (let i = 1; i < openList.length; i++) if (openList[i].f < openList[currentIndex].f) currentIndex = i;
    const current = openList.splice(currentIndex, 1)[0];
    closedList.add(`${current.x},${current.z}`);

    if (current.x === goalX && current.z === goalZ) {
      const path: PathNode[] = [];
      let temp: GridNode | null = current;
      while (temp) { path.push({ x: temp.x + 0.5, z: temp.z + 0.5, floor }); temp = temp.parent; }
      // Set the final node to renderEnd so the path visually touches the face
      path[0] = { ...renderEnd, floor };
      const finalPath = path.reverse();
      // Minimize with line-of-sight shortcutting while respecting clearance
      const minimized = shortcutPath(finalPath, grid, CLEARANCE_CELLS);
      return minimized;
    }

    const directions = [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 }];
    for (const dir of directions) {
      const nx = current.x + dir.x, nz = current.z + dir.z;
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth || closedList.has(`${nx},${nz}`) || !grid[nx][nz]) continue;

      // Prevent diagonal corner cutting (both adjacent orthogonals must be free)
      if (dir.x !== 0 && dir.z !== 0) {
        const adj1x = current.x + dir.x, adj1z = current.z;
        const adj2x = current.x, adj2z = current.z + dir.z;
        if (
          adj1x < 0 || adj1x >= width || adj1z < 0 || adj1z >= depth ||
          adj2x < 0 || adj2x >= width || adj2z < 0 || adj2z >= depth ||
          !grid[adj1x][adj1z] || !grid[adj2x][adj2z]
        ) {
          continue;
        }
      }

      // Do not enforce clearance at neighbor selection to avoid no-path in narrow aisles.
      // Clearance is enforced later during smoothing/centering.

      const baseMove = (dir.x !== 0 && dir.z !== 0) ? Math.SQRT2 : 1;
      const tileCost = costGrid[nx]?.[nz] ?? 1;
      let g = current.g + baseMove * tileCost;
      const h = Math.hypot(nx - goalX, nz - goalZ);
      const f = g + h;
      const existing = openList.find(n => n.x === nx && n.z === nz);
      if (existing && g >= existing.g) continue;
      if (!existing) openList.push({ x: nx, z: nz, g, h, f, parent: current });
      else { existing.g = g; existing.f = f; existing.parent = current; }
    }
  }
  
  // Debug logging when no path found
  console.warn('Pathfinder: No path found', { 
    start: { x: startX, z: startZ }, 
    end: { x: goalX, z: goalZ },
    endAccessible: grid[goalX] && grid[goalX][goalZ],
    startAccessible: grid[startX] && grid[startX][startZ],
    floor
  });
  
  // Fallback: return a minimal straight path so the UI can render while tuning
  return [
    { x: startX + 0.5, z: startZ + 0.5, floor },
    { x: goalX + 0.5, z: goalZ + 0.5, floor }
  ];
};

export const findShortestPath = (config: StoreConfig, start: PathNode, end: PathNode): PathNode[] => {
  if (start.floor === end.floor) {
    return runAStar(config, start.floor!, start, end);
  }

  // Cross-floor routing via nearest elevator
  if (!config.elevators || config.elevators.length === 0) {
    return []; // No elevator info; indicate no route
  }

  const nearestElev = config.elevators.reduce((best, e) => {
    const db = Math.hypot(best.x - start.x, best.z - start.z);
    const de = Math.hypot(e.x - start.x, e.z - start.z);
    return de < db ? e : best;
  });

  const elevOnStart: PathNode = { x: nearestElev.x, z: nearestElev.z, floor: start.floor };
  const elevOnEnd: PathNode = { x: nearestElev.x, z: nearestElev.z, floor: end.floor };

  const leg1 = runAStar(config, start.floor!, start, elevOnStart);
  const leg2 = runAStar(config, end.floor!, elevOnEnd, end);

  return [...leg1, ...leg2];
};
