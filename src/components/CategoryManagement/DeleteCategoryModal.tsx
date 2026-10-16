import React, { useState } from 'react';
import { AlertTriangle, X, Trash2, Power, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { ProductCategory } from '../../types/category';

interface DeleteCategoryModalProps {
  category: ProductCategory;
  productCount: number;
  onClose: () => void;
  onConfirmDelete: (categoryId: number) => Promise<void>;
  onConfirmDeactivate: (categoryId: number) => Promise<void>;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  category,
  productCount,
  onClose,
  onConfirmDelete,
  onConfirmDeactivate,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasAssociatedProducts = productCount > 0;

  const handleDelete = async () => {
    if (hasAssociatedProducts) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirmDelete(category.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete category.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirmDeactivate(category.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate category.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md border ${
                hasAssociatedProducts
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {hasAssociatedProducts ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {hasAssociatedProducts ? 'Cannot Delete Category' : 'Delete Category'}
              </h2>
              <span className="text-[11px] text-stone-500 font-mono">
                Category ID #{category.id} · {category.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {hasAssociatedProducts ? (
            /* Warning: Category has associated products, permanent deletion blocked */
            <div className="space-y-3">
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-md text-amber-900 leading-relaxed">
                <p className="font-semibold text-amber-950 mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Data Integrity Safeguard</span>
                </p>
                <p>
                  Category <strong>&quot;{category.name}&quot;</strong> is currently assigned to{' '}
                  <strong className="underline">{productCount} product{productCount > 1 ? 's' : ''}</strong> in
                  the catalog.
                </p>
                <p className="mt-2 text-[11px] text-amber-800">
                  To protect sales records, inventory transactions, and purchase invoice history from orphan
                  references, categories with associated products cannot be deleted.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-2 text-stone-700">
                <span className="font-semibold block text-stone-900">Recommended Action: Deactivate</span>
                <p className="text-[11px] text-stone-600 leading-normal">
                  Deactivating this category will hide it from future product creation dropdowns while safely
                  preserving all {productCount} existing products, inventory history, and reports intact.
                </p>
              </div>
            </div>
          ) : (
            /* Confirm deletion for unused category */
            <div className="space-y-3">
              <p className="text-stone-700 leading-relaxed">
                Are you sure you want to permanently delete category <strong>&quot;{category.name}&quot;</strong>?
              </p>
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-md text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero products currently reference this category. It is safe to remove.</span>
              </div>
              <p className="text-[11px] text-stone-500">
                This action is logged in the system audit trail and cannot be undone.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-stone-300 hover:bg-stone-100 rounded-md font-medium text-stone-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {hasAssociatedProducts ? (
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={loading || !category.active}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {loading
                    ? 'Updating...'
                    : category.active
                    ? 'Deactivate Category Instead'
                    : 'Already Inactive'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{loading ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
