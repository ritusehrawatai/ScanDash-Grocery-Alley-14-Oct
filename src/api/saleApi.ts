import { SaleDto, CreateSalePayload } from '../types/sale';
import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class SaleApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'SaleApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Process a completed cart sale transactionally.
 * POST /api/sales
 */
export async function processSale(payload: CreateSalePayload): Promise<SaleDto> {
  const res = await authFetch(`${BASE_URL}/api/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errMsg = `Failed to process sale (${res.status})`;
    let details: string[] | undefined;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
      details = data.details;
    } catch {}
    throw new SaleApiError(errMsg, res.status, details);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch all historical completed sales.
 * GET /api/sales
 */
export async function fetchAllSales(): Promise<SaleDto[]> {
  const res = await authFetch(`${BASE_URL}/api/sales`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let errMsg = `Failed to fetch sales (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new SaleApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Fetch sale details by internal ID.
 * GET /api/sales/:id
 */
export async function fetchSaleById(id: number): Promise<SaleDto> {
  const res = await authFetch(`${BASE_URL}/api/sales/${id}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let errMsg = `Failed to fetch sale #${id}`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new SaleApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch sale details by receipt number.
 * GET /api/sales/receipt/:receiptNumber
 */
export async function fetchSaleByReceipt(receiptNumber: string): Promise<SaleDto> {
  const res = await authFetch(`${BASE_URL}/api/sales/receipt/${encodeURIComponent(receiptNumber)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let errMsg = `Failed to fetch sale receipt: ${receiptNumber}`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {}
    throw new SaleApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data;
}
