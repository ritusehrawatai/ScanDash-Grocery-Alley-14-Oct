export type NotificationType = 'LOW_STOCK' | 'OUT_OF_STOCK';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface NotificationProductRef {
  id: number;
  name: string;
  sku: string;
  unit?: string;
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  severity: NotificationSeverity;
  productId: number;
  productName: string;
  productSku: string;
  product?: NotificationProductRef;
  read: boolean;
  createdAt: string;
}
