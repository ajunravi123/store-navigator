
import React, { useState, useMemo, useEffect } from 'react';
import { StoreConfig, Product, PathNode } from './types';
import { DEFAULT_STORE_CONFIG, DEFAULT_PRODUCTS } from './constants';
import Store3D from './components/Store3D';
import Settings from './components/Settings';
import AIConsultant from './components/AIConsultant';
import { findShortestPath } from './services/pathfinder';
import { findBayById, getAllFloors, migrateStoreConfig, getProductLocation, getAisleColor } from './utils/storeHelpers';
import { Search, Navigation2, X, Info, Target, Layers, DoorOpen, Navigation, Settings as SettingsIcon, LayoutGrid, Bot, Package } from 'lucide-react';

type AppView = 'explorer' | 'settings';

const App: React.FC = () => {
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<AppView>('explorer');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentMapFloor, setCurrentMapFloor] = useState(0);

  // AI States
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [aiHighlightedIds, setAiHighlightedIds] = useState<string[]>([]);

  // Load data from server on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const storeRes = await fetch('/api/store');
        const prodRes = await fetch('/api/products');

        if (storeRes.ok && prodRes.ok) {
          const storeData = await storeRes.json();
          const prodData = await prodRes.json();
          // Migrate old structure to new structure if needed
          const migratedStore = migrateStoreConfig(storeData);
          setStoreConfig(migratedStore);
          setProducts(prodData);
        } else {
          setStoreConfig(DEFAULT_STORE_CONFIG);
          setProducts(DEFAULT_PRODUCTS);
        }
      } catch (e) {
        console.error("Failed to fetch data:", e);
        setStoreConfig(DEFAULT_STORE_CONFIG);
        setProducts(DEFAULT_PRODUCTS);
      }
    };

    fetchData();
  }, []);

  const handleUpdateConfig = async (store: StoreConfig, prods: Product[]) => {
    try {
      const storeRes = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
      });
      const prodRes = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prods)
      });

      if (storeRes.ok && prodRes.ok) {
        setStoreConfig(store);
        setProducts(prods);
        setView('explorer');
      } else {
        alert('Failed to save data to server');
      }
    } catch (e) {
      console.error("Failed to save data:", e);
      alert('Error saving data to server. Is the backend running?');
    }
  };

  const filteredProducts = useMemo(() => {
    let list = products;
    if (aiHighlightedIds.length > 0) {
      // Prioritize AI matches
      const matches = products.filter(p => aiHighlightedIds.includes(p.id));
      const others = products.filter(p => !aiHighlightedIds.includes(p.id));
      list = [...matches, ...others];
    }

    return list.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery, aiHighlightedIds]);

  const targetBay = useMemo(() => {
    if (!storeConfig || !activeProduct) return null;
    const bayId = activeProduct.bayId || activeProduct.departmentId;
    return bayId ? findBayById(storeConfig, bayId) : null;
  }, [storeConfig, activeProduct]);

  const productLocation = useMemo(() => {
    if (!storeConfig || !activeProduct) return null;
    return getProductLocation(storeConfig, activeProduct);
  }, [storeConfig, activeProduct]);

  const navigationPath = useMemo(() => {
    if (!storeConfig || !activeProduct || !targetBay) return [];

    const shelfIndex = targetBay.shelves.findIndex(s => s.id === activeProduct.shelfId);
    const validShelfIndex = shelfIndex === -1 ? 0 : shelfIndex;
    const numShelves = targetBay.shelves.length;
    const shelfSpacing = targetBay.shelfSpacing ?? 0;
    const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
    const availableWidth = targetBay.width - totalSpacing;
    const unitWidth = numShelves > 0 ? availableWidth / numShelves : targetBay.width;

    // X: Center of the specific shelf
    const targetX = targetBay.column + (unitWidth / 2) + (validShelfIndex * (unitWidth + shelfSpacing));

    // Z: Path should be positioned accurately on the open side of the shelf
    // Shelf is centered at bay.row + bay.depth / 2
    // Shelf depth is bay.depth - 0.5
    // Front face is at: bay.row + bay.depth / 2 + (bay.depth - 0.5) / 2 = bay.row + bay.depth - 0.25
    // Back face is at: bay.row + bay.depth / 2 - (bay.depth - 0.5) / 2 = bay.row + 0.25
    
    const targetShelf = targetBay.shelves[validShelfIndex];
    const closedSides = targetShelf?.closedSides ?? [];
    
    // Determine which sides are closed/open
    const isFrontClosed = closedSides.includes('front');
    const isBackClosed = closedSides === undefined || closedSides.length === 0 || closedSides.includes('back');
    const isLeftClosed = closedSides.includes('left');
    const isRightClosed = closedSides.includes('right');
    
    // Calculate exact face positions
    const shelfCenterZ = targetBay.row + targetBay.depth / 2;
    const shelfDepth = targetBay.depth - 0.5;
    const frontFaceZ = shelfCenterZ + shelfDepth / 2; // bay.row + bay.depth - 0.25
    const backFaceZ = shelfCenterZ - shelfDepth / 2;  // bay.row + 0.25
    
    // Calculate shelf X boundaries (exact center of shelf section)
    const shelfLeftX = targetX - unitWidth / 2;
    const shelfRightX = targetX + unitWidth / 2;
    const shelfCenterX = targetX; // Exact center X of the shelf section
    
    // Position path endpoint at the center of the open side with proper spacing
    // Use a safe distance (0.8 units = ~80cm) to ensure user doesn't overlap with shelf blocks
    const safeDistance = 0.8; // Safe walking distance from shelf face
    
    let targetZ: number;
    let targetXFinal: number = shelfCenterX; // Always center X of shelf section
    
    if (isFrontClosed && !isBackClosed) {
      // Front closed, back open - endpoint at center of back face, safely away
      targetZ = backFaceZ - safeDistance; // Safe distance behind back face, at center
      targetXFinal = shelfCenterX; // Exact center X of shelf section
    } else if (isBackClosed && !isFrontClosed) {
      // Back closed, front open - endpoint at center of front face, safely away
      targetZ = frontFaceZ + safeDistance; // Safe distance in front of front face (in aisle), at center
      targetXFinal = shelfCenterX; // Exact center X of shelf section
    } else if (isFrontClosed && isBackClosed) {
      // Both front and back are closed - check left/right sides
      if (!isRightClosed) {
        // Right side is open - endpoint at center of right face, safely away
        targetXFinal = shelfRightX + safeDistance; // Safe distance to the right, at center Z
        targetZ = shelfCenterZ; // Exact center Z of shelf (middle of the side)
      } else if (!isLeftClosed) {
        // Left side is open - endpoint at center of left face, safely away
        targetXFinal = shelfLeftX - safeDistance; // Safe distance to the left, at center Z
        targetZ = shelfCenterZ; // Exact center Z of shelf (middle of the side)
      } else {
        // All sides closed - fallback to front face center with safe distance
        targetZ = frontFaceZ + safeDistance;
        targetXFinal = shelfCenterX; // Exact center X
      }
    } else {
      // Both open - endpoint at center of front face, safely away (preferred)
      targetZ = frontFaceZ + safeDistance; // Safe distance in front of front face (in aisle)
      targetXFinal = shelfCenterX; // Exact center X of shelf section
    }

    // Boundary checks to keep path somewhat valid within grid
    targetZ = Math.max(0, Math.min(targetZ, storeConfig.gridSize.depth - 1));
    targetXFinal = Math.max(0, Math.min(targetXFinal, storeConfig.gridSize.width - 1));

    const target: PathNode = {
      x: targetXFinal,
      z: targetZ,
      floor: targetBay.floor
    };

    const path = findShortestPath(storeConfig, storeConfig.entrance, target);
    
    // Debug logging
    if (activeProduct.name === 'Frozen Pepperoni Pizza') {
      console.log('Path calculation for Frozen Pepperoni Pizza:');
      console.log('Target endpoint:', target);
      console.log('Closed sides:', closedSides);
      console.log('Shelf bounds - Left:', shelfLeftX, 'Right:', shelfRightX);
      console.log('Front face Z:', frontFaceZ, 'Back face Z:', backFaceZ, 'Center Z:', shelfCenterZ);
      console.log('Path length:', path.length);
      console.log('Path points:', path.slice(0, 5), '...', path.slice(-5));
    }

    return path;
  }, [storeConfig, activeProduct, targetBay]);

  const startNavigation = (product: Product) => {
    const bayId = product.bayId || product.departmentId;
    const bay = bayId ? findBayById(storeConfig, bayId) : undefined;
    setActiveProduct(product);
    setIsNavigating(true);
    if (bay) setCurrentMapFloor(bay.floor);
    setIsAISidebarOpen(false);
  };

  const closeNavigation = () => {
    setIsNavigating(false);
    setTimeout(() => setActiveProduct(null), 300);
  };

  if (!storeConfig) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Navigation2 size={20} className="rotate-45" />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">IA Store Navigator</h2>
          </div>

          <nav className="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setView('explorer')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${view === 'explorer' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid size={16} /> EXPLORER
            </button>
            <button
              onClick={() => setView('settings')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${view === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <SettingsIcon size={16} /> ADMIN
            </button>
          </nav>

          <div className="flex-1 max-w-lg relative sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 border border-transparent rounded-xl outline-none font-medium text-slate-600 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAISidebarOpen(true)}
              className="relative p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Bot size={20} />
            </button>
            <button
              onClick={() => setView(view === 'explorer' ? 'settings' : 'explorer')}
              className="p-2.5 bg-slate-900 text-white rounded-xl md:hidden"
            >
              {view === 'explorer' ? <SettingsIcon size={20} /> : <LayoutGrid size={20} />}
            </button>
          </div>
        </div>
      </header>

      {view === 'explorer' ? (
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Store Directory</h1>
              <p className="text-slate-400 font-bold flex items-center gap-2 uppercase text-[10px] md:text-xs tracking-widest">
                <Info size={14} className="text-blue-500" />
                {aiHighlightedIds.length > 0 ? `${aiHighlightedIds.length} items suggested for your plan` : 'Select an item for navigation'}
              </p>
            </div>
            {aiHighlightedIds.length > 0 && (
              <button onClick={() => setAiHighlightedIds([])} className="text-[10px] font-black uppercase text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                Clear AI Suggestions
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
            {filteredProducts.map(product => {
              const bayId = product.bayId || product.departmentId;
              const bay = bayId ? findBayById(storeConfig, bayId) : undefined;
              const isAIMatch = aiHighlightedIds.includes(product.id);

              return (
                <div key={product.id} className={`group bg-white rounded-[2rem] border p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col ${isAIMatch ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-indigo-50' : 'border-slate-100'}`}>
                  <div className="aspect-square rounded-2xl overflow-hidden mb-6 bg-slate-50 border border-slate-50 relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 px-3 py-1 bg-white/95 backdrop-blur rounded-lg shadow-sm border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">{product.category}</span>
                    </div>
                    {isAIMatch && (
                      <div className="absolute bottom-3 right-3 p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg">
                        <Bot size={14} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 mb-6">
                    <h3 className="text-lg font-black text-slate-900 leading-tight mb-4 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl text-slate-500 border border-slate-100 w-fit">
                        <Layers size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase">Floor {bay?.floor ?? 0}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border w-fit ${(product.stockCount ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <Package size={14} />
                        <span className="text-xs font-bold uppercase">Stock: {product.stockCount ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => startNavigation(product)} 
                    disabled={(product.stockCount ?? 0) === 0}
                    className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${
                      (product.stockCount ?? 0) === 0 
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                        : isAIMatch 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                          : 'bg-slate-900 text-white hover:bg-blue-600'
                    }`}
                  >
                    <Navigation2 size={16} className="rotate-45" />
                    {(product.stockCount ?? 0) === 0 ? 'OUT OF STOCK' : 'GO TO LOCATION'}
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <Settings
          storeConfig={storeConfig}
          products={products}
          onSave={handleUpdateConfig}
        />
      )}

      {/* AI Assistant Sidebar */}
      {isAISidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAISidebarOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right-full duration-300">
            <AIConsultant
              products={products}
              onClose={() => setIsAISidebarOpen(false)}
              onSelectProducts={(ids) => {
                setAiHighlightedIds(ids);
              }}
              onNavigateToProduct={(product) => {
                startNavigation(product);
              }}
            />
          </div>
        </div>
      )}

      {isNavigating && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 lg:p-10">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={closeNavigation} />

          <div className="relative w-full h-full bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between z-20 shrink-0">
              <div className="flex items-center gap-5">
                <img src={activeProduct.image} className="w-12 h-12 object-cover rounded-2xl shadow-md border border-slate-100" />
                <div>
                  <h4 className="text-slate-900 text-lg font-black leading-none mb-1.5">{activeProduct.name}</h4>
                  <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em]">Floor {targetBay?.floor} • Pathfinding</p>
                </div>
              </div>
              <button onClick={closeNavigation} className="w-11 h-11 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full md:w-[280px] lg:w-[340px] bg-white border-b md:border-b-0 md:border-r border-slate-100 flex flex-col shrink-0 overflow-hidden z-10">
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="flex items-center gap-2 text-blue-600 mb-10">
                    <Navigation size={18} />
                    <span className="font-black text-[11px] uppercase tracking-[0.25em]">Walking Route</span>
                  </div>
                  <div className="space-y-12 relative">
                    <div className="absolute left-[21px] top-6 bottom-6 w-0.5 bg-slate-100 rounded-full" />
                    <div className={`flex gap-5 relative transition-all duration-500 ${currentMapFloor === storeConfig.entrance.floor ? 'opacity-100' : 'opacity-25'}`}>
                      <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-xl z-10 shrink-0 border-4 border-white">
                        <DoorOpen size={20} />
                      </div>
                      <div className="pt-1">
                        <h5 className="font-black text-slate-900 text-[15px] mb-1 leading-none">Entrance Door</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Floor {storeConfig.entrance.floor}</p>
                      </div>
                    </div>
                    <div className={`flex gap-5 relative transition-all duration-500 ${currentMapFloor === targetBay?.floor ? 'opacity-100' : 'opacity-25'}`}>
                      <div className="w-11 h-11 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-xl z-10 shrink-0 border-4 border-white">
                        <Target size={20} />
                      </div>
                      <div className="pt-1">
                        <h5 className="font-black text-slate-900 text-[15px] mb-1 leading-none">{activeProduct.name}</h5>
                        {productLocation ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {productLocation.zone.name} → <span style={{ color: getAisleColor(productLocation.aisle.id) }}>{productLocation.aisle.name}</span> → {productLocation.bay.name}
                              {productLocation.shelf && ` → ${productLocation.shelf.name}`}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[9px] text-slate-300 font-semibold uppercase tracking-wider">
                                Floor {targetBay?.floor}
                              </p>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">•</span>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                {activeProduct.category}
                              </p>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">•</span>
                              <div className={`flex items-center gap-1 ${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                <Package size={10} />
                                <p className="text-[9px] font-bold uppercase tracking-wider">
                                  Stock: {activeProduct.stockCount ?? 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bay {activeProduct.bayId || activeProduct.departmentId}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                {activeProduct.category}
                              </p>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">•</span>
                              <div className={`flex items-center gap-1 ${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                <Package size={10} />
                                <p className="text-[9px] font-bold uppercase tracking-wider">
                                  Stock: {activeProduct.stockCount ?? 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-8 shrink-0">
                  <button onClick={closeNavigation} className="w-full py-4.5 bg-slate-950 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95 uppercase tracking-widest">
                    Dismiss Map
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-slate-50 min-h-0">
                <Store3D
                  config={storeConfig}
                  targetProduct={activeProduct}
                  path={navigationPath}
                  currentFloor={currentMapFloor}
                  allProducts={products}
                  showAllProducts={aiHighlightedIds.length > 0}
                  disableFocus={true}
                />
                <div className="absolute top-6 right-6 flex flex-col gap-2">
                  {getAllFloors(storeConfig).map(f => (
                    <button
                      key={f}
                      onClick={() => setCurrentMapFloor(f)}
                      className={`w-12 h-12 rounded-2xl font-black text-sm transition-all border shadow-2xl ${currentMapFloor === f ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/95 text-slate-400 border-slate-100 hover:bg-white'}`}
                    >
                      F{f}
                    </button>
                  ))}
                </div>
                <div className="absolute bottom-8 right-8 pointer-events-none hidden lg:block">
                  <div className="flex items-center gap-6 bg-white/90 backdrop-blur px-6 py-4 rounded-2xl border border-slate-100 shadow-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entrance</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Route</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-slate-900 rounded-full border border-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Destination</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 bg-slate-700 rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Elevator</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
