export type UserRole = 'ROLE_OWNER' | 'ROLE_ADMIN' | 'ROLE_MANAGER' | 'ROLE_CASHIER' | 'OWNER' | 'ADMIN' | 'CASHIER';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt?: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  role: UserRole;
}

export interface UpdateUserData {
  fullName?: string;
  email?: string;
  role?: UserRole;
  enabled?: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthSessionData {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface AuthApiResponse {
  success: boolean;
  message: string;
  data?: AuthSessionData;
  error?: string;
  timestamp?: string;
}
