import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  RefreshCw,
  Edit2,
  Power,
  Trash2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ProductCategory, CreateCategoryInput, UpdateCategoryInput } from '../../types/category';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
} from '../../api/categoryApi';
import { CategoryFormModal } from './CategoryFormModal';
import { DeleteCategoryModal } from './DeleteCategoryModal';

interface CategoryListProps {
  onNavigateToProducts?: () => void;
  onCategoriesChanged?: () => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  onNavigateToProducts,
  onCategoriesChanged,
}) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);

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

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch categories from backend REST API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.active) ||
        (statusFilter === 'inactive' && !c.active);

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // Handlers
  const handleSaveCategory = async (data: CreateCategoryInput | UpdateCategoryInput) => {
    if (editingCategory) {
      const updated = await updateCategory(editingCategory.id, data);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Category "${updated.name}" updated successfully.`);
      onCategoriesChanged?.();
    } else {
      const created = await createCategory(data as CreateCategoryInput);
      setCategories((prev) => [...prev, created]);
      showToast(`Category "${created.name}" created successfully.`);
      onCategoriesChanged?.();
    }
  };

  const handleToggleActive = async (category: ProductCategory) => {
    const newStatus = !category.active;
    try {
      const updated = await toggleCategoryActive(category.id, newStatus);
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(
        `Category "${updated.name}" ${newStatus ? 'activated' : 'deactivated'} successfully.`
      );
      onCategoriesChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to update category status', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    await deleteCategory(categoryId);
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    showToast('Category deleted successfully.');
    onCategoriesChanged?.();
  };

  const handleDeactivateFromModal = async (categoryId: number) => {
    const updated = await toggleCategoryActive(categoryId, false);
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    showToast(`Category "${updated.name}" deactivated successfully.`);
    onCategoriesChanged?.();
  };

  const totalActive = categories.filter((c) => c.active).length;
  const totalInactive = categories.filter((c) => !c.active).length;
  const totalProductsCount = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

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
              <span>Catalog Taxonomy</span>
              <span aria-hidden="true">·</span>
              <span>REST API Connected</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mt-0.5">Product Category Management</h1>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <span>{categories.length} Categories</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">{totalActive} Active</span>
              <span aria-hidden="true">·</span>
              <span className="text-stone-500">{totalInactive} Inactive</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-stone-600 font-medium">
                {totalProductsCount} Associated Products
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToProducts && (
              <button
                onClick={onNavigateToProducts}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors cursor-pointer"
                title="Go to Product Catalog"
              >
                <Package className="w-3.5 h-3.5" />
                <span>View Products</span>
              </button>
            )}

            <button
              onClick={loadCategories}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh category list from API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setEditingCategory(null);
                setIsAddingCategory(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories by name or description..."
              className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-900 placeholder:text-stone-400 focus:outline-emerald-600 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Categories ({categories.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Active ({totalActive})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Inactive ({totalInactive})
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadCategories}
            className="text-red-700 underline font-medium hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Categories Table Container */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-center">Associated Products</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Created / Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Loading categories from REST API...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    <Tag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-medium text-stone-700">No categories found</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing your search query or filter'
                        : 'Get started by clicking "Add Category" above'}
                    </p>
                    {(searchQuery || statusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                        }}
                        className="mt-2 text-xs text-emerald-700 underline font-medium cursor-pointer"
                      >
                        Reset search & filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => {
                  const productCount = c.productCount || 0;
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        !c.active ? 'bg-stone-50/40 text-stone-400' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        <div className="flex items-center gap-2">
                          <Tag className={`w-3.5 h-3.5 ${c.active ? 'text-emerald-600' : 'text-stone-400'}`} />
                          <span>{c.name}</span>
                          {!c.active && (
                            <span className="text-[10px] bg-stone-200/80 text-stone-600 px-1.5 py-0.2 rounded font-normal">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3 text-stone-600 max-w-sm truncate">
                        {c.description ? (
                          <span title={c.description}>{c.description}</span>
                        ) : (
                          <span className="text-stone-400 italic">No description</span>
                        )}
                      </td>

                      {/* Associated Products Count */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            productCount > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-stone-100 text-stone-500 border border-stone-200'
                          }`}
                          title={`${productCount} product(s) classified under this category`}
                        >
                          <Package className="w-3 h-3" />
                          <span>{productCount}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            c.active ? 'text-emerald-700' : 'text-stone-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.active ? 'bg-emerald-500' : 'bg-stone-300'
                            }`}
                          ></span>
                          <span>{c.active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Created / Updated */}
                      <td className="py-3 px-3 font-mono text-stone-500 text-[11px]">
                        {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingCategory(c)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                            title="Edit Category Name & Description"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(c)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              c.active
                                ? 'text-stone-400 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-stone-400 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={c.active ? 'Deactivate Category' : 'Activate Category'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setCategoryToDelete(c)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              productCount > 0
                                ? 'text-stone-300 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-stone-400 hover:text-red-700 hover:bg-red-50'
                            }`}
                            title={
                              productCount > 0
                                ? 'Deactivate or Reassign (Cannot permanently delete with associated products)'
                                : 'Delete Unused Category'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing <span className="font-mono font-medium text-stone-700">{filteredCategories.length}</span> of{' '}
            <span className="font-mono font-medium text-stone-700">{categories.length}</span> categories
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">
              Deactivating preserves existing product associations safely.
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(isAddingCategory || editingCategory) && (
        <CategoryFormModal
          categoryToEdit={editingCategory}
          existingCategories={categories}
          onClose={() => {
            setIsAddingCategory(false);
            setEditingCategory(null);
          }}
          onSubmit={handleSaveCategory}
        />
      )}

      {categoryToDelete && (
        <DeleteCategoryModal
          category={categoryToDelete}
          productCount={categoryToDelete.productCount || 0}
          onClose={() => setCategoryToDelete(null)}
          onConfirmDelete={handleDeleteCategory}
          onConfirmDeactivate={handleDeactivateFromModal}
        />
      )}
    </div>
  );
};
