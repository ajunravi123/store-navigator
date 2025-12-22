
import { StoreConfig, Product } from './types';

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  gridSize: { width: 50, depth: 60 },
  entrance: { x: 25, z: 58, floor: 0 },
  elevators: [
    { x: 5, z: 5 },
    { x: 45, z: 5 },
    { x: 25, z: 5 }
  ],
  departments: [
    // FLOOR 0 - Grocery & Fresh Produce
    // Aisle 1: Dairy & Frozen (Left Side)
    {
      id: 'S1', name: 'Fresh Milk', floor: 0, row: 10, column: 5, width: 8, depth: 4,
      shelves: [{ id: 'S1-A', name: 'Organic' }, { id: 'S1-B', name: 'Standard' }]
    },
    {
      id: 'S2', name: 'Cheese & Deli', floor: 0, row: 18, column: 5, width: 8, depth: 4,
      shelves: [{ id: 'S2-A', name: 'Imported' }, { id: 'S2-B', name: 'Local' }]
    },
    {
      id: 'S3', name: 'Frozen Meals', floor: 0, row: 30, column: 5, width: 8, depth: 6,
      shelves: [{ id: 'S3-A', name: 'Pizza' }, { id: 'S3-B', name: 'Veggie' }]
    },

    // Aisle 2: Pantry & Dry Goods (Center-Left)
    {
      id: 'S4', name: 'Cereal & Breakfast', floor: 0, row: 10, column: 18, width: 6, depth: 8,
      shelves: [{ id: 'S4-A', name: 'Kids' }, { id: 'S4-B', name: 'Healthy' }]
    },
    {
      id: 'S5', name: 'Pasta & Sauces', floor: 0, row: 22, column: 18, width: 6, depth: 8,
      shelves: [{ id: 'S5-A', name: 'Italian' }, { id: 'S5-B', name: 'Asian' }]
    },
    {
      id: 'S6', name: 'Canned Goods', floor: 0, row: 34, column: 18, width: 6, depth: 8,
      shelves: [{ id: 'S6-A', name: 'Soups' }, { id: 'S6-B', name: 'Vegetables' }]
    },

    // Aisle 3: Snacks & Beverages (Center-Right)
    {
      id: 'S7', name: 'Salty Snacks', floor: 0, row: 10, column: 30, width: 6, depth: 8,
      shelves: [{ id: 'S7-A', name: 'Chips' }, { id: 'S7-B', name: 'Popcorn' }]
    },
    {
      id: 'S8', name: 'Soft Drinks', floor: 0, row: 22, column: 30, width: 6, depth: 8,
      shelves: [{ id: 'S8-A', name: 'Cola' }, { id: 'S8-B', name: 'Water' }]
    },
    {
      id: 'S9', name: 'Confectionery', floor: 0, row: 34, column: 30, width: 6, depth: 8,
      shelves: [{ id: 'S9-A', name: 'Chocolate' }, { id: 'S9-B', name: 'Candy' }]
    },

    // Aisle 4: Bakery & Produce (Right Side)
    {
      id: 'S10', name: 'Bakery', floor: 0, row: 10, column: 42, width: 6, depth: 10,
      shelves: [{ id: 'S10-A', name: 'Breads' }, { id: 'S10-B', name: 'Pastries' }]
    },
    {
      id: 'S11', name: 'Fresh Fruit', floor: 0, row: 25, column: 42, width: 6, depth: 6,
      shelves: [{ id: 'S11-A', name: 'Tropical' }, { id: 'S11-B', name: 'Apples' }]
    },

    // FLOOR 1 - Electronics, Home & Hobby
    // Tech Department
    {
      id: 'S12', name: 'Computers', floor: 1, row: 10, column: 5, width: 12, depth: 4,
      shelves: [{ id: 'S12-A', name: 'Gaming Laptops' }, { id: 'S12-B', name: 'Business' }]
    },
    {
      id: 'S13', name: 'Mobile Tech', floor: 1, row: 18, column: 5, width: 12, depth: 4,
      shelves: [{ id: 'S13-A', name: 'Smartphones' }, { id: 'S13-B', name: 'Tablets' }]
    },
    {
      id: 'S14', name: 'TV & Audio', floor: 1, row: 30, column: 5, width: 12, depth: 8,
      shelves: [{ id: 'S14-A', name: 'OLED TVs' }, { id: 'S14-B', name: 'Soundbars' }]
    },

    // Home Department
    {
      id: 'S15', name: 'Kitchenware', floor: 1, row: 10, column: 22, width: 8, depth: 10,
      shelves: [{ id: 'S15-A', name: 'Cookware' }, { id: 'S15-B', name: 'Cutlery' }]
    },
    {
      id: 'S16', name: 'Appliances', floor: 1, row: 25, column: 22, width: 8, depth: 10,
      shelves: [{ id: 'S16-A', name: 'Vacuums' }, { id: 'S16-B', name: 'Laundry' }]
    },

    // Toys & Games
    {
      id: 'S17', name: 'Action Figures', floor: 1, row: 10, column: 35, width: 10, depth: 6,
      shelves: [{ id: 'S17-A', name: 'Collectibles' }, { id: 'S17-B', name: 'Retro' }]
    },
    {
      id: 'S18', name: 'Board Games', floor: 1, row: 20, column: 35, width: 10, depth: 6,
      shelves: [{ id: 'S18-A', name: 'Strategy' }, { id: 'S18-B', name: 'Family' }]
    },
    {
      id: 'S19', name: 'Video Games', floor: 1, row: 30, column: 35, width: 10, depth: 6,
      shelves: [{ id: 'S19-A', name: 'PS5' }, { id: 'S19-B', name: 'Switch' }]
    }
  ]
};

