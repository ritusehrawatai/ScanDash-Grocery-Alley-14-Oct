import { ProductCategory, CreateCategoryInput, UpdateCategoryInput } from '../types/category';
import { authFetch } from '../utils/authStorage';
import { BASE_URL } from './baseUrl';
import { ApiError } from './productApi';

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
    return json.data !== undefined ? json.data : json;
  }

  return {} as T;
}

/**
 * Fetches all product categories.
 * Supports activeOnly filter and query string search.
 */
export async function fetchCategories(
  activeOnly?: boolean,
  search?: string
): Promise<ProductCategory[]> {
  const params = new URLSearchParams();
  if (activeOnly) params.append('activeOnly', 'true');
  if (search && search.trim()) params.append('search', search.trim());

  const url = `${BASE_URL}/api/categories${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url, {
    headers: { Accept: 'application/json' },
  });

  return handleResponse<ProductCategory[]>(res);
}

/**
 * Fetches a single category by ID.
 */
export async function fetchCategoryById(id: number): Promise<ProductCategory> {
  const res = await authFetch(`${BASE_URL}/api/categories/${id}`, {
    headers: { Accept: 'application/json' },
  });
  return handleResponse<ProductCategory>(res);
}

/**
 * Creates a new product category.
 */
export async function createCategory(input: CreateCategoryInput): Promise<ProductCategory> {
  const res = await authFetch(`${BASE_URL}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  return handleResponse<ProductCategory>(res);
}

/**
 * Updates an existing category (rename, description, status).
 */
export async function updateCategory(
  id: number,
  input: UpdateCategoryInput
): Promise<ProductCategory> {
  const res = await authFetch(`${BASE_URL}/api/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  return handleResponse<ProductCategory>(res);
}

/**
 * Activates or deactivates a category.
 */
export async function toggleCategoryActive(
  id: number,
  active: boolean
): Promise<ProductCategory> {
  const res = await authFetch(`${BASE_URL}/api/categories/${id}/active`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ active }),
  });

  return handleResponse<ProductCategory>(res);
}

/**
 * Safely deletes an unused category.
 * If the category has associated products, the backend returns 409 Conflict.
 */
export async function deleteCategory(id: number): Promise<{ id: number }> {
  const res = await authFetch(`${BASE_URL}/api/categories/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  return handleResponse<{ id: number }>(res);
}
