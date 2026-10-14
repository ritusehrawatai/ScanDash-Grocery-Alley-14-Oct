import { LoginCredentials, AuthApiResponse, User } from '../types/auth';
import { authStorage } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<AuthApiResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || `Login failed with status ${res.status}`;
    throw new AuthApiError(errorMsg, res.status);
  }

  if (data?.data?.token) {
    authStorage.setToken(data.data.token);
    authStorage.setUser(data.data.user);
  }

  return data;
}

export async function logoutUser(): Promise<void> {
  const headers = authStorage.getAuthHeaders();
  try {
    await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
    });
  } catch {
    // ignore network errors on logout
  } finally {
    authStorage.clearAuth();
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  const headers = authStorage.getAuthHeaders();
  if (!headers['Authorization']) {
    return null;
  }

  const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      authStorage.clearAuth();
    }
    return null;
  }

  const result = await res.json().catch(() => null);
  if (result?.success && result?.data) {
    authStorage.setUser(result.data);
    return result.data;
  }
  return null;
}
