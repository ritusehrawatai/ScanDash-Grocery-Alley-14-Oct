export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface PaymentDto {
  id: number;
  saleId?: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  externalPaymentId?: string;
  clientSecret?: string;
  errorMessage?: string;
  paymentMethod?: string;
  finalizationStatus?: 'PENDING' | 'FINALIZED' | 'FAILED';
  finalizationError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestPayload {
  amount: number;
  currency?: string;
  saleId?: number;
  provider?: string;
}
