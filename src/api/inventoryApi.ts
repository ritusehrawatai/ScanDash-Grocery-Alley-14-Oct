import {
  InventoryItem,
  InventoryTransactionItem,
  AddStockPayload,
  RemoveStockPayload,
  AdjustStockPayload,
  StockStatus,
} from '../types/inventory';
import { fetchProducts } from './productApi';
import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class InventoryApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'InventoryApiError';
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    let details: string[] | undefined;

    if (isJson) {
      try {
        const errorBody = await res.json();
        errorMsg = errorBody.error || errorBody.message || errorMsg;
        details = errorBody.details;
      } catch {
        // ignore JSON parse error
      }
    } else {
      const text = await res.text();
      if (text) errorMsg = text;
    }

    throw new InventoryApiError(errorMsg, res.status, details);
  }

  if (isJson) {
    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  return {} as T;
}

export function computeStockStatus(
  currentQuantity: number,
  minimumThreshold: number = 0
): StockStatus {
  if (currentQuantity <= 0) {
    return 'OUT OF STOCK';
  }
  if (currentQuantity > 0 && currentQuantity <= minimumThreshold) {
    return 'LOW STOCK';
  }
  return 'IN STOCK';
}

/**
 * Fetch all inventory items, joined with product minimum thresholds for live status calculation.
 */
export async function fetchAllInventory(): Promise<InventoryItem[]> {
  const [invList, products] = await Promise.all([
    authFetch(`${BASE_URL}/api/inventory`, { headers: { Accept: 'application/json' } }).then((r) =>
      handleResponse<any[]>(r)
    ),
    fetchProducts().catch(() => []),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  return invList.map((item) => {
    const prod = productMap.get(item.productId);
    const threshold = prod?.minimumInventoryThreshold ?? 0;
    const currentQty = Number(item.currentQuantity);
    const status = computeStockStatus(currentQty, threshold);

    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName || prod?.name || `Product #${item.productId}`,
      productSku: item.productSku || prod?.sku || 'N/A',
      unit: item.unit || prod?.unit || 'PCS',
      currentQuantity: currentQty,
      minimumInventoryThreshold: threshold,
      stockStatus: status,
      lastUpdated: item.lastUpdated || new Date().toISOString(),
    };
  });
}

/**
 * Fetch inventory for a specific product.
 */
export async function fetchProductInventory(productId: number): Promise<InventoryItem> {
  const [inv, prod] = await Promise.all([
    authFetch(`${BASE_URL}/api/inventory/${productId}`, {
      headers: { Accept: 'application/json' },
    }).then((r) => handleResponse<any>(r)),
    fetchProducts()
      .then((ps) => ps.find((p) => p.id === productId))
      .catch(() => undefined),
  ]);

  const threshold = prod?.minimumInventoryThreshold ?? 0;
  const currentQty = Number(inv.currentQuantity);

  return {
    id: inv.id,
    productId: inv.productId,
    productName: inv.productName || prod?.name || `Product #${inv.productId}`,
    productSku: inv.productSku || prod?.sku || 'N/A',
    unit: inv.unit || prod?.unit || 'PCS',
    currentQuantity: currentQty,
    minimumInventoryThreshold: threshold,
    stockStatus: computeStockStatus(currentQty, threshold),
    lastUpdated: inv.lastUpdated,
  };
}

/**
 * Add stock to a product (e.g. PURCHASE, RETURN).
 */
export async function addStock(payload: AddStockPayload): Promise<InventoryTransactionItem> {
  const res = await authFetch(`${BASE_URL}/api/inventory/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<InventoryTransactionItem>(res);
}

/**
 * Remove stock from a product (e.g. DAMAGE, EXPIRY, CORRECTION).
 * Prevents negative stock.
 */
export async function removeStock(payload: RemoveStockPayload): Promise<InventoryTransactionItem> {
  const res = await authFetch(`${BASE_URL}/api/inventory/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<InventoryTransactionItem>(res);
}

/**
 * Adjust stock directly to target quantity.
 */
export async function adjustStock(payload: AdjustStockPayload): Promise<InventoryTransactionItem> {
  const res = await authFetch(`${BASE_URL}/api/inventory/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<InventoryTransactionItem>(res);
}

/**
 * Fetch inventory transaction history (optionally filtered by productId).
 */
export async function fetchInventoryTransactions(
  productId?: number
): Promise<InventoryTransactionItem[]> {
  const url = productId
    ? `${BASE_URL}/api/inventory/${productId}/transactions`
    : `${BASE_URL}/api/inventory/transactions`;

  const res = await authFetch(url, {
    headers: { Accept: 'application/json' },
  });

  return handleResponse<InventoryTransactionItem[]>(res);
}
