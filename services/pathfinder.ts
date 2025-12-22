
import { PathNode, StoreConfig } from '../types';

interface GridNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

const runAStar = (config: StoreConfig, floor: number, start: PathNode, end: PathNode): PathNode[] => {
  const { width, depth } = config.gridSize;
  const grid: boolean[][] = Array.from({ length: width }, () => new Array(depth).fill(true));

  const targetDepartment = config.departments.find(dept =>
    dept.floor === floor &&
    end.x >= dept.column && end.x <= dept.column + dept.width &&
    end.z >= dept.row && end.z <= dept.row + dept.depth
  );

  config.departments.forEach((dept) => {
    if (dept.floor !== floor) return;

    const buffer = 1.5;
    for (let x = Math.floor(dept.column - buffer); x < Math.floor(dept.column + dept.width + buffer); x++) {
      for (let z = Math.floor(dept.row - buffer); z < Math.floor(dept.row + dept.depth + buffer); z++) {
        if (x < 0 || x >= width || z < 0 || z >= depth) continue;

        // Skip blocking if this node is near start or end points.
        // We use a larger exemption (3.0) to ensure the target cell connects to the aisle.
        const nodeX = x + 0.5, nodeZ = z + 0.5;
        const distToStart = Math.sqrt((nodeX - start.x) ** 2 + (nodeZ - start.z) ** 2);
        const distToEnd = Math.sqrt((nodeX - end.x) ** 2 + (nodeZ - end.z) ** 2);
        if (distToStart < 3.0 || distToEnd < 3.0) continue;

        grid[x][z] = false;
      }
    }
  });

  const openList: GridNode[] = [];
  const closedList: Set<string> = new Set();
  const startX = Math.min(width - 1, Math.max(0, Math.floor(start.x)));
  const startZ = Math.min(depth - 1, Math.max(0, Math.floor(start.z)));
  const endX = Math.min(width - 1, Math.max(0, Math.floor(end.x)));
  const endZ = Math.min(depth - 1, Math.max(0, Math.floor(end.z)));

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
      return path.reverse();
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
