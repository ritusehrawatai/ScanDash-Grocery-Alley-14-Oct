import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Receipt,
  X,
  RotateCcw,
  Clock,
  HelpCircle,
} from 'lucide-react';
import type { Reader } from '@stripe/terminal-js';
import { CartItem, CartTotals } from '../../types/cart';
import { SaleDto } from '../../types/sale';
import { processSale } from '../../api/saleApi';
import {
  createTerminalPaymentIntent,
  verifyPaymentWithServer,
  cancelPaymentOnServer,
  recordPaymentFailureOnServer,
  getPaymentStatusFromServer,
  formatDeclineMessage,
  formatCancelMessage,
  formatDisconnectMessage,
  formatTimeoutMessage,
  formatProcessingMessage,
  PaymentIntentResponse,
} from '../../api/paymentApi';
import { stripeTerminalManager } from '../../services/terminalService';
import { ReaderConnectionState } from '../../types/terminal';

export type PaymentFlowStep =
  | 'idle'
  | 'preparing_intent'
  | 'collecting_card'
  | 'processing_payment'
  | 'verifying_server'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'uncertain_status'
  | 'reader_disconnected';

export const ACTIVE_CHECKOUT_SESSION_KEY = 'freshcart_active_checkout_draft';

interface TerminalCardPaymentModalProps {
  items: CartItem[];
  totals: CartTotals;
  paymentMethod: string;
  onClose: () => void;
  onPaymentComplete: (sale: SaleDto, paymentIntentId: string) => void;
  initialSaleDraft?: SaleDto | null;
  initialPaymentIntent?: PaymentIntentResponse | null;
}

