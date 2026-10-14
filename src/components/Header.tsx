import React, { useState, useEffect, useCallback } from 'react';
import { Store, RefreshCw, Activity, CheckCircle2, AlertCircle, Bell, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { NotificationDropdown } from './Notification/NotificationDropdown';
import { fetchUnreadCount } from '../api/notificationApi';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  isHealthy: boolean;
  latencyMs: number;
  lastChecked: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing,
  isHealthy,
  latencyMs,
  lastChecked,
}) => {
  const { user, logout, quickSwitchUser } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshNotificationCount = useCallback(async () => {
    try {
      const count = await fetchUnreadCount();
      setUnreadCount(count);
    } catch {
      // Ignore background notification fetch errors
    }
  }, []);

  useEffect(() => {
    refreshNotificationCount();
    const interval = setInterval(refreshNotificationCount, 10000);

    const handleInventoryChange = () => {
      refreshNotificationCount();
    };

    window.addEventListener('inventory-changed', handleInventoryChange);
    window.addEventListener('notification-refresh', handleInventoryChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('inventory-changed', handleInventoryChange);
      window.removeEventListener('notification-refresh', handleInventoryChange);
    };
  }, [refreshNotificationCount]);

  return (
    <header className="bg-white border-b border-stone-200 px-6 py-3.5 flex items-center justify-between shadow-xs relative z-30">
      {/* Brand & Store context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 tracking-tight text-base">ScanDash POS</span>
              <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">v1.0.0-arch</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Terminal: Lane 01</span>
              <span aria-hidden="true">·</span>
              <span>Central Grocery Hub</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time status indicators & Actions */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-stone-600 border-r border-stone-200 pr-6">
          <span>{currentTime}</span>
        </div>

        {/* Backend Connectivity Status */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${
              isHealthy
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>API: {isHealthy ? 'Connected (UP)' : 'Connecting...'}</span>
            <span className="text-stone-400 font-mono">·</span>
            <span className="font-mono text-[11px]">{latencyMs}ms</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Health Check API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Ping API</span>
          </button>
        </div>

        {/* Low-Stock Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className={`relative p-2 rounded-lg transition-colors cursor-pointer border ${
              isNotificationsOpen
                ? 'bg-stone-100 text-stone-900 border-stone-300'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border-stone-200'
            }`}
            title={`Stock Notifications (${unreadCount} unread)`}
            aria-label="Stock Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationDropdown
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            onCountChange={(count) => setUnreadCount(count)}
          />
        </div>

        {/* Authenticated User Profile & Role Switcher */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-stone-200">
            {/* Quick Demo Role Switcher */}
            <div className="hidden lg:flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
              <span className="text-[10px] font-semibold text-stone-500 uppercase px-1.5 tracking-wider">
                RBAC Test:
              </span>
              <button
                onClick={() => quickSwitchUser('owner')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  user.role === 'ROLE_OWNER'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
                title="Switch to Owner account"
              >
                Owner
              </button>
              <button
                onClick={() => quickSwitchUser('admin')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  user.role === 'ROLE_ADMIN'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
                title="Switch to Admin account"
              >
                Admin
              </button>
              <button
                onClick={() => quickSwitchUser('cashier')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  user.role === 'ROLE_CASHIER'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
                title="Switch to Cashier account"
              >
                Cashier
              </button>
            </div>

            <div className="hidden md:flex flex-col items-end text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-stone-900">{user.fullName || user.username}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    user.role === 'ROLE_OWNER'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : user.role === 'ROLE_ADMIN'
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {user.role.replace('ROLE_', '')}
                </span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">@{user.username}</span>
            </div>

            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-rose-700 bg-stone-50 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Sign Out / Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
