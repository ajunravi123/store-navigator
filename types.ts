
export interface Shelf {
  id: string;
  name: string;
  levelCount?: number;
}

export interface Department {
  id: string;
  name: string;
  floor: number;
  row: number;
  column: number;
  width: number;
  depth: number;
  shelves: Shelf[];
  levelCount?: number;
}

export interface StoreConfig {
  gridSize: { width: number; depth: number };
  entrance: { x: number; z: number; floor: number };
  elevators: { x: number; z: number }[];
  departments: Department[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  departmentId: string;
  shelfId: string;
  image?: string;
  levels?: number[];
}

export interface PathNode {
  x: number;
  z: number;
  floor?: number;
}

export interface AIRecommendation {
  explanation: string;
  productIds: string[];
}
