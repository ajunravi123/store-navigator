
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Product, AIRecommendation } from '../types';
import { Bot, Send, Loader2, X, ShoppingBag, ArrowRight, Sparkles, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  recommendation?: AIRecommendation;
  additionalRecommendations?: { [productId: string]: AIRecommendation };
  loadingRecommendations?: { [productId: string]: boolean };
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
  const [internalMessages, setInternalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use external history if provided, otherwise use internal state
  const messages = externalChatHistory || internalMessages;
  const setMessages = onChatHistoryChange || setInternalMessages;
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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
    setMessages(prev => [...prev, userMessage]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on the following store products, help the user with their request: "${userQuery}". 
        Products: ${JSON.stringify(products.map(p => ({ 
          id: p.id, 
          name: p.name, 
          category: p.category,
          price: p.price,
          description: p.description,
          stockCount: p.stockCount,
          sku: p.sku,
          image: p.image
        })))}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { 
                type: Type.STRING, 
                description: "A brief friendly explanation of the suggestions. If the user asks about price, include the price in your explanation. If they ask about stock, include stock information. Be helpful and informative." 
              },
              productIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of product IDs that match the user's intent."
              }
            },
            required: ["explanation", "productIds"]
          },
          systemInstruction: "You are a helpful in-store shopping assistant representing this store. You have access to complete product information including prices, descriptions, stock counts, and SKUs. When users ask about specific products, provide detailed information from the product data. Use natural, direct language - refer to products as 'it' or by name, not 'they'. Speak as if you're a store employee helping a customer. Your goal is to map user intents (like recipes, occasions, problems, or specific product questions) to specific product IDs from the provided catalog. Always include relevant product details (price, description, stock) in your explanations when available. Keep your explanation concise, encouraging, and informative. Use first-person when referring to the store (e.g., 'We have', 'Our product', 'It is priced at')."
        }
      });

      const result = JSON.parse(response.text || '{}') as AIRecommendation;
      onSelectProducts(result.productIds);
      
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: result.explanation,
        recommendation: result,
        additionalRecommendations: {},
        loadingRecommendations: {},
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Fetch additional recommendations for each recommended product
      fetchAdditionalRecommendations(result.productIds, assistantMessage.id);
    } catch (error) {
      console.error("AI Error:", error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdditionalRecommendations = async (productIds: string[], messageId: string) => {
    // Track all products that have already been recommended to avoid duplicates
    const alreadyRecommended = new Set<string>(productIds);
    const recommendationsMap: { [productId: string]: AIRecommendation } = {};
    const loadingMap: { [productId: string]: boolean } = {};
    
    // Initialize loading states
    productIds.forEach(id => {
      loadingMap[id] = true;
    });
    
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, loadingRecommendations: { ...loadingMap } }
        : msg
    ));
    
    // Fetch recommendations for each product sequentially to avoid duplicates
    for (const productId of productIds) {
      const product = products.find(p => p.id === productId);
      if (!product) {
        loadingMap[productId] = false;
        continue;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const otherProducts = products.filter(p => 
          p.id !== productId && 
          !alreadyRecommended.has(p.id) // Exclude already recommended products
        );
        
        if (otherProducts.length === 0) {
          loadingMap[productId] = false;
          continue;
        }
        
        const productContext = `Product: ${product.name}${product.description ? `. Description: ${product.description}` : ''}. Category: ${product.category}`;
        
        const prompt = `Find 2-3 products that are similar, complementary, or commonly purchased together with this product: "${productContext}". 
        Exclude the current product (ID: ${productId}) and products already shown to the user.
        Products available: ${JSON.stringify(otherProducts.map(p => ({ 
          id: p.id, 
          name: p.name, 
          category: p.category,
          description: p.description || ''
        })))}`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                explanation: { 
                  type: Type.STRING, 
                  description: "A brief explanation (max 1 sentence) of why these products are recommended." 
                },
                productIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of 2-3 product IDs that are similar or complementary."
                }
              },
              required: ["explanation", "productIds"]
            },
            systemInstruction: "You are a smart shopping assistant. Recommend 2-3 products that are similar, complementary, or commonly bought together. Keep recommendations relevant and useful."
          }
        });

        const result = JSON.parse(response.text || '{}') as AIRecommendation;
        
        // Filter to ensure we only show products that exist and haven't been recommended yet
        const validProductIds = result.productIds.filter(id => 
          id !== productId && 
          otherProducts.some(p => p.id === id) &&
          !alreadyRecommended.has(id) // Don't show products already recommended for other main products
        );
        
        // Add these recommendations to the "already recommended" set
        validProductIds.forEach(id => alreadyRecommended.add(id));
        
        if (validProductIds.length > 0) {
          recommendationsMap[productId] = {
            ...result,
            productIds: validProductIds.slice(0, 3)
          };
        }
        
        loadingMap[productId] = false;
        
        // Update the message with recommendations
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                additionalRecommendations: { ...msg.additionalRecommendations, ...recommendationsMap },
                loadingRecommendations: { ...loadingMap }
              }
            : msg
        ));
      } catch (err) {
        console.error(`Error fetching recommendations for ${productId}:`, err);
        loadingMap[productId] = false;
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, loadingRecommendations: { ...loadingMap } }
            : msg
        ));
      }
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
        {messages.length === 0 && !loading && (
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
        {messages.map((message) => (
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

                  {message.recommendation && (
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Found in store:</h5>
                      {message.recommendation.productIds.map(id => {
                        const p = products.find(prod => prod.id === id);
                        if (!p) return null;
                        const additionalRecs = message.additionalRecommendations?.[id];
                        const isLoadingRecs = message.loadingRecommendations?.[id];
                        const hasAdditionalRecs = additionalRecs && additionalRecs.productIds.length > 0;
                        
                        return (
                          <div key={id} className="space-y-2">
                            <button
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
                            
                            {/* Additional Recommendations for this product */}
                            {(isLoadingRecs || hasAdditionalRecs) && (
                              <div className="ml-4 pl-4 border-l-2 border-blue-100 space-y-2">
                                {isLoadingRecs && (
                                  <div className="flex items-center gap-2 py-1">
                                    <Loader2 className="text-blue-400 animate-spin" size={12} />
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Finding matches...</p>
                                  </div>
                                )}
                                {hasAdditionalRecs && (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles size={10} className="text-indigo-500" />
                                      <p className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">You might also like</p>
                                    </div>
                                    {additionalRecs.productIds.map(recId => {
                                      const recProduct = products.find(prod => prod.id === recId);
                                      if (!recProduct) return null;
                                      return (
                                        <button
                                          key={recId}
                                          onClick={() => onNavigateToProduct(recProduct)}
                                          className="w-full flex items-center gap-2 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
                                        >
                                          {recProduct.image && (
                                            <img src={recProduct.image} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                                              {recProduct.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              <p className="text-[8px] font-bold text-slate-400 uppercase truncate">
                                                {recProduct.category}
                                              </p>
                                              {recProduct.price !== undefined && recProduct.price !== null && (
                                                <>
                                                  <span className="text-[7px] text-slate-300">•</span>
                                                  <p className="text-[8px] font-black text-slate-600">
                                                    ${recProduct.price.toFixed(2)}
                                                  </p>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                          <ArrowRight size={10} className="text-indigo-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
