import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Minus,
  Sliders,
  History,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { InventoryItem, StockStatus } from '../../types/inventory';
import { fetchAllInventory } from '../../api/inventoryApi';
import { StockStatusBadge } from './StockStatusBadge';
import { AddStockModal } from './AddStockModal';
import { RemoveStockModal } from './RemoveStockModal';
import { AdjustStockModal } from './AdjustStockModal';
import { InventoryHistoryView } from './InventoryHistoryView';

export const InventoryList: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');

  // Modals state
  const [addingStockItem, setAddingStockItem] = useState<InventoryItem | null>(null);
  const [removingStockItem, setRemovingStockItem] = useState<InventoryItem | null>(null);
  const [adjustingStockItem, setAdjustingStockItem] = useState<InventoryItem | null>(null);

  // History sub-view state
  const [viewingHistory, setViewingHistory] = useState<boolean>(false);
  const [historyProductId, setHistoryProductId] = useState<number | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllInventory();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.productSku.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || item.stockStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((i) => i.stockStatus === 'IN STOCK').length;
    const lowStock = items.filter((i) => i.stockStatus === 'LOW STOCK').length;
    const outOfStock = items.filter((i) => i.stockStatus === 'OUT OF STOCK').length;
    return { total, inStock, lowStock, outOfStock };
  }, [items]);

  // If user opened the full transaction history ledger view
  if (viewingHistory) {
    return (
      <InventoryHistoryView
        initialProductId={historyProductId}
        onBack={() => {
          setViewingHistory(false);
          setHistoryProductId(null);
          loadInventory();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
              <span>Stock Control & Ledger</span>
              <span aria-hidden="true">·</span>
              <span>Negative Inventory Guarded</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mt-0.5">Inventory Management</h1>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <span>{stats.total} Products Tracked</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-medium">{stats.inStock} In Stock</span>
              {stats.lowStock > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-medium">{stats.lowStock} Low Stock</span>
                </>
              )}
              {stats.outOfStock > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-700 font-medium">{stats.outOfStock} Out of Stock</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setHistoryProductId(null);
                setViewingHistory(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-md transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-stone-500" />
              <span>History Ledger</span>
            </button>

            <button
              onClick={loadInventory}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh inventory from API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-200 text-xs">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
            <span className="text-[11px] text-stone-500 font-medium block">Total Stock Items</span>
            <span className="text-lg font-bold font-mono text-stone-900 mt-0.5 block">
              {stats.total}
            </span>
          </div>

          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-md">
            <span className="text-[11px] text-emerald-700 font-medium block">Adequate Stock</span>
            <span className="text-lg font-bold font-mono text-emerald-800 mt-0.5 block">
              {stats.inStock}
            </span>
          </div>

          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-md">
            <span className="text-[11px] text-amber-700 font-medium block">Low Stock Alert</span>
            <span className="text-lg font-bold font-mono text-amber-800 mt-0.5 block">
              {stats.lowStock}
            </span>
          </div>

          <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-md">
            <span className="text-[11px] text-rose-700 font-medium block">Out of Stock</span>
            <span className="text-lg font-bold font-mono text-rose-800 mt-0.5 block">
              {stats.outOfStock}
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-4 pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Query */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by product name or SKU..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-emerald-600 text-stone-900"
            />
          </div>

          {/* Status Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter('IN STOCK')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'IN STOCK'
                  ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              In Stock ({stats.inStock})
            </button>
            <button
              onClick={() => setStatusFilter('LOW STOCK')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'LOW STOCK'
                  ? 'bg-white text-amber-800 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Low Stock ({stats.lowStock})
            </button>
            <button
              onClick={() => setStatusFilter('OUT OF STOCK')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === 'OUT OF STOCK'
                  ? 'bg-white text-rose-800 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Out of Stock ({stats.outOfStock})
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadInventory}
            className="text-red-700 underline font-medium hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Min. Threshold</th>
                <th className="py-3 px-3 text-center">Stock Status</th>
                <th className="py-3 px-4 text-center">Last Updated</th>
                <th className="py-3 px-4 text-right">Inventory Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Loading real-time inventory balances...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-medium text-stone-700">No inventory records found</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing your search query or filter'
                        : 'Products in your catalog will display here with stock tracking.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                    {/* Product Name */}
                    <td className="py-3 px-4 font-medium text-stone-900 max-w-[200px] truncate">
                      <span title={item.productName}>{item.productName}</span>
                    </td>

                    {/* SKU */}
                    <td className="py-3 px-3 font-mono text-stone-600">
                      {item.productSku}
                    </td>

                    {/* Current Stock */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-stone-900">
                      {item.currentQuantity.toFixed(2)}{' '}
                      <span className="text-[10px] text-stone-400 font-normal">{item.unit}</span>
                    </td>

                    {/* Minimum Threshold */}
                    <td className="py-3 px-3 text-right font-mono text-stone-600">
                      {item.minimumInventoryThreshold}{' '}
                      <span className="text-[10px] text-stone-400 font-normal">{item.unit}</span>
                    </td>

                    {/* Stock Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <StockStatusBadge status={item.stockStatus} />
                    </td>

                    {/* Last Updated */}
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-stone-500 whitespace-nowrap">
                      {new Date(item.lastUpdated).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAddingStockItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors cursor-pointer"
                          title="Add Stock"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>Add</span>
                        </button>

                        <button
                          onClick={() => setRemovingStockItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                          title="Remove Stock (Damage/Expiry)"
                        >
                          <Minus className="w-3 h-3 text-rose-600" />
                          <span>Remove</span>
                        </button>

                        <button
                          onClick={() => setAdjustingStockItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded transition-colors cursor-pointer"
                          title="Physical Inventory Count Adjustment"
                        >
                          <Sliders className="w-3 h-3 text-stone-500" />
                          <span>Adjust</span>
                        </button>

                        <button
                          onClick={() => {
                            setHistoryProductId(item.productId);
                            setViewingHistory(true);
                          }}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                          title="View Product Transaction History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing <span className="font-mono font-medium text-stone-700">{filteredItems.length}</span> of{' '}
            <span className="font-mono font-medium text-stone-700">{items.length}</span> inventory items
          </div>
          <div className="flex items-center gap-3">
            <span>Guarded Balance Model</span>
            <span aria-hidden="true">·</span>
            <span>Real-time ACID Audits</span>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {addingStockItem && (
        <AddStockModal
          item={addingStockItem}
          onClose={() => setAddingStockItem(null)}
          onSuccess={() => {
            loadInventory();
            window.dispatchEvent(new CustomEvent('inventory-changed'));
            showToast(`Added stock for "${addingStockItem.productName}".`);
          }}
        />
      )}

      {removingStockItem && (
        <RemoveStockModal
          item={removingStockItem}
          onClose={() => setRemovingStockItem(null)}
          onSuccess={() => {
            loadInventory();
            window.dispatchEvent(new CustomEvent('inventory-changed'));
            showToast(`Removed stock for "${removingStockItem.productName}".`);
          }}
        />
      )}

      {adjustingStockItem && (
        <AdjustStockModal
          item={adjustingStockItem}
          onClose={() => setAdjustingStockItem(null)}
          onSuccess={() => {
            loadInventory();
            window.dispatchEvent(new CustomEvent('inventory-changed'));
            showToast(`Adjusted inventory for "${adjustingStockItem.productName}".`);
          }}
        />
      )}
    </div>
  );
};
