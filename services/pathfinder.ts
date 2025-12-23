
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

// Simplify path by removing unnecessary waypoints (makes paths smoother through departments)
const simplifyPath = (path: PathNode[]): PathNode[] => {
  if (path.length <= 2) return path;
  
  const simplified: PathNode[] = [path[0]]; // Always keep start
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1]; // Last point in simplified path
    const curr = path[i];
    const next = path[i + 1];
    
    // Calculate direction vectors
    const dx1 = curr.x - prev.x;
    const dz1 = curr.z - prev.z;
    const dx2 = next.x - curr.x;
    const dz2 = next.z - curr.z;
    
    // Normalize vectors for comparison
    const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
    const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    
    if (len1 < 0.01 || len2 < 0.01) {
      // Very short segments, keep the point
      simplified.push(curr);
      continue;
    }
    
    // Normalized direction vectors
    const dir1x = dx1 / len1;
    const dir1z = dz1 / len1;
    const dir2x = dx2 / len2;
    const dir2z = dz2 / len2;
    
    // Check if directions are similar (dot product close to 1 means same direction)
    const dotProduct = dir1x * dir2x + dir1z * dir2z;
    const angleThreshold = 0.95; // ~18 degrees tolerance
    
    // If direction changes significantly, keep this point
    if (dotProduct < angleThreshold) {
      simplified.push(curr);
    }
    // Otherwise, skip this point (it's collinear/unnecessary)
  }
  
  simplified.push(path[path.length - 1]); // Always keep end
  return simplified;
}

