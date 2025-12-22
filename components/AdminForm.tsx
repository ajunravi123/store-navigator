
import React, { useState } from 'react';
import { StoreConfig, Product, Department, Shelf } from '../types';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Box, MapPin, Layers, Package, Zap } from 'lucide-react';

interface AdminFormProps {
    storeConfig: StoreConfig;
    products: Product[];
    expandedDepartmentId: string | null;
    onDepartmentExpand: (id: string | null) => void;
    expandedProductId: string | null;
    onProductExpand: (id: string | null) => void;
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
    onChange
}) => {
    const [activeTab, setActiveTab] = useState<'store' | 'products'>('store');
    const [gridExpanded, setGridExpanded] = useState(false);
    const [elevatorsExpanded, setElevatorsExpanded] = useState(false);

    const updateStore = (updates: Partial<StoreConfig>) => {
        onChange({ ...storeConfig, ...updates }, products);
    };

    const updateProducts = (newProducts: Product[]) => {
        onChange(storeConfig, newProducts);
    };

    // Department Handlers
    const addDepartment = () => {
        const id = `S${storeConfig.departments.length + 1}`;
        const newDepartment: Department = {
            id,
            name: 'New Department',
            floor: 0,
            row: 10,
            column: 10,
            width: 6,
            depth: 4,
            shelves: [{ id: `${id}-A`, name: 'Shelf A' }]
        };
        updateStore({ departments: [...storeConfig.departments, newDepartment] });
        onDepartmentExpand(id);
    };

    const updateDepartment = (id: string, updates: Partial<Department>) => {
        const departments = storeConfig.departments.map(d => d.id === id ? { ...d, ...updates } : d);
        updateStore({ departments });
    };

    const removeDepartment = (id: string) => {
        const departments = storeConfig.departments.filter(d => d.id !== id);
        updateStore({ departments });
        if (expandedDepartmentId === id) onDepartmentExpand(null);
    };

    // Product Handlers
    const addProduct = () => {
        const newProduct: Product = {
            id: `P${products.length + 1}`,
            name: 'New Product',
            category: 'Uncategorized',
            departmentId: storeConfig.departments[0]?.id || '',
            shelfId: storeConfig.departments[0]?.shelves[0]?.id || '',
            image: 'https://picsum.photos/400/400'
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

                        {/* Departments List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departments ({storeConfig.departments.length})</label>
                                <button
                                    onClick={addDepartment}
                                    className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {storeConfig.departments.map((dept) => (
                                    <div key={dept.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => onDepartmentExpand(expandedDepartmentId === dept.id ? null : dept.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black">
                                                    {dept.id}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">{dept.name}</h4>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Floor {dept.floor} • {dept.shelves.length} Shelves</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeDepartment(dept.id); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                {expandedDepartmentId === dept.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                            </div>
                                        </div>

                                        {expandedDepartmentId === dept.id && (
                                            <div className="p-5 bg-slate-50/50 border-t border-slate-100 space-y-5 animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 block">Department Name</span>
                                                        <input
                                                            type="text"
                                                            value={dept.name}
                                                            onChange={(e) => updateDepartment(dept.id, { name: e.target.value })}
                                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <ValidatedInput
                                                            label="Floor"
                                                            value={dept.floor}
                                                            onChange={(val) => updateDepartment(dept.id, { floor: val })}
                                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                            min={0}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-4 gap-3 text-center">
                                                    <ValidatedInput
                                                        label="Row (Z)"
                                                        value={dept.row}
                                                        onChange={(val) => updateDepartment(dept.id, { row: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                    <ValidatedInput
                                                        label="Col (X)"
                                                        value={dept.column}
                                                        onChange={(val) => updateDepartment(dept.id, { column: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                    <ValidatedInput
                                                        label="Width"
                                                        value={dept.width}
                                                        onChange={(val) => updateDepartment(dept.id, { width: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        min={1}
                                                    />
                                                    <ValidatedInput
                                                        label="Depth"
                                                        value={dept.depth}
                                                        onChange={(val) => updateDepartment(dept.id, { depth: val })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                                                        min={1}
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Shelves</span>
                                                        <button
                                                            onClick={() => {
                                                                const newShelf = { id: `${dept.id}-${String.fromCharCode(65 + dept.shelves.length)}`, name: `Shelf ${String.fromCharCode(65 + dept.shelves.length)}` };
                                                                updateDepartment(dept.id, { shelves: [...dept.shelves, newShelf] });
                                                            }}
                                                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase"
                                                        >
                                                            + Add Shelf
                                                        </button>
                                                    </div>
                                                    {dept.shelves.map((shelf, idx) => (
                                                        <div key={shelf.id} className="flex gap-2 items-center">
                                                            <div className="flex-1 flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={shelf.name}
                                                                    onChange={(e) => {
                                                                        const newShelves = [...dept.shelves];
                                                                        newShelves[idx] = { ...shelf, name: e.target.value };
                                                                        updateDepartment(dept.id, { shelves: newShelves });
                                                                    }}
                                                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                                    placeholder="Shelf Name"
                                                                />
                                                                <ValidatedInput
                                                                    value={shelf.levelCount || 5}
                                                                    onChange={(val) => {
                                                                        const newShelves = [...dept.shelves];
                                                                        newShelves[idx] = { ...shelf, levelCount: val };
                                                                        updateDepartment(dept.id, { shelves: newShelves });
                                                                    }}
                                                                    className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-center"
                                                                    label=""
                                                                    min={1}
                                                                    placeholder="Rows"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    updateDepartment(dept.id, { shelves: dept.shelves.filter(s => s.id !== shelf.id) });
                                                                }}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
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
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Placement Rows</label>
                                                            <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                                {(() => {
                                                                    const dept = storeConfig.departments.find(d => d.id === product.departmentId);
                                                                    const shelf = dept?.shelves.find(s => s.id === product.shelfId);
                                                                    const maxLevels = shelf?.levelCount || dept?.levelCount || 5;

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
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Department Assignment</label>
                                                                <select
                                                                    value={product.departmentId}
                                                                    onChange={(e) => {
                                                                        const dept = storeConfig.departments.find(d => d.id === e.target.value);
                                                                        updateProduct(product.id, { departmentId: e.target.value, shelfId: dept?.shelves[0]?.id || '' });
                                                                    }}
                                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none shadow-sm focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                                                >
                                                                    {storeConfig.departments.map(d => <option key={d.id} value={d.id}>{d.id} – {d.name}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Shelf Assignment</label>
                                                                <select
                                                                    value={product.shelfId}
                                                                    onChange={(e) => updateProduct(product.id, { shelfId: e.target.value })}
                                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none shadow-sm focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                                                >
                                                                    {storeConfig.departments.find(d => d.id === product.departmentId)?.shelves.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
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
