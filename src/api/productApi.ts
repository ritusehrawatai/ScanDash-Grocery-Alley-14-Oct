import { Product, CreateProductInput, UpdateProductInput } from '../types/product';
import { ApiResponse } from '../types/health';
import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return {} as T;
  }

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
        // ignore parse error
      }
    } else {
      const text = await res.text();
      if (text) errorMsg = text;
    }

    throw new ApiError(errorMsg, res.status, details);
  }

  if (isJson) {
    const json = await res.json();
    // Support either ApiResponse<T> wrapper ({ data: ... }) or direct payload
    return json.data !== undefined ? json.data : json;
  }

  return {} as T;
}

export async function fetchProducts(
  search?: string,
  categoryId?: number,
  activeOnly?: boolean
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (categoryId) params.append('categoryId', categoryId.toString());
  if (activeOnly) params.append('activeOnly', 'true');

  const url = `${BASE_URL}/api/products${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url, {
    headers: { Accept: 'application/json' },
  });

  return handleResponse<Product[]>(res);
}

/**
 * Searches products by partial match across Name, SKU, Barcode, or Category.
 * GET /api/products/search?q={query}
 */
export async function searchProducts(
  query: string,
  activeOnly?: boolean
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (query) params.append('q', query.trim());
  if (activeOnly) params.append('activeOnly', 'true');

  const url = `${BASE_URL}/api/products/search${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url, {
    headers: { Accept: 'application/json' },
  });

  return handleResponse<Product[]>(res);
}

export async function fetchProductById(id: number): Promise<Product> {
  const res = await authFetch(`${BASE_URL}/api/products/${id}`, {
    headers: { Accept: 'application/json' },
  });
  return handleResponse<Product>(res);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const res = await authFetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return handleResponse<Product>(res);
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  const res = await authFetch(`${BASE_URL}/api/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return handleResponse<Product>(res);
}

export async function toggleProductActive(product: Product, newActiveStatus: boolean): Promise<Product> {
  const updatePayload: UpdateProductInput = {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    categoryId: product.categoryId,
    supplierId: product.supplierId,
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    taxRate: product.taxRate,
    unit: product.unit,
    minimumInventoryThreshold: product.minimumInventoryThreshold,
    active: newActiveStatus,
  };

  return updateProduct(product.id, updatePayload);
}

export async function deleteProduct(id: number): Promise<void> {
  const res = await authFetch(`${BASE_URL}/api/products/${id}`, {
    method: 'DELETE',
  });
  await handleResponse<void>(res);
}
