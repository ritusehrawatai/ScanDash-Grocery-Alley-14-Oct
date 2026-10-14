import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  X,
  Package,
} from 'lucide-react';
import { NotificationItem } from '../../types/notification';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../api/notificationApi';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const items = await fetchNotifications();
      setNotifications(items);
      const unreadCount = items.filter((n) => !n.read).length;
      if (onCountChange) {
        onCountChange(unreadCount);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = async (id: number) => {
    setMarkingId(id);
    try {
      const updated = await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? updated : n))
      );
      const unreadCount = notifications.filter(
        (n) => n.id !== id && !n.read
      ).length;
      if (onCountChange) {
        onCountChange(unreadCount);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      if (onCountChange) {
        onCountChange(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-stone-200 z-50 overflow-hidden flex flex-col"
      style={{ maxHeight: 'calc(100vh - 5rem)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-stone-800 text-amber-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Stock Notifications</h3>
            <p className="text-[11px] text-stone-400">In-app inventory threshold alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subheader & Filters */}
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="flex items-center gap-1 px-2 py-1 text-stone-700 hover:text-stone-900 hover:bg-stone-200 rounded font-medium transition-colors disabled:opacity-50 cursor-pointer"
            title="Mark all notifications as read"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto flex-1 divide-y divide-stone-100 max-h-96">
        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-stone-400 mb-2" />
            <span>Checking stock alerts...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Check className="w-5 h-5" />
            </div>
            <p className="font-semibold text-stone-800">No stock alerts</p>
            <p className="text-stone-500 mt-1 max-w-[200px]">
              {filter === 'unread'
                ? 'All stock notifications have been marked as read.'
                : 'All products currently have healthy inventory levels.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isOutOfStock = n.type === 'OUT_OF_STOCK';
            return (
              <div
                key={n.id}
                className={`p-3.5 transition-colors flex gap-3 text-left ${
                  n.read
                    ? 'bg-white hover:bg-stone-50 opacity-80'
                    : isOutOfStock
                    ? 'bg-rose-50/60 hover:bg-rose-50 border-l-4 border-rose-600'
                    : 'bg-amber-50/60 hover:bg-amber-50 border-l-4 border-amber-500'
                }`}
              >
                {/* Severity Icon */}
                <div className="shrink-0 mt-0.5">
                  {isOutOfStock ? (
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                      <AlertOctagon className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isOutOfStock
                          ? 'bg-rose-200/80 text-rose-900'
                          : 'bg-amber-200/80 text-amber-900'
                      }`}
                    >
                      {isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK'}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {formatTime(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-stone-900 leading-snug font-medium mb-1.5">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/40">
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-600 font-mono">
                      <Package className="w-3 h-3 text-stone-400" />
                      <span>{n.productSku}</span>
                    </div>

                    {!n.read ? (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        disabled={markingId === n.id}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 rounded border border-emerald-300 transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400 flex items-center gap-1">
                        <Check className="w-3 h-3 text-stone-400" />
                        <span>Read</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
        <span>Automatic threshold detection</span>
        <span className="font-mono text-[10px] text-stone-400">In-App Alerts</span>
      </div>
    </div>
  );
};
