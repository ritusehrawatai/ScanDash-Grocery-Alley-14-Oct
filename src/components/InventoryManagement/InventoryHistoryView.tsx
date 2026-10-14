import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  History,
  TrendingUp,
  TrendingDown,
  Sliders,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  InventoryTransactionItem,
  InventoryTransactionType,
  InventoryItem,
} from '../../types/inventory';
import { fetchInventoryTransactions, fetchAllInventory } from '../../api/inventoryApi';

interface InventoryHistoryViewProps {
  initialProductId?: number | null;
  onBack: () => void;
}

export const InventoryHistoryView: React.FC<InventoryHistoryViewProps> = ({
  initialProductId = null,
  onBack,
}) => {
  const [transactions, setTransactions] = useState<InventoryTransactionItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | 'all'>(
    initialProductId !== null ? initialProductId : 'all'
  );
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txList, items] = await Promise.all([
        fetchInventoryTransactions(
          selectedProductId !== 'all' ? selectedProductId : undefined
        ),
        fetchAllInventory(),
      ]);
      setTransactions(txList);
      setInventoryItems(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProductId]);

  // Filtered list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesType = selectedType === 'all' || tx.transactionType === selectedType;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tx.productName.toLowerCase().includes(q) ||
        tx.productSku.toLowerCase().includes(q) ||
        (tx.referenceId && tx.referenceId.toLowerCase().includes(q)) ||
        (tx.reason && tx.reason.toLowerCase().includes(q));

      return matchesType && matchesSearch;
    });
  }, [transactions, selectedType, searchQuery]);

  const getTypeBadge = (type: InventoryTransactionType) => {
    switch (type) {
      case 'PURCHASE':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold text-[11px]">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>PURCHASE</span>
          </span>
        );
      case 'RETURN':
        return (
          <span className="inline-flex items-center gap-1 text-blue-800 font-semibold text-[11px]">
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>RETURN</span>
          </span>
        );
      case 'DAMAGE':
        return (
          <span className="inline-flex items-center gap-1 text-rose-800 font-semibold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>DAMAGE</span>
          </span>
        );
      case 'EXPIRY':
        return (
          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>EXPIRY</span>
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 text-purple-800 font-semibold text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>ADJUSTMENT</span>
          </span>
        );
      case 'SALE':
        return (
          <span className="inline-flex items-center gap-1 text-stone-700 font-semibold text-[11px]">
            <TrendingDown className="w-3.5 h-3.5 text-stone-500" />
            <span>SALE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-stone-700 font-semibold text-[11px]">
            <span>{type}</span>
          </span>
        );
    }
  };

  const isPositiveDelta = (type: InventoryTransactionType, prev: number, next: number) => {
    if (type === 'PURCHASE' || type === 'RETURN') return true;
    if (type === 'DAMAGE' || type === 'EXPIRY' || type === 'SALE') return false;
    return next >= prev;
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md border border-stone-200 transition-colors cursor-pointer"
              title="Return to Inventory List"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
                <span>Audit Ledger</span>
                <span aria-hidden="true">·</span>
                <span>Immutable Transaction Records</span>
              </div>
              <h1 className="text-xl font-bold text-stone-900 mt-0.5">
                Inventory Transaction History
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Query */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by product, SKU, PO or reason..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-md text-xs focus:outline-emerald-600 text-stone-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Product Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Product:</span>
              <select
                value={selectedProductId}
                onChange={(e) =>
                  setSelectedProductId(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-800 focus:outline-emerald-600 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">All Products</option>
                {inventoryItems.map((inv) => (
                  <option key={inv.productId} value={inv.productId}>
                    {inv.productName} ({inv.productSku})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Type:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs text-stone-800 focus:outline-emerald-600 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="SALE">SALE</option>
                <option value="RETURN">RETURN</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="DAMAGE">DAMAGE</option>
                <option value="EXPIRY">EXPIRY</option>
                <option value="CORRECTION">CORRECTION</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* History Ledger Table */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Transaction Type</th>
                <th className="py-3 px-3 text-right">Quantity Delta</th>
                <th className="py-3 px-4 text-center">Balance Transition</th>
                <th className="py-3 px-3">Reference / Order ID</th>
                <th className="py-3 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Loading ledger transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500">
                    <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-medium text-stone-700">No inventory transactions found</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Stock modifications will automatically generate immutable audit logs here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const positive = isPositiveDelta(tx.transactionType, tx.previousQuantity, tx.newQuantity);
                  return (
                    <tr key={tx.id} className="hover:bg-stone-50/80 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-3 font-medium text-stone-900 max-w-[180px] truncate">
                        {tx.productName}
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-3 font-mono text-stone-600">
                        {tx.productSku}
                      </td>

                      {/* Transaction Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getTypeBadge(tx.transactionType)}
                      </td>

                      {/* Delta Quantity */}
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          positive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {positive ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </td>

                      {/* Balance Transition */}
                      <td className="py-3 px-4 text-center font-mono text-stone-600 whitespace-nowrap">
                        <span>{tx.previousQuantity}</span>
                        <span className="text-stone-400 mx-1.5">&rarr;</span>
                        <span className="font-bold text-stone-900">{tx.newQuantity}</span>
                      </td>

                      {/* Reference ID */}
                      <td className="py-3 px-3 font-mono text-stone-600 whitespace-nowrap">
                        {tx.referenceId ? (
                          tx.referenceId
                        ) : (
                          <span className="text-stone-300 italic">-</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-stone-600 max-w-[200px] truncate">
                        {tx.reason || <span className="text-stone-400 italic">None recorded</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div>
            Showing <span className="font-mono font-medium text-stone-700">{filteredTransactions.length}</span> audit records
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>ACID Transaction Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
};