export const DEFAULT_PRODUCTS: Product[] = [
  // Grocery
  { id: 'P1', name: 'Organic Whole Milk', category: 'Dairy', departmentId: 'S1', shelfId: 'S1-A', image: 'https://picsum.photos/seed/milk1/400/400' },
  { id: 'P2', name: 'Blueberry Yogurt', category: 'Dairy', departmentId: 'S1', shelfId: 'S1-B', image: 'https://picsum.photos/seed/yogurt/400/400' },
  { id: 'P3', name: 'Cheddar Block', category: 'Deli', departmentId: 'S2', shelfId: 'S2-B', image: 'https://picsum.photos/seed/cheese/400/400' },
  { id: 'P4', name: 'Frozen Pepperoni Pizza', category: 'Frozen', departmentId: 'S3', shelfId: 'S3-A', image: 'https://picsum.photos/seed/pizza/400/400' },
  { id: 'P5', name: 'Honey Nut O\'s', category: 'Breakfast', departmentId: 'S4', shelfId: 'S4-A', image: 'https://picsum.photos/seed/cereal/400/400' },
  { id: 'P6', name: 'Spaghetti Pasta', category: 'Pantry', departmentId: 'S5', shelfId: 'S5-A', image: 'https://picsum.photos/seed/pasta/400/400' },
  { id: 'P7', name: 'Tomato Basil Sauce', category: 'Pantry', departmentId: 'S5', shelfId: 'S5-A', image: 'https://picsum.photos/seed/sauce/400/400' },
  { id: 'P8', name: 'Chicken Noodle Soup', category: 'Canned', departmentId: 'S6', shelfId: 'S6-A', image: 'https://picsum.photos/seed/soup/400/400' },
  { id: 'P9', name: 'Classic Potato Chips', category: 'Snacks', departmentId: 'S7', shelfId: 'S7-A', image: 'https://picsum.photos/seed/chips2/400/400' },
  { id: 'P10', name: 'Sparkling Water 6pk', category: 'Beverages', departmentId: 'S8', shelfId: 'S8-B', image: 'https://picsum.photos/seed/water/400/400' },
  { id: 'P11', name: 'Dark Chocolate Bar', category: 'Confectionery', departmentId: 'S9', shelfId: 'S9-A', image: 'https://picsum.photos/seed/choc/400/400' },
  { id: 'P12', name: 'Sourdough Loaf', category: 'Bakery', departmentId: 'S10', shelfId: 'S10-A', image: 'https://picsum.photos/seed/bread2/400/400' },
  { id: 'P13', name: 'Fresh Bananas', category: 'Produce', departmentId: 'S11', shelfId: 'S11-A', image: 'https://picsum.photos/seed/bananas/400/400' },

  // Electronics
  { id: 'P14', name: 'Pro Gaming Laptop', category: 'Electronics', departmentId: 'S12', shelfId: 'S12-A', image: 'https://picsum.photos/seed/gaming/400/400' },
  { id: 'P15', name: 'Smartphone Ultra', category: 'Electronics', departmentId: 'S13', shelfId: 'S13-A', image: 'https://picsum.photos/seed/phone/400/400' },
  { id: 'P16', name: '65" OLED 4K TV', category: 'Electronics', departmentId: 'S14', shelfId: 'S14-A', image: 'https://picsum.photos/seed/tv/400/400' },
  { id: 'P17', name: 'Cast Iron Skillet', category: 'Home', departmentId: 'S15', shelfId: 'S15-A', image: 'https://picsum.photos/seed/skillet/400/400' },
  { id: 'P18', name: 'Robot Vacuum Cleaner', category: 'Home', departmentId: 'S16', shelfId: 'S16-A', image: 'https://picsum.photos/seed/vacuum/400/400' },
  { id: 'P19', name: 'Legendary Action Figure', category: 'Toys', departmentId: 'S17', shelfId: 'S17-A', image: 'https://picsum.photos/seed/action/400/400' },
  { id: 'P20', name: 'Space Strategy Game', category: 'Games', departmentId: 'S18', shelfId: 'S18-A', image: 'https://picsum.photos/seed/boardgame/400/400' },
  { id: 'P21', name: 'RPG Master Edition PS5', category: 'Games', departmentId: 'S19', shelfId: 'S19-A', image: 'https://picsum.photos/seed/ps5/400/400' }
];
