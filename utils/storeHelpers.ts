
import { StoreConfig, Bay, Zone, Aisle, Department, Shelf } from '../types';

/**
 * Migrate old department structure to new zone/aisle/bay structure
 */
export function migrateStoreConfig(config: any): StoreConfig {
  // If already has zones, return as-is
  if (config.zones && Array.isArray(config.zones)) {
    return config as StoreConfig;
  }

  // If has departments, migrate them
  if (config.departments && Array.isArray(config.departments)) {
    const departments = config.departments as Department[];
    const floors = [...new Set(departments.map(d => d.floor))].sort();
    const zones: Zone[] = [];

    floors.forEach((floor, floorIdx) => {
      const floorDepts = departments.filter(d => d.floor === floor);
      
      const zone: Zone = {
        id: `Z${floorIdx + 1}`,
        name: floor === 0 ? 'Grocery Zone' : 'Electronics & Home Zone',
        aisles: []
      };

      // Group departments into aisles (every 3-4 departments per aisle)
      const deptsPerAisle = 3;
      for (let i = 0; i < floorDepts.length; i += deptsPerAisle) {
        const aisleDepts = floorDepts.slice(i, i + deptsPerAisle);
        const aisle: Aisle = {
          id: `${zone.id}-A${Math.floor(i / deptsPerAisle) + 1}`,
          name: `Aisle ${Math.floor(i / deptsPerAisle) + 1}`,
          bays: aisleDepts.map((dept) => {
            const bay: Bay = {
              id: dept.id,
              name: dept.name,
              floor: dept.floor,
              row: dept.row,
              column: dept.column,
              width: dept.width,
              depth: dept.depth,
              shelves: dept.shelves || [],
              levelCount: dept.levelCount,
              shelfSpacing: dept.shelfSpacing
            };
            return bay;
          })
        };
        zone.aisles.push(aisle);
      }

      zones.push(zone);
    });

    return {
      ...config,
      zones,
      departments: undefined // Remove old departments
    } as StoreConfig;
  }

  // Fallback: return config with empty zones array
  return {
    ...config,
    zones: []
  } as StoreConfig;
}

/**
 * Get all bays from all zones/aisles (flattened list)
 * This provides backward compatibility for code that expects a "departments" array
 */
export function getAllBays(config: StoreConfig): Bay[] {
  const bays: Bay[] = [];
  if (!config.zones || !Array.isArray(config.zones)) {
    return bays;
  }
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      for (const aisle of zone.aisles) {
        if (aisle.bays && Array.isArray(aisle.bays)) {
          bays.push(...aisle.bays);
        }
      }
    }
  }
  return bays;
}

/**
 * Find a bay by its ID
 */
export function findBayById(config: StoreConfig, bayId: string): Bay | undefined {
  if (!config.zones || !Array.isArray(config.zones)) {
    return undefined;
  }
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      for (const aisle of zone.aisles) {
        if (aisle.bays && Array.isArray(aisle.bays)) {
          const bay = aisle.bays.find(b => b.id === bayId);
          if (bay) return bay;
        }
      }
    }
  }
  return undefined;
}

/**
 * Find zone, aisle, and bay for a given bay ID
 */
export function findLocationForBay(config: StoreConfig, bayId: string): { zone: Zone; aisle: Aisle; bay: Bay } | null {
  if (!config.zones || !Array.isArray(config.zones)) {
    return null;
  }
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      for (const aisle of zone.aisles) {
        if (aisle.bays && Array.isArray(aisle.bays)) {
          const bay = aisle.bays.find(b => b.id === bayId);
          if (bay) {
            return { zone, aisle, bay };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Get all unique floors from all bays
 */
export function getAllFloors(config: StoreConfig): number[] {
  const floors = new Set<number>();
  if (!config.zones || !Array.isArray(config.zones)) {
    return [];
  }
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      for (const aisle of zone.aisles) {
        if (aisle.bays && Array.isArray(aisle.bays)) {
          for (const bay of aisle.bays) {
            floors.add(bay.floor);
          }
        }
      }
    }
  }
  return Array.from(floors).sort();
}

/**
 * Get all bays on a specific floor
 */
export function getBaysOnFloor(config: StoreConfig, floor: number): Bay[] {
  return getAllBays(config).filter(bay => bay.floor === floor);
}

/**
 * Get aisle ID for a given bay ID
 */
export function getAisleIdForBay(config: StoreConfig, bayId: string): string | null {
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      for (const aisle of zone.aisles) {
        if (aisle.bays && Array.isArray(aisle.bays)) {
          const bay = aisle.bays.find(b => b.id === bayId);
          if (bay) return aisle.id;
        }
      }
    }
  }
  return null;
}

