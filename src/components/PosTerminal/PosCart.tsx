import React, { useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  Receipt,
  AlertCircle,
  Package,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import { CartItem, CartTotals } from '../../types/cart';
import { PaymentDeviceSection } from './PaymentDeviceSection';

interface PosCartProps {
  items: CartItem[];
  totals: CartTotals;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
  checkoutError: string | null;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
}

export const PosCart: React.FC<PosCartProps> = ({
  items,
  totals,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isCheckingOut,
  checkoutError,
  paymentMethod,
  onPaymentMethodChange,
}) => {
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  return (
    <div className="flex flex-col h-full bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
      {/* Cart Header */}
      <div className="px-4 py-3.5 bg-stone-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-800 text-emerald-400 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight">Active Cart</h3>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-1.5 py-0.2 rounded border border-emerald-500/30">
                Lane 01
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              {totals.itemCount} items ({totals.lineCount} lines)
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-300 hover:text-white hover:bg-rose-950/60 rounded border border-rose-900/60 transition-colors cursor-pointer"
            title="Clear all cart items"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Cart</span>
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mb-3">
              <ShoppingCart className="w-6 h-6 stroke-1" />
            </div>
            <p className="text-sm font-semibold text-stone-700">Shopping Cart is Empty</p>
            <p className="text-xs text-stone-400 mt-1 max-w-[220px]">
              Search or scan products on the left catalog to add them to this transaction.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg hover:bg-stone-50/80 transition-colors flex flex-col gap-2 group"
            >
              {/* Product Info & Line Price */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-0.5">
                    <span className="font-mono text-stone-400">{item.product.sku}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.product.categoryName || 'General'}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-stone-900 leading-snug line-clamp-1">
                    {item.product.name}
                  </h4>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold font-mono text-stone-900">
                    ${item.lineTotal.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    ${item.unitPrice.toFixed(2)} / {item.product.unit}
                  </div>
                </div>
              </div>

              {/* Controls: Quantity +/- and Remove */}
              <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5 bg-stone-100 rounded-md p-0.5 border border-stone-200">
                  <button
                    onClick={() => {
                      if (item.quantity > 1) {
                        onUpdateQuantity(item.id, Number((item.quantity - 1).toFixed(3)));
                      } else {
                        onRemoveItem(item.id);
                      }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-white hover:text-stone-900 transition-colors cursor-pointer"
                    title={item.quantity <= 1 ? 'Remove from cart' : 'Decrease quantity'}
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        onUpdateQuantity(item.id, val);
                      }
                    }}
                    className="w-12 text-center text-xs font-bold font-mono text-stone-900 bg-white border border-stone-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />

                  <button
                    onClick={() =>
                      onUpdateQuantity(item.id, Number((item.quantity + 1).toFixed(3)))
                    }
                    className="w-6 h-6 flex items-center justify-center rounded text-stone-600 hover:bg-white hover:text-stone-900 transition-colors cursor-pointer"
                    title="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Tax Breakdown & Remove Action */}
                <div className="flex items-center gap-3">
                  {item.taxRate > 0 && (
                    <span className="text-[10px] text-stone-500 font-mono">
                      Tax: ${item.lineTax.toFixed(2)}
                    </span>
                  )}

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary & Totals */}
      <div className="p-4 border-t border-stone-200 bg-stone-50/80 space-y-3">
        {/* Breakdown */}
        <div className="space-y-1.5 text-xs text-stone-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-mono font-medium text-stone-800">
              ${totals.subtotal.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>Estimated Tax</span>
            <span className="font-mono font-medium text-stone-800">
              ${totals.tax.toFixed(2)}
            </span>
          </div>

          <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-base font-bold text-stone-900">
            <span>Total</span>
            <span className="font-mono text-lg text-emerald-700">
              ${totals.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-lg">
            {(['Cash', 'Credit Card', 'Debit Card'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onPaymentMethodChange(method)}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  paymentMethod === method
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Stripe Terminal Payment Device Status & Controls */}
        <PaymentDeviceSection />

        {/* Checkout Error Alert */}
        {checkoutError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-tight font-medium">
              <span>{checkoutError}</span>
            </div>
          </div>
        )}

        {/* Complete Sale Button */}
        <button
          onClick={onCheckout}
          disabled={items.length === 0 || isCheckingOut}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          {isCheckingOut ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Processing Sale & Deducting Stock...</span>
            </>
          ) : paymentMethod === 'Credit Card' || paymentMethod === 'Debit Card' ? (
            <>
              <CreditCard className="w-4 h-4" />
              <span>Pay by Card (${totals.total.toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Complete Sale (${totals.total.toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Confirm Clear Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">Clear Shopping Cart?</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  This will remove all {totals.itemCount} items from the current transaction.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearCart();
                  setConfirmClearOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
              >
                Yes, Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
