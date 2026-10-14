import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Receipt, AlertCircle, Store, RotateCcw, CreditCard, RefreshCw } from 'lucide-react';
import { Product } from '../../types/product';
import { CartItem, CartTotals } from '../../types/cart';
import { SaleDto } from '../../types/sale';
import { processSale } from '../../api/saleApi';
import { cancelPaymentOnServer } from '../../api/paymentApi';
import { ProductSearchCatalog } from './ProductSearchCatalog';
import { PosCart } from './PosCart';
import { SaleReceiptModal } from './SaleReceiptModal';
import {
  TerminalCardPaymentModal,
  ACTIVE_CHECKOUT_SESSION_KEY,
} from './TerminalCardPaymentModal';

function getTaxRateDecimal(taxRate: number): number {
  if (!taxRate || taxRate <= 0) return 0;
  return taxRate > 1 ? taxRate / 100 : taxRate;
}

function calculateLineFields(product: Product, quantity: number) {
  const unitPrice = Number(product.sellingPrice) || 0;
  const lineSubtotal = Number((unitPrice * quantity).toFixed(2));
  const rateDec = getTaxRateDecimal(Number(product.taxRate) || 0);
  const lineTax = Number((lineSubtotal * rateDec).toFixed(2));
  const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

  return {
    unitPrice,
    taxRate: Number(product.taxRate) || 0,
    lineSubtotal,
    lineTax,
    lineTotal,
  };
}

