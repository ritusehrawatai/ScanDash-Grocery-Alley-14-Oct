import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  History,
  Lock,
  Boxes,
  DollarSign,
  Tag,
  AlertCircle,
  Shield,
  FileCheck2,
  Trash2,
} from 'lucide-react';
import { AuditLog, AuditLogFilter } from '../../types/audit';
import { fetchAllAuditLogs, downloadAuditLogsCsv, cancelSale } from '../../api/auditApi';
import { useAuth } from '../../context/AuthContext';

export const AuditLogViewer: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Log for Inspector Modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  // Export state
  const [exporting, setExporting] = useState<boolean>(false);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllAuditLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleDownloadCsv = async () => {
    setExporting(true);
    try {
      await downloadAuditLogsCsv();
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedEntity !== 'ALL' && log.entity.toUpperCase() !== selectedEntity.toUpperCase()) {
        return false;
      }
      if (selectedAction !== 'ALL' && log.action.toUpperCase() !== selectedAction.toUpperCase()) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          log.details?.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q) ||
          log.username.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [logs, selectedEntity, selectedAction, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const priceAndThreshold = logs.filter(
      (l) => l.action === 'PRICE_CHANGED' || l.action === 'THRESHOLD_CHANGED'
    ).length;
    const inventoryAdjustments = logs.filter((l) => l.action === 'INVENTORY_ADJUSTED').length;
    const cancellations = logs.filter((l) => l.action === 'SALE_CANCELLED').length;
    const invoices = logs.filter((l) => l.action === 'INVOICE_CONFIRMED').length;
    const userRoleChanges = logs.filter(
      (l) => l.action === 'USER_ROLE_CHANGED' || l.action === 'USER_CREATED' || l.action === 'USER_STATUS_TOGGLED'
    ).length;

    return { total, priceAndThreshold, inventoryAdjustments, cancellations, invoices, userRoleChanges };
  }, [logs]);

  // Helper to get action badge styling
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PRODUCT_CREATED':
      case 'INVOICE_CONFIRMED':
      case 'USER_CREATED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'PRICE_CHANGED':
      case 'THRESHOLD_CHANGED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'INVENTORY_ADJUSTED':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'USER_ROLE_CHANGED':
      case 'USER_STATUS_TOGGLED':
      case 'PRODUCT_UPDATED':
      case 'USER_UPDATED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SALE_CANCELLED':
      case 'PRODUCT_DELETED':
      case 'USER_DELETED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300';
    }
  };

  // Helper to format JSON safely
  const formatJson = (val: string | null | undefined) => {
    if (!val) return 'None';
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <History className="w-5 h-5 text-emerald-700" />
              </div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">
                Enterprise Operations Audit Trail
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Ledger
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500 max-w-3xl">
              Chronological, immutable audit records for important business operations: product catalog changes,
              price modifications, inventory adjustments, threshold changes, invoice confirmations, sale cancellations,
              and user role updates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={exporting || logs.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Security / Sensitive Info Compliance Banner */}
        <div className="mt-4 p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-stone-600">
            <span className="font-semibold text-stone-800">Sensitive Information Protection: </span>
            Passwords, salts, hashes, and session tokens are strictly sanitized and stripped prior to logging in
            accordance with enterprise POS standards. Old and new state values preserve operational business context
            without credential exposure.
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-stone-100">
          <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-200/80">
            <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider block">Total Logs</span>
            <span className="text-lg font-bold text-stone-800">{stats.total}</span>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/70">
            <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider block">Price & Threshold</span>
            <span className="text-lg font-bold text-amber-800">{stats.priceAndThreshold}</span>
          </div>
          <div className="bg-cyan-50/60 p-2.5 rounded-lg border border-cyan-200/70">
            <span className="text-[10px] font-medium text-cyan-700 uppercase tracking-wider block">Stock Adjustments</span>
            <span className="text-lg font-bold text-cyan-800">{stats.inventoryAdjustments}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/70">
            <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider block">Invoices Confirmed</span>
            <span className="text-lg font-bold text-emerald-800">{stats.invoices}</span>
          </div>
          <div className="bg-rose-50/60 p-2.5 rounded-lg border border-rose-200/70">
            <span className="text-[10px] font-medium text-rose-700 uppercase tracking-wider block">Sale Cancellations</span>
            <span className="text-lg font-bold text-rose-800">{stats.cancellations}</span>
          </div>
          <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200/70">
            <span className="text-[10px] font-medium text-blue-700 uppercase tracking-wider block">User/Role Changes</span>
            <span className="text-lg font-bold text-blue-800">{stats.userRoleChanges}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search user, action, ID, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-stone-800 placeholder-stone-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Entity Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <span className="text-[11px] font-medium text-stone-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Entity:
            </span>
            {['ALL', 'PRODUCT', 'INVENTORY', 'INVOICE', 'SALE', 'USER'].map((ent) => (
              <button
                key={ent}
                onClick={() => setSelectedEntity(ent)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  selectedEntity === ent
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {ent}
              </button>
            ))}
          </div>

          {/* Action Filter Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full py-1.5 px-3 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Tracked Actions</option>
              <option value="PRODUCT_CREATED">Product Created</option>
              <option value="PRODUCT_UPDATED">Product Updated</option>
              <option value="PRODUCT_DELETED">Product Deleted</option>
              <option value="PRICE_CHANGED">Price Changed</option>
              <option value="THRESHOLD_CHANGED">Threshold Changed</option>
              <option value="INVENTORY_ADJUSTED">Inventory Adjusted</option>
              <option value="INVOICE_CONFIRMED">Invoice Confirmed</option>
              <option value="SALE_CANCELLED">Sale Cancelled</option>
              <option value="USER_CREATED">User Created</option>
              <option value="USER_UPDATED">User Updated</option>
              <option value="USER_ROLE_CHANGED">User Role Changed</option>
              <option value="USER_STATUS_TOGGLED">User Status Toggled</option>
              <option value="USER_DELETED">User Deleted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl shadow-xs border border-stone-200 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-stone-500">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="text-xs font-semibold">{error}</p>
            <button
              onClick={loadLogs}
              className="mt-3 px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 rounded-md text-stone-800"
            >
              Try Again
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-stone-400">
            <History className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            <p className="text-sm font-semibold text-stone-600">No matching audit logs found</p>
            <p className="text-xs text-stone-400 mt-1">
              Try adjusting your entity filter, action selector, or search keyword.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/90 text-stone-600 border-b border-stone-200 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-center">State Delta</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredLogs.map((log) => {
                  const hasOldValue = Boolean(log.oldValue);
                  const hasNewValue = Boolean(log.newValue);
                  const roleLabel = log.userRole.replace('ROLE_', '');

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-stone-50/80 transition-colors group cursor-pointer"
                      onClick={() => setInspectLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-[11px] text-stone-800">
                          {new Date(log.createdAt).toLocaleDateString()}{' '}
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-stone-400">ID #{log.id}</div>
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-[10px] uppercase">
                            {log.username.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-stone-900 block">{log.username}</span>
                            <span
                              className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                                log.userRole === 'ROLE_OWNER'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.userRole === 'ROLE_ADMIN'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider font-mono ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 font-semibold border border-stone-200">
                            {log.entity}
                          </span>
                          <span className="text-stone-400">#{log.entityId}</span>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs truncate text-stone-600" title={log.details}>
                        {log.details || '—'}
                      </td>

                      {/* State Delta Indicator */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-[10px] font-mono">
                          {hasOldValue ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Old
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                          <ArrowRight className="w-2.5 h-2.5 text-stone-400" />
                          {hasNewValue ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              New
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectLog(log);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspector Modal (Old Value vs New Value Diff Viewer) */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-stone-900 text-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Audit Record Inspector</h3>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Log Entry #{inspectLog.id} • {inspectLog.action}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="text-stone-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200 font-mono">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block">User</span>
                  <span className="font-bold text-stone-800">{inspectLog.username}</span>
                  <span className="text-[10px] text-stone-500 block">({inspectLog.userRole})</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block">Entity Target</span>
                  <span className="font-bold text-stone-800">{inspectLog.entity}</span>
                  <span className="text-[10px] text-stone-500 block">ID: {inspectLog.entityId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block">Action</span>
                  <span className="font-bold text-emerald-700">{inspectLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block">Timestamp</span>
                  <span className="text-stone-700 text-[11px]">
                    {new Date(inspectLog.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Description Details */}
              <div>
                <span className="text-[11px] font-semibold text-stone-700 block mb-1">Operation Summary</span>
                <p className="p-2.5 bg-stone-100/70 border border-stone-200 rounded-lg text-stone-800">
                  {inspectLog.details || 'No additional details recorded.'}
                </p>
              </div>

              {/* Side-by-Side Old vs New Value Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Value */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Old Value (Before)
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">Prior State</span>
                  </div>
                  <pre className="p-3 bg-stone-900 text-amber-200 font-mono text-[11px] rounded-lg overflow-x-auto border border-stone-800 min-h-[140px] max-h-60 leading-relaxed">
                    {formatJson(inspectLog.oldValue)}
                  </pre>
                </div>

                {/* New Value */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      New Value (After)
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">Committed State</span>
                  </div>
                  <pre className="p-3 bg-stone-900 text-emerald-300 font-mono text-[11px] rounded-lg overflow-x-auto border border-stone-800 min-h-[140px] max-h-60 leading-relaxed">
                    {formatJson(inspectLog.newValue)}
                  </pre>
                </div>
              </div>

              {/* Privacy / Sanitization Attestation */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-[11px] text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Audited & Scrubbed:</strong> Password credentials, salt strings, and authentication tokens
                  are guaranteed excluded from both Old and New value payloads.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-stone-100 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg cursor-pointer transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
