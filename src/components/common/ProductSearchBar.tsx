import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Package, Tag, Barcode as BarcodeIcon } from 'lucide-react';
import { Product } from '../../types/product';
import { searchProducts } from '../../api/productApi';

export interface ProductSearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
  activeOnly?: boolean;
  value?: string;
  onChange?: (query: string) => void;
  onSearchResults?: (results: Product[]) => void;
  onSelectProduct?: (product: Product) => void;
  showDropdown?: boolean;
  className?: string;
}

export const ProductSearchBar: React.FC<ProductSearchBarProps> = ({
  placeholder = 'Search by Name, SKU, Barcode, or Category (e.g. "milk")...',
  autoFocus = false,
  activeOnly = false,
  value: controlledValue,
  onChange,
  onSearchResults,
  onSelectProduct,
  showDropdown = false,
  className = '',
}) => {
  const [internalQuery, setInternalQuery] = useState<string>(controlledValue || '');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentQuery = controlledValue !== undefined ? controlledValue : internalQuery;

  // Sync with controlled value if provided
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalQuery(controlledValue);
    }
  }, [controlledValue]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced API search execution
  const executeSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const matches = await searchProducts(q, activeOnly);
        setResults(matches);
        if (onSearchResults) {
          onSearchResults(matches);
        }
        if (showDropdown && q.trim().length > 0) {
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setLoading(false);
      }
    },
    [activeOnly, onSearchResults, showDropdown]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(currentQuery);
    }, 200);

    return () => clearTimeout(timer);
  }, [currentQuery, executeSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (controlledValue === undefined) {
      setInternalQuery(val);
    }
    if (onChange) {
      onChange(val);
    }
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    if (controlledValue === undefined) {
      setInternalQuery('');
    }
    if (onChange) {
      onChange('');
    }
    setResults([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSelect = (product: Product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    }
    setIsOpen(false);
  };

  // Keyboard navigation for POS speed
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (results.length === 1) {
        // Quick barcode scan or exact 1-match enter
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-stone-400 pointer-events-none flex items-center">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={currentQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (showDropdown && currentQuery.trim().length > 0 && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-9 pr-9 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 placeholder:text-stone-400 focus:outline-emerald-600 focus:bg-white transition-colors"
        />

        {currentQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-full transition-colors cursor-pointer"
            title="Clear search query"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Popover Results for POS / Quick Select */}
      {showDropdown && isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-100 text-xs">
          {results.length === 0 ? (
            <div className="p-4 text-center text-stone-500">
              <Package className="w-5 h-5 mx-auto mb-1 text-stone-300" />
              <span>No matching products found for &quot;{currentQuery}&quot;</span>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 bg-stone-50 text-[11px] font-medium text-stone-500 flex items-center justify-between border-b border-stone-100">
                <span>{results.length} results matching &quot;{currentQuery}&quot;</span>
                <span className="font-mono text-[10px] text-stone-400">↑↓ to navigate · Enter to select</span>
              </div>
              {results.map((product, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(product)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 text-emerald-950'
                        : 'hover:bg-stone-50 text-stone-800'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-semibold text-stone-900 truncate flex items-center gap-2">
                        <span>{product.name}</span>
                        {!product.active && (
                          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.2 rounded font-normal">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        <span className="font-mono">{product.sku}</span>
                        {product.barcode && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-stone-400 flex items-center gap-0.5">
                              <BarcodeIcon className="w-3 h-3" />
                              {product.barcode}
                            </span>
                          </>
                        )}
                        {product.categoryName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="flex items-center gap-0.5">
                              <Tag className="w-3 h-3 text-stone-400" />
                              {product.categoryName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-emerald-700 text-sm">
                        ${product.sellingPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        per {product.unit}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};
