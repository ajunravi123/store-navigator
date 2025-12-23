import React, { useState, useMemo, useEffect } from 'react';
import { StoreConfig, Product } from '../types';
import { DEFAULT_STORE_CONFIG, DEFAULT_PRODUCTS } from '../constants';
import { Database, Save, RotateCcw, AlertCircle, CheckCircle2, Eye, Layout, Code, Wand2 } from 'lucide-react';
import Store3D from './Store3D';
import AdminForm from './AdminForm';
import { findBayById, getAllFloors, getAisleBounds } from '../utils/storeHelpers';

interface SettingsProps {
  storeConfig: StoreConfig;
  products: Product[];
  onSave: (store: StoreConfig, prods: Product[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ storeConfig: initialStore, products: initialProducts, onSave }) => {
  const [editMode, setEditMode] = useState<'form' | 'json'>('form');
  const [localStore, setLocalStore] = useState<StoreConfig>(initialStore);
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts);

  const [storeJson, setStoreJson] = useState(JSON.stringify(initialStore, null, 2));
  const [productsJson, setProductsJson] = useState(JSON.stringify(initialProducts, null, 2));

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewFloor, setPreviewFloor] = useState(0);
  const [showProductsInPreview, setShowProductsInPreview] = useState(true);
  const [expandedDepartmentId, setExpandedDepartmentId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);

  // Sync JSON when local state changes in form mode
  useEffect(() => {
    if (editMode === 'form') {
      setStoreJson(JSON.stringify(localStore, null, 2));
      setProductsJson(JSON.stringify(localProducts, null, 2));
    }
  }, [localStore, localProducts, editMode]);

  // Sync local state when JSON changes in json mode (if valid)
  useEffect(() => {
    if (editMode === 'json') {
      try {
        const s = JSON.parse(storeJson);
        const p = JSON.parse(productsJson);
        setLocalStore(s);
        setLocalProducts(p);
        setError(null);
      } catch (e) {
        // Just wait for valid JSON
      }
    }
  }, [storeJson, productsJson, editMode]);

  // Auto-switch floor when selecting shelf or product
  useEffect(() => {
    if (expandedProductId) {
      const product = localProducts.find(p => p.id === expandedProductId);
      if (product) {
        const bayId = product.bayId || product.departmentId;
        const bay = bayId ? findBayById(localStore, bayId) : undefined;
        if (bay) setPreviewFloor(bay.floor);
      }
    } else if (expandedDepartmentId) {
      const bay = findBayById(localStore, expandedDepartmentId);
      if (bay) setPreviewFloor(bay.floor);
    } else if (selectedAisleId) {
      const bounds = getAisleBounds(localStore, selectedAisleId);
      if (bounds) setPreviewFloor(bounds.floor);
    }
  }, [expandedProductId, expandedDepartmentId, selectedAisleId, localStore, localProducts]);

  const handleSave = () => {
    try {
      let finalStore = localStore;
      let finalProducts = localProducts;

      if (editMode === 'json') {
        finalStore = JSON.parse(storeJson);
        finalProducts = JSON.parse(productsJson);
      }

      if (!finalStore.gridSize || !finalStore.zones) throw new Error("Invalid store structure");
      if (!Array.isArray(finalProducts)) throw new Error("Products must be an array");

      setError(null);
      onSave(finalStore, finalProducts);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Invalid data format. Please check your inputs.');
      setSuccess(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all data to defaults? This will erase your current configuration.')) {
      setLocalStore(DEFAULT_STORE_CONFIG);
      setLocalProducts(DEFAULT_PRODUCTS);
      setStoreJson(JSON.stringify(DEFAULT_STORE_CONFIG, null, 2));
      setProductsJson(JSON.stringify(DEFAULT_PRODUCTS, null, 2));
      setError(null);
    }
  };

  return (
    <main className="max-w-[1800px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Database size={24} />
            </div>
            <span className="font-black text-xs uppercase tracking-[0.2em]">Management Console</span>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight">Store Architect</h1>
          <p className="text-slate-500 mt-3 font-medium text-lg">Build your digital twin and manage product inventory with ease.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200">
            <button
              onClick={() => setEditMode('form')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${editMode === 'form' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Layout size={16} /> FORM EDITOR
            </button>
            <button
              onClick={() => setEditMode('json')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${editMode === 'json' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Code size={16} /> JSON SOURCE
            </button>
          </div>

          <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block" />

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3.5 bg-white text-slate-600 border border-slate-200 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={16} /> RESET
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-3 px-10 py-3.5 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-2xl ${success ? 'bg-emerald-500 text-white shadow-emerald-100 scale-105' : 'bg-slate-900 text-white shadow-slate-200 hover:bg-blue-600'}`}
          >
            {success ? <CheckCircle2 size={18} /> : <Wand2 size={18} />}
            {success ? 'CHANGES PUBLISHED' : 'DEPLOY UPDATES'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-5 bg-red-50 border border-red-100 text-red-600 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 shadow-sm">
          <div className="p-2 bg-red-100 rounded-xl">
            <AlertCircle size={20} className="shrink-0" />
          </div>
          <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
        {/* Editor Column */}
        <div className="h-[800px]">
          {editMode === 'form' ? (
            <AdminForm
              storeConfig={localStore}
              products={localProducts}
              expandedDepartmentId={expandedDepartmentId}
              onDepartmentExpand={setExpandedDepartmentId}
              expandedProductId={expandedProductId}
              onProductExpand={setExpandedProductId}
              onAisleSelect={setSelectedAisleId}
              onShelfSelect={setSelectedShelfId}
              onChange={(s, p) => {
                setLocalStore(s);
                setLocalProducts(p);
              }}
            />
          ) : (
            <div className="flex flex-col gap-6 h-full">
              <div className="flex-1 flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Store Configuration</label>
                <textarea
                  className="flex-1 w-full p-8 font-mono text-sm bg-slate-900 text-blue-100 border-none rounded-[2.5rem] focus:ring-8 focus:ring-blue-500/10 transition-all outline-none shadow-2xl resize-none custom-scrollbar"
                  value={storeJson}
                  onChange={(e) => setStoreJson(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="h-1/3 flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Products Data</label>
                <textarea
                  className="flex-1 w-full p-8 font-mono text-sm bg-slate-900 text-emerald-100 border-none rounded-[2.5rem] focus:ring-8 focus:ring-emerald-500/10 transition-all outline-none shadow-2xl resize-none custom-scrollbar"
                  value={productsJson}
                  onChange={(e) => setProductsJson(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3D Preview Column */}
        <div className="h-[800px] xl:sticky xl:top-24 bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-2xl flex flex-col group">
          <div className="p-8 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <Eye size={22} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-xl leading-none mb-2">Real-time Visualization</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">3D Digital Twin Preview</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <button
                onClick={() => setShowProductsInPreview(!showProductsInPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${showProductsInPreview ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}
              >
                {showProductsInPreview ? 'Hiding Items' : 'Showing Items'}
              </button>

              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
                {getAllFloors(localStore).map(f => (
                  <button
                    key={f}
                    onClick={() => setPreviewFloor(f)}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${previewFloor === f ? 'bg-white text-blue-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    FLOOR {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 relative bg-slate-50 min-h-0">
            <Store3D
              config={localStore}
              targetProduct={expandedProductId ? localProducts.find(p => p.id === expandedProductId) || null : null}
              path={[]}
              currentFloor={previewFloor}
              allProducts={expandedProductId ? localProducts.filter(p => p.id === expandedProductId) : []}
              showAllProducts={showProductsInPreview}
              showLabels={showProductsInPreview}
              targetDepartmentId={expandedDepartmentId}
              targetAisleId={selectedAisleId}
              targetShelfId={selectedShelfId}
            />

            {/* Admin HUD */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none w-full max-w-lg px-8">
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 p-6 rounded-[2rem] shadow-2xl flex items-center justify-around gap-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-900 shadow-md border-2 border-white" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Bays</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-md border-2 border-white" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Shelves</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-indigo-600 shadow-md border-2 border-white" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Products</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-400 shadow-md border-2 border-white" />
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Elevators</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </main>
  );
};

export default Settings;
