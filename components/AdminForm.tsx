
import React, { useState } from 'react';
import { StoreConfig, Product, Bay, Shelf, Zone, Aisle } from '../types';
import { getAllBays, findBayById, getAisleIdForBay } from '../utils/storeHelpers';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Box, MapPin, Layers, Package, Zap } from 'lucide-react';

interface AdminFormProps {
    storeConfig: StoreConfig;
    products: Product[];
    expandedDepartmentId: string | null;
    onDepartmentExpand: (id: string | null) => void;
    expandedProductId: string | null;
    onProductExpand: (id: string | null) => void;
    onAisleSelect?: (id: string | null) => void;
    onShelfSelect?: (id: string | null) => void;
    onChange: (store: StoreConfig, prods: Product[]) => void;
}

const ValidatedInput: React.FC<{
    label?: string;
    value: number;
    onChange: (val: number) => void;
    className?: string;
    type?: 'number' | 'text';
    min?: number;
    placeholder?: string;
}> = ({ label, value, onChange, className, type = 'number', min, placeholder }) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (!isNaN(parseFloat(localValue)) && parseFloat(localValue) === value) return;
        setLocalValue(value.toString());
        setError(null);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);

        if (val.trim() === '') {
            setError('Required');
            return;
        }

        const num = type === 'number' ? parseFloat(val) : NaN;
        if (type === 'number' && isNaN(num)) {
            setError('Invalid');
            return;
        }

        if (min !== undefined && num < min) {
            setError(`Min ${min}`);
            return;
        }

        setError(null);
        onChange(num);
    };

    return (
        <div className="space-y-1">
            {label && <span className="text-[10px] text-slate-400 mb-1 block font-bold uppercase">{label}</span>}
            <div className="relative">
                <input
                    type={type}
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className={`${className} ${error ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : ''}`}
                />
                {error && (
                    <div className="absolute -bottom-4 right-2 text-[8px] font-black text-red-500 uppercase animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminForm: React.FC<AdminFormProps> = ({
    storeConfig,
    products,
    expandedDepartmentId,
    onDepartmentExpand,
    expandedProductId,
    onProductExpand,
    onAisleSelect,
    onShelfSelect,
    onChange
}) => {
    const [activeTab, setActiveTab] = useState<'store' | 'products'>('store');
    const [gridExpanded, setGridExpanded] = useState(false);
    const [elevatorsExpanded, setElevatorsExpanded] = useState(false);
    const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
    const [expandedAisleId, setExpandedAisleId] = useState<string | null>(null);

    const updateStore = (updates: Partial<StoreConfig>) => {
        onChange({ ...storeConfig, ...updates }, products);
    };

    const updateProducts = (newProducts: Product[]) => {
        onChange(storeConfig, newProducts);
    };

    // Zone Handlers
    const addZone = () => {
        const zoneNum = storeConfig.zones.length + 1;
        const newZone: Zone = {
            id: `Z${zoneNum}`,
            name: `Zone ${zoneNum}`,
            aisles: []
        };
        updateStore({ zones: [...storeConfig.zones, newZone] });
        setExpandedZoneId(newZone.id);
    };

    const updateZone = (id: string, updates: Partial<Zone>) => {
        const zones = storeConfig.zones.map(z => z.id === id ? { ...z, ...updates } : z);
        updateStore({ zones });
    };

    const removeZone = (id: string) => {
        const zones = storeConfig.zones.filter(z => z.id !== id);
        updateStore({ zones });
        if (expandedZoneId === id) setExpandedZoneId(null);
    };

    // Aisle Handlers
    const addAisle = (zoneId: string) => {
        const zone = storeConfig.zones.find(z => z.id === zoneId);
        if (!zone) return;
        
        const aisleNum = zone.aisles.length + 1;
        const newAisle: Aisle = {
            id: `${zoneId}-A${aisleNum}`,
            name: `Aisle ${aisleNum}`,
            bays: []
        };
        
        const zones = storeConfig.zones.map(z => 
            z.id === zoneId ? { ...z, aisles: [...z.aisles, newAisle] } : z
        );
        updateStore({ zones });
        setExpandedAisleId(newAisle.id);
        setExpandedZoneId(zoneId);
    };

    const updateAisle = (zoneId: string, aisleId: string, updates: Partial<Aisle>) => {
        const zones = storeConfig.zones.map(zone => 
            zone.id === zoneId ? {
                ...zone,
                aisles: zone.aisles.map(aisle => aisle.id === aisleId ? { ...aisle, ...updates } : aisle)
            } : zone
        );
        updateStore({ zones });
    };

    const removeAisle = (zoneId: string, aisleId: string) => {
        const zones = storeConfig.zones.map(zone => 
            zone.id === zoneId ? {
                ...zone,
                aisles: zone.aisles.filter(a => a.id !== aisleId)
            } : zone
        );
        updateStore({ zones });
        if (expandedAisleId === aisleId) setExpandedAisleId(null);
    };

    // Bay Handlers
    const allBays = getAllBays(storeConfig);
    
    const addBay = (zoneId: string, aisleId: string) => {
        const zone = storeConfig.zones.find(z => z.id === zoneId);
        const aisle = zone?.aisles.find(a => a.id === aisleId);
        if (!aisle) return;

        const newBayId = `B${allBays.length + 1}`;
        const newBay: Bay = {
            id: newBayId,
            name: 'New Bay',
            floor: 0,
            row: 10,
            column: 10,
            width: 6,
            depth: 4,
            shelves: [{ id: `${newBayId}-A`, name: 'Shelf A' }]
        };
        
        const zones = storeConfig.zones.map(z => 
            z.id === zoneId ? {
                ...z,
                aisles: z.aisles.map(a => 
                    a.id === aisleId ? { ...a, bays: [...a.bays, newBay] } : a
                )
            } : z
        );
        
        updateStore({ zones });
        onDepartmentExpand(newBayId);
        setExpandedAisleId(aisleId);
        setExpandedZoneId(zoneId);
    };

    const updateBay = (id: string, updates: Partial<Bay>) => {
        const zones = storeConfig.zones.map(zone => ({
            ...zone,
            aisles: zone.aisles.map(aisle => ({
                ...aisle,
                bays: aisle.bays.map(bay => bay.id === id ? { ...bay, ...updates } : bay)
            }))
        }));
        updateStore({ zones });
    };

    const removeBay = (zoneId: string, aisleId: string, bayId: string) => {
        const zones = storeConfig.zones.map(zone => 
            zone.id === zoneId ? {
                ...zone,
                aisles: zone.aisles.map(aisle => 
                    aisle.id === aisleId ? {
                        ...aisle,
                        bays: aisle.bays.filter(bay => bay.id !== bayId)
                    } : aisle
                ).filter(aisle => aisle.bays.length > 0) // Remove empty aisles
            } : zone
        ).filter(zone => zone.aisles.length > 0); // Remove empty zones
        
        updateStore({ zones });
        if (expandedDepartmentId === bayId) onDepartmentExpand(null);
    };

    // Product Handlers
    const addProduct = () => {
        const firstBay = allBays[0];
        const newProduct: Product = {
            id: `P${products.length + 1}`,
            name: 'New Product',
            category: 'Uncategorized',
            zoneId: 'Z1',
            aisleId: 'Z1-A1',
            bayId: firstBay?.id || '',
            shelfId: firstBay?.shelves[0]?.id || '',
            image: 'https://picsum.photos/400/400',
            sku: '',
            stockCount: 100
        };
        updateProducts([...products, newProduct]);
        onProductExpand(newProduct.id);
    };

    const updateProduct = (id: string, updates: Partial<Product>) => {
        const newProducts = products.map(p => p.id === id ? { ...p, ...updates } : p);
        updateProducts(newProducts);
    };

    const removeProduct = (id: string) => {
        const newProducts = products.filter(p => p.id !== id);
        updateProducts(newProducts);
        if (expandedProductId === id) onProductExpand(null);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-100 p-2 bg-slate-50/50">
                <button
                    onClick={() => setActiveTab('store')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'store' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <MapPin size={16} /> STORE LAYOUT
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'products' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Package size={16} /> PRODUCTS
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeTab === 'store' ? (
                    <div className="space-y-8">
                        {/* Grid & Entrance Collapsible */}
                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                            <button
                                onClick={() => setGridExpanded(!gridExpanded)}
                                className="flex items-center justify-between w-full mb-2"
                            >
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                                    <Box size={14} className="text-blue-500" /> Global Configuration
                                </label>
                                {gridExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </button>

                            {gridExpanded && (
                                <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Grid Size
                                        </label>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <ValidatedInput
                                                    label="Width"
                                                    value={storeConfig.gridSize.width}
                                                    onChange={(val) => updateStore({ gridSize: { ...storeConfig.gridSize, width: val } })}
                                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                    min={1}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <ValidatedInput
                                                    label="Depth"
                                                    value={storeConfig.gridSize.depth}
                                                    onChange={(val) => updateStore({ gridSize: { ...storeConfig.gridSize, depth: val } })}
                                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                    min={1}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Layers size={14} className="text-blue-500" /> Entrance
                                        </label>
                                        <div className="flex gap-2">
                                            <ValidatedInput
                                                label="X"
                                                value={storeConfig.entrance.x}
                                                onChange={(val) => updateStore({ entrance: { ...storeConfig.entrance, x: val } })}
                                                className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                            />
                                            <ValidatedInput
                                                label="Z"
                                                value={storeConfig.entrance.z}
                                                onChange={(val) => updateStore({ entrance: { ...storeConfig.entrance, z: val } })}
                                                className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                            />
                                            <ValidatedInput
                                                label="Floor"
                                                value={storeConfig.entrance.floor}
                                                onChange={(val) => updateStore({ entrance: { ...storeConfig.entrance, floor: val } })}
                                                className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Elevators List Collapsible */}
                        <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                            <button
                                onClick={() => setElevatorsExpanded(!elevatorsExpanded)}
                                className="flex items-center justify-between w-full mb-2"
                            >
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                                    <div className="p-1 bg-slate-100 rounded-lg"><Zap size={14} className="text-slate-600" /></div> Elevators
                                </label>
                                {elevatorsExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </button>

                            {elevatorsExpanded && (
                                <div className="space-y-4 animate-in slide-in-from-top-2">
                                    {/* Add Button Row */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => updateStore({ elevators: [...storeConfig.elevators, { x: 5, z: 5 }] })}
                                            className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {storeConfig.elevators.map((elevator, idx) => (
                                            <div key={idx} className="flex gap-4 items-end p-4 bg-white border border-slate-100 rounded-2xl relative group shadow-sm">
                                                <div className="flex-1">
                                                    <ValidatedInput
                                                        label={`Elevator ${idx + 1} - X`}
                                                        value={elevator.x}
                                                        onChange={(val) => {
                                                            const newElevators = [...storeConfig.elevators];
                                                            newElevators[idx] = { ...elevator, x: val };
                                                            updateStore({ elevators: newElevators });
                                                        }}
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <ValidatedInput
                                                        label="Z"
                                                        value={elevator.z}
                                                        onChange={(val) => {
                                                            const newElevators = [...storeConfig.elevators];
                                                            newElevators[idx] = { ...elevator, z: val };
                                                            updateStore({ elevators: newElevators });
                                                        }}
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newElevators = storeConfig.elevators.filter((_, i) => i !== idx);
                                                        updateStore({ elevators: newElevators });
                                                    }}
                                                    className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Zones List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zones ({storeConfig.zones.length})</label>
                                <button
                                    onClick={addZone}
                                    className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {storeConfig.zones.map((zone) => (
                                    <div key={zone.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                                        {/* Zone Header */}
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => setExpandedZoneId(expandedZoneId === zone.id ? null : zone.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black">
                                                    {zone.id}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">{zone.name}</h4>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{zone.aisles.length} Aisles</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                {expandedZoneId === zone.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                            </div>
                                        </div>

                                        {expandedZoneId === zone.id && (
                                            <div className="p-5 bg-slate-50/50 border-t border-slate-100 space-y-5 animate-in slide-in-from-top-2 duration-200">
                                                {/* Zone Name Edit */}
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">Zone Name</span>
                                                    <input
                                                        type="text"
                                                        value={zone.name}
                                                        onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                </div>

                                                {/* Aisles List */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Aisles ({zone.aisles.length})</span>
                                                        <button
                                                            onClick={() => addAisle(zone.id)}
                                                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase"
                                                        >
                                                            + Add Aisle
                                                        </button>
                                                    </div>

                                                    {zone.aisles.map((aisle) => (
                                                        <div key={aisle.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                                            {/* Aisle Header */}
                                                            <div
                                                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                                                onClick={() => {
                                                                    const newExpandedId = expandedAisleId === aisle.id ? null : aisle.id;
                                                                    setExpandedAisleId(newExpandedId);
                                                                    // Trigger camera focus on aisle
                                                                    if (onAisleSelect) {
                                                                        onAisleSelect(newExpandedId);
                                                                    }
                                                                    // Clear shelf selection when aisle is collapsed
                                                                    if (!newExpandedId && onShelfSelect) {
                                                                        onShelfSelect(null);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-[9px] font-black">
                                                                        {aisle.id.split('-').pop()}
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="text-xs font-black text-slate-800">{aisle.name}</h5>
                                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{aisle.bays.length} Bays</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); removeAisle(zone.id, aisle.id); }}
                                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                    {expandedAisleId === aisle.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                                </div>
                                                            </div>

                                                            {expandedAisleId === aisle.id && (
                                                                <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                                                                    {/* Aisle Name Edit */}
                                                                    <div>
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">Aisle Name</span>
                                                                        <input
                                                                            type="text"
                                                                            value={aisle.name}
                                                                            onChange={(e) => updateAisle(zone.id, aisle.id, { name: e.target.value })}
                                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                                                                        />
                                                                    </div>

                                                                    {/* Bays List */}
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Bays ({aisle.bays.length})</span>
                                                                            <button
                                                                                onClick={() => addBay(zone.id, aisle.id)}
                                                                                className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 uppercase"
                                                                            >
                                                                                + Add Bay
                                                                            </button>
                                                                        </div>

                                                                        {aisle.bays.map((bay) => (
                                                                            <div key={bay.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                                                <div
                                                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white transition-colors"
                                                                                    onClick={() => {
                                                                                        const newExpandedId = expandedDepartmentId === bay.id ? null : bay.id;
                                                                                        onDepartmentExpand(newExpandedId);
                                                                                        // Trigger camera focus on bay and aisle
                                                                                        if (onAisleSelect && newExpandedId) {
                                                                                            const aisleId = getAisleIdForBay(storeConfig, newExpandedId);
                                                                                            onAisleSelect(aisleId);
                                                                                        } else if (onAisleSelect && !newExpandedId) {
                                                                                            onAisleSelect(null);
                                                                                        }
                                                                                        // Clear shelf selection when bay is collapsed
                                                                                        if (!newExpandedId && onShelfSelect) {
                                                                                            onShelfSelect(null);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-6 h-6 bg-slate-700 text-white rounded-lg flex items-center justify-center text-[9px] font-black">
                                                                                            {bay.id}
                                                                                        </div>
                                                                                        <div>
                                                                                            <h5 className="text-xs font-black text-slate-800">{bay.name}</h5>
                                                                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Floor {bay.floor} • {bay.shelves.length} Shelves</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); removeBay(zone.id, aisle.id, bay.id); }}
                                                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                        >
                                                                                            <Trash2 size={14} />
                                                                                        </button>
                                                                                        {expandedDepartmentId === bay.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                                                    </div>
                                                                                </div>

                                                                                {expandedDepartmentId === bay.id && (
                                                                                    <div className="p-4 bg-white border-t border-slate-200 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">Bay Name</span>
                                                        <input
                                                            type="text"
                                                            value={bay.name}
                                                            onChange={(e) => updateBay(bay.id, { name: e.target.value })}
                                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <ValidatedInput
                                                            label="Floor"
                                                            value={bay.floor}
                                                            onChange={(val) => updateBay(bay.id, { floor: val })}
                                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                            min={0}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-3 text-center">
                                                    <ValidatedInput
                                                        label="Row (Z)"
                                                        value={bay.row}
                                                        onChange={(val) => updateBay(bay.id, { row: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                    <ValidatedInput
                                                        label="Col (X)"
                                                        value={bay.column}
                                                        onChange={(val) => updateBay(bay.id, { column: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                    <ValidatedInput
                                                        label="Width"
                                                        value={bay.width}
                                                        onChange={(val) => updateBay(bay.id, { width: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        min={1}
                                                    />
                                                    <ValidatedInput
                                                        label="Depth"
                                                        value={bay.depth}
                                                        onChange={(val) => updateBay(bay.id, { depth: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        min={1}
                                                    />
                                                </div>

                                                <div>
                                                    <ValidatedInput
                                                        label="Shelf Spacing"
                                                        value={bay.shelfSpacing ?? 0}
                                                        onChange={(val) => updateBay(bay.id, { shelfSpacing: val })}
                                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        min={0}
                                                        placeholder="0"
                                                    />
                                                    <span className="text-[9px] text-slate-400 font-medium mt-1 block">Distance between shelves within this bay</span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Shelves</span>
                                                        <button
                                                            onClick={() => {
                                                                const newShelf = { id: `${bay.id}-${String.fromCharCode(65 + bay.shelves.length)}`, name: `Shelf ${String.fromCharCode(65 + bay.shelves.length)}`, closedSides: ['back'] };
                                                                updateBay(bay.id, { shelves: [...bay.shelves, newShelf] });
                                                            }}
                                                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase"
                                                        >
                                                            + Add Shelf
                                                        </button>
                                                    </div>
                                                    {bay.shelves.map((shelf, idx) => (
                                                        <div key={shelf.id} className="space-y-2">
                                                            <div className="flex gap-2 items-center">
                                                                <div className="flex-1 flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={shelf.name}
                                                                        onChange={(e) => {
                                                                            const newShelves = [...bay.shelves];
                                                                            newShelves[idx] = { ...shelf, name: e.target.value };
                                                                            updateBay(bay.id, { shelves: newShelves });
                                                                        }}
                                                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                                        placeholder="Shelf Name"
                                                                    />
                                                                    <ValidatedInput
                                                                        value={shelf.levelCount || 5}
                                                                        onChange={(val) => {
                                                                            const newShelves = [...bay.shelves];
                                                                            newShelves[idx] = { ...shelf, levelCount: val };
                                                                            updateBay(bay.id, { shelves: newShelves });
                                                                        }}
                                                                        className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-center"
                                                                        label=""
                                                                        min={1}
                                                                        placeholder="Rows"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        updateBay(bay.id, { shelves: bay.shelves.filter(s => s.id !== shelf.id) });
                                                                    }}
                                                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                            <div className="flex gap-2 items-center pl-1">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Closed Sides:</span>
                                                                {(['left', 'right', 'front', 'back'] as const).map((side) => {
                                                                    // Back side is checked by default (when closedSides is undefined)
                                                                    // For other sides, checked only if explicitly in closedSides
                                                                    const isChecked = side === 'back'
                                                                        ? (shelf.closedSides === undefined || shelf.closedSides.includes('back'))
                                                                        : (shelf.closedSides?.includes(side) || false);
                                                                    return (
                                                                        <label key={side} className="flex items-center gap-1 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={(e) => {
                                                                                    const currentClosedSides = shelf.closedSides || [];
                                                                                    let newClosedSides: ('left' | 'right' | 'front' | 'back')[];
                                                                                    
                                                                                    if (e.target.checked) {
                                                                                        // Add the side
                                                                                        if (currentClosedSides.includes(side)) {
                                                                                            newClosedSides = currentClosedSides;
                                                                                        } else {
                                                                                            newClosedSides = [...currentClosedSides, side];
                                                                                        }
                                                                                    } else {
                                                                                        // Remove the side
                                                                                        newClosedSides = currentClosedSides.filter(s => s !== side);
                                                                                    }
                                                                                    
                                                                                    const newShelves = [...bay.shelves];
                                                                                    // If back is unchecked and no other sides, set to empty array (all open)
                                                                                    // If back is checked and it's the only one, set to undefined (default state)
                                                                                    // Otherwise, store the array
                                                                                    if (newClosedSides.length === 0) {
                                                                                        newShelves[idx] = { ...shelf, closedSides: [] };
                                                                                    } else if (newClosedSides.length === 1 && newClosedSides[0] === 'back') {
                                                                                        // Only back selected = default state, use undefined
                                                                                        newShelves[idx] = { ...shelf, closedSides: undefined };
                                                                                    } else {
                                                                                        newShelves[idx] = { ...shelf, closedSides: newClosedSides };
                                                                                    }
                                                                                    updateBay(bay.id, { shelves: newShelves });
                                                                                }}
                                                                                className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                            />
                                                                            <span className="text-[9px] font-bold text-slate-600 uppercase">{side}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Product Management</label>
                                <h3 className="text-xl font-black text-slate-900">Inventory Directory ({products.length})</h3>
                            </div>
                            <button
                                onClick={addProduct}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                            >
                                <Plus size={16} /> ADD PRODUCT
                            </button>
                        </div>

                        <div className="space-y-3">
                            {products.map((product) => {
                                const isExpanded = expandedProductId === product.id;
                                return (
                                    <div
                                        key={product.id}
                                        className={`border transition-all duration-300 rounded-[2rem] overflow-hidden ${isExpanded ? 'border-blue-200 bg-blue-50/10 shadow-xl' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'}`}
                                    >
                                        <div
                                            className="p-5 flex items-center justify-between cursor-pointer group"
                                            onClick={() => onProductExpand(isExpanded ? null : product.id)}
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0">
                                                    <img src={product.image} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <h4 className={`text-xl font-black transition-colors ${isExpanded ? 'text-blue-600' : 'text-slate-900 group-hover:text-blue-500'}`}>
                                                        {product.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{product.id}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeProduct(product.id); }}
                                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                                {isExpanded ? <ChevronUp size={24} className="text-blue-400" /> : <ChevronDown size={24} className="text-slate-300" />}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-5 pb-8 pt-2 space-y-6 animate-in slide-in-from-top-4 duration-300 border-t border-blue-50">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Product Title</label>
                                                            <input
                                                                type="text"
                                                                value={product.name}
                                                                onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                                                                className="text-lg font-black text-slate-800 bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none w-full shadow-sm"
                                                                placeholder="Enter product name..."
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Category</label>
                                                            <input
                                                                type="text"
                                                                value={product.category}
                                                                onChange={(e) => updateProduct(product.id, { category: e.target.value })}
                                                                className="text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none w-full shadow-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">SKU Code</label>
                                                            <input
                                                                type="text"
                                                                value={product.sku || ''}
                                                                onChange={(e) => updateProduct(product.id, { sku: e.target.value })}
                                                                className="text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none w-full shadow-sm"
                                                                placeholder="Enter SKU code..."
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Remaining Stock Count</label>
                                                            <input
                                                                type="number"
                                                                value={product.stockCount ?? ''}
                                                                onChange={(e) => updateProduct(product.id, { stockCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 })}
                                                                className="text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none w-full shadow-sm"
                                                                placeholder="0"
                                                                min={0}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Placement Rows</label>
                                                            <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                                {(() => {
                                                                    const bayId = product.bayId || product.departmentId;
                                                                    const bay = bayId ? findBayById(storeConfig, bayId) : undefined;
                                                                    const shelf = bay?.shelves.find(s => s.id === product.shelfId);
                                                                    const maxLevels = shelf?.levelCount || bay?.levelCount || 5;

                                                                    return Array.from({ length: maxLevels }).map((_, idx) => {
                                                                        const isSelected = product.levels?.includes(idx);
                                                                        return (
                                                                            <button
                                                                                key={idx}
                                                                                onClick={() => {
                                                                                    const currentLevels = product.levels || [];
                                                                                    const newLevels = isSelected
                                                                                        ? currentLevels.filter(l => l !== idx)
                                                                                        : [...currentLevels, idx].sort();
                                                                                    updateProduct(product.id, { levels: newLevels });
                                                                                }}
                                                                                className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${isSelected
                                                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105'
                                                                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                                                                    }`}
                                                                            >
                                                                                {idx + 1}
                                                                            </button>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Bay Assignment</label>
                                                            <select
                                                                value={product.bayId || product.departmentId || ''}
                                                                onChange={(e) => {
                                                                    const bay = findBayById(storeConfig, e.target.value);
                                                                    const newShelfId = bay?.shelves[0]?.id || '';
                                                                    updateProduct(product.id, { bayId: e.target.value, shelfId: newShelfId });
                                                                    // Trigger camera focus on bay and aisle
                                                                    if (onAisleSelect && bay) {
                                                                        const aisleId = getAisleIdForBay(storeConfig, e.target.value);
                                                                        onAisleSelect(aisleId);
                                                                    }
                                                                    onDepartmentExpand(e.target.value);
                                                                    if (onShelfSelect) {
                                                                        onShelfSelect(newShelfId || null);
                                                                    }
                                                                }}
                                                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none shadow-sm focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                                            >
                                                                {allBays.map(b => <option key={b.id} value={b.id}>{b.id} – {b.name}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Shelf Assignment</label>
                                                            <select
                                                                value={product.shelfId}
                                                                onChange={(e) => {
                                                                    updateProduct(product.id, { shelfId: e.target.value });
                                                                    // Trigger camera focus on shelf
                                                                    if (onShelfSelect) {
                                                                        onShelfSelect(e.target.value || null);
                                                                    }
                                                                    // Ensure bay is expanded when selecting shelf
                                                                    const bayId = product.bayId || product.departmentId;
                                                                    if (bayId && expandedDepartmentId !== bayId) {
                                                                        onDepartmentExpand(bayId);
                                                                        if (onAisleSelect) {
                                                                            const aisleId = getAisleIdForBay(storeConfig, bayId);
                                                                            onAisleSelect(aisleId);
                                                                        }
                                                                    }
                                                                }}
                                                                className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none shadow-sm focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                                            >
                                                                {(() => {
                                                                    const bayId = product.bayId || product.departmentId;
                                                                    const bay = bayId ? findBayById(storeConfig, bayId) : undefined;
                                                                    return bay?.shelves.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    )) || [];
                                                                })()}
                                                            </select>
                                                        </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Product Media (URL)</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={product.image}
                                                                    onChange={(e) => updateProduct(product.id, { image: e.target.value })}
                                                                    className="flex-1 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-500 outline-none shadow-sm"
                                                                />
                                                                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                                                    <Zap size={16} className="text-slate-400" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
        </div>
    );
};

export default AdminForm;
