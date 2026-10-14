import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials } from '../types/auth';
import { authStorage } from '../utils/authStorage';
import { loginUser, logoutUser, fetchCurrentUser } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // RBAC Roles
  isOwner: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isOwnerOrAdmin: boolean;
  // Role-Based Permissions
  canManageProducts: boolean;
  canManageInventory: boolean;
  canManageInvoices: boolean;
  canViewReports: boolean;
  canManageNotifications: boolean;
  canManageUsers: boolean;
  canConfigureThresholds: boolean;
  canUsePos: boolean;
  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  quickSwitchUser: (targetRole: 'owner' | 'admin' | 'cashier') => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => authStorage.getUser());
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const roleStr = (user?.role || '').toUpperCase();
  const isOwner = roleStr === 'ROLE_OWNER' || roleStr === 'OWNER';
  const isAdmin = roleStr === 'ROLE_ADMIN' || roleStr === 'ADMIN' || roleStr === 'ROLE_MANAGER';
  const isCashier = roleStr === 'ROLE_CASHIER' || roleStr === 'CASHIER';
  const isOwnerOrAdmin = isOwner || isAdmin;

  // RBAC permissions as requested:
  // OWNER/ADMIN: Products, Inventory, Invoices, Reports, Notifications, User management, Inventory thresholds
  // CASHIER: Product search, Voice search, POS, Checkout, Receipt
  const canManageProducts = isOwnerOrAdmin;
  const canManageInventory = isOwnerOrAdmin;
  const canManageInvoices = isOwnerOrAdmin;
  const canViewReports = isOwnerOrAdmin;
  const canManageNotifications = isOwnerOrAdmin;
  const canManageUsers = isOwnerOrAdmin;
  const canConfigureThresholds = isOwnerOrAdmin;
  const canUsePos = true; // All authenticated roles can use POS, checkout & receipt

  useEffect(() => {
    let isMounted = true;

    async function checkAuthSession() {
      const storedToken = authStorage.getToken();
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (isMounted) {
          if (currentUser) {
            setUser(currentUser);
            setToken(storedToken);
          } else {
            // Token expired or invalid
            authStorage.clearAuth();
            setUser(null);
            setToken(null);
          }
        }
      } catch {
        if (isMounted) {
          // Fallback to local storage if network glitch, or clear if unauthorized
          const cached = authStorage.getUser();
          setUser(cached);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await loginUser(credentials);
      if (res.success && res.data?.token) {
        setToken(res.data.token);
        setUser(res.data.user);
        setIsLoading(false);
        return true;
      } else {
        setError(res.message || 'Authentication failed');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      setIsLoading(false);
      return false;
    }
  };

  const quickSwitchUser = async (targetRole: 'owner' | 'admin' | 'cashier'): Promise<boolean> => {
    const creds: Record<string, LoginCredentials> = {
      owner: { username: 'owner', password: 'Owner@123' },
      admin: { username: 'admin', password: 'Admin@123' },
      cashier: { username: 'cashier', password: 'Cashier@123' },
    };
    return await login(creds[targetRole]);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
    } finally {
      authStorage.clearAuth();
      setUser(null);
      setToken(null);
      setError(null);
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        error,
        isOwner,
        isAdmin,
        isCashier,
        isOwnerOrAdmin,
        canManageProducts,
        canManageInventory,
        canManageInvoices,
        canViewReports,
        canManageNotifications,
        canManageUsers,
        canConfigureThresholds,
        canUsePos,
        login,
        quickSwitchUser,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
