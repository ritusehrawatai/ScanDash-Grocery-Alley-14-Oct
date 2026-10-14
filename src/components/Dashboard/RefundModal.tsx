import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SaleDto, RefundDto, RefundInfoResponse } from '../../types/sale';
import { fetchSaleRefundInfo, createSaleRefund } from '../../api/paymentApi';

interface RefundModalProps {
  sale: SaleDto;
  onClose: () => void;
  onRefundSuccess: (refund: RefundDto) => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  sale,
  onClose,
  onRefundSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [refundInfo, setRefundInfo] = useState<RefundInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<RefundDto | null>(null);

  // Form State
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('Customer return');
  const [customReason, setCustomReason] = useState<string>('');
  const [restock, setRestock] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchSaleRefundInfo(sale.id)
      .then((info) => {
        if (isMounted) {
          setRefundInfo(info);
          setPartialAmount(info.remainingRefundable.toFixed(2));
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load sale refund details');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sale.id]);

  const maxRefundable = refundInfo?.remainingRefundable ?? sale.totalAmount;
  const isCardPresent =
    sale.paymentMethod?.toLowerCase().includes('card') ||
    sale.paymentMethod?.toLowerCase().includes('stripe') ||
    Boolean(sale.paymentReference);

  const calculatedAmount =
    refundType === 'FULL' ? maxRefundable : Number(parseFloat(partialAmount) || 0);

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (calculatedAmount <= 0) {
      setError('Refund amount must be greater than $0.00');
      return;
    }

    if (calculatedAmount > maxRefundable) {
      setError(
        `Refund amount ($${calculatedAmount.toFixed(2)}) exceeds remaining refundable balance ($${maxRefundable.toFixed(2)})`
      );
      return;
    }

    const effectiveReason = reason === 'Other' ? customReason.trim() || 'Other' : reason;

    setSubmitting(true);
    try {
      const response = await createSaleRefund(sale.id, {
        amount: Number(calculatedAmount.toFixed(2)),
        reason: effectiveReason,
        restock,
        idempotencyKey: `refund_modal_${sale.id}_${Date.now()}`,
      });

      if (response.success && response.data) {
        setSuccessResult(response.data);
        onRefundSuccess(response.data);
        window.dispatchEvent(new CustomEvent('inventory-changed'));
      } else {
        setError(response.message || 'Refund could not be processed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit refund request to Stripe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Authorized Stripe Card Refund</h3>
              <p className="text-[11px] text-stone-400">
                Receipt {sale.receiptNumber} · Manager / Admin Authorized
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-stone-500">
              <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Verifying refundable balance with Stripe...</span>
            </div>
          ) : successResult ? (
            /* Success State */
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">
                  {successResult.status === 'SUCCEEDED'
                    ? 'Refund Processed Successfully'
                    : 'Refund Submitted (Pending Bank Confirmation)'}
                </h4>
                <p className="text-xs text-emerald-700">
                  ${successResult.amount.toFixed(2)} refunded for sale {successResult.receiptNumber}.
                </p>
                <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 font-mono text-[11px] text-stone-700 inline-block text-left w-full mt-2">
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-500">Stripe Refund ID:</span>
                    <span className="font-semibold text-emerald-900">{successResult.refundReference}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-500">Status:</span>
                    <span className="font-bold text-emerald-700">{successResult.status}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-stone-500">Restocked to Inventory:</span>
                    <span>{successResult.restocked ? 'Yes (Returned)' : 'No (Unchanged)'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitRefund} className="space-y-4">
              {/* Financial Balance Overview */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Original Sale Total:</span>
                  <span className="font-mono font-semibold text-stone-900">
                    ${sale.totalAmount.toFixed(2)}
                  </span>
                </div>
                {refundInfo && refundInfo.totalRefunded > 0 && (
                  <div className="flex justify-between items-center text-rose-600">
                    <span>Already Refunded:</span>
                    <span className="font-mono font-semibold">
                      -${refundInfo.totalRefunded.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-stone-200 font-bold text-sm">
                  <span className="text-stone-800">Remaining Refundable:</span>
                  <span className="font-mono text-emerald-700">
                    ${maxRefundable.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Details Badge */}
              <div className="flex items-center justify-between px-3 py-2 bg-stone-100 rounded-lg text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-stone-500" />
                  <span>
                    {sale.paymentMethod || 'Stripe Card-Present'}
                  </span>
                </div>
                {sale.paymentReference && (
                  <span className="font-mono text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded">
                    {sale.paymentReference}
                  </span>
                )}
              </div>

              {/* Error Banner */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Refund Request Error</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Refund Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Refund Amount
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundType('FULL')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors cursor-pointer ${
                      refundType === 'FULL'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    Full Refund (${maxRefundable.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('PARTIAL')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border text-center transition-colors cursor-pointer ${
                      refundType === 'PARTIAL'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    Partial Refund
                  </button>
                </div>

                {refundType === 'PARTIAL' && (
                  <div className="mt-2.5">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxRefundable}
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 text-xs border border-stone-200 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      Max available: ${maxRefundable.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Refund Reason */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Refund Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Customer return">Customer return</option>
                  <option value="Defective / Damaged product">Defective / Damaged product</option>
                  <option value="Incorrect item scanned">Incorrect item scanned</option>
                  <option value="Price adjustment / Overcharge">Price adjustment / Overcharge</option>
                  <option value="Duplicate charge">Duplicate charge</option>
                  <option value="Other">Other (specify below)</option>
                </select>

                {reason === 'Other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Provide detailed refund reason..."
                    className="w-full mt-2 py-2 px-3 text-xs border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                )}
              </div>

              {/* Explicit Inventory Restock Option (Requirement 8) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restock}
                    onChange={(e) => setRestock(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-amber-950 block">
                      Restock returned items back into store inventory
                    </span>
                    <span className="text-[11px] text-amber-700 block">
                      Inventory quantities will NOT be changed unless checked here. Uncheck if items were discarded, damaged, or not returned physically.
                    </span>
                  </div>
                </label>
              </div>

              {/* Security & PCI Compliance Notice (Requirement 9) */}
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  PCI Compliant: Processed through official Stripe API without storing card numbers or CVV.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || maxRefundable <= 0}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Contacting Stripe...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Process Stripe Refund (${calculatedAmount.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
