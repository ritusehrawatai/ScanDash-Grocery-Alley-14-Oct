import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethodTypes: string[];
  saleId: number;
  paymentId: number;
  receiptNumber: string;
  idempotencyKey?: string;
}

export interface PaymentRecordDto {
  id: number;
  saleId: number;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  provider: string;
  paymentMethod?: string;
  externalPaymentId?: string;
  clientSecret?: string;
  errorMessage?: string;
  finalizationStatus?: 'PENDING' | 'FINALIZED' | 'FAILED';
  finalizationError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  provider: string;
  externalPaymentId?: string;
  amount: number;
  currency: string;
  finalizationStatus: 'PENDING' | 'FINALIZED' | 'FAILED';
  errorMessage?: string;
  saleId?: number;
  saleStatus?: string;
  requiresRecovery: boolean;
  recoveryStatus: string;
  isSucceeded: boolean;
  isPendingOrProcessing: boolean;
  isSafeToRetry: boolean;
  canReattempt: boolean;
}

export function formatDeclineMessage(declineCode?: string, rawMessage?: string): string {
  const code = (declineCode || '').toLowerCase().trim();
  switch (code) {
    case 'card_declined':
    case 'generic_decline':
      return "Card Declined: The customer's bank declined the charge. Please request an alternative card or cash payment.";
    case 'insufficient_funds':
      return "Card Declined (Insufficient Funds): The account has insufficient funds. Please ask the customer for another card or payment method.";
    case 'expired_card':
      return "Card Declined (Expired Card): The card has expired. Please ask the customer for a valid card.";
    case 'incorrect_pin':
      return "PIN Error: Incorrect PIN entered. Please have the customer try again or use contactless/chip.";
    case 'pin_try_limit_exceeded':
      return "PIN Error: PIN try limit exceeded. The customer must contact their bank or use a different card.";
    case 'card_velocity_exceeded':
      return "Security Alert: Card activity limit exceeded. Please ask for an alternate payment method.";
    case 'lost_card':
    case 'stolen_card':
      return "Card Declined: Card reported lost or stolen. Please retain card if instructed or ask for another payment method.";
    case 'do_not_honor':
      return "Card Declined: The bank returned 'Do Not Honor'. Please ask the customer to use another card.";
    default:
      if (rawMessage && rawMessage.length > 0) {
        return `Card Payment Failed: ${rawMessage}. No charge was made.`;
      }
      return "Card Declined: The transaction was declined by the card issuer. Please try another payment method.";
  }
}

export function formatCancelMessage(reason?: string): string {
  if (reason === 'customer_canceled' || reason === 'customer_cancelled') {
    return 'Payment Cancelled: The customer cancelled the transaction on the reader. No charge was made.';
  }
  return 'Payment Cancelled: The transaction was safely aborted. No charge was made.';
}

export function formatDisconnectMessage(): string {
  return 'Reader Disconnected: The card reader lost connection. Please check reader power and network, then reconnect. The sale is preserved.';
}

export function formatTimeoutMessage(): string {
  return 'Network / Timeout Warning: Connection timed out while confirming payment. Checking PaymentIntent status with Stripe before deciding whether retry is safe...';
}

export function formatProcessingMessage(): string {
  return 'Payment Processing: Transaction is being authorized by the card issuer. Please wait or check status — do not re-charge the customer.';
}

export async function createTerminalPaymentIntent(
  saleId: number,
  idempotencyKey?: string
): Promise<PaymentIntentResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await authFetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ saleId, idempotencyKey }),
  });

  if (!res.ok) {
    let errMsg = `Failed to create payment intent (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

export async function verifyPaymentWithServer(
  paymentId: number,
  options?: {
    timeoutMs?: number;
    paymentReference?: string;
    paymentMethod?: string;
    simulateFinalizationFailure?: boolean;
  }
): Promise<PaymentRecordDto> {
  const timeoutMs = options?.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await authFetch(`${BASE_URL}/api/v1/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        paymentReference: options?.paymentReference,
        paymentMethod: options?.paymentMethod,
        simulateFinalizationFailure: options?.simulateFinalizationFailure,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = `Failed to verify payment status (${res.status})`;
      let isRecoveryRequired = false;
      try {
        const data = await res.json();
        errMsg = data.error || data.message || errMsg;
        isRecoveryRequired = Boolean(data.recoveryRequired);
      } catch {}
      const err = new Error(errMsg);
      (err as any).recoveryRequired = isRecoveryRequired;
      (err as any).status = res.status;
      throw err;
    }

    const json = await res.json();
    return json.data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Verification network timeout. Checking Stripe status before retrying.');
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

export async function getPaymentStatusFromServer(paymentId: number): Promise<PaymentStatusResponse> {
  const res = await authFetch(`${BASE_URL}/api/v1/payments/${paymentId}/status`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to retrieve payment status (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

export async function recordPaymentFailureOnServer(
  paymentId: number,
  declineCode?: string,
  errorMessage?: string
): Promise<PaymentRecordDto> {
  const res = await authFetch(`${BASE_URL}/api/v1/payments/${paymentId}/fail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ declineCode, errorMessage }),
  });

  if (!res.ok) {
    let errMsg = `Failed to record payment failure (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

export async function cancelPaymentOnServer(
  paymentId: number,
  reason?: string
): Promise<PaymentRecordDto> {
  const res = await authFetch(`${BASE_URL}/api/v1/payments/${paymentId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    let errMsg = `Failed to cancel payment (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

// ==========================================
// Stripe Card-Present Refund Workflows
// ==========================================

export async function fetchSaleRefundInfo(saleId: number) {
  const res = await authFetch(`${BASE_URL}/api/v1/sales/${saleId}/refund-info`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to retrieve refund info (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

export async function createSaleRefund(
  saleId: number,
  payload: {
    amount?: number;
    reason?: string;
    restock?: boolean;
    restockItems?: Array<{ productId: number; quantity: number }>;
    idempotencyKey?: string;
    simulateStripeStatus?: 'succeeded' | 'pending' | 'failed';
    simulateLocalPersistenceFailure?: boolean;
  }
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (payload.idempotencyKey) {
    headers['Idempotency-Key'] = payload.idempotencyKey;
  }

  const res = await authFetch(`${BASE_URL}/api/v1/sales/${saleId}/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errMsg = `Failed to process refund (${res.status})`;
    let errData: any = {};
    try {
      errData = await res.json();
      errMsg = errData.error || errData.message || errMsg;
    } catch {}
    const error = new Error(errMsg);
    (error as any).status = res.status;
    (error as any).data = errData;
    throw error;
  }

  return await res.json();
}

export async function reconcileSaleRefund(
  saleId: number,
  payload: {
    stripeRefundId?: string;
    paymentIntentId?: string;
    amount?: number;
    reason?: string;
    idempotencyKey?: string;
  }
) {
  const res = await authFetch(`${BASE_URL}/api/v1/sales/${saleId}/refund/reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errMsg = `Failed to reconcile refund (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return await res.json();
}

export async function fetchSaleRefunds(saleId: number) {
  const res = await authFetch(`${BASE_URL}/api/v1/sales/${saleId}/refunds`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to retrieve refunds (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const json = await res.json();
  return json.data;
}