const runAStar = (config: StoreConfig, floor: number, start: PathNode, end: PathNode): PathNode[] => {
  const { width, depth } = config.gridSize;
  const grid: boolean[][] = Array.from({ length: width }, () => new Array(depth).fill(true));

  const allBays = getAllBays(config);
  const targetBay = allBays.find(bay =>
    bay.floor === floor &&
    end.x >= bay.column && end.x <= bay.column + bay.width &&
    end.z >= bay.row && end.z <= bay.row + bay.depth
  );

  allBays.forEach((bay) => {
    if (bay.floor !== floor) return;

    const shelfSpacing = bay.shelfSpacing ?? 0;
    const numShelves = bay.shelves.length;
    const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
    const availableWidth = bay.width - totalSpacing;
    const unitWidth = numShelves > 0 ? availableWidth / numShelves : bay.width;
    
    // Minimum spacing required to walk through (0.8 units = ~80cm, reasonable for walking)
    const minWalkableSpacing = 0.8;
    const canWalkThroughGaps = shelfSpacing >= minWalkableSpacing && numShelves > 1;

    // Block individual shelves (not the entire bay) to allow paths through gaps
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
      const buffer = 0.1; // Small buffer around shelf
      const safeDistance = 0.8; // Safe distance from shelf face (matches App.tsx)
      
      for (let x = Math.floor(shelfLeftX - buffer); x <= Math.floor(shelfRightX + buffer); x++) {
        // Block entire shelf depth (from backFaceZ to frontFaceZ)
        for (let z = Math.floor(backFaceZ - buffer); z <= Math.floor(frontFaceZ + buffer); z++) {
          if (x < 0 || x >= width || z < 0 || z >= depth) continue;

          // Skip blocking if this node is near the endpoint (for endpoint connectivity)
          const nodeX = x + 0.5, nodeZ = z + 0.5;
          const distToEnd = Math.sqrt((nodeX - end.x) ** 2 + (nodeZ - end.z) ** 2);
          
          // Allow endpoint area - endpoint is at safeDistance (0.8) from shelf face
          // Check if this node is near the endpoint (within 1.0 units)
          if (distToEnd < 1.0) {
            // Check if this node is in the endpoint area (outside shelf, at safe distance)
            const isInFrontAisle = nodeZ >= frontFaceZ + safeDistance - 0.3 && nodeZ <= frontFaceZ + safeDistance + 0.3;
            const isInBackAisle = nodeZ <= backFaceZ - safeDistance + 0.3 && nodeZ >= backFaceZ - safeDistance - 0.3;
            const isInRightAisle = nodeX >= shelfRightX + safeDistance - 0.3 && nodeX <= shelfRightX + safeDistance + 0.3;
            const isInLeftAisle = nodeX <= shelfLeftX - safeDistance + 0.3 && nodeX >= shelfLeftX - safeDistance - 0.3;
            
            // Allow if it's in the endpoint area (aisle space, not shelf interior)
            if ((isInFrontAisle || isInBackAisle || isInRightAisle || isInLeftAisle) && 
                (nodeZ < backFaceZ || nodeZ > frontFaceZ || nodeX < shelfLeftX || nodeX > shelfRightX)) {
              continue; // Allow endpoint area
            }
          }

          grid[x][z] = false; // Block shelf interior
        }
      }
      
      // Keep gaps between shelves accessible (if spacing exists)
      // Gaps are naturally accessible since we only block individual shelves above

      // Block front face area if front is closed - NEVER allow paths through closed faces
      if (closedSides.includes('front')) {
        // Block area in front of the closed front face (from front face outward)
        // Block a wider area to prevent paths from getting too close
        for (let x = Math.floor(shelfLeftX - 0.5); x <= Math.floor(shelfRightX + 0.5); x++) {
          for (let z = Math.floor(frontFaceZ); z <= Math.floor(frontFaceZ + 2.5); z++) {
            if (x < 0 || x >= width || z < 0 || z >= depth) continue;
            // Always block closed faces - no exemption near target
            grid[x][z] = false;
          }
        }
      }

      // Block back face area if back is closed - NEVER allow paths through closed faces
      const isBackClosed = closedSides === undefined || closedSides.length === 0 || closedSides.includes('back');
      if (isBackClosed) {
        // Block area behind the closed back face (from back face outward)
        // Block a wider area to prevent paths from getting too close
        for (let x = Math.floor(shelfLeftX - 0.5); x <= Math.floor(shelfRightX + 0.5); x++) {
          for (let z = Math.floor(backFaceZ - 2.5); z <= Math.floor(backFaceZ); z++) {
            if (x < 0 || x >= width || z < 0 || z >= depth) continue;
            // Always block closed faces - no exemption near target
            grid[x][z] = false;
          }
        }
      }
      
      // Block left/right face areas if they are closed
      if (closedSides.includes('left')) {
        // Block area to the left of the closed left face
        for (let x = Math.floor(shelfLeftX - 2.5); x <= Math.floor(shelfLeftX); x++) {
          for (let z = Math.floor(backFaceZ - 0.5); z <= Math.floor(frontFaceZ + 0.5); z++) {
            if (x < 0 || x >= width || z < 0 || z >= depth) continue;
            grid[x][z] = false;
          }
        }
      }
      
      if (closedSides.includes('right')) {
        // Block area to the right of the closed right face
        for (let x = Math.floor(shelfRightX); x <= Math.floor(shelfRightX + 2.5); x++) {
          for (let z = Math.floor(backFaceZ - 0.5); z <= Math.floor(frontFaceZ + 0.5); z++) {
            if (x < 0 || x >= width || z < 0 || z >= depth) continue;
            grid[x][z] = false;
          }
        }
      }
    });

    // Ensure aisle areas around bay remain accessible for better path routing
    // Aisles are the areas in front/behind the bay (outside shelf blocking zones)
    // These should remain open for natural path routing
    const aisleBuffer = 1.0; // Aisle width around bay
    
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
  });

  // Ensure endpoint cell and nearby cells are always accessible
  // This ensures the path can reach the destination point safely
  const endX = Math.min(width - 1, Math.max(0, Math.floor(end.x)));
  const endZ = Math.min(depth - 1, Math.max(0, Math.floor(end.z)));
  
  // Ensure endpoint and adjacent cells are accessible for path connectivity
  // Use a larger area (3x3) to ensure connectivity and account for safe distance
  // This creates a clear access zone around the endpoint
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const nx = endX + dx;
      const nz = endZ + dz;
      if (nx >= 0 && nx < width && nz >= 0 && nz < depth) {
        // Only force accessibility if it's not already blocked by a closed face
        // Check if this cell is in a blocked area (we'll allow it if it's near endpoint)
        const nodeX = nx + 0.5;
        const nodeZ = nz + 0.5;
        const distToEnd = Math.sqrt((nodeX - end.x) ** 2 + (nodeZ - end.z) ** 2);
        
        // Force accessibility within 1.5 units of endpoint (safe walking area)
        if (distToEnd < 1.5) {
          grid[nx][nz] = true; // Force endpoint area to be accessible
        }
      }
    }
  }

  const openList: GridNode[] = [];
  const closedList: Set<string> = new Set();
  const startX = Math.min(width - 1, Math.max(0, Math.floor(start.x)));
  const startZ = Math.min(depth - 1, Math.max(0, Math.floor(start.z)));

  openList.push({ x: startX, z: startZ, g: 0, h: Math.abs(startX - endX) + Math.abs(startZ - endZ), f: 0, parent: null });

  while (openList.length > 0) {
    let currentIndex = 0;
    for (let i = 1; i < openList.length; i++) if (openList[i].f < openList[currentIndex].f) currentIndex = i;
    const current = openList.splice(currentIndex, 1)[0];
    closedList.add(`${current.x},${current.z}`);

    if (current.x === endX && current.z === endZ) {
      const path: PathNode[] = [];
      let temp: GridNode | null = current;
      while (temp) { path.push({ x: temp.x + 0.5, z: temp.z + 0.5, floor }); temp = temp.parent; }
      path[0] = { ...end, floor };
      let finalPath = path.reverse();
      
      // Smooth the path by removing unnecessary waypoints (path simplification)
      // This makes paths through departments look more natural
      if (finalPath.length > 2) {
        finalPath = simplifyPath(finalPath);
      }
      
      // Ensure endpoint matches exactly (for accuracy)
      if (finalPath.length > 0) {
        finalPath[finalPath.length - 1] = { ...end, floor };
      }
      
      // Debug logging for troubleshooting
      if (finalPath.length === 0) {
        console.warn('Pathfinder: Path found but is empty', { start, end, endX, endZ });
      }
      
      return finalPath;
    }

    const directions = [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 }];
    for (const dir of directions) {
      const nx = current.x + dir.x, nz = current.z + dir.z;
      if (nx < 0 || nx >= width || nz < 0 || nz >= depth || closedList.has(`${nx},${nz}`) || !grid[nx][nz]) continue;
      const g = current.g + ((dir.x !== 0 && dir.z !== 0) ? 1.4 : 1);
      const h = Math.abs(nx - endX) + Math.abs(nz - endZ);
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
    end: { x: endX, z: endZ },
    endAccessible: grid[endX] && grid[endX][endZ],
    startAccessible: grid[startX] && grid[startX][startZ]
  });
  
  return [];
};

export const findShortestPath = (config: StoreConfig, start: PathNode, end: PathNode): PathNode[] => {
  if (start.floor === end.floor) return runAStar(config, start.floor!, start, end);

  // Cross-floor routing: Find closest elevator to start
  const closestElevator = config.elevators.reduce((prev, curr) => {
    const dPrev = Math.abs(prev.x - start.x) + Math.abs(prev.z - start.z);
    const dCurr = Math.abs(curr.x - start.x) + Math.abs(curr.z - start.z);
    return dCurr < dPrev ? prev : prev;
  });

  const path1 = runAStar(config, start.floor!, start, closestElevator);
  const path2 = runAStar(config, end.floor!, closestElevator, end);
  return [...path1, ...path2];
};
