import React, { useState } from 'react';
import { X, Sliders, AlertCircle, ArrowRight } from 'lucide-react';
import { InventoryItem } from '../../types/inventory';
import { adjustStock } from '../../api/inventoryApi';

interface AdjustStockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const [targetQuantity, setTargetQuantity] = useState<string>(item.currentQuantity.toString());
  const [reason, setReason] = useState<string>('Physical cycle count audit reconciliation');
  const [referenceId, setReferenceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const numTarget = parseFloat(targetQuantity);
  const isValidNumber = !isNaN(numTarget) && numTarget >= 0;
  const delta = isValidNumber ? Number((numTarget - item.currentQuantity).toFixed(3)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidNumber) {
      setError('Target quantity must be a non-negative number.');
      return;
    }

    setSubmitting(true);
    try {
      await adjustStock({
        productId: item.productId,
        targetQuantity: numTarget,
        reason: reason.trim() || undefined,
        referenceId: referenceId.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <div className="text-xs font-mono text-stone-500">
              <span>SKU: {item.productSku}</span>
            </div>
            <h3 className="font-bold text-stone-900 text-sm mt-0.5">
              Reconcile Stock: {item.productName}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Current vs Target Preview */}
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-md flex items-center justify-between font-mono">
              <div>
                <span className="text-[11px] text-stone-500 block">Current Balance</span>
                <span className="text-sm font-bold text-stone-800">
                  {item.currentQuantity} {item.unit}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
              <div>
                <span className="text-[11px] text-stone-500 block">Target Balance</span>
                <span className="text-sm font-bold text-stone-900">
                  {isValidNumber ? numTarget.toFixed(2) : '--'} {item.unit}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-stone-500 block">Net Adjustment</span>
                <span
                  className={`text-xs font-bold ${
                    delta > 0
                      ? 'text-emerald-700'
                      : delta < 0
                      ? 'text-rose-700'
                      : 'text-stone-500'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta} {item.unit}
                </span>
              </div>
            </div>

            {/* Target Quantity */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Verified Physical Stock Count ({item.unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                autoFocus
                required
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                placeholder="e.g. 45.0"
                className="w-full font-mono px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Enter the exact count from your physical inventory audit. The system will log an{' '}
                <span className="font-mono font-medium text-stone-700">ADJUSTMENT</span> transaction
                for the delta.
              </p>
            </div>

            {/* Reference ID */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Audit Batch / Reference ID <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. AUDIT-2026-Q4 or CYCLE-01"
                className="w-full font-mono px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Audit Reason / Explanation
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Discrepancy reconciled during quarterly count"
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isValidNumber}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{submitting ? 'Reconciling...' : 'Confirm Stock Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
