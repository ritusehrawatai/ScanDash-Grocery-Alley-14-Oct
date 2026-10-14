import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Package,
  X,
  Filter,
  CheckCircle2,
  RefreshCw,
  Mic,
  MicOff,
} from 'lucide-react';
import { Product } from '../../types/product';
import { searchProducts, fetchProducts } from '../../api/productApi';

/**
 * Normalizes and cleans voice transcript for product searching.
 * Example: "Find milk" -> "milk", "search for organic bananas" -> "organic bananas"
 */
export function cleanVoiceTranscript(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Strip trailing punctuation like periods or question marks from speech recognition
  text = text.replace(/[.,!?;:]+$/, '').trim();

  // Strip conversational search prefixes
  const prefixRegex = /^(can you\s+)?(find\s+me\s+|find\s+|search\s+for\s+|search\s+|look\s+for\s+|look\s+up\s+|show\s+me\s+|get\s+me\s+|get\s+|where\s+is\s+|where\s+are\s+|query\s+)/i;
  const cleaned = text.replace(prefixRegex, '').trim();
  return cleaned || text;
}

interface ProductSearchCatalogProps {
  onAddToCart: (product: Product) => void;
}

export const ProductSearchCatalog: React.FC<ProductSearchCatalogProps> = ({ onAddToCart }) => {
  const [query, setQuery] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);

  // Browser-native speech recognition state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);
  const [voiceFeedback, setVoiceFeedback] = useState<{
    transcript: string;
    cleanedTerm: string;
    status: 'heard' | 'error';
    errorMessage?: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Detect browser-native speech recognition availability on mount
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    setIsSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  const loadProducts = async (searchQuery: string = '') => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await searchProducts(searchQuery.trim(), true);
        setProducts(results);
      } else {
        const all = await fetchProducts(undefined, undefined, true);
        setProducts(all);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Debounced search for manual typing
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-dismiss voice feedback after 6 seconds
  useEffect(() => {
    if (voiceFeedback?.status === 'heard') {
      const timer = setTimeout(() => {
        setVoiceFeedback(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [voiceFeedback]);

  // Voice Search Handler using Browser-Native Speech Recognition
  const handleStartVoiceSearch = () => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setVoiceFeedback({
        transcript: '',
        cleanedTerm: '',
        status: 'error',
        errorMessage: 'Speech recognition is not supported in this browser.',
      });
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceFeedback(null);
      };

      recognition.onresult = (event: any) => {
        setIsListening(false);
        const lastResultIndex = event.results.length - 1;
        const rawTranscript = event.results[lastResultIndex][0]?.transcript || '';
        if (rawTranscript.trim()) {
          const cleaned = cleanVoiceTranscript(rawTranscript);
          // Set query in the POS search input
          setQuery(cleaned);
          // Directly use existing product search API to load matching products immediately
          loadProducts(cleaned);
          setVoiceFeedback({
            transcript: rawTranscript.trim(),
            cleanedTerm: cleaned,
            status: 'heard',
          });
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'no-speech') {
          setVoiceFeedback({
            transcript: '',
            cleanedTerm: '',
            status: 'error',
            errorMessage: 'No speech was detected. Please try again.',
          });
        } else if (event.error === 'not-allowed') {
          setVoiceFeedback({
            transcript: '',
            cleanedTerm: '',
            status: 'error',
            errorMessage: 'Microphone permission was denied. Please allow microphone access.',
          });
        } else if (event.error !== 'aborted') {
          setVoiceFeedback({
            transcript: '',
            cleanedTerm: '',
            status: 'error',
            errorMessage: `Voice recognition error: ${event.error}`,
          });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setVoiceFeedback({
        transcript: '',
        cleanedTerm: '',
        status: 'error',
        errorMessage: 'Could not access microphone for voice search.',
      });
    }
  };

  const handleStopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleToggleVoiceSearch = () => {
    if (isListening) {
      handleStopVoiceSearch();
    } else {
      handleStartVoiceSearch();
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Extract unique categories
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set);
  }, [products]);

  // Filter products by selected category
  const filteredProducts = React.useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.categoryName === selectedCategory);
  }, [products, selectedCategory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) return;

      // Exact barcode or SKU match
      const exactMatch = products.find(
        (p) =>
          p.barcode?.toLowerCase() === trimmed ||
          p.sku.toLowerCase() === trimmed
      );

      if (exactMatch) {
        handleProductClick(exactMatch);
        setQuery('');
      } else if (filteredProducts.length === 1) {
        handleProductClick(filteredProducts[0]);
        setQuery('');
      }
    }
  };

  const handleProductClick = (product: Product) => {
    onAddToCart(product);
    setLastAddedId(product.id);
    setTimeout(() => {
      setLastAddedId((prev) => (prev === product.id ? null : prev));
    }, 600);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Search Bar with Microphone Voice Search */}
      <div className="p-4 border-b border-stone-200 bg-stone-50/50 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan barcode, type Name, SKU, or click Mic to speak (e.g. 'Find milk')..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent placeholder-stone-400 font-sans"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setVoiceFeedback(null);
                  searchInputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400">
                <Barcode className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Dedicated POS Voice Search Microphone Button */}
          <button
            type="button"
            onClick={handleToggleVoiceSearch}
            disabled={!isSpeechSupported}
            title={
              !isSpeechSupported
                ? 'Speech recognition not supported in this browser'
                : isListening
                ? 'Listening... Click to stop voice search'
                : 'Voice Search: Click and say e.g. "Find milk"'
            }
            className={`px-3 py-2.5 rounded-lg border flex items-center gap-1.5 text-sm font-medium transition-all shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-50 text-rose-700 border-rose-400 ring-2 ring-rose-400/40 animate-pulse'
                : isSpeechSupported
                ? 'bg-white hover:bg-stone-50 text-stone-700 border-stone-300 hover:border-emerald-600 shadow-xs'
                : 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4 text-rose-600 animate-bounce" />
                <span className="text-xs font-bold text-rose-700">Listening...</span>
              </>
            ) : (
              <>
                <Mic className={`w-4 h-4 ${isSpeechSupported ? 'text-emerald-700' : 'text-stone-400'}`} />
                <span className="hidden sm:inline text-xs font-semibold text-stone-700">Voice</span>
              </>
            )}
          </button>
        </div>

        {/* Listening Active Banner */}
        {isListening && (
          <div className="flex items-center justify-between px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span className="font-medium">
                Listening... Speak a product name (e.g. <strong>&ldquo;Find milk&rdquo;</strong>, <strong>&ldquo;Bananas&rdquo;</strong>)
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopVoiceSearch}
              className="text-[11px] underline font-semibold text-rose-700 hover:text-rose-900 cursor-pointer ml-2"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Voice Feedback Badge */}
        {voiceFeedback && !isListening && (
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all ${
              voiceFeedback.status === 'heard'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {voiceFeedback.status === 'heard' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="truncate">
                {voiceFeedback.status === 'heard' ? (
                  <>
                    Voice search heard <strong>&ldquo;{voiceFeedback.transcript}&rdquo;</strong> &rarr; searching for <strong>&ldquo;{voiceFeedback.cleanedTerm}&rdquo;</strong>
                  </>
                ) : (
                  voiceFeedback.errorMessage || 'Voice recognition ended'
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setVoiceFeedback(null)}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Category Filter Tabs */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-md font-medium shrink-0 transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md font-medium shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Catalog Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Searching catalog...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-center">
            <Package className="w-8 h-8 stroke-1 mb-2 text-stone-300" />
            <p className="text-sm font-medium text-stone-600">No products found</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs">
              {query
                ? `No active products match "${query}". Try searching by name, SKU, or category.`
                : 'No active products available in catalog.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const isJustAdded = lastAddedId === product.id;
              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`relative p-3 rounded-lg border text-left transition-all flex flex-col justify-between group cursor-pointer ${
                    isJustAdded
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-stone-200 bg-white hover:border-emerald-500 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Category & SKU */}
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                      <span className="truncate font-medium text-stone-600">
                        {product.categoryName || 'General'}
                      </span>
                      <span className="font-mono text-[10px] text-stone-400">
                        {product.sku}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4 className="text-xs font-semibold text-stone-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                      {product.name}
                    </h4>

                    {/* Barcode if present */}
                    {product.barcode && (
                      <div className="text-[10px] font-mono text-stone-400 mt-0.5 truncate flex items-center gap-1">
                        <Barcode className="w-3 h-3 inline text-stone-400 shrink-0" />
                        <span>{product.barcode}</span>
                      </div>
                    )}
                  </div>

                  {/* Price & Unit & Quick Add Action */}
                  <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold font-mono text-stone-900">
                        ${Number(product.sellingPrice).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        per {product.unit}
                        {product.taxRate > 0 ? ` · ${product.taxRate}% tax` : ' · No tax'}
                      </div>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        isJustAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-100 group-hover:bg-emerald-600 group-hover:text-white text-stone-600'
                      }`}
                      title="Add to cart"
                    >
                      {isJustAdded ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Footer Stats */}
      <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
        <span>
          Showing <span className="font-medium text-stone-700">{filteredProducts.length}</span> active products
        </span>
        <span className="font-mono text-[10px] text-stone-400">Click item or press Enter to add</span>
      </div>
    </div>
  );
};