/**
 * Get a consistent color for an aisle based on its ID
 */
export function getAisleColor(aisleId: string): string {
  const hash = aisleId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const AISLE_COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ef4444', // Red
    '#6366f1', // Indigo
    '#84cc16', // Lime
  ];
  return AISLE_COLORS[hash % AISLE_COLORS.length];
}

/**
 * Get all bays for a specific aisle
 */
export function getBaysForAisle(config: StoreConfig, aisleId: string): Bay[] {
  for (const zone of config.zones) {
    if (zone.aisles && Array.isArray(zone.aisles)) {
      const aisle = zone.aisles.find(a => a.id === aisleId);
      if (aisle && aisle.bays && Array.isArray(aisle.bays)) {
        return aisle.bays;
      }
    }
  }
  return [];
}

/**
 * Calculate the bounding box for an aisle (min/max positions of all bays)
 */
export function getAisleBounds(config: StoreConfig, aisleId: string): { minX: number; maxX: number; minZ: number; maxZ: number; floor: number } | null {
  const bays = getBaysForAisle(config, aisleId);
  if (bays.length === 0) return null;

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let floor = bays[0].floor;

  bays.forEach(bay => {
    minX = Math.min(minX, bay.column);
    maxX = Math.max(maxX, bay.column + bay.width);
    minZ = Math.min(minZ, bay.row);
    maxZ = Math.max(maxZ, bay.row + bay.depth);
  });

  return { minX, maxX, minZ, maxZ, floor };
}

/**
 * Get full location hierarchy for a product (Zone → Aisle → Bay → Shelf)
 */
export function getProductLocation(config: StoreConfig, product: { bayId?: string; departmentId?: string; shelfId?: string }): { zone: Zone; aisle: Aisle; bay: Bay; shelf: Shelf | null } | null {
  const bayId = product.bayId || product.departmentId;
  if (!bayId) return null;

  const location = findLocationForBay(config, bayId);
  if (!location) return null;

  const { zone, aisle, bay } = location;
  
  // Find the shelf if shelfId is provided
  let shelf: Shelf | null = null;
  if (product.shelfId) {
    shelf = bay.shelves.find(s => s.id === product.shelfId) || null;
  }

  return { zone, aisle, bay, shelf };
}

/**
 * Calculate shelf positions based on bay shape
 * Returns array of shelf positions with their world coordinates, rotation, and dimensions
 */
export function calculateShelfPositions(
  bay: Bay
): Array<{ 
  worldX: number; 
  worldZ: number; 
  rotation: number; 
  shelfWidth: number; 
  shelfDepth: number;
  localX: number;
  localZ: number;
}> {
  const { shape = 'rectangle', width, depth, shelves, shelfSpacing = 0 } = bay;
  const numShelves = shelves.length;
  
  if (numShelves === 0) return [];
  
  const positions: Array<{ 
    worldX: number; 
    worldZ: number; 
    rotation: number; 
    shelfWidth: number; 
    shelfDepth: number;
    localX: number;
    localZ: number;
  }> = [];
  
  const bayCenterX = bay.column + bay.width / 2;
  const bayCenterZ = bay.row + bay.depth / 2;
  
  switch (shape) {
    case 'circle': {
      const radius = Math.min(width, depth) / 2 - 1;
      const angleStep = (Math.PI * 2) / numShelves;
      const circumference = 2 * Math.PI * radius;
      const shelfWidth = Math.max(1.5, Math.min(3, circumference / numShelves - 0.5));
      const shelfDepth = Math.min(width, depth) * 0.35;
      
      for (let i = 0; i < numShelves; i++) {
        const angle = i * angleStep;
        const localX = Math.cos(angle) * radius * 0.7;
        const localZ = Math.sin(angle) * radius * 0.7;
        const rotation = angle + Math.PI / 2; // Face outward
        
        positions.push({
          worldX: bayCenterX + localX,
          worldZ: bayCenterZ + localZ,
          rotation,
          shelfWidth,
          shelfDepth,
          localX,
          localZ
        });
      }
      break;
    }
    case 'rectangle':
    default: {
      const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
      const availableWidth = width - totalSpacing;
      const unitWidth = numShelves > 0 ? availableWidth / numShelves : width;
      
      for (let i = 0; i < numShelves; i++) {
        const localX = -width / 2 + unitWidth / 2 + (i * (unitWidth + shelfSpacing));
        positions.push({
          worldX: bayCenterX + localX,
          worldZ: bayCenterZ,
          rotation: 0,
          shelfWidth: Math.max(1, unitWidth - 0.4),
          shelfDepth: depth - 0.5,
          localX,
          localZ: 0
        });
      }
      break;
    }
  }
  
  return positions;
}

