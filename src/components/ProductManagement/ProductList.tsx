import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  Edit2,
  Power,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { Product, CreateProductInput, UpdateProductInput } from '../../types/product';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  toggleProductActive,
} from '../../api/productApi';
import { updateProductThreshold } from '../../api/userApi';
import { ProductSearchBar } from '../common/ProductSearchBar';
import { ProductDetailModal } from './ProductDetailModal';
import { ProductFormModal } from './ProductFormModal';
import { DeactivateConfirmModal } from './DeactivateConfirmModal';

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' ||
        (p.categoryName && p.categoryName.toLowerCase() === selectedCategory.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.active) ||
        (statusFilter === 'inactive' && !p.active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Unique categories for filter dropdown
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  // Handlers for Add / Edit
  const handleSaveProduct = async (data: CreateProductInput | UpdateProductInput) => {
    if (editingProduct) {
      const updated = await updateProduct(editingProduct.id, data);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(`Product "${updated.name}" updated successfully.`);
    } else {
      const created = await createProduct(data as CreateProductInput);
      setProducts((prev) => [created, ...prev]);
      showToast(`Product "${created.name}" created successfully.`);
    }
  };

  // Handler for Deactivate / Activate
  const handleConfirmToggleActive = async (product: Product, newActiveStatus: boolean) => {
    const updated = await toggleProductActive(product, newActiveStatus);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast(
      `Product "${updated.name}" ${newActiveStatus ? 'activated' : 'deactivated'} successfully.`
    );
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
              <span>Catalog & Price Master</span>
              <span aria-hidden="true">·</span>
              <span>REST API Connected</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mt-0.5">Product Management</h1>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <span>{products.length} Total SKUs</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">
                {products.filter((p) => p.active).length} Active
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-stone-500">
                {products.filter((p) => !p.active).length} Inactive
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadProducts}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh product list from API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setEditingProduct(null);
                setIsAddingProduct(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Reusable Search Bar with instant dropdown (reusable in POS checkout) */}
          <div className="relative flex-1 max-w-lg">
            <ProductSearchBar
              value={searchQuery}
              onChange={(q) => setSearchQuery(q)}
              onSelectProduct={(p) => setViewingProduct(p)}
              showDropdown={true}
              placeholder='Search by Name, SKU, Barcode, or Category (e.g. "milk")...'
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-800 focus:outline-emerald-600 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Quick Search Keyword Suggestions */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span className="text-[11px] font-medium text-stone-400">Quick partial match examples:</span>
          {['milk', 'bananas', 'dairy', 'produce', '0123'].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setSearchQuery(term)}
              className="text-[11px] font-mono text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              &quot;{term}&quot;
            </button>
          ))}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-stone-400 hover:text-stone-700 underline ml-2 cursor-pointer"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadProducts}
            className="text-red-700 underline font-medium hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Product Table Container */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-right">Purchase ($)</th>
                <th className="py-3 px-3 text-right">Selling ($)</th>
                <th className="py-3 px-3 text-right">Tax (%)</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Min. Thresh</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Loading products from REST API...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-stone-500">
                    <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-medium text-stone-700">No products found</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
                        ? 'Try clearing your search query or filters'
                        : 'Get started by clicking "Add Product" above'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-stone-50/80 transition-colors ${
                      !p.active ? 'bg-stone-50/40 text-stone-400' : ''
                    }`}
                  >
                    {/* Name */}
                    <td className="py-3 px-4 font-medium text-stone-900 max-w-[180px] truncate">
                      <span title={p.name}>{p.name}</span>
                    </td>

                    {/* SKU */}
                    <td className="py-3 px-3 font-mono text-stone-700 font-medium">
                      {p.sku}
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-3 font-mono text-stone-500">
                      {p.barcode ? p.barcode : <span className="text-stone-300 italic">-</span>}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 text-stone-600">
                      {p.categoryName || <span className="text-stone-400 italic">None</span>}
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-3 text-stone-600 max-w-[120px] truncate">
                      <span title={p.supplierName || 'In-House'}>
                        {p.supplierName || <span className="text-stone-400 italic">In-House</span>}
                      </span>
                    </td>

                    {/* Purchase Price */}
                    <td className="py-3 px-3 font-mono text-stone-600 text-right">
                      ${p.purchasePrice.toFixed(2)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-3 font-mono font-bold text-stone-900 text-right">
                      ${p.sellingPrice.toFixed(2)}
                    </td>

                    {/* Tax */}
                    <td className="py-3 px-3 font-mono text-stone-600 text-right">
                      {p.taxRate.toFixed(1)}%
                    </td>

                    {/* Unit */}
                    <td className="py-3 px-3 text-stone-600 font-mono">
                      {p.unit}
                    </td>

                    {/* Minimum Threshold */}
                    <td className="py-3 px-3 font-mono text-stone-600 text-right">
                      <button
                        onClick={async () => {
                          const val = prompt(`Set minimum stock threshold for '${p.name}':`, String(p.minimumInventoryThreshold));
                          if (val !== null && !isNaN(parseInt(val)) && parseInt(val) >= 0) {
                            try {
                              const newThresh = parseInt(val);
                              await updateProductThreshold(p.id, newThresh);
                              setProducts((prev) => prev.map((item) => (item.id === p.id ? { ...item, minimumInventoryThreshold: newThresh } : item)));
                              showToast(`Threshold for '${p.name}' updated to ${newThresh} units`);
                            } catch (err: any) {
                              showToast(err.message || 'Failed to update threshold', 'error');
                            }
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-stone-100 hover:bg-emerald-100 hover:text-emerald-900 border border-stone-200 transition cursor-pointer font-bold text-xs"
                        title="Click to adjust inventory threshold (OWNER/ADMIN only)"
                      >
                        {p.minimumInventoryThreshold}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          p.active ? 'text-emerald-700' : 'text-stone-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.active ? 'bg-emerald-500' : 'bg-stone-300'
                          }`}
                        ></span>
                        <span>{p.active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingProduct(p)}
                          className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeactivatingProduct(p)}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            p.active
                              ? 'text-stone-400 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-stone-400 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={p.active ? 'Deactivate Product' : 'Activate Product'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing <span className="font-mono font-medium text-stone-700">{filteredProducts.length}</span> of{' '}
            <span className="font-mono font-medium text-stone-700">{products.length}</span> products
          </div>
          <div className="flex items-center gap-3">
            <span>Currency: USD ($)</span>
            <span aria-hidden="true">·</span>
            <span>Tax Inclusive Mode</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={(prod) => {
            setViewingProduct(null);
            setEditingProduct(prod);
          }}
          onToggleActive={(prod) => {
            setViewingProduct(null);
            setDeactivatingProduct(prod);
          }}
        />
      )}

      {(isAddingProduct || editingProduct) && (
        <ProductFormModal
          productToEdit={editingProduct}
          onClose={() => {
            setIsAddingProduct(false);
            setEditingProduct(null);
          }}
          onSubmit={handleSaveProduct}
        />
      )}

      {deactivatingProduct && (
        <DeactivateConfirmModal
          product={deactivatingProduct}
          onClose={() => setDeactivatingProduct(null)}
          onConfirm={handleConfirmToggleActive}
        />
      )}
    </div>
  );
};
