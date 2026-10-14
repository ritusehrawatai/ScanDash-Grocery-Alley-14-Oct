import { PurchaseInvoice, InvoiceUploadResponse, InvoiceListResponse } from '../types/invoice';
import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class InvoiceApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'InvoiceApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Upload an invoice file (JPG, JPEG, PNG, PDF) using multipart/form-data.
 * Strictly creates PurchaseInvoice with status UPLOADED.
 * Does NOT run OCR. Does NOT modify inventory. Does NOT create products.
 */
export async function uploadInvoice(
  file: File,
  notes?: string,
  uploadedBy: string = 'Owner / Admin'
): Promise<PurchaseInvoice> {
  const formData = new FormData();
  formData.append('file', file);
  if (notes) {
    formData.append('notes', notes);
  }
  formData.append('uploadedBy', uploadedBy);

  const response = await authFetch(`${BASE_URL}/api/invoices/upload`, {
    method: 'POST',
    body: formData,
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || 'Failed to upload invoice',
      response.status,
      json.details
    );
  }

  return json.data;
}

/**
 * Fetch all purchase invoices.
 */
export async function fetchInvoices(): Promise<PurchaseInvoice[]> {
  const response = await authFetch(`${BASE_URL}/api/invoices`);
  const json: InvoiceListResponse = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError('Failed to fetch purchase invoices', response.status);
  }

  return json.data;
}

/**
 * Fetch a single invoice by ID.
 */
export async function fetchInvoiceById(id: number): Promise<PurchaseInvoice> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}`);
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(`Failed to fetch invoice #${id}`, response.status);
  }

  return json.data;
}

/**
 * Delete an uploaded invoice.
 */
export async function deleteInvoice(id: number): Promise<void> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}`, {
    method: 'DELETE',
  });
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(`Failed to delete invoice #${id}`, response.status);
  }
}

/**
 * Get direct download or preview link for stored invoice file.
 */
export function getInvoiceDownloadUrl(id: number): string {
  return `${BASE_URL}/api/invoices/${id}/download`;
}

/**
 * Execute Tesseract OCR processing on an uploaded invoice.
 * Extracts: Supplier, Invoice number, Date, Line items (Product name, SKU, Barcode, Qty, Unit price, Total).
 * Flags low-confidence values for manual review.
 * Safeguards: Inventory is NOT updated. Invoice is NOT automatically confirmed.
 */
export async function processInvoiceOcr(id: number): Promise<{
  ocrResult: import('../types/invoice').InvoiceOcrResult;
  invoice: PurchaseInvoice;
}> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || `Failed to run OCR on invoice #${id}`,
      response.status
    );
  }

  return {
    ocrResult: json.data,
    invoice: json.invoice,
  };
}

/**
 * Fetch OCR extracted data for an invoice.
 */
export async function fetchInvoiceOcr(id: number): Promise<import('../types/invoice').InvoiceOcrResult> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}/ocr`);
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || `Failed to fetch OCR data for invoice #${id}`,
      response.status
    );
  }

  return json.data;
}

/**
 * Save edited invoice review data (supplier, invoice number, date, items, matching, ignored status).
 * STRICT SAFEGUARD:
 * Does NOT update inventory.
 * Does NOT confirm the invoice.
 * Stores draft changes for manual review.
 */
export async function saveInvoiceReview(
  id: number,
  payload: import('../types/invoice').InvoiceReviewPayload
): Promise<PurchaseInvoice> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || `Failed to save review edits for invoice #${id}`,
      response.status
    );
  }

  return json.data;
}

/**
 * Explicitly confirm an invoice and update store inventory stock for non-ignored items.
 * Executes the 10-step transactional confirmation process with automatic rollback on failure:
 * 1. Validate invoice
 * 2. Validate invoice items
 * 3. Match each item to a product
 * 4. Require user confirmation for uncertain matches
 * 5. Create purchase invoice
 * 6. Create invoice items
 * 7. Increase inventory
 * 8. Create PURCHASE inventory transactions
 * 9. Recalculate stock status
 * 10. Trigger notification logic
 *
 * STRICT ENFORCEMENT:
 * Inventory is ONLY updated upon explicit invocation of this endpoint!
 */
export async function confirmInvoice(
  id: number,
  options?: import('../types/invoice').InvoiceConfirmOptions
): Promise<import('../types/invoice').InvoiceConfirmResponse> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options || {}),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || `Failed to confirm invoice #${id}`,
      response.status
    );
  }

  return json;
}

/**
 * Fetch formal purchase invoice line items created during confirmation
 */
export async function fetchPurchaseInvoiceItems(
  id: number
): Promise<import('../types/invoice').PurchaseInvoiceItemRecord[]> {
  const response = await authFetch(`${BASE_URL}/api/invoices/${id}/items`);
  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || `Failed to fetch invoice items for #${id}`,
      response.status
    );
  }

  return json.data;
}

/**
 * Match an item against the catalog using the 4-tier matching sequence:
 * 1. Barcode
 * 2. SKU
 * 3. Exact normalized name
 * 4. Fuzzy name matching
 */
export async function matchInvoiceProduct(params: {
  productName: string;
  sku?: string;
  barcode?: string;
  itemId?: string;
}): Promise<import('../types/invoice').ProductMatchSuggestion> {
  const response = await authFetch(`${BASE_URL}/api/invoices/match-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new InvoiceApiError(
      json.error || json.message || 'Failed to match invoice product',
      response.status
    );
  }

  return json.data;
}


