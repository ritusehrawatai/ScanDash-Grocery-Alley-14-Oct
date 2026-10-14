import React, { useState } from 'react';
import { Power, AlertTriangle, X } from 'lucide-react';
import { Product } from '../../types/product';

interface DeactivateConfirmModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (product: Product, newActiveStatus: boolean) => Promise<void>;
}

export const DeactivateConfirmModal: React.FC<DeactivateConfirmModalProps> = ({
  product,
  onClose,
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDeactivating = product.active;
  const newActiveStatus = !product.active;

  const handleAction = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(product, newActiveStatus);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update product status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-white ${
                isDeactivating ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
            >
              <Power className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-stone-900 text-sm">
              {isDeactivating ? 'Deactivate Product' : 'Reactivate Product'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-xs text-stone-600 space-y-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          <p>
            Are you sure you want to {isDeactivating ? 'deactivate' : 'reactivate'}{' '}
            <strong className="text-stone-900">{product.name}</strong> (SKU:{' '}
            <span className="font-mono">{product.sku}</span>)?
          </p>

          {isDeactivating ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Deactivating this product will hide it from active POS sales lookups and searches,
                while preserving historical transaction logs.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-start gap-2">
              <Power className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Reactivating this product will restore it to POS registers and active inventory views.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={submitting}
            className={`px-3 py-1.5 text-xs font-medium text-white rounded transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
              isDeactivating ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {submitting ? 'Updating...' : isDeactivating ? 'Confirm Deactivate' : 'Confirm Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};
