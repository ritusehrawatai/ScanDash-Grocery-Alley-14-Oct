export interface SaleItemDto {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  productSku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';

export interface RefundRestockedItem {
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  restockedStock?: number;
}

export interface RefundDto {
  id: number;
  refundReference: string;
  paymentId: number;
  saleId: number;
  receiptNumber: string;
  amount: number;
  currency: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  reason: string;
  failureReason?: string;
  stripePaymentIntentId?: string;
  requestingUserId: number;
  requestingUsername: string;
  requestingUserRole: string;
  restocked: boolean;
  restockedItems?: RefundRestockedItem[];
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundInfoResponse {
  saleId: number;
  receiptNumber: string;
  totalAmount: number;
  totalRefunded: number;
  remainingRefundable: number;
  currency: string;
  status: SaleStatus;
  canRefund: boolean;
  originalPayment?: {
    paymentId: number;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    externalPaymentId?: string;
    paymentMethod?: string;
  };
  refunds: RefundDto[];
}

export interface CreateRefundPayload {
  amount?: number;
  reason?: string;
  restock?: boolean;
  restockItems?: Array<{ productId: number; quantity: number }>;
  idempotencyKey?: string;
  simulateStripeStatus?: 'succeeded' | 'pending' | 'failed';
  simulateLocalPersistenceFailure?: boolean;
}

export interface ReconcileRefundPayload {
  stripeRefundId?: string;
  paymentIntentId?: string;
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface SaleDto {
  id: number;
  receiptNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: SaleStatus;
  itemCount: number;
  items: SaleItemDto[];
  createdAt: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentId?: number;
  requiresRecovery?: boolean;
  recoveryStatus?: 'NONE' | 'FAILED_FINALIZATION' | 'COMPLETED';
  recoveryError?: string;
  finalizedAt?: string;
  refundedAmount?: number;
  refundStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  refunds?: RefundDto[];
}

export interface CreateSaleItemPayload {
  productId: number;
  quantity: number;
}

export interface CreateSalePayload {
  items: CreateSaleItemPayload[];
  status?: 'PENDING' | 'COMPLETED';
}

