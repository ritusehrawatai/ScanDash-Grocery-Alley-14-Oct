import React, { useState } from 'react';
import { X, Minus, AlertTriangle, AlertCircle, ArrowRight } from 'lucide-react';
import { InventoryItem, InventoryTransactionType } from '../../types/inventory';
import { removeStock } from '../../api/inventoryApi';

interface RemoveStockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const RemoveStockModal: React.FC<RemoveStockModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState<string>('');
  const [transactionType, setTransactionType] = useState<InventoryTransactionType>('DAMAGE');
  const [reason, setReason] = useState<string>('Damaged goods write-off');
  const [referenceId, setReferenceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const numQty = parseFloat(quantity) || 0;
  const isOverDeduction = numQty > item.currentQuantity;
  const projectedQuantity = item.currentQuantity - numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(numQty) || numQty <= 0) {
      setError('Quantity to remove must be greater than zero.');
      return;
    }

    if (isOverDeduction) {
      setError(
        `Insufficient inventory: current stock is ${item.currentQuantity} ${item.unit}, cannot deduct ${numQty} ${item.unit}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await removeStock({
        productId: item.productId,
        quantity: numQty,
        transactionType,
        reason: reason.trim() || undefined,
        referenceId: referenceId.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove stock');
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
              Remove Stock: {item.productName}
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

            {/* Current Stock vs New Stock Preview */}
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-md flex items-center justify-between font-mono">
              <div>
                <span className="text-[11px] text-stone-500 block">Current Balance</span>
                <span className="text-sm font-bold text-stone-800">
                  {item.currentQuantity} {item.unit}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
              <div>
                <span className="text-[11px] text-stone-500 block">Projected Balance</span>
                <span
                  className={`text-sm font-bold ${
                    isOverDeduction ? 'text-rose-600 font-extrabold' : 'text-stone-800'
                  }`}
                >
                  {projectedQuantity.toFixed(2)} {item.unit}
                </span>
              </div>
            </div>

            {/* Over-deduction negative prevention warning */}
            {isOverDeduction && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Negative Inventory Prevented: </span>
                  Requested deduction exceeds available stock. Current maximum deduction is{' '}
                  <span className="font-mono font-bold">{item.currentQuantity} {item.unit}</span>.
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Quantity to Deduct ({item.unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max={item.currentQuantity}
                autoFocus
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 5.0"
                className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                  isOverDeduction ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300'
                }`}
              />
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">Deduction Reason Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as InventoryTransactionType)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white cursor-pointer"
              >
                <option value="DAMAGE">DAMAGE (Broken / Damaged Product Write-Off)</option>
                <option value="EXPIRY">EXPIRY (Out-of-Date / Spoiled Stock Disposal)</option>
                <option value="CORRECTION">CORRECTION (Stock Discrepancy Downward Adjustment)</option>
              </select>
            </div>

            {/* Reference ID */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Reference ID / Incident Ticket <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. DMG-104 or SHRINK-Q4"
                className="w-full font-mono px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Explanation / Internal Note
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Aisle leak water damage"
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
              disabled={submitting || numQty <= 0 || isOverDeduction}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>{submitting ? 'Deducting...' : 'Confirm Stock Removal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
