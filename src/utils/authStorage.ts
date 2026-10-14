import { User } from '../types/auth';

const TOKEN_KEY = 'freshcart_auth_token';
const USER_KEY = 'freshcart_auth_user';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // storage unavailable
    }
  },

  getUser(): User | null {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  setUser(user: User): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // storage unavailable
    }
  },

  clearAuth(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  },

  getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const token = this.getToken();
    const headers: Record<string, string> = { ...customHeaders };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },
};

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let customHeaders: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((val, key) => {
        customHeaders[key] = val;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, val]) => {
        customHeaders[key] = val;
      });
    } else {
      customHeaders = { ...init.headers as Record<string, string> };
    }
  }

  const mergedHeaders = authStorage.getAuthHeaders(customHeaders);

  return fetch(input, {
    ...init,
    headers: mergedHeaders,
  });
}
