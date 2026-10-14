import { User, CreateUserData, UpdateUserData, UserRole } from '../types/auth';
import { authStorage } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getAuthHeaders(): HeadersInit {
  const token = authStorage.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`${BASE_URL}/api/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Failed to fetch users (${res.status})`);
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchUserById(id: number): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/users/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Failed to fetch user #${id}`);
  }
  const json = await res.json();
  return json.data;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to create user (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateUser(id: number, data: UpdateUserData): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to update user #${id}`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateUserRole(id: number, role: UserRole): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/users/${id}/role`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to update role for user #${id}`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateUserStatus(id: number, enabled: boolean): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/users/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to update status for user #${id}`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to delete user #${id}`);
  }
}

export async function updateProductThreshold(productId: number, threshold: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/products/${productId}/threshold`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ threshold }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Failed to set threshold (${res.status})`);
  }
  return res.json();
}