export const TerminalCardPaymentModal: React.FC<TerminalCardPaymentModalProps> = ({
  items,
  totals,
  paymentMethod,
  onClose,
  onPaymentComplete,
  initialSaleDraft = null,
  initialPaymentIntent = null,
}) => {
  const [step, setStep] = useState<PaymentFlowStep>('idle');
  const [readerState, setReaderState] = useState<ReaderConnectionState>('Disconnected');
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing payment device...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentResponse | null>(initialPaymentIntent);
  const [saleDraft, setSaleDraft] = useState<SaleDto | null>(initialSaleDraft);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);

  // Sync active checkout to sessionStorage so page refresh can recover the sale & cart
  const syncCheckoutStorage = (sale: SaleDto | null, intent: PaymentIntentResponse | null) => {
    if (sale && sale.status !== 'COMPLETED') {
      try {
        sessionStorage.setItem(
          ACTIVE_CHECKOUT_SESSION_KEY,
          JSON.stringify({
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            paymentId: intent?.paymentId,
            paymentIntentId: intent?.paymentIntentId,
            paymentMethod,
            items,
            totals,
            updatedAt: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Could not store active checkout draft in sessionStorage:', e);
      }
    } else {
      try {
        sessionStorage.removeItem(ACTIVE_CHECKOUT_SESSION_KEY);
      } catch {}
    }
  };

  // Subscribe to Terminal connection status and watch for reader disconnections
  useEffect(() => {
    const unsub = stripeTerminalManager.subscribe({
      onStateChange: (state, reader) => {
        setReaderState(state);
        setConnectedReader(reader);

        // Case: Reader disconnects while in-flight
        if (state === 'Disconnected' || state === 'Error') {
          if (step === 'collecting_card') {
            setStep('reader_disconnected');
            setErrorMessage(formatDisconnectMessage());
            setStatusMessage('Card reader disconnected.');
            isRunningRef.current = false;
          }
        }
      },
    });
    return () => {
      unsub();
    };
  }, [step]);

  // Ensure reader is connected, or auto-connect simulated reader in test mode
  const ensureReaderConnected = async (): Promise<boolean> => {
    const current = stripeTerminalManager.getState();
    if (current.state === 'Connected' && current.reader) {
      return true;
    }
    setStatusMessage('Connecting to card reader...');
    try {
      const readers = await stripeTerminalManager.discoverSimulatedReaders();
      if (readers.length > 0) {
        await stripeTerminalManager.connectReader(readers[0]);
        return true;
      }
    } catch (err: any) {
      console.warn('Auto-connect reader error:', err);
    }
    return false;
  };

  // Verify PaymentIntent status with Stripe before deciding whether a retry is safe
  const verifyStatusWithStripe = async (pid: number) => {
    setIsCheckingStatus(true);
    setStatusMessage('Querying Stripe for current PaymentIntent status...');
    try {
      const statusRes = await getPaymentStatusFromServer(pid);

      if (statusRes.isSucceeded) {
        // Payment actually succeeded on Stripe! Complete sale without charging again
        setStep('verifying_server');
        setStatusMessage('Payment already succeeded on Stripe! Finalizing sale...');
        const verified = await verifyPaymentWithServer(pid, {
          paymentMethod: 'STRIPE_CARD_PRESENT',
        });
        if (saleDraft) {
          const completedSale = { ...saleDraft, status: 'COMPLETED' as const };
          setSaleDraft(completedSale);
          syncCheckoutStorage(null, null);
          setStep('succeeded');
          setStatusMessage('Payment Confirmed by Stripe!');
          return;
        }
      }

      if (statusRes.isPendingOrProcessing) {
        // Payment remains processing or has uncertain status
        setStep('uncertain_status');
        setErrorMessage(formatProcessingMessage());
        setStatusMessage('Payment is still processing with the bank.');
        return;
      }

      if (statusRes.isSafeToRetry) {
        // Truly failed or canceled: safe to retry!
        setStep('failed');
        setErrorMessage(
          statusRes.errorMessage ||
            'Payment was not completed. It is safe to retry without double-charging.'
        );
        setStatusMessage('Safe to retry payment.');
      }
    } catch (err: any) {
      setErrorMessage(
        `Unable to reach payment verification server: ${err.message}. Please retry status check before charging again.`
      );
    } finally {
      setIsCheckingStatus(false);
      isRunningRef.current = false;
    }
  };

  // Main payment execution sequence
  const startPaymentFlow = async () => {
    // Prevent repeated clicks / concurrent runs (Case: Cashier clicks repeatedly)
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    isCancelledRef.current = false;
    setErrorMessage(null);

    try {
      // Step A: If we already have a payment record, verify with Stripe first before charging again
      if (paymentIntent?.paymentId) {
        setStatusMessage('Checking existing payment record with Stripe...');
        try {
          const existingStatus = await getPaymentStatusFromServer(paymentIntent.paymentId);
          if (existingStatus.isSucceeded) {
            setStep('verifying_server');
            setStatusMessage('Stripe confirmed payment already succeeded. Completing sale...');
            await verifyPaymentWithServer(paymentIntent.paymentId, {
              paymentMethod: 'STRIPE_CARD_PRESENT',
            });
            if (saleDraft) {
              setSaleDraft({ ...saleDraft, status: 'COMPLETED' });
            }
            syncCheckoutStorage(null, null);
            setStep('succeeded');
            setStatusMessage('Payment Confirmed by Stripe!');
            return;
          }
        } catch {
          // Continue if status check unavailable
        }
      }

      // Step 1: Ensure reader is connected
      const hasReader = await ensureReaderConnected();
      if (!hasReader) {
        setStep('reader_disconnected');
        setErrorMessage(formatDisconnectMessage());
        throw new Error('Please connect a card reader before starting payment.');
      }
      if (isCancelledRef.current) return;

      // Step 2: Create or reuse pending sale draft (never deduct inventory for unpaid sale)
      setStep('preparing_intent');
      setStatusMessage('Creating pending checkout record on server...');

      let currentSale = saleDraft;
      if (!currentSale) {
        currentSale = await processSale({
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          status: 'PENDING',
        });
        setSaleDraft(currentSale);
      }
      if (isCancelledRef.current) return;

      // Step 3: Create Stripe PaymentIntent on backend (backend idempotency prevents duplicate charges)
      setStatusMessage('Generating Stripe Terminal PaymentIntent...');
      const intent = await createTerminalPaymentIntent(currentSale.id);
      setPaymentIntent(intent);
      syncCheckoutStorage(currentSale, intent);
      if (isCancelledRef.current) return;

      // Step 4: Collect Payment Method on Reader
      setStep('collecting_card');
      setStatusMessage('Waiting for customer card: Tap, insert, or swipe on reader...');

      const collectedIntent = await stripeTerminalManager.collectPaymentMethod(intent.clientSecret);
      if (isCancelledRef.current) return;

      // Step 5: Process Payment with Stripe
      setStep('processing_payment');
      setStatusMessage('Card detected. Authorizing payment with Stripe...');

      const processedIntent = await stripeTerminalManager.processPayment(collectedIntent);
      if (isCancelledRef.current) return;

      // Check for uncertain or processing status
      const confirmedStatus = processedIntent.status;
      if (confirmedStatus === 'processing') {
        setStep('uncertain_status');
        setErrorMessage(formatProcessingMessage());
        setStatusMessage('Payment is processing with card issuer.');
        return;
      }

      if (confirmedStatus !== 'succeeded' && confirmedStatus !== 'requires_capture') {
        const declineErr = new Error(`Payment returned status: ${confirmedStatus}`);
        (declineErr as any).declineCode = confirmedStatus;
        throw declineErr;
      }

      // Step 6: Server-side verification (timeout-protected; never assume timeout means failure)
      setStep('verifying_server');
      setStatusMessage('Verifying payment confirmation with server...');

      await verifyPaymentWithServer(intent.paymentId, {
        timeoutMs: 12000,
        paymentMethod: 'STRIPE_CARD_PRESENT',
      });
      if (isCancelledRef.current) return;

      if (currentSale) {
        setSaleDraft({ ...currentSale, status: 'COMPLETED' });
      }

      // Step 7: Payment Succeeded!
      syncCheckoutStorage(null, null);
      setStep('succeeded');
      setStatusMessage('Payment Confirmed by Stripe!');
    } catch (err: any) {
      if (isCancelledRef.current) {
        setStep('cancelled');
        setStatusMessage(formatCancelMessage('customer_canceled'));
        setErrorMessage(null);
        return;
      }

      // Case: Timeout during verification or processing
      if (err.isTimeout || err.name === 'AbortError' || err.message?.includes('timeout')) {
        setStep('uncertain_status');
        setStatusMessage('Network / verification timed out.');
        setErrorMessage(formatTimeoutMessage());
        return;
      }

      // Case: Reader disconnect during collection
      if (err.message?.includes('reader') && err.message?.includes('connect')) {
        setStep('reader_disconnected');
        setStatusMessage('Reader connection lost.');
        setErrorMessage(formatDisconnectMessage());
        return;
      }

      // Case: Card declined or authorization error
      const declineCode = err.declineCode || err.code || (err.message?.includes('declined') ? 'card_declined' : undefined);
      const friendlyDeclineMsg = formatDeclineMessage(declineCode, err.message);

      if (paymentIntent?.paymentId) {
        try {
          await recordPaymentFailureOnServer(paymentIntent.paymentId, declineCode, friendlyDeclineMsg);
        } catch {}
      }

      setStep('failed');
      setErrorMessage(friendlyDeclineMsg);
      setStatusMessage('Transaction declined or failed.');
    } finally {
      isRunningRef.current = false;
    }
  };

  // Start on initial open
  useEffect(() => {
    startPaymentFlow();
  }, []);

  // Handle Cancel (Customer or Cashier)
  const handleCancelPayment = async () => {
    isCancelledRef.current = true;
    isRunningRef.current = false;
    await stripeTerminalManager.cancelCollectPaymentMethod();
    if (paymentIntent?.paymentId) {
      try {
        await cancelPaymentOnServer(paymentIntent.paymentId, 'customer_canceled');
      } catch {}
    }
    syncCheckoutStorage(null, null);
    setStep('cancelled');
    setStatusMessage(formatCancelMessage('customer_canceled'));
    setErrorMessage(null);
  };

  // Handle Cashier Retry after failed attempt (safety check ensures Stripe status verified)
  const handleRetryAfterFailure = async () => {
    if (paymentIntent?.paymentId) {
      // Check status with Stripe first to prevent duplicate charges
      await verifyStatusWithStripe(paymentIntent.paymentId);
      if (step === 'succeeded') return;
    }
    startPaymentFlow();
  };

  const isBusy =
    step === 'preparing_intent' ||
    step === 'collecting_card' ||
    step === 'processing_payment' ||
    step === 'verifying_server';

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-800 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Stripe Terminal Checkout</h3>
              <p className="text-[11px] text-stone-400">Card-Present Payment (In-Person Reader)</p>
            </div>
          </div>

          {!isBusy && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Amount Summary */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
                Total Charge ({items.length} items)
              </span>
              <span className="text-xs text-stone-600 font-medium">Method: {paymentMethod}</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-stone-900">
                ${totals.total.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 block font-mono">
                USD (Server-calculated)
              </span>
            </div>
          </div>

          {/* Reader Status Ribbon */}
          <div className="flex items-center justify-between px-3 py-2 bg-stone-100 rounded-lg text-xs">
            <div className="flex items-center gap-2 text-stone-600 truncate">
              {readerState === 'Connected' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              )}
              <span className="truncate font-medium">
                {connectedReader?.label || 'WisePOS E Reader'}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${
                readerState === 'Connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {readerState}
            </span>
          </div>

          {/* Active Flow State Render */}
          <div className="py-2 text-center space-y-3">
            {/* Step Icons & Progress Spinners */}
            {isBusy && (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-stone-100 border-t-emerald-600 animate-spin" />
                  <CreditCard className="w-6 h-6 text-stone-700" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-stone-900">{statusMessage}</h4>
                  <p className="text-xs text-stone-500">
                    {step === 'collecting_card'
                      ? 'Ask the customer to tap, insert, or swipe their card.'
                      : 'Please do not navigate away or refresh the page.'}
                  </p>
                </div>
              </div>
            )}

            {/* Succeeded State */}
            {step === 'succeeded' && (
              <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-stone-900">Payment Succeeded!</h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Stripe confirmed card-present authorization.
                  </p>
                  {paymentIntent && (
                    <div className="text-[11px] font-mono text-stone-500 pt-1">
                      ID: {paymentIntent.paymentIntentId}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Failed State (Card Declined) */}
            {step === 'failed' && (
              <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-bold text-rose-900">Payment Declined or Failed</h4>
                  <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-left">
                    {errorMessage || 'Card was declined. No charges were made.'}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Cart and sale draft are preserved. You can retry with another card or switch to cash.
                  </p>
                </div>
              </div>
            )}

            {/* Cancelled State (Customer/Cashier) */}
            {step === 'cancelled' && (
              <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-stone-800">Payment Cancelled</h4>
                  <p className="text-xs text-stone-500">
                    {statusMessage || 'The transaction was safely aborted without charging the card.'}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Cart items and draft remain available for retry.
                  </p>
                </div>
              </div>
            )}

            {/* Reader Disconnected State */}
            {step === 'reader_disconnected' && (
              <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <WifiOff className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-bold text-amber-900">Reader Disconnected</h4>
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-left">
                    {errorMessage || formatDisconnectMessage()}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    No charge was made. Please reconnect the reader to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Uncertain / Timeout / Processing State */}
            {step === 'uncertain_status' && (
              <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
                <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-bold text-amber-900">Payment Status Uncertain</h4>
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-left">
                    {errorMessage || 'Checking payment status with Stripe...'}
                  </p>
                  <p className="text-[11px] text-stone-600 font-semibold">
                    Important: Never assume a timeout means payment failed. Please check status before charging again.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Security & PCI Compliance Note */}
          <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-[11px] text-stone-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              End-to-end encrypted card processing. Card details and CVVs are never stored.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
          {/* While In-Flight */}
          {isBusy && (
            <>
              <button
                type="button"
                onClick={handleCancelPayment}
                className="px-3.5 py-2 text-xs font-semibold text-stone-700 hover:text-rose-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel Payment
              </button>
              <span className="text-xs text-stone-400 font-mono flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
              </span>
            </>
          )}

          {/* When Succeeded */}
          {step === 'succeeded' && (
            <button
              type="button"
              onClick={() => {
                if (saleDraft && paymentIntent) {
                  onPaymentComplete(saleDraft, paymentIntent.paymentIntentId);
                } else {
                  onClose();
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Receipt className="w-4 h-4" />
              <span>Complete Sale & View Receipt</span>
            </button>
          )}

          {/* When Failed or Cancelled */}
          {(step === 'failed' || step === 'cancelled') && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Return to Cart
              </button>
              <button
                type="button"
                onClick={handleRetryAfterFailure}
                disabled={isCheckingStatus}
                className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isCheckingStatus ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Retry Card Payment</span>
              </button>
            </>
          )}

          {/* When Reader Disconnected */}
          {step === 'reader_disconnected' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Return to Cart
              </button>
              <button
                type="button"
                onClick={startPaymentFlow}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Reconnect Reader & Retry</span>
              </button>
            </>
          )}

          {/* When Uncertain / Timeout / Processing */}
          {step === 'uncertain_status' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Return to Cart (Keep Sale)
              </button>
              <button
                type="button"
                disabled={isCheckingStatus || !paymentIntent}
                onClick={() => {
                  if (paymentIntent?.paymentId) {
                    verifyStatusWithStripe(paymentIntent.paymentId);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                <span>Check Stripe Status</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
