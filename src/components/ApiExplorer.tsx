import React, { useState } from 'react';
import { Play, Copy, Check, Terminal } from 'lucide-react';
import { authFetch } from '../utils/authStorage';

interface EndpointOption {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  defaultBody?: string;
}

const ENDPOINTS: EndpointOption[] = [
  {
    label: 'POST /api/v1/auth/login — Spring Security Authentication (Returns JWT Bearer Token)',
    method: 'POST',
    path: '/api/v1/auth/login',
    defaultBody: JSON.stringify(
      {
        username: 'owner',
        password: 'Owner@123',
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/v1/auth/me — Get Authenticated User Profile (Requires Bearer Token)',
    method: 'GET',
    path: '/api/v1/auth/me',
  },
  {
    label: 'GET /api/users — List All Users (RBAC: OWNER/ADMIN only, 403 Forbidden for CASHIER)',
    method: 'GET',
    path: '/api/users',
  },
  {
    label: 'POST /api/users — Create User (RBAC: OWNER/ADMIN only, 403 Forbidden for CASHIER)',
    method: 'POST',
    path: '/api/users',
    defaultBody: JSON.stringify(
      {
        username: 'cashier_lane2',
        password: 'Cashier@456',
        fullName: 'Lane 2 Cashier',
        email: 'lane2@freshcartpos.com',
        role: 'ROLE_CASHIER',
      },
      null,
      2
    ),
  },
  {
    label: 'PUT /api/products/1/threshold — Configure Inventory Threshold (RBAC: OWNER/ADMIN only)',
    method: 'PUT',
    path: '/api/products/1/threshold',
    defaultBody: JSON.stringify(
      {
        threshold: 25,
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/products?search=banana — Search Products (CASHIER, ADMIN, OWNER allowed)',
    method: 'GET',
    path: '/api/products?search=banana',
  },
  {
    label: 'GET /api/audit-logs — Chronological Enterprise Operations Audit Trail (OWNER/ADMIN only, 403 for CASHIER)',
    method: 'GET',
    path: '/api/audit-logs',
  },
  {
    label: 'GET /api/audit-logs?action=PRICE_CHANGED — Audit Trail Filtered by Price Changes',
    method: 'GET',
    path: '/api/audit-logs?action=PRICE_CHANGED',
  },
  {
    label: 'GET /api/audit-logs/export/csv — Export Operations Audit Trail to CSV',
    method: 'GET',
    path: '/api/audit-logs/export/csv',
  },
  {
    label: 'POST /api/sales/1/cancel — Void Sale & Restore Stock (Records SALE_CANCELLED in Audit Trail)',
    method: 'POST',
    path: '/api/sales/1/cancel',
    defaultBody: JSON.stringify(
      {
        reason: 'Customer return / Cashier counter void',
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/v1/auth/logout — Invalidate Current Session / Token',
    method: 'POST',
    path: '/api/v1/auth/logout',
  },
  {
    label: 'POST /api/invoices/1/ocr — Run Tesseract OCR on uploaded invoice (Extract items, flag low-confidence values)',
    method: 'POST',
    path: '/api/invoices/1/ocr',
  },
  {
    label: 'GET /api/invoices/1/ocr — Get OCR extracted data & manual review flags for invoice #1',
    method: 'GET',
    path: '/api/invoices/1/ocr',
  },
  {
    label: 'GET /api/invoices — Get all uploaded purchase invoices ledger',
    method: 'GET',
    path: '/api/invoices',
  },
  {
    label: 'POST /api/invoices/upload — Upload invoice (Status: UPLOADED, JPG/JPEG/PNG/PDF validation)',
    method: 'POST',
    path: '/api/invoices/upload',
    defaultBody: JSON.stringify(
      {
        filename: 'invoice-sample.pdf',
        mimeType: 'application/pdf',
        base64Data: 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCAxNSAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJzLSM3JyVcAABswA78KZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWyAzIDAgUiBdIC9Db3VudCAxID4+CmVuZG9iagozIDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL0NvbnRlbnRzIDQgMCBSID4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNzMgMDAwMDAgbiAKMDAwMDAwMDEyOSAwMDAwMCBuIAowMDAwMDAwMTgzIDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyNDMKJSVFT0Y=',
        notes: 'Sample vendor invoice for produce',
        uploadedBy: 'Store Owner / Admin',
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/invoices/1 — Get purchase invoice record by ID',
    method: 'GET',
    path: '/api/invoices/1',
  },
  {
    label: 'POST /api/sales — Process POS Checkout Sale (11-step transaction)',
    method: 'POST',
    path: '/api/sales',
    defaultBody: JSON.stringify(
      {
        items: [
          { productId: 1, quantity: 2.0 },
          { productId: 2, quantity: 1.0 },
        ],
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/sales — Get all completed historical sales ledger',
    method: 'GET',
    path: '/api/sales',
  },
  {
    label: 'GET /api/notifications — Get in-app low-stock & out-of-stock notifications',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'GET /api/notifications?unreadOnly=true — Get unread notifications only',
    method: 'GET',
    path: '/api/notifications?unreadOnly=true',
  },
  {
    label: 'GET /api/notifications/unread-count — Get total unread notifications count',
    method: 'GET',
    path: '/api/notifications/unread-count',
  },
  {
    label: 'PUT /api/notifications/1/read — Mark notification #1 as read',
    method: 'PUT',
    path: '/api/notifications/1/read',
  },
  {
    label: 'PUT /api/notifications/read-all — Mark all notifications as read',
    method: 'PUT',
    path: '/api/notifications/read-all',
  },
  {
    label: 'GET /api/inventory — Get current inventory for all products',
    method: 'GET',
    path: '/api/inventory',
  },
  {
    label: 'GET /api/inventory/1 — Get inventory for product #1 (Bananas)',
    method: 'GET',
    path: '/api/inventory/1',
  },
  {
    label: 'POST /api/inventory/add — Add stock (PURCHASE 25 units)',
    method: 'POST',
    path: '/api/inventory/add',
    defaultBody: JSON.stringify(
      {
        productId: 1,
        quantity: 25.0,
        transactionType: 'PURCHASE',
        reason: 'Shipment restock delivery',
        referenceId: 'PO-2024-88',
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/inventory/remove — Remove stock (DAMAGE 5 units)',
    method: 'POST',
    path: '/api/inventory/remove',
    defaultBody: JSON.stringify(
      {
        productId: 1,
        quantity: 5.0,
        transactionType: 'DAMAGE',
        reason: 'Broken packaging write-off',
        referenceId: 'DMG-102',
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/inventory/remove — Test Prevent Negative Inventory (Error 400)',
    method: 'POST',
    path: '/api/inventory/remove',
    defaultBody: JSON.stringify(
      {
        productId: 1,
        quantity: 99999.0,
        transactionType: 'DAMAGE',
        reason: 'Excessive deduction attempt',
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/inventory/adjust — Adjust stock to target count',
    method: 'POST',
    path: '/api/inventory/adjust',
    defaultBody: JSON.stringify(
      {
        productId: 1,
        targetQuantity: 50.0,
        reason: 'Physical cycle count audit reconciliation',
        referenceId: 'AUDIT-Q4',
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/inventory/1/transactions — Get audit transaction history for product #1',
    method: 'GET',
    path: '/api/inventory/1/transactions',
  },
  {
    label: 'GET /api/products — List all grocery products',
    method: 'GET',
    path: '/api/products',
  },
  {
    label: 'GET /api/products/search?q=milk — Search products by keyword "milk"',
    method: 'GET',
    path: '/api/products/search?q=milk',
  },
  {
    label: 'GET /api/products/search?q=dairy — Search products by category "dairy"',
    method: 'GET',
    path: '/api/products/search?q=dairy',
  },
  {
    label: 'GET /api/products/1 — Get product by ID (Bananas)',
    method: 'GET',
    path: '/api/products/1',
  },
  {
    label: 'POST /api/products — Create new product',
    method: 'POST',
    path: '/api/products',
    defaultBody: JSON.stringify(
      {
        name: 'Organic Hass Avocados',
        sku: 'SKU-AVO-001',
        barcode: '012345678903',
        description: 'Ripe Hass avocados, bag of 4',
        categoryId: 1,
        purchasePrice: 2.20,
        sellingPrice: 3.99,
        taxRate: 0.00,
        unit: 'BAG',
        minimumInventoryThreshold: 10,
        active: true,
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/products — Test Duplicate SKU Error (Conflict 409)',
    method: 'POST',
    path: '/api/products',
    defaultBody: JSON.stringify(
      {
        name: 'Duplicate SKU Test',
        sku: 'SKU-BAN-001',
        purchasePrice: 1.00,
        sellingPrice: 2.00,
        taxRate: 0.00,
        unit: 'PCS',
        minimumInventoryThreshold: 5,
      },
      null,
      2
    ),
  },
  {
    label: 'POST /api/products — Test Negative Price Error (Bad Request 400)',
    method: 'POST',
    path: '/api/products',
    defaultBody: JSON.stringify(
      {
        name: 'Invalid Price Item',
        sku: 'SKU-INV-PRICE',
        purchasePrice: -1.50,
        sellingPrice: -3.00,
        taxRate: 0.00,
        unit: 'PCS',
        minimumInventoryThreshold: 0,
      },
      null,
      2
    ),
  },
  {
    label: 'PUT /api/products/1 — Update product pricing / details',
    method: 'PUT',
    path: '/api/products/1',
    defaultBody: JSON.stringify(
      {
        name: 'Organic Cavendish Bananas (Special Price)',
        sku: 'SKU-BAN-001',
        barcode: '012345678901',
        description: 'Premium organic bananas on weekly discount',
        purchasePrice: 0.60,
        sellingPrice: 1.09,
        taxRate: 0.00,
        unit: 'KG',
        minimumInventoryThreshold: 25,
        active: true,
      },
      null,
      2
    ),
  },
  {
    label: 'GET /api/products/999 — Test Product Not Found (404)',
    method: 'GET',
    path: '/api/products/999',
  },
  {
    label: 'GET /api/v1/health — Full System & Module Health',
    method: 'GET',
    path: '/api/v1/health',
  },
  {
    label: 'GET /api/v1/health/ping — Heartbeat Liveness Probe',
    method: 'GET',
    path: '/api/v1/health/ping',
  },
];

export const ApiExplorer: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [requestBody, setRequestBody] = useState<string>(ENDPOINTS[0].defaultBody || '');
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string>('');
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const selected = ENDPOINTS[selectedIndex];

  const handleSelectChange = (idx: number) => {
    setSelectedIndex(idx);
    setRequestBody(ENDPOINTS[idx].defaultBody || '');
    setResponseStatus(null);
    setResponseBody('');
  };

  const executeCall = async () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseBody('');
    const start = performance.now();
    try {
      const options: RequestInit = {
        method: selected.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };

      if ((selected.method === 'POST' || selected.method === 'PUT') && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await authFetch(selected.path, options);
      const latency = Math.round(performance.now() - start);
      setExecutionTime(latency);
      setResponseStatus(res.status);

      if (res.status === 204) {
        setResponseBody('/* HTTP 204 No Content - Operation executed successfully with empty body */');
        return;
      }

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponseBody(JSON.stringify(json, null, 2));
      } catch {
        setResponseBody(text);
      }
    } catch (err: unknown) {
      const latency = Math.round(performance.now() - start);
      setExecutionTime(latency);
      setResponseStatus(500);
      setResponseBody(JSON.stringify({ error: err instanceof Error ? err.message : 'Execution error' }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = () => {
    let curl = `curl -X ${selected.method} "http://localhost:8080${selected.path}"`;
    if ((selected.method === 'POST' || selected.method === 'PUT') && requestBody.trim()) {
      curl += ` -H "Content-Type: application/json" -d '${requestBody.replace(/\n\s*/g, ' ')}'`;
    }
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-emerald-700 text-white';
      case 'POST':
        return 'bg-blue-700 text-white';
      case 'PUT':
        return 'bg-amber-600 text-white';
      case 'DELETE':
        return 'bg-rose-700 text-white';
      default:
        return 'bg-stone-700 text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Interactive Product REST API Explorer</h1>
            <p className="text-sm text-stone-600 mt-0.5">
              Live test console for Product endpoints, verifying DTOs, validations, 404, and 409 conflict handling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2 py-1 rounded">
              Endpoints: /api/products
            </span>
          </div>
        </div>

        {/* Endpoint Selector & Send Button */}
        <div className="mt-5 p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className={`px-2.5 py-1 font-mono text-xs font-bold rounded ${getMethodBadgeColor(selected.method)}`}>
                {selected.method}
              </span>
              <select
                value={selectedIndex}
                onChange={(e) => handleSelectChange(Number(e.target.value))}
                className="flex-1 bg-white border border-stone-300 text-stone-900 text-xs font-mono py-1.5 px-3 rounded focus:outline-emerald-600 cursor-pointer"
              >
                {ENDPOINTS.map((ep, idx) => (
                  <option key={idx} value={idx}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={executeCall}
                disabled={loading}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-4 py-2 rounded transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Executing...' : 'Send Request'}</span>
              </button>

              <button
                onClick={copyCurl}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-medium px-3 py-2 rounded transition-colors cursor-pointer"
                title="Copy cURL command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
          </div>

          {(selected.method === 'POST' || selected.method === 'PUT') && (
            <div>
              <div className="text-[11px] font-mono text-stone-500 mb-1">Request JSON Body:</div>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                rows={7}
                className="w-full font-mono text-xs p-2.5 bg-white border border-stone-300 rounded focus:outline-emerald-600 text-stone-900"
              />
            </div>
          )}
        </div>
      </div>

      {/* Response Panel */}
      <div className="bg-stone-900 border border-stone-800 rounded-lg p-4 text-stone-200 shadow-2xs">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-medium text-stone-200">
              Response Console
            </span>
            {responseStatus !== null && (
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                  responseStatus >= 200 && responseStatus < 300
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : responseStatus === 409
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : responseStatus === 404
                    ? 'bg-blue-950 text-blue-400 border border-blue-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                HTTP {responseStatus}
              </span>
            )}
            {executionTime !== null && (
              <span className="text-xs font-mono text-stone-400">
                {executionTime} ms
              </span>
            )}
          </div>

          <span className="text-[11px] font-mono text-stone-500">
            Path: {selected.path}
          </span>
        </div>

        {responseBody ? (
          <pre className="font-mono text-xs text-emerald-400 overflow-x-auto p-3 bg-stone-950/70 rounded border border-stone-800 max-h-96">
            {responseBody}
          </pre>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-stone-500">
            Click &quot;Send Request&quot; above to execute the endpoint and inspect status codes, DTOs, and error messages.
          </div>
        )}
      </div>
    </div>
  );
};
