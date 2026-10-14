import { NotificationItem } from '../types/notification';
import { authFetch } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class NotificationApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'NotificationApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Fetch list of in-app stock notifications.
 * @param unreadOnly If true, filters by unread status
 */
export async function fetchNotifications(unreadOnly: boolean = false): Promise<NotificationItem[]> {
  const url = unreadOnly
    ? `${BASE_URL}/api/notifications?unreadOnly=true`
    : `${BASE_URL}/api/notifications`;

  const res = await authFetch(url);
  if (!res.ok) {
    let errMsg = `Failed to fetch notifications (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.message || data.error || errMsg;
    } catch {}
    throw new NotificationApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Fetch total unread stock notifications count.
 */
export async function fetchUnreadCount(): Promise<number> {
  const res = await authFetch(`${BASE_URL}/api/notifications/unread-count`);
  if (!res.ok) {
    let errMsg = `Failed to fetch unread count (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.message || data.error || errMsg;
    } catch {}
    throw new NotificationApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data?.count ?? 0;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id: number): Promise<NotificationItem> {
  const res = await authFetch(`${BASE_URL}/api/notifications/${id}/read`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to mark notification as read (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.message || data.error || errMsg;
    } catch {}
    throw new NotificationApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Mark all unread notifications as read.
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  const res = await authFetch(`${BASE_URL}/api/notifications/read-all`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Failed to mark all notifications as read (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.message || data.error || errMsg;
    } catch {}
    throw new NotificationApiError(errMsg, res.status);
  }

  const json = await res.json();
  return json.data?.updatedCount ?? 0;
}
