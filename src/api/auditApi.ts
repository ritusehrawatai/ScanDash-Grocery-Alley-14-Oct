import { AuditLog, AuditLogFilter } from '../types/audit';
import { authStorage } from '../utils/authStorage';
import { BASE_URL } from './baseUrl';

function getAuthHeaders(): HeadersInit {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch chronological audit logs with optional filters
 * Restricted to OWNER and ADMIN roles (CASHIER returns 403 Forbidden).
 */
export async function fetchAllAuditLogs(filters?: AuditLogFilter): Promise<AuditLog[]> {
  const params = new URLSearchParams();
  if (filters?.entity && filters.entity !== 'ALL') {
    params.set('entity', filters.entity);
  }
  if (filters?.action && filters.action !== 'ALL') {
    params.set('action', filters.action);
  }
  if (filters?.username) {
    params.set('username', filters.username);
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/api/audit-logs${query}`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Failed to fetch audit logs (${res.status})`);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Fetch a single audit log by ID
 */
export async function fetchAuditLogById(id: number): Promise<AuditLog> {
  const res = await fetch(`${BASE_URL}/api/audit-logs/${id}`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Failed to fetch audit log #${id}`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Export audit logs as CSV string
 */
export async function exportAuditLogsCsv(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/audit-logs/export/csv`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${authStorage.getToken() || ''}`,
    },
  });

  if (!res.ok) {
    throw new Error(`CSV export failed with status: ${res.status}`);
  }

  return await res.text();
}

/**
 * Trigger download of audit logs CSV file in the browser
 */
export async function downloadAuditLogsCsv(): Promise<void> {
  const csvText = await exportAuditLogsCsv();
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `freshcart-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Cancel a sale and restore inventory (records SALE_CANCELLED in audit trail)
 */
export async function cancelSale(saleId: number, reason: string = 'Voided / Returned'): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/sales/${saleId}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Failed to cancel sale #${saleId}`);
  }

  return await res.json();
}
