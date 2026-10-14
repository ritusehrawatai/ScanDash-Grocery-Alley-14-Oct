export type AuditAction =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRICE_CHANGED'
  | 'INVENTORY_ADJUSTED'
  | 'THRESHOLD_CHANGED'
  | 'INVOICE_CONFIRMED'
  | 'SALE_CANCELLED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_STATUS_TOGGLED'
  | 'USER_DELETED';

export type AuditEntity =
  | 'PRODUCT'
  | 'INVENTORY'
  | 'INVOICE'
  | 'SALE'
  | 'USER';

export interface AuditLog {
  id: number;
  userId?: number;
  username: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}

export interface AuditLogFilter {
  entity?: string;
  action?: string;
  username?: string;
  search?: string;
}
