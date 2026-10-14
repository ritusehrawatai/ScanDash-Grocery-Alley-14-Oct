export type StockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';

export interface InventoryItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  unit: string;
  currentQuantity: number;
  minimumInventoryThreshold: number;
  stockStatus: StockStatus;
  lastUpdated: string;
}

export type InventoryTransactionType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'EXPIRY'
  | 'CORRECTION';

export interface InventoryTransactionItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface AddStockPayload {
  productId: number;
  quantity: number;
  transactionType?: InventoryTransactionType;
  reason?: string;
  referenceId?: string;
}

export interface RemoveStockPayload {
  productId: number;
  quantity: number;
  transactionType?: InventoryTransactionType;
  reason?: string;
  referenceId?: string;
}

export interface AdjustStockPayload {
  productId: number;
  targetQuantity: number;
  reason?: string;
  referenceId?: string;
}
