
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
    {
      id: 'S1',
      name: 'Fresh Milk',
      levelCount: 5,
      floor: 0,
      row: 10,
      column: 5,
      width: 8,
      depth: 4,
      shelves: [
        { id: 'S1-A', name: 'Organic', levelCount: 5 },
        { id: 'S1-B', name: 'Standard', levelCount: 5 }
      ]
    },
    {
      id: 'S2',
      name: 'Cheese & Deli',
      levelCount: 5,
      floor: 0,
      row: 18,
      column: 5,
      width: 8,
      depth: 4,
      shelves: [
        { id: 'S2-A', name: 'Imported', levelCount: 5 },
        { id: 'S2-B', name: 'Local', levelCount: 5 }
      ]
    },
    {
      id: 'S3',
      name: 'Frozen Meals',
      levelCount: 5,
      floor: 0,
      row: 30,
      column: 5,
      width: 8,
      depth: 6,
      shelves: [
        { id: 'S3-A', name: 'Pizza', levelCount: 5 },
        { id: 'S3-B', name: 'Veggie', levelCount: 5 }
      ]
    },
    {
      id: 'S4',
      name: 'Cereal & Breakfast',
      levelCount: 5,
      floor: 0,
      row: 10,
      column: 18,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S4-A', name: 'Kids', levelCount: 5 },
        { id: 'S4-B', name: 'Healthy', levelCount: 5 }
      ]
    },
    {
      id: 'S5',
      name: 'Pasta & Sauces',
      levelCount: 5,
      floor: 0,
      row: 22,
      column: 18,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S5-A', name: 'Italian', levelCount: 5 },
        { id: 'S5-B', name: 'Asian', levelCount: 5 }
      ]
    },
    {
      id: 'S6',
      name: 'Canned Goods',
      levelCount: 5,
      floor: 0,
      row: 34,
      column: 18,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S6-A', name: 'Soups', levelCount: 5 },
        { id: 'S6-B', name: 'Vegetables', levelCount: 5 }
      ]
    },
    {
      id: 'S7',
      name: 'Salty Snacks',
      levelCount: 5,
      floor: 0,
      row: 10,
      column: 30,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S7-A', name: 'Chips', levelCount: 5 },
        { id: 'S7-B', name: 'Popcorn', levelCount: 5 }
      ]
    },
    {
      id: 'S8',
      name: 'Soft Drinks',
      levelCount: 5,
      floor: 0,
      row: 22,
      column: 30,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S8-A', name: 'Cola', levelCount: 5 },
        { id: 'S8-B', name: 'Water', levelCount: 5 }
      ]
    },
    {
      id: 'S9',
      name: 'Confectionery',
      levelCount: 5,
      floor: 0,
      row: 34,
      column: 30,
      width: 6,
      depth: 8,
      shelves: [
        { id: 'S9-A', name: 'Chocolate', levelCount: 5 },
        { id: 'S9-B', name: 'Candy', levelCount: 5 }
      ]
    },
    {
      id: 'S10',
      name: 'Bakery',
      levelCount: 5,
      floor: 0,
      row: 10,
      column: 42,
      width: 6,
      depth: 10,
      shelves: [
        { id: 'S10-A', name: 'Breads', levelCount: 5 },
        { id: 'S10-B', name: 'Pastries', levelCount: 5 }
      ]
    },
    {
      id: 'S11',
      name: 'Fresh Fruit',
      levelCount: 5,
      floor: 0,
      row: 25,
      column: 42,
      width: 6,
      depth: 6,
      shelves: [
        { id: 'S11-A', name: 'Tropical', levelCount: 5 },
        { id: 'S11-B', name: 'Apples', levelCount: 5 }
      ]
    },
    {
      id: 'S12',
      name: 'Computers',
      levelCount: 5,
      floor: 1,
      row: 10,
      column: 5,
      width: 12,
      depth: 4,
      shelves: [
        { id: 'S12-A', name: 'Gaming Laptops', levelCount: 5 },
        { id: 'S12-B', name: 'Business', levelCount: 5 }
      ]
    },
    {
      id: 'S13',
      name: 'Mobile Tech',
      levelCount: 5,
      floor: 1,
      row: 18,
      column: 5,
      width: 12,
      depth: 4,
      shelves: [
        { id: 'S13-A', name: 'Smartphones', levelCount: 5 },
        { id: 'S13-B', name: 'Tablets', levelCount: 5 }
      ]
    },
    {
      id: 'S14',
      name: 'TV & Audio',
      levelCount: 5,
      floor: 1,
      row: 30,
      column: 5,
      width: 12,
      depth: 8,
      shelves: [
        { id: 'S14-A', name: 'OLED TVs', levelCount: 5 },
        { id: 'S14-B', name: 'Soundbars', levelCount: 5 }
      ]
    },
    {
      id: 'S15',
      name: 'Kitchenware',
      levelCount: 5,
      floor: 1,
      row: 10,
      column: 22,
      width: 8,
      depth: 10,
      shelves: [
        { id: 'S15-A', name: 'Cookware', levelCount: 5 },
        { id: 'S15-B', name: 'Cutlery', levelCount: 5 }
      ]
    },
    {
      id: 'S16',
      name: 'Appliances',
      levelCount: 5,
      floor: 1,
      row: 25,
      column: 22,
      width: 8,
      depth: 10,
      shelves: [
        { id: 'S16-A', name: 'Vacuums', levelCount: 5 },
        { id: 'S16-B', name: 'Laundry', levelCount: 5 }
      ]
    },
    {
      id: 'S17',
      name: 'Action Figures',
      levelCount: 5,
      floor: 1,
      row: 10,
      column: 35,
      width: 10,
      depth: 6,
      shelves: [
        { id: 'S17-A', name: 'Collectibles', levelCount: 5 },
        { id: 'S17-B', name: 'Retro', levelCount: 5 }
      ]
    },
    {
      id: 'S18',
      name: 'Board Games',
      levelCount: 5,
      floor: 1,
      row: 20,
      column: 35,
      width: 10,
      depth: 6,
      shelves: [
        { id: 'S18-A', name: 'Strategy', levelCount: 5 },
        { id: 'S18-B', name: 'Family', levelCount: 5 }
      ]
    },
    {
      id: 'S19',
      name: 'Video Games',
      levelCount: 5,
      floor: 1,
      row: 30,
      column: 35,
      width: 10,
      depth: 6,
      shelves: [
        { id: 'S19-A', name: 'PS5', levelCount: 5 },
        { id: 'S19-B', name: 'Switch', levelCount: 5 }
      ]
    }
  ]
};

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'P1',
    name: 'Organic Whole Milk',
    category: 'Dairy',
    departmentId: 'S1',
    shelfId: 'S1-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/KlrTYcRXgsZmMLPx.png'
  },
  {
    id: 'P2',
    name: 'Blueberry Yogurt',
    category: 'Dairy',
    departmentId: 'S1',
    shelfId: 'S1-B',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/USlGGiKIQFHKNZGb.png'
  },
  {
    id: 'P3',
    name: 'Cheddar Block',
    category: 'Deli',
    departmentId: 'S2',
    shelfId: 'S2-B',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/ohFNuPOYtAEgGBgt.png'
  },
  {
    id: 'P4',
    name: 'Frozen Pepperoni Pizza',
    category: 'Frozen',
    departmentId: 'S3',
    shelfId: 'S3-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/RrKIoZzBwfExaVXJ.png'
  },
  {
    id: 'P5',
    name: 'Honey Nut O\'s',
    category: 'Breakfast',
    departmentId: 'S4',
    shelfId: 'S4-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/vejuQHHmqyTlityb.png'
  },
  {
    id: 'P6',
    name: 'Spaghetti Pasta',
    category: 'Pantry',
    departmentId: 'S5',
    shelfId: 'S5-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/DrvNgruUtgUkRpws.png'
  },
  {
    id: 'P7',
    name: 'Tomato Basil Sauce',
    category: 'Pantry',
    departmentId: 'S5',
    shelfId: 'S5-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/HxqpAUTMjnOguUXz.png'
  },
  {
    id: 'P8',
    name: 'Chicken Noodle Soup',
    category: 'Canned',
    departmentId: 'S6',
    shelfId: 'S6-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/NsMygnwfYcFNDczd.png'
  },
  {
    id: 'P9',
    name: 'Classic Potato Chips',
    category: 'Snacks',
    departmentId: 'S7',
    shelfId: 'S7-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/HrbXAkOeeMcqLNLe.png'
  },
  {
    id: 'P10',
    name: 'Sparkling Water 6pk',
    category: 'Beverages',
    departmentId: 'S8',
    shelfId: 'S8-B',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/MlGLTsqJUVyIaTFj.png'
  },
  {
    id: 'P11',
    name: 'Dark Chocolate Bar',
    category: 'Confectionery',
    departmentId: 'S9',
    shelfId: 'S9-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/dJbkuqVkxAbwtbhr.png'
  },
  {
    id: 'P12',
    name: 'Sourdough Loaf',
    category: 'Bakery',
    departmentId: 'S10',
    shelfId: 'S10-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/gnLqnNRnYhHQPmzj.png'
  },
  {
    id: 'P13',
    name: 'Fresh Bananas',
    category: 'Produce',
    departmentId: 'S11',
    shelfId: 'S11-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/fJjRZqkQgrSbPKQP.png'
  },
  {
    id: 'P14',
    name: 'Pro Gaming Laptop',
    category: 'Electronics',
    departmentId: 'S12',
    shelfId: 'S12-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/IuIjkVpuAjviGAAr.png'
  },
  {
    id: 'P15',
    name: 'Smartphone Ultra',
    category: 'Electronics',
    departmentId: 'S13',
    shelfId: 'S13-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/raeZhHdzRPczTHkB.png'
  },
  {
    id: 'P16',
    name: '65" OLED 4K TV',
    category: 'Electronics',
    departmentId: 'S14',
    shelfId: 'S14-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/xbqVtCEGApjgAhvO.png'
  },
  {
    id: 'P17',
    name: 'Cast Iron Skillet',
    category: 'Home',
    departmentId: 'S15',
    shelfId: 'S15-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/ClhjHFDZzlXFrlvv.png'
  },
  {
    id: 'P18',
    name: 'Robot Vacuum Cleaner',
    category: 'Home',
    departmentId: 'S16',
    shelfId: 'S16-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/nCsaZKnnEbxNpzDs.png'
  },
  {
    id: 'P19',
    name: 'Legendary Action Figure',
    category: 'Toys',
    departmentId: 'S17',
    shelfId: 'S17-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/dJzzGGbAdSoZdLRV.png'
  },
  {
    id: 'P20',
    name: 'Space Strategy Game',
    category: 'Games',
    departmentId: 'S18',
    shelfId: 'S18-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/zfDTeZCCtgZoYDrw.png'
  },
  {
    id: 'P21',
    name: 'RPG Master Edition PS5',
    category: 'Games',
    departmentId: 'S19',
    shelfId: 'S19-A',
    levels: [0, 1],
    image: 'https://files.manuscdn.com/user_upload_by_module/session_file/115397999/PIIApjZksxBabRZY.png'
  }
];
