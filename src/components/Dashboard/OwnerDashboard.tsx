import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Clock,
  Bell,
  RefreshCw,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  FileText,
  CheckCircle2,
  Calendar,
  Eye,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Coins,
  History,
  Store,
  BarChart3,
} from 'lucide-react';
import { NavTab } from '../Sidebar';
import { Product } from '../../types/product';
import { InventoryItem, InventoryTransactionItem } from '../../types/inventory';
import { SaleDto } from '../../types/sale';
import { PurchaseInvoice } from '../../types/invoice';
import { NotificationItem } from '../../types/notification';

import { fetchAllSales } from '../../api/saleApi';
import { fetchProducts } from '../../api/productApi';
import { fetchAllInventory, fetchInventoryTransactions } from '../../api/inventoryApi';
import { fetchInvoices } from '../../api/invoiceApi';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../api/notificationApi';
import { useAuth } from '../../context/AuthContext';
import { RefundModal } from './RefundModal';

interface OwnerDashboardProps {
  onNavigate?: (tab: NavTab) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onNavigate }) => {
  const { isOwnerOrAdmin } = useAuth();

  // State for all API resources
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionItem[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  // Filter or selection state
  const [selectedSale, setSelectedSale] = useState<SaleDto | null>(null);
  const [refundSale, setRefundSale] = useState<SaleDto | null>(null);
  const [stockFilterTab, setStockFilterTab] = useState<'ALL_ALERTS' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL_ALERTS');

  // Load all dashboard metrics via existing APIs
  const loadDashboardData = useCallback(async (isBackground = false) => {
    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const failedResources: string[] = [];
      const [
        salesData,
        productsData,
        inventoryData,
        txData,
        invoicesData,
        notificationsData,
      ] = await Promise.all([
        fetchAllSales().catch((err) => {
          failedResources.push('sales');
          console.warn('Dashboard notice: sales fetch deferred:', err?.message || err);
          return [] as SaleDto[];
        }),
        fetchProducts().catch((err) => {
          failedResources.push('products');
          console.warn('Dashboard notice: products fetch deferred:', err?.message || err);
          return [] as Product[];
        }),
        fetchAllInventory().catch((err) => {
          failedResources.push('inventory');
          console.warn('Dashboard notice: inventory fetch deferred:', err?.message || err);
          return [] as InventoryItem[];
        }),
        fetchInventoryTransactions().catch((err) => {
          failedResources.push('transactions');
          console.warn('Dashboard notice: transactions fetch deferred:', err?.message || err);
          return [] as InventoryTransactionItem[];
        }),
        fetchInvoices().catch((err) => {
          failedResources.push('invoices');
          console.warn('Dashboard notice: invoices fetch deferred:', err?.message || err);
          return [] as PurchaseInvoice[];
        }),
        fetchNotifications().catch((err) => {
          failedResources.push('notifications');
          console.warn('Dashboard notice: notifications fetch deferred:', err?.message || err);
          return [] as NotificationItem[];
        }),
      ]);

      setSales(salesData);
      setProducts(productsData);
      setInventory(inventoryData);
      setTransactions(txData);
      setInvoices(invoicesData);
      setNotifications(notificationsData);
      setLastRefreshed(new Date());

      if (failedResources.length > 0) {
        setError(`Some dashboard metrics could not be loaded (${failedResources.join(', ')}). Click Refresh to retry.`);
      }
    } catch (err: any) {
      console.warn('Dashboard data load issue:', err?.message || err);
      setError(err?.message || 'Failed to refresh dashboard metrics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch and auto-refresh interval
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);

    const handleDataChange = () => {
      loadDashboardData(true);
    };

    window.addEventListener('inventory-changed', handleDataChange);
    window.addEventListener('notification-refresh', handleDataChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('inventory-changed', handleDataChange);
      window.removeEventListener('notification-refresh', handleDataChange);
    };
  }, [loadDashboardData]);

  // Handle Mark Single Notification As Read
  const handleMarkAsRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      console.warn('Notification read update notice:', err);
    }
  };

  // Handle Mark All Notifications As Read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      console.warn('All notifications read update notice:', err);
    }
  };

  // -------------------------------------------------------------
  // AUTHORITATIVE CALCULATIONS (USING BACKEND-PROVIDED DOMAIN DATA)
  // -------------------------------------------------------------

  // Helper to test if a date string is today
  const isToday = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // 1. Today's Completed Sales & Transactions
  const todaySalesList = useMemo(() => {
    return sales.filter(
      (s) => s.status === 'COMPLETED' && isToday(s.createdAt)
    );
  }, [sales]);

  const todaySalesTotal = useMemo(() => {
    return todaySalesList.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  }, [todaySalesList]);

  const todayTransactionsCount = todaySalesList.length;

  const averageTransactionValue = useMemo(() => {
    if (todayTransactionsCount === 0) return 0;
    return todaySalesTotal / todayTransactionsCount;
  }, [todaySalesTotal, todayTransactionsCount]);

  // 2. Total Products
  const totalProductsCount = useMemo(() => {
    return products.filter((p) => p.active !== false).length;
  }, [products]);

  // 3. Total Inventory Units
  const totalInventoryUnits = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (Number(item.currentQuantity) || 0), 0);
  }, [inventory]);

  // 4. Low-stock products (uses backend-calculated stockStatus directly)
  const lowStockProducts = useMemo(() => {
    return inventory.filter((item) => item.stockStatus === 'LOW STOCK');
  }, [inventory]);

  // 5. Out-of-stock products (uses backend-calculated stockStatus directly)
  const outOfStockProducts = useMemo(() => {
    return inventory.filter((item) => item.stockStatus === 'OUT OF STOCK');
  }, [inventory]);

  // 6. Inventory Valuation (Total Inventory Value)
  const productPriceMap = useMemo(() => {
    const map = new Map<number, { purchasePrice: number; sellingPrice: number }>();
    products.forEach((p) => {
      map.set(p.id, {
        purchasePrice: Number(p.purchasePrice) || 0,
        sellingPrice: Number(p.sellingPrice) || 0,
      });
    });
    return map;
  }, [products]);

  const inventoryValueCost = useMemo(() => {
    return inventory.reduce((total, item) => {
      const prices = productPriceMap.get(item.productId);
      const cost = prices?.purchasePrice ?? 0;
      return total + item.currentQuantity * cost;
    }, 0);
  }, [inventory, productPriceMap]);

  const inventoryValueRetail = useMemo(() => {
    return inventory.reduce((total, item) => {
      const prices = productPriceMap.get(item.productId);
      const retail = prices?.sellingPrice ?? 0;
      return total + item.currentQuantity * retail;
    }, 0);
  }, [inventory, productPriceMap]);

  // 7. Pending Invoices (Invoices awaiting review, OCR, or explicit confirmation)
  const pendingInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.status === 'UPLOADED' || inv.status === 'PROCESSED'
    );
  }, [invoices]);

  // 8. Recent Sales (Sorted newest first)
  const recentSalesList = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [sales]);

  // 9. Recent Inventory Activity (Sorted newest first)
  const recentTransactionsList = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [transactions]);

  // 10. Unread Notifications
  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  // Stock alert items for the watchlist widget
  const stockAlerts = useMemo(() => {
    if (stockFilterTab === 'LOW_STOCK') return lowStockProducts;
    if (stockFilterTab === 'OUT_OF_STOCK') return outOfStockProducts;
    return [...outOfStockProducts, ...lowStockProducts];
  }, [stockFilterTab, lowStockProducts, outOfStockProducts]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* DASHBOARD TOP HEADER & QUICK ACTIONS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <Store className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              Owner / Admin Dashboard
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live POS Store
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Store performance overview, inventory valuations, stock alerts, and audit logs.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="text-right hidden lg:block mr-2 text-[11px] text-stone-400">
            <span>Last synced: </span>
            <span className="font-mono text-stone-600 font-medium">
              {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>

          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing || loading}
            className="px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh dashboard metrics"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-emerald-600' : 'text-stone-500'}`}
            />
            <span>Refresh</span>
          </button>

          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('reports')}
                className="px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-300"
              >
                <BarChart3 className="w-3.5 h-3.5 text-stone-600" />
                <span>Reports & CSV</span>
              </button>

              <button
                onClick={() => onNavigate('pos')}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>New POS Sale</span>
              </button>

              <button
                onClick={() => onNavigate('invoices')}
                className="px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Review Invoices</span>
                {pendingInvoices.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] flex items-center justify-center">
                    {pendingInvoices.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error notification banner if any API failed */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="underline font-semibold hover:text-rose-900 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ROW 1: PRIMARY KPI STAT METRICS CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: TODAY'S SALES & TRANSACTIONS */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Today's Sales
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  ${todaySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span className="flex items-center gap-1 font-medium text-stone-700">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{todayTransactionsCount} transactions</span>
            </span>
            <span className="font-mono text-stone-500 text-[11px]">
              Avg: ${averageTransactionValue.toFixed(2)}/sale
            </span>
          </div>
        </div>

        {/* KPI 2: TOTAL PRODUCTS & CATALOG */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Products
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {totalProductsCount}
                </span>
                <span className="text-xs text-stone-500 font-medium">active items</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500">Catalog status:</span>
            {onNavigate ? (
              <button
                onClick={() => onNavigate('products')}
                className="text-blue-600 hover:text-blue-700 font-medium text-[11px] flex items-center gap-1 cursor-pointer hover:underline"
              >
                <span>Manage Catalog</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-emerald-700 font-medium">All active</span>
            )}
          </div>
        </div>

        {/* KPI 3: TOTAL INVENTORY & INVENTORY VALUE */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs relative overflow-hidden group hover:border-purple-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Inventory
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {totalInventoryUnits.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs text-stone-500 font-medium">units</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span className="text-[11px] text-stone-500 font-medium">Inventory Value:</span>
            <span className="font-mono font-bold text-stone-900 text-xs" title="Valuation at purchase cost">
              ${inventoryValueCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] text-stone-400 font-normal ml-0.5">cost</span>
            </span>
          </div>
        </div>

        {/* KPI 4: STOCK HEALTH (LOW & OUT OF STOCK) */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Stock Alerts
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${outOfStockProducts.length > 0 ? 'text-rose-600' : lowStockProducts.length > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                  {outOfStockProducts.length + lowStockProducts.length}
                </span>
                <span className="text-xs text-stone-500 font-medium">alerts requiring review</span>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              outOfStockProducts.length > 0
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : lowStockProducts.length > 0
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {outOfStockProducts.length > 0 ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${lowStockProducts.length > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
                {lowStockProducts.length} Low
              </span>
              <span className="text-stone-300">·</span>
              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${outOfStockProducts.length > 0 ? 'text-rose-700' : 'text-stone-400'}`}>
                {outOfStockProducts.length} Out
              </span>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('inventory')}
                className="text-stone-700 hover:text-emerald-700 font-medium text-[11px] flex items-center gap-0.5 cursor-pointer hover:underline"
              >
                <span>Stock</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 2: SECONDARY OPERATIONAL CARDS (INVENTORY VALUATION & PENDING INVOICES) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* INVENTORY VALUATION BREAKDOWN */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <Coins className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                Inventory Valuation
              </h3>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Live Cost</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-100">
              <span className="text-stone-600 font-medium">Cost Basis Value:</span>
              <span className="font-mono font-bold text-stone-900 text-sm">
                ${inventoryValueCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-100">
              <span className="text-stone-600 font-medium">Retail Valuation:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                ${inventoryValueRetail.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-stone-500">
              <span>Potential Margin:</span>
              <span className="font-mono font-semibold text-emerald-600">
                +${(inventoryValueRetail - inventoryValueCost).toFixed(2)}
                {inventoryValueCost > 0 && (
                  <span className="text-[10px] text-stone-400 ml-1">
                    ({(((inventoryValueRetail - inventoryValueCost) / inventoryValueCost) * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* PENDING INVOICES SUMMARY */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                Pending Invoices
              </h3>
            </div>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              {pendingInvoices.length} Pending
            </span>
          </div>

          {pendingInvoices.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-stone-200 rounded-lg text-stone-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <span>All invoices processed and confirmed!</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-stone-600">
                <strong>{pendingInvoices.length} invoice(s)</strong> awaiting OCR review and confirmation into inventory.
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {pendingInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-2 rounded border border-stone-200 bg-stone-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-stone-800 text-[11px]">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate max-w-[140px]">
                        {inv.originalFilename}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      inv.status === 'PROCESSED'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('invoices')}
                  className="w-full mt-1 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                >
                  Go to Invoice Review &rarr;
                </button>
              )}
            </div>
          )}
        </div>

        {/* UNREAD NOTIFICATIONS WIDGET */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <Bell className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                Unread Notifications
              </h3>
            </div>
            {unreadNotifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-stone-500 hover:text-stone-800 underline font-medium cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {unreadNotifications.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-stone-200 rounded-lg text-stone-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <span>No unread stock notifications</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {unreadNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-2 rounded border text-xs flex items-start justify-between gap-2 ${
                    notif.severity === 'CRITICAL'
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : notif.severity === 'WARNING'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-stone-50 border-stone-200 text-stone-800'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[11px] flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${notif.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-amber-600'}`} />
                      <span>{notif.productName || 'Stock Alert'}</span>
                    </div>
                    <div className="text-[10px] leading-tight text-stone-600 line-clamp-2">
                      {notif.message}
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="shrink-0 text-[10px] text-stone-500 hover:text-stone-900 underline font-medium cursor-pointer"
                    title="Mark read"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 3: TWO-COLUMN SECTION */}
      {/* LEFT: RECENT SALES & RECENT INVENTORY ACTIVITY */}
      {/* RIGHT: LOW-STOCK & OUT-OF-STOCK PRODUCTS WATCHLIST */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: OPERATIONAL ACTIVITY (2 SPANS) */}
        <div className="lg:col-span-2 space-y-6">
          {/* RECENT SALES TABLE */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                  Recent Sales
                </h2>
                <span className="text-[11px] font-mono text-stone-400">({sales.length} total)</span>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('pos')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Open POS</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {recentSalesList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="font-medium text-stone-600">No completed sales recorded yet</p>
                <p className="text-stone-400 text-[11px] mt-0.5">Use the POS Terminal to ring up cart transactions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Receipt #</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Items</th>
                      <th className="py-2.5 px-4 text-right">Total Amount</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recentSalesList.map((sale) => (
                      <tr key={sale.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-stone-900">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-3 px-4 text-stone-500 text-[11px]">
                          {new Date(sale.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          <span className="text-[10px] text-stone-400 ml-1">
                            ({new Date(sale.createdAt).toLocaleDateString()})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          <span className="font-semibold text-stone-800">
                            {sale.itemCount || sale.items?.length || 1}
                          </span>{' '}
                          item(s)
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-900 text-right text-sm">
                          ${Number(sale.totalAmount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {sale.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedSale(sale)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              View Items
                            </button>
                            {(sale.status === 'COMPLETED' || sale.refundStatus === 'PARTIAL') && isOwnerOrAdmin && (
                              <button
                                onClick={() => setRefundSale(sale)}
                                className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-200 transition-colors cursor-pointer"
                                title="Request Stripe refund"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RECENT INVENTORY ACTIVITY AUDIT LOG */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-purple-700" />
                <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                  Recent Inventory Activity
                </h2>
                <span className="text-[11px] font-mono text-stone-400">
                  (Stock Ledger Audit)
                </span>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Inventory Ledger</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {recentTransactionsList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="font-medium text-stone-600">No inventory movements recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Product / SKU</th>
                      <th className="py-2.5 px-4 text-right">Delta Qty</th>
                      <th className="py-2.5 px-4 text-right">Balance</th>
                      <th className="py-2.5 px-4">Reason / Reference</th>
                      <th className="py-2.5 px-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recentTransactionsList.map((tx) => {
                      const isAddition = tx.quantity > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.transactionType === 'PURCHASE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : tx.transactionType === 'SALE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : tx.transactionType === 'DAMAGE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {tx.transactionType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900 truncate max-w-[180px]">
                              {tx.productName}
                            </div>
                            <div className="font-mono text-[10px] text-stone-400">
                              {tx.productSku}
                            </div>
                          </td>
                          <td
                            className={`py-3 px-4 font-mono font-bold text-right text-xs ${
                              isAddition ? 'text-emerald-700' : 'text-stone-700'
                            }`}
                          >
                            {isAddition ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="py-3 px-4 font-mono text-right text-stone-500 text-[11px]">
                            {tx.newQuantity}
                          </td>
                          <td className="py-3 px-4 text-stone-600 text-[11px] max-w-[200px] truncate">
                            {tx.reason || tx.referenceId || 'Manual update'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-stone-400 text-right">
                            {new Date(tx.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CRITICAL STOCK WATCHLIST (LOW & OUT OF STOCK) */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-stone-200 bg-stone-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                    Stock Alerts Watchlist
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {outOfStockProducts.length + lowStockProducts.length} items
                </span>
              </div>

              {/* Watchlist Filter Pills */}
              <div className="flex items-center gap-1 mt-3">
                <button
                  onClick={() => setStockFilterTab('ALL_ALERTS')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    stockFilterTab === 'ALL_ALERTS'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-200/60 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  All ({outOfStockProducts.length + lowStockProducts.length})
                </button>
                <button
                  onClick={() => setStockFilterTab('OUT_OF_STOCK')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    stockFilterTab === 'OUT_OF_STOCK'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Out of Stock ({outOfStockProducts.length})
                </button>
                <button
                  onClick={() => setStockFilterTab('LOW_STOCK')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    stockFilterTab === 'LOW_STOCK'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Low Stock ({lowStockProducts.length})
                </button>
              </div>
            </div>

            {stockAlerts.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-stone-700">Healthy Stock Levels!</p>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  No products currently below their minimum thresholds.
                </p>
              </div>
            ) : (
              <div className="p-3 divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
                {stockAlerts.map((item) => {
                  const isOut = item.stockStatus === 'OUT OF STOCK';
                  return (
                    <div key={item.id} className="py-3 first:pt-1 last:pb-1 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-stone-900">{item.productName}</div>
                          <div className="text-[10px] font-mono text-stone-400">
                            SKU: {item.productSku}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isOut
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.stockStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <div>
                          On Hand:{' '}
                          <strong className={isOut ? 'text-rose-600 font-mono' : 'text-amber-700 font-mono'}>
                            {item.currentQuantity} {item.unit}
                          </strong>
                          <span className="text-stone-400 text-[10px] ml-1">
                            (Min: {item.minimumInventoryThreshold} {item.unit})
                          </span>
                        </div>

                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('inventory')}
                            className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] hover:underline cursor-pointer"
                          >
                            Restock &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SALE ITEMS BREAKDOWN MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 animate-fadeIn">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Receipt #{selectedSale.receiptNumber}</span>
                </h3>
                <span className="text-[11px] text-stone-400">
                  {new Date(selectedSale.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-stone-400 hover:text-white cursor-pointer text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Purchased Line Items
              </div>
              <div className="divide-y divide-stone-100">
                {selectedSale.items?.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-stone-800">{item.productName}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        SKU: {item.productSku} · Qty: {item.quantity} {item.unit || ''} @ ${Number(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-stone-900 text-right">
                      ${Number(item.totalAmount ?? item.subtotal).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-1 text-xs">
                <div className="flex items-center justify-between text-stone-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">${Number(selectedSale.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-stone-500">
                  <span>Tax:</span>
                  <span className="font-mono">${Number(selectedSale.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-100">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono text-emerald-700">
                    ${Number(selectedSale.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              {(selectedSale.status === 'COMPLETED' || selectedSale.refundStatus === 'PARTIAL') && isOwnerOrAdmin ? (
                <button
                  onClick={() => {
                    setRefundSale(selectedSale);
                    setSelectedSale(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Request Stripe Refund
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authorized Stripe Card Refund Modal */}
      {refundSale && (
        <RefundModal
          sale={refundSale}
          onClose={() => setRefundSale(null)}
          onRefundSuccess={() => {
            loadDashboardData(true);
          }}
        />
      )}
    </div>
  );
};