export const PosTerminal: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);

  // Active draft recovery state for browser refresh during a payment
  const [activeDraftInfo, setActiveDraftInfo] = useState<{
    saleId: number;
    receiptNumber: string;
    paymentId?: number;
    paymentIntentId?: string;
    sale?: SaleDto;
  } | null>(null);

  // On mount: inspect sessionStorage to recover draft if browser refreshed during payment
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_CHECKOUT_SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.saleId && saved.items && saved.items.length > 0) {
          fetch(`/api/sales/${saved.saleId}`)
            .then((r) => r.json())
            .then((saleRes) => {
              if (saleRes.success && saleRes.data) {
                const s = saleRes.data;
                if (s.status === 'COMPLETED') {
                  sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
                  setCompletedSale(s);
                } else if (s.status === 'PENDING') {
                  // Restore cart items and show recovery banner
                  setCartItems(saved.items);
                  if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
                  setActiveDraftInfo({
                    saleId: saved.saleId,
                    receiptNumber: saved.receiptNumber,
                    paymentId: saved.paymentId,
                    paymentIntentId: saved.paymentIntentId,
                    sale: s,
                  });
                }
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to inspect active checkout draft:', e);
    }
  }, []);

  // Add Product to Cart
  const handleAddToCart = (product: Product) => {
    setCheckoutError(null);
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);

      if (existingIndex > -1) {
        // Increase quantity by 1
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = Number((existing.quantity + 1).toFixed(3));
        const lineCalcs = calculateLineFields(product, newQty);

        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          ...lineCalcs,
        };
        return updated;
      } else {
        // Add new line
        const lineCalcs = calculateLineFields(product, 1);
        const newItem: CartItem = {
          id: product.id,
          product,
          quantity: 1,
          ...lineCalcs,
        };
        return [...prev, newItem];
      }
    });
  };

  // Change Quantity
  const handleUpdateQuantity = (productId: number, quantity: number) => {
    setCheckoutError(null);
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const lineCalcs = calculateLineFields(item.product, quantity);
          return {
            ...item,
            quantity,
            ...lineCalcs,
          };
        }
        return item;
      })
    );
  };

  // Remove Product
  const handleRemoveItem = (productId: number) => {
    setCheckoutError(null);
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  };

  // Clear Cart
  const handleClearCart = () => {
    setCheckoutError(null);
    setCartItems([]);
    if (activeDraftInfo) {
      sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
      setActiveDraftInfo(null);
    }
  };

  // Dismiss / Abort recovered payment draft
  const handleAbortRecoveredDraft = async () => {
    if (activeDraftInfo?.paymentId) {
      try {
        await cancelPaymentOnServer(activeDraftInfo.paymentId, 'customer_canceled');
      } catch {}
    }
    sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
    setActiveDraftInfo(null);
  };

  // Complete Sale & Checkout (guarded against repeated clicks)
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    // Prevent repeated clicks while checkout is active or modal is open
    if (isCheckingOut || isCardModalOpen) return;

    // Card Payments: Route through Stripe Terminal JavaScript SDK modal
    if (paymentMethod === 'Credit Card' || paymentMethod === 'Debit Card') {
      setIsCardModalOpen(true);
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const payload = {
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      const sale = await processSale(payload);

      // Clear cart
      setCartItems([]);
      sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
      setActiveDraftInfo(null);
      // Open receipt modal
      setCompletedSale(sale);

      // Notify other views (inventory table & notification bell)
      window.dispatchEvent(new CustomEvent('inventory-changed'));
    } catch (err: any) {
      setCheckoutError(err.message || 'Sale processing failed. Transaction was rolled back.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // View Subtotal, Tax, and Total
  const totals: CartTotals = useMemo(() => {
    const lineCount = cartItems.length;
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number(
      cartItems.reduce((sum, item) => sum + item.lineSubtotal, 0).toFixed(2)
    );
    const tax = Number(
      cartItems.reduce((sum, item) => sum + item.lineTax, 0).toFixed(2)
    );
    const total = Number((subtotal + tax).toFixed(2));

    return {
      itemCount,
      lineCount,
      subtotal,
      tax,
      total,
    };
  }, [cartItems]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              POS Checkout Terminal
            </h1>
            <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Cashier Lane 01
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Barcode scanning, catalog lookup, and live cart calculation engine.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-stone-600 bg-stone-50 px-3 py-2 rounded-lg border border-stone-200 self-start sm:self-auto">
          <div className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-stone-400" />
            <span>Store #104</span>
          </div>
          <span aria-hidden="true" className="text-stone-300">|</span>
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-stone-400" />
            <span>Cart: {totals.itemCount} items</span>
          </div>
        </div>
      </div>

      {/* Recovered Active Draft Banner (Browser refreshed during payment) */}
      {activeDraftInfo && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                In-Progress Card Payment Restored (Receipt {activeDraftInfo.receiptNumber})
              </h4>
              <p className="text-[11px] text-amber-700">
                A browser refresh occurred during payment. Cart items and sale record have been safely preserved.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAbortRecoveredDraft}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel Payment & Keep Cart
            </button>
            <button
              onClick={() => setIsCardModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Resume Payment / Check Status</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column POS Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-14.5rem)] min-h-[550px]">
        {/* Left Column: Product Search & Catalog (7 of 12 cols on desktop) */}
        <div className="lg:col-span-7 h-full min-h-[350px]">
          <ProductSearchCatalog onAddToCart={handleAddToCart} />
        </div>

        {/* Right Column: POS Shopping Cart (5 of 12 cols on desktop) */}
        <div className="lg:col-span-5 h-full min-h-[350px]">
          <PosCart
            items={cartItems}
            totals={totals}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onCheckout={handleCheckout}
            isCheckingOut={isCheckingOut || isCardModalOpen}
            checkoutError={checkoutError}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>
      </div>

      {/* Sale Receipt Modal */}
      {completedSale && (
        <SaleReceiptModal
          sale={completedSale}
          paymentMethod={paymentMethod}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* Stripe Terminal In-Person Card Payment Modal */}
      {isCardModalOpen && (
        <TerminalCardPaymentModal
          items={cartItems}
          totals={totals}
          paymentMethod={paymentMethod}
          initialSaleDraft={activeDraftInfo?.sale || null}
          initialPaymentIntent={
            activeDraftInfo?.paymentId && activeDraftInfo?.paymentIntentId
              ? {
                  paymentId: activeDraftInfo.paymentId,
                  paymentIntentId: activeDraftInfo.paymentIntentId,
                  clientSecret: '',
                  amount: totals.total,
                  currency: 'USD',
                  status: 'requires_payment_method',
                  paymentMethodTypes: ['card_present'],
                  saleId: activeDraftInfo.saleId,
                  receiptNumber: activeDraftInfo.receiptNumber,
                }
              : null
          }
          onClose={() => setIsCardModalOpen(false)}
          onPaymentComplete={(sale) => {
            setIsCardModalOpen(false);
            setCartItems([]);
            setActiveDraftInfo(null);
            sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
            setCompletedSale(sale);
            window.dispatchEvent(new CustomEvent('inventory-changed'));
          }}
        />
      )}
    </div>
  );
};
