
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Product, AIRecommendation } from '../types';
import { Bot, Send, Loader2, X, ShoppingBag, ArrowRight } from 'lucide-react';

interface AIConsultantProps {
  products: Product[];
  onSelectProducts: (ids: string[]) => void;
  onNavigateToProduct: (product: Product) => void;
  onClose: () => void;
}

const AIConsultant: React.FC<AIConsultantProps> = ({ products, onSelectProducts, onNavigateToProduct, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);

  const askAI = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on the following store products, help the user with their request: "${query}". 
        Products: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, cat: p.category })))}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING, description: "A brief friendly explanation of the suggestions." },
              productIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of product IDs that match the user's intent."
              }
            },
            required: ["explanation", "productIds"]
          },
          systemInstruction: "You are a helpful in-store shopping assistant. Your goal is to map user intents (like recipes, occasions, or problems) to specific product IDs from the provided catalog. Keep your explanation concise and encouraging."
        }
      });

      const result = JSON.parse(response.text || '{}') as AIRecommendation;
      setRecommendation(result);
      onSelectProducts(result.productIds);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-sm tracking-tight">Shopping Concierge</h3>
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Powered by Impact Analytics</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {!recommendation && !loading && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="text-blue-500" size={24} />
            </div>
            <h4 className="font-black text-slate-800 mb-2">How can I help you shop today?</h4>
            <p className="text-xs text-slate-400 font-medium px-4">
              Try "I'm making tacos tonight" or "What do you have for a movie marathon?"
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="text-blue-500 animate-spin" size={32} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Consulting Catalog...</p>
          </div>
        )}

        {recommendation && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {recommendation.explanation}
              </p>
            </div>

            <div className="space-y-3">
              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Found in store:</h5>
              {recommendation.productIds.map(id => {
                const p = products.find(prod => prod.id === id);
                if (!p) return null;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigateToProduct(p)}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all text-left group"
                  >
                    <img src={p.image} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{p.category}</p>
                    </div>
                    <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ArrowRight size={14} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask anything..."
            className="w-full pl-4 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAI()}
          />
          <button
            onClick={askAI}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConsultant;
