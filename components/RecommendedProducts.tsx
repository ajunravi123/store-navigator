import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Product, AIRecommendation } from '../types';
import { Bot, Loader2, ArrowRight, Sparkles } from 'lucide-react';

interface RecommendedProductsProps {
  currentProduct: Product;
  allProducts: Product[];
  onNavigateToProduct: (product: Product) => void;
}

const RecommendedProducts: React.FC<RecommendedProductsProps> = ({
  currentProduct,
  allProducts,
  onNavigateToProduct
}) => {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && recommendation && recommendation.productIds.length > 0) {
      // Small timeout to allow the DOM to update with new content and layout to settle
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          // Find the scrollable container (marked with custom-scrollbar in App.tsx)
          const scrollableParent = containerRef.current.closest('.custom-scrollbar');
          if (scrollableParent) {
            const start = scrollableParent.scrollTop;
            const target = scrollableParent.scrollHeight - scrollableParent.clientHeight;

            // If already at or near bottom, no need to scroll
            if (target - start < 10) return;

            const duration = 2500; // 2.5 seconds for a nice, slow, deliberate scroll
            const startTime = performance.now();

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);

              // Smooth easing function (easeInOutCubic) for a professional feel
              const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

              scrollableParent.scrollTop = start + (target - start) * easeProgress;

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
          }
        }
      }, 600);

      return () => clearTimeout(timeout);
    }
  }, [loading, recommendation]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentProduct) return;

      setLoading(true);
      setError(null);
      setRecommendation(null);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Build product context excluding current product
        const otherProducts = allProducts.filter(p => p.id !== currentProduct.id);

        // Create prompt based on product name and description
        const productContext = `Product: ${currentProduct.name}${currentProduct.description ? `. Description: ${currentProduct.description}` : ''}. Category: ${currentProduct.category}`;

        const prompt = `Find products that are similar, complementary, or commonly purchased together with this product: "${productContext}". 
        Exclude the current product (ID: ${currentProduct.id}) from recommendations.
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
                  description: "A brief explanation of why these products are recommended (max 2 sentences)."
                },
                productIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of 3-5 product IDs that are similar or complementary to the current product."
                }
              },
              required: ["explanation", "productIds"]
            },
            systemInstruction: "You are a smart shopping assistant. Recommend products that are similar, complementary, or commonly bought together. Keep recommendations relevant and useful. Return 3-5 product IDs maximum."
          }
        });

        const result = JSON.parse(response.text || '{}') as AIRecommendation;

        // Filter to ensure we only show products that exist and aren't the current product
        const validProductIds = result.productIds.filter(id =>
          id !== currentProduct.id && otherProducts.some(p => p.id === id)
        );

        setRecommendation({
          ...result,
          productIds: validProductIds.slice(0, 5) // Limit to 5 products
        });
      } catch (err: any) {
        console.error("AI Recommendation Error:", err);
        setError("Unable to load recommendations");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentProduct.id, currentProduct.name, currentProduct.description, currentProduct.category, allProducts]);

  // Don't render if no recommendation and not loading
  if (!loading && !recommendation && !error) {
    return null;
  }

  const recommendedProducts = recommendation?.productIds
    .map(id => allProducts.find(p => p.id === id))
    .filter((p): p is Product => p !== undefined) || [];

  if (recommendedProducts.length === 0 && !loading && !error) {
    return null;
  }

  return (
    <div ref={containerRef} className="mt-8 pt-8 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <Sparkles size={14} className="text-indigo-600" />
        </div>
        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recommended Products</h5>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="text-indigo-500 animate-spin" size={20} />
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Finding matches...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <p className="text-[10px] text-red-600 font-medium">{error}</p>
        </div>
      )}

      {recommendation && recommendedProducts.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
          {recommendation.explanation && (
            <div className="bg-indigo-50/50 rounded-lg px-3 py-2 border border-indigo-100 mb-3">
              <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                {recommendation.explanation}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {recommendedProducts.map(product => (
              <button
                key={product.id}
                onClick={() => onNavigateToProduct(product)}
                className="w-full flex items-center gap-2.5 p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all text-left group"
              >
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-8 h-8 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                    {product.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                      {product.category}
                    </p>
                    {product.price !== undefined && product.price !== null && (
                      <>
                        <span className="text-[8px] text-slate-300">•</span>
                        <p className="text-[9px] font-black text-slate-700">
                          ${product.price.toFixed(2)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-1 bg-slate-50 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                  <ArrowRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendedProducts;

