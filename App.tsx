
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StoreConfig, Product, PathNode } from './types';
import Store3D from './components/Store3D';
import LoadingScreen from './components/LoadingScreen';
import Settings from './components/Settings';
import AIConsultant, { ChatMessage } from './components/AIConsultant';
import RecommendedProducts from './components/RecommendedProducts';
import { findShortestPath } from './services/pathfinder';
import { findBayById, getAllFloors, migrateStoreConfig, getProductLocation, getAisleColor, calculateShelfPositions } from './utils/storeHelpers';
import { Search, Navigation2, X, Info, Target, Layers, DoorOpen, Navigation, Settings as SettingsIcon, LayoutGrid, Bot, Package, Maximize } from 'lucide-react';

type AppView = 'explorer' | 'settings';

const App: React.FC = () => {
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<AppView>('explorer');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentMapFloor, setCurrentMapFloor] = useState(0);
  const [mapResetTrigger, setMapResetTrigger] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);


  // AI States
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [aiHighlightedIds, setAiHighlightedIds] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const hasFetchedRef = useRef(false);

  // Load data from server on mount
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchData = async () => {
      try {
        const headers = { 'Authorization': import.meta.env.VITE_API_AUTH_TOKEN };
        const storeRes = await fetch('/api/store_navigator/store', { headers });
        const prodRes = await fetch('/api/store_navigator/products', { headers });

        if (storeRes.ok && prodRes.ok) {
          const storeData = await storeRes.json();
          const prodData = await prodRes.json();
          // Migrate old structure to new structure if needed
          const migratedStore = migrateStoreConfig(storeData);
          setStoreConfig(migratedStore);
          setProducts(prodData);
        } else {
          let errorMsg = `Server error: Store (${storeRes.status}) Products (${prodRes.status})`;
          try {
            const storeErr = !storeRes.ok ? await storeRes.json() : null;
            const prodErr = !prodRes.ok ? await prodRes.json() : null;
            if (storeErr?.error) errorMsg = `Store Error: ${storeErr.error}`;
            else if (prodErr?.error) errorMsg = `Products Error: ${prodErr.error}`;
          } catch (e) {
            // Use default msg if JSON parse fails
          }
          setFetchError(errorMsg);
          console.error(errorMsg);
        }
      } catch (e: any) {
        console.error("Failed to fetch data:", e);
        setFetchError(e.message || "Failed to connect to the server. Please ensure the backend is running.");
      }
    };

    fetchData();
  }, []);

  const handleUpdateConfig = async (store: StoreConfig, prods: Product[]) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': import.meta.env.VITE_API_AUTH_TOKEN
      };
      const storeRes = await fetch('/api/store_navigator/store', {
        method: 'POST',
        headers,
        body: JSON.stringify(store)
      });
      const prodRes = await fetch('/api/store_navigator/products', {
        method: 'POST',
        headers,
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

    const targetShelf = targetBay.shelves[validShelfIndex];
    const closedSides = targetShelf?.closedSides ?? [];

    // Determine which sides are closed/open
    const isFrontClosed = closedSides.includes('front');
    const isBackClosed = closedSides === undefined || closedSides.length === 0 || closedSides.includes('back');
    const isLeftClosed = closedSides.includes('left');
    const isRightClosed = closedSides.includes('right');

    const frontOpen = !isFrontClosed;
    const backOpen = !isBackClosed;
    const leftOpen = !isLeftClosed;
    const rightOpen = !isRightClosed;

    const bayShape = targetBay.shape || 'rectangle';
    const safeDistance = 0.8;

    let targetXFinal: number;
    let targetZ: number;

    if (bayShape === 'circle') {
      // Circle bay: use shelf position calculation
      const shelfPositions = calculateShelfPositions(targetBay);
      const shelfPos = shelfPositions[validShelfIndex] || shelfPositions[0];

      if (!shelfPos) {
        // Fallback
        targetXFinal = targetBay.column + targetBay.width / 2;
        targetZ = targetBay.row + targetBay.depth / 2;
      } else {
        const rotation = shelfPos.rotation;
        const shelfWorldX = shelfPos.worldX;
        const shelfWorldZ = shelfPos.worldZ;
        const shelfWidth = shelfPos.shelfWidth;
        const shelfDepth = shelfPos.shelfDepth;

        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        // Calculate distances from bay edge (circle perimeter) to each open side
        const calculateSideDistance = (side: 'front' | 'back' | 'left' | 'right'): number => {
          const bayCenterX = targetBay.column + targetBay.width / 2;
          const bayCenterZ = targetBay.row + targetBay.depth / 2;
          const bayRadius = Math.min(targetBay.width, targetBay.depth) / 2;

          let sideX: number, sideZ: number;

          if (side === 'front') {
            sideX = shelfWorldX + (shelfDepth / 2) * sinR;
            sideZ = shelfWorldZ + (shelfDepth / 2) * cosR;
          } else if (side === 'back') {
            sideX = shelfWorldX - (shelfDepth / 2) * sinR;
            sideZ = shelfWorldZ - (shelfDepth / 2) * cosR;
          } else if (side === 'left') {
            sideX = shelfWorldX - (shelfWidth / 2) * cosR;
            sideZ = shelfWorldZ + (shelfWidth / 2) * sinR;
          } else {
            sideX = shelfWorldX + (shelfWidth / 2) * cosR;
            sideZ = shelfWorldZ - (shelfWidth / 2) * sinR;
          }

          // Distance from bay edge (circle perimeter)
          // Find closest point on circle perimeter to the side face point
          const dx = sideX - bayCenterX;
          const dz = sideZ - bayCenterZ;
          const distFromCenter = Math.hypot(dx, dz);

          if (distFromCenter === 0) return bayRadius; // At center, distance is radius

          // Closest point on circle perimeter
          const closestX = bayCenterX + (dx / distFromCenter) * bayRadius;
          const closestZ = bayCenterZ + (dz / distFromCenter) * bayRadius;

          // Distance from side face to closest point on circle perimeter
          return Math.hypot(sideX - closestX, sideZ - closestZ);
        };

        // Find best open side with minimal distance from bay edge
        const sideDistances = [
          { side: 'front' as const, dist: calculateSideDistance('front'), open: frontOpen },
          { side: 'back' as const, dist: calculateSideDistance('back'), open: backOpen },
          { side: 'left' as const, dist: calculateSideDistance('left'), open: leftOpen },
          { side: 'right' as const, dist: calculateSideDistance('right'), open: rightOpen }
        ];

        const openSides = sideDistances.filter(s => s.open);
        const bestSide = openSides.length > 0
          ? openSides.sort((a, b) => a.dist - b.dist)[0].side
          : 'front'; // Fallback

        // Calculate endpoint position on the best open side
        if (bestSide === 'front') {
          targetXFinal = shelfWorldX + (shelfDepth / 2 + safeDistance) * sinR;
          targetZ = shelfWorldZ + (shelfDepth / 2 + safeDistance) * cosR;
        } else if (bestSide === 'back') {
          targetXFinal = shelfWorldX - (shelfDepth / 2 + safeDistance) * sinR;
          targetZ = shelfWorldZ - (shelfDepth / 2 + safeDistance) * cosR;
        } else if (bestSide === 'left') {
          targetXFinal = shelfWorldX - (shelfWidth / 2 + safeDistance) * cosR;
          targetZ = shelfWorldZ + (shelfWidth / 2 + safeDistance) * sinR;
        } else {
          targetXFinal = shelfWorldX + (shelfWidth / 2 + safeDistance) * cosR;
          targetZ = shelfWorldZ - (shelfWidth / 2 + safeDistance) * sinR;
        }
      }
    } else {
      // Rectangle bay logic (original)
      const numShelves = targetBay.shelves.length;
      const shelfSpacing = targetBay.shelfSpacing ?? 0;
      const totalSpacing = shelfSpacing * Math.max(0, numShelves - 1);
      const availableWidth = targetBay.width - totalSpacing;
      const unitWidth = numShelves > 0 ? availableWidth / numShelves : targetBay.width;

      // X: Center of the specific shelf
      const targetX = targetBay.column + (unitWidth / 2) + (validShelfIndex * (unitWidth + shelfSpacing));

      // Calculate exact face positions
      const shelfCenterZ = targetBay.row + targetBay.depth / 2;
      const shelfDepth = targetBay.depth - 0.5;
      const frontFaceZ = shelfCenterZ + shelfDepth / 2;
      const backFaceZ = shelfCenterZ - shelfDepth / 2;

      // Calculate shelf X boundaries
      const shelfLeftX = targetX - unitWidth / 2;
      const shelfRightX = targetX + unitWidth / 2;
      const shelfCenterX = targetX;

      targetZ = shelfCenterZ;
      targetXFinal = shelfCenterX;

      // Prefer the longer open side: width (front/back) vs. depth (left/right)
      const isWideShelf = unitWidth > shelfDepth;

      if (isWideShelf) {
        // Prefer front/back faces first
        if (frontOpen) {
          targetZ = frontFaceZ + safeDistance;
        } else if (backOpen) {
          targetZ = backFaceZ - safeDistance;
        } else if (rightOpen) {
          targetXFinal = shelfRightX + safeDistance;
        } else if (leftOpen) {
          targetXFinal = shelfLeftX - safeDistance;
        } else {
          // All closed: fallback
          targetZ = frontFaceZ + safeDistance;
        }
      } else {
        // Prefer left/right faces first
        if (rightOpen) {
          targetXFinal = shelfRightX + safeDistance;
        } else if (leftOpen) {
          targetXFinal = shelfLeftX - safeDistance;
        } else if (frontOpen) {
          targetZ = frontFaceZ + safeDistance;
        } else if (backOpen) {
          targetZ = backFaceZ - safeDistance;
        } else {
          // All closed: fallback
          targetZ = frontFaceZ + safeDistance;
        }
      }
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
    if (activeProduct.name === 'Frozen Pepperoni Pizza' || activeProduct.name === 'Vanilla Extract') {
      console.log(`Path calculation for ${activeProduct.name}:`);
      console.log('Target endpoint:', target);
      console.log('Target bay:', targetBay.id, 'Floor:', targetBay.floor);
      console.log('Shelf index:', validShelfIndex, 'Shelf ID:', activeProduct.shelfId);
      console.log('Closed sides:', closedSides);
      console.log('Path length:', path.length);
      if (path.length > 0) {
        console.log('Path points:', path.slice(0, 5), '...', path.slice(-5));
      } else {
        console.warn('PATH IS EMPTY! Check pathfinder logic.');
      }
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

  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl p-10 border border-red-100 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <X size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">Connection Failed</h2>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            {fetchError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-all shadow-xl active:scale-95"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  if (!storeConfig) return <LoadingScreen />;

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
              const isOutOfStock = (product.stockCount ?? 0) === 0;

              return (
                <div key={product.id} className={`group bg-white rounded-[2rem] border p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col ${isAIMatch ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-indigo-50' : 'border-slate-100'} ${isOutOfStock ? 'opacity-50' : ''}`}>
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
                    <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                    {product.price !== undefined && product.price !== null && (
                      <div className="mb-4">
                        <span className="text-2xl font-black text-slate-900">${product.price.toFixed(2)}</span>
                      </div>
                    )}
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
                    className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${(product.stockCount ?? 0) === 0
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
              chatHistory={chatHistory}
              onChatHistoryChange={setChatHistory}
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
              <div className="w-full md:w-[280px] lg:w-[320px] bg-white border-b md:border-b-0 md:border-r border-slate-100 flex flex-col shrink-0 overflow-hidden z-10">
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="flex items-center gap-2 text-blue-600 mb-6">
                    <Navigation size={18} />
                    <span className="font-black text-xs uppercase tracking-wider">Walking Route</span>
                  </div>
                  <div className="space-y-6 relative">
                    <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-200 to-red-200 rounded-full" />
                    <div className={`flex gap-4 relative transition-all duration-500 ${currentMapFloor === storeConfig.entrance.floor ? 'opacity-100' : 'opacity-25'}`}>
                      <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg z-10 shrink-0 border-2 border-white">
                        <DoorOpen size={18} />
                      </div>
                      <div className="pt-0.5 flex-1">
                        <h5 className="font-black text-slate-900 text-base mb-1.5 leading-tight">Entrance Door</h5>
                        <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                          <p className="text-[10px] text-slate-900 font-black uppercase tracking-wide">Floor {storeConfig.entrance.floor}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`flex gap-4 relative transition-all duration-500 ${currentMapFloor === targetBay?.floor ? 'opacity-100' : 'opacity-25'}`}>
                      <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg z-10 shrink-0 border-2 border-white">
                        <Target size={18} />
                      </div>
                      <div className="pt-0.5 flex-1">
                        <h5 className="font-black text-slate-900 text-base mb-2 leading-tight">{activeProduct.name}</h5>
                        {activeProduct.price !== undefined && activeProduct.price !== null && (
                          <div className="mb-3">
                            <p className="text-xl font-black text-slate-900">${activeProduct.price.toFixed(2)}</p>
                          </div>
                        )}
                        {activeProduct.description && (
                          <div className="mb-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-1">Description</p>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">{activeProduct.description}</p>
                          </div>
                        )}
                        {productLocation ? (
                          <div className="space-y-2">
                            {/* Location Hierarchy Cards */}
                            <div className="space-y-1.5">
                              <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                                <p className="text-[9px] text-blue-600 font-black uppercase tracking-wider mb-0.5">Zone</p>
                                <p className="text-xs font-bold text-slate-900">{productLocation.zone.name}</p>
                              </div>
                              <div className="bg-purple-50 rounded-lg px-3 py-2 border" style={{ borderColor: `${getAisleColor(productLocation.aisle.id)}40` }}>
                                <p className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color: getAisleColor(productLocation.aisle.id) }}>Aisle</p>
                                <p className="text-xs font-bold text-slate-900">{productLocation.aisle.name}</p>
                              </div>
                              <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                <p className="text-[9px] text-amber-600 font-black uppercase tracking-wider mb-0.5">Bay</p>
                                <p className="text-xs font-bold text-slate-900">{productLocation.bay.name}</p>
                              </div>
                              {productLocation.shelf && (
                                <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                                  <p className="text-[9px] text-emerald-600 font-black uppercase tracking-wider mb-0.5">Shelf</p>
                                  <p className="text-xs font-bold text-slate-900">{productLocation.shelf.name}</p>
                                </div>
                              )}
                            </div>

                            {/* Additional Info */}
                            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Layers size={12} className="text-slate-500" />
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wide">Floor {targetBay?.floor}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Package size={12} className={`${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                                <p className={`text-[10px] font-bold uppercase tracking-wide ${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                  Stock: {activeProduct.stockCount ?? 0}
                                </p>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Category</p>
                                <p className="text-[10px] text-slate-700 font-semibold">{activeProduct.category}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {activeProduct.price !== undefined && activeProduct.price !== null && (
                              <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-0.5">Price</p>
                                <p className="text-lg font-black text-slate-900">${activeProduct.price.toFixed(2)}</p>
                              </div>
                            )}
                            {activeProduct.description && (
                              <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-1">Description</p>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed">{activeProduct.description}</p>
                              </div>
                            )}
                            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-0.5">Bay</p>
                              <p className="text-xs font-bold text-slate-900">{activeProduct.bayId || activeProduct.departmentId}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Package size={12} className={`${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                                <p className={`text-[10px] font-bold uppercase tracking-wide ${(activeProduct.stockCount ?? 0) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                  Stock: {activeProduct.stockCount ?? 0}
                                </p>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Category</p>
                                <p className="text-[10px] text-slate-700 font-semibold">{activeProduct.category}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Products Section */}
                  {activeProduct && (
                    <RecommendedProducts
                      currentProduct={activeProduct}
                      allProducts={products}
                      onNavigateToProduct={(product) => {
                        startNavigation(product);
                      }}
                    />
                  )}
                </div>
                <div className="p-5 shrink-0 border-t border-slate-100">
                  <button onClick={closeNavigation} className="w-full py-3 bg-slate-950 text-white rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95 uppercase tracking-wider">
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
                  resetTrigger={mapResetTrigger}
                />
                <div className="absolute top-6 right-6 flex flex-col gap-2">
                  <button
                    onClick={() => setMapResetTrigger(prev => prev + 1)}
                    className="w-12 h-12 bg-white/95 text-slate-900 rounded-2xl flex items-center justify-center border border-slate-100 shadow-2xl hover:bg-white hover:scale-105 active:scale-95 transition-all mb-2"
                    title="Reset View"
                  >
                    <Maximize size={20} />
                  </button>
                  {getAllFloors(storeConfig).slice().reverse().map(f => (
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
