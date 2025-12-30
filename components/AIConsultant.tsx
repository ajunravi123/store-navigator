
import React, { useState, useEffect, useRef } from 'react';
import { Product, AIRecommendation } from '../types';
import { Bot, Send, Loader2, X, ShoppingBag, ArrowRight, Sparkles, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  recommendation?: AIRecommendation;
  timestamp: Date;
}

interface AIConsultantProps {
  products: Product[];
  chatHistory?: ChatMessage[];
  onChatHistoryChange?: (history: ChatMessage[]) => void;
  onSelectProducts: (ids: string[]) => void;
  onNavigateToProduct: (product: Product) => void;
  onClose: () => void;
}

const AIConsultant: React.FC<AIConsultantProps> = ({
  products,
  chatHistory: externalChatHistory,
  onChatHistoryChange,
  onSelectProducts,
  onNavigateToProduct,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>(externalChatHistory || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync internal state with external history prop updates
  useEffect(() => {
    if (externalChatHistory) {
      setInternalMessages(externalChatHistory);
    }
  }, [externalChatHistory]);

  // Notify parent of state changes
  useEffect(() => {
    if (onChatHistoryChange && internalMessages !== externalChatHistory) {
      onChatHistoryChange(internalMessages);
    }
  }, [internalMessages, onChatHistoryChange, externalChatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [internalMessages, loading]);

  const askAI = async () => {
    if (!query.trim()) return;

    const userQuery = query.trim();
    setQuery('');
    setLoading(true);

    // Add user message to chat history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userQuery,
      timestamp: new Date()
    };

    setInternalMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          history: internalMessages.map(m => ({ role: m.type, content: m.content }))
        })
      });

      if (!response.ok) throw new Error('AI request failed');
      const result = await response.json() as AIRecommendation;
      onSelectProducts(result.productIds);

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: result.explanation,
        recommendation: result,
        timestamp: new Date()
      };

      setInternalMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setInternalMessages(prev => [...prev, errorMessage]);
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
        {internalMessages.length === 0 && !loading && (
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

        {/* Chat Messages */}
        {internalMessages.map((message) => (
          <div key={message.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {message.type === 'user' ? (
              <div className="flex items-start gap-3 justify-end">
                <div className="flex-1 max-w-[80%]">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm">
                    <p className="text-sm font-medium">{message.content}</p>
                  </div>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} className="text-blue-600" />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-slate-600" />
                </div>
                <div className="flex-1 max-w-[80%] space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-sm border border-slate-100">
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {message.content}
                    </p>
                  </div>

                  {message.recommendation && (message.recommendation.productIds.length > 0 || (message.recommendation.suggestedProductIds && message.recommendation.suggestedProductIds.length > 0)) && (
                    <div className="space-y-4">
                      {message.recommendation.productIds.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Found in store:</h5>
                          {message.recommendation.productIds.map(id => {
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
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{p.category}</p>
                                    {p.price !== undefined && p.price !== null && (
                                      <>
                                        <span className="text-[8px] text-slate-300">•</span>
                                        <p className="text-[9px] font-black text-slate-600">${p.price.toFixed(2)}</p>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                  <ArrowRight size={14} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {message.recommendation.suggestedProductIds && message.recommendation.suggestedProductIds.length > 0 && (
                        <div className="space-y-3 pt-2 border-t border-slate-100/50">
                          <div className="flex items-center gap-2">
                            <Sparkles size={12} className="text-indigo-500" />
                            <h5 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">You might also like:</h5>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {message.recommendation.suggestedProductIds.map(id => {
                              const p = products.find(prod => prod.id === id);
                              if (!p) return null;

                              return (
                                <button
                                  key={id}
                                  onClick={() => onNavigateToProduct(p)}
                                  className="w-full flex items-center gap-3 p-2.5 bg-indigo-50/30 border border-indigo-100/50 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
                                >
                                  {p.image && <img src={p.image} className="w-8 h-8 rounded-lg object-cover" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase">{p.category}</p>
                                      {p.price !== undefined && p.price !== null && (
                                        <>
                                          <span className="text-[7px] text-slate-300">•</span>
                                          <p className="text-[8px] font-black text-slate-600">${p.price.toFixed(2)}</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-1 bg-white rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <ArrowRight size={12} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
              <Bot size={16} className="text-slate-600" />
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <Loader2 className="text-blue-500 animate-spin" size={20} />
                  <p className="text-sm text-slate-600 font-medium">Consulting Catalog...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
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
