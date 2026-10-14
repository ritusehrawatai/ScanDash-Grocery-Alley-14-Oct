import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Truck,
  Sliders,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { NavTab } from '../Sidebar';
import { SaleDto } from '../../types/sale';
import { Product } from '../../types/product';
import { InventoryItem, InventoryTransactionItem } from '../../types/inventory';
import { PurchaseInvoice } from '../../types/invoice';

import { fetchAllSales } from '../../api/saleApi';
import { fetchProducts } from '../../api/productApi';
import { fetchAllInventory, fetchInventoryTransactions } from '../../api/inventoryApi';
import { fetchInvoices } from '../../api/invoiceApi';
import { exportToCsv } from '../../utils/csvExport';

type MainReportType = 'SALES' | 'INVENTORY';
type SalesReportSubtype = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PRODUCT';
type InventoryReportSubtype =
  | 'CURRENT'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'VALUATION'
  | 'PURCHASES'
  | 'ADJUSTMENTS';

interface ReportsViewProps {
  onNavigate?: (tab: NavTab) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNavigate }) => {
  // Main Navigation State
  const [mainTab, setMainTab] = useState<MainReportType>('SALES');
  const [salesSubtype, setSalesSubtype] = useState<SalesReportSubtype>('DAILY');
  const [inventorySubtype, setInventorySubtype] = useState<InventoryReportSubtype>('CURRENT');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH'>('ALL');

  // Data Stores
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionItem[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);

  // Loading & State
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Load all foundational data via existing APIs
  const loadReportData = useCallback(async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [salesData, productsData, invData, txData, invoicesData] = await Promise.all([
        fetchAllSales().catch(() => [] as SaleDto[]),
        fetchProducts().catch(() => [] as Product[]),
        fetchAllInventory().catch(() => [] as InventoryItem[]),
        fetchInventoryTransactions().catch(() => [] as InventoryTransactionItem[]),
        fetchInvoices().catch(() => [] as PurchaseInvoice[]),
      ]);

      setSales(salesData);
      setProducts(productsData);
      setInventory(invData);
      setTransactions(txData);
      setInvoices(invoicesData);
    } catch (err) {
      console.error('Failed to load reporting data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Flash export success message
  const triggerExportSuccess = (filename: string) => {
    setExportSuccessMsg(`Successfully exported ${filename}`);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // Map product details by ID for fast lookup
  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    return sales.filter((s) => {
      if (s.status !== 'COMPLETED') return false;
      const saleDate = new Date(s.createdAt);

      if (dateRangeFilter === 'LAST_7') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return saleDate >= sevenDaysAgo;
      }
      if (dateRangeFilter === 'LAST_30') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return saleDate >= thirtyDaysAgo;
      }
      if (dateRangeFilter === 'THIS_MONTH') {
        return (
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [sales, dateRangeFilter]);

  // =========================================================================
  // 1. SALES REPORT CALCULATIONS
  // =========================================================================

  // Daily Sales Aggregation
  const dailySales = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        timestamp: number;
        transactionCount: number;
        itemsSoldCount: number;
        revenue: number;
      }
    >();

    filteredSales.forEach((sale) => {
      const d = new Date(sale.createdAt);
      const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = map.get(dateKey) || {
        date: dateKey,
        timestamp: new Date(dateKey).getTime(),
        transactionCount: 0,
        itemsSoldCount: 0,
        revenue: 0,
      };

      const saleItemsCount = sale.items?.reduce((cnt, it) => cnt + it.quantity, 0) || sale.itemCount || 1;
      existing.transactionCount += 1;
      existing.itemsSoldCount += Number(saleItemsCount);
      existing.revenue += Number(sale.totalAmount) || 0;
      map.set(dateKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredSales]);

  // Weekly Sales Aggregation
  const weeklySales = useMemo(() => {
    const map = new Map<
      string,
      {
        weekKey: string;
        weekLabel: string;
        timestamp: number;
        transactionCount: number;
        itemsSoldCount: number;
        revenue: number;
      }
    >();

    filteredSales.forEach((sale) => {
      const d = new Date(sale.createdAt);
      // Determine Monday of the week
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const weekKey = `${monday.getFullYear()}-W${Math.ceil((monday.getDate() + (monday.getMonth() * 30)) / 7)}`;
      const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      const existing = map.get(weekKey) || {
        weekKey,
        weekLabel,
        timestamp: monday.getTime(),
        transactionCount: 0,
        itemsSoldCount: 0,
        revenue: 0,
      };

      const saleItemsCount = sale.items?.reduce((cnt, it) => cnt + it.quantity, 0) || sale.itemCount || 1;
      existing.transactionCount += 1;
      existing.itemsSoldCount += Number(saleItemsCount);
      existing.revenue += Number(sale.totalAmount) || 0;
      map.set(weekKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredSales]);

  // Monthly Sales Aggregation
  const monthlySales = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        timestamp: number;
        transactionCount: number;
        itemsSoldCount: number;
        revenue: number;
      }
    >();

    filteredSales.forEach((sale) => {
      const d = new Date(sale.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

      const existing = map.get(monthKey) || {
        monthKey,
        monthLabel,
        timestamp: firstOfMonth,
        transactionCount: 0,
        itemsSoldCount: 0,
        revenue: 0,
      };

      const saleItemsCount = sale.items?.reduce((cnt, it) => cnt + it.quantity, 0) || sale.itemCount || 1;
      existing.transactionCount += 1;
      existing.itemsSoldCount += Number(saleItemsCount);
      existing.revenue += Number(sale.totalAmount) || 0;
      map.set(monthKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredSales]);

  // Product Sales Aggregation
  const productSales = useMemo(() => {
    const map = new Map<
      number,
      {
        productId: number;
        productName: string;
        sku: string;
        categoryName: string;
        unit: string;
        unitsSold: number;
        transactionAppearances: number;
        revenue: number;
        unitPriceAvg: number;
      }
    >();

    let totalRevenueSum = 0;

    filteredSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        const prod = productMap.get(item.productId);
        const qty = Number(item.quantity) || 0;
        const lineRev = Number(item.totalAmount ?? item.subtotal) || 0;
        totalRevenueSum += lineRev;

        const existing = map.get(item.productId) || {
          productId: item.productId,
          productName: item.productName || prod?.name || `Product #${item.productId}`,
          sku: item.productSku || prod?.sku || 'N/A',
          categoryName: prod?.categoryName || 'General',
          unit: item.unit || prod?.unit || 'PCS',
          unitsSold: 0,
          transactionAppearances: 0,
          revenue: 0,
          unitPriceAvg: Number(item.unitPrice) || Number(prod?.sellingPrice) || 0,
        };

        existing.unitsSold += qty;
        existing.transactionAppearances += 1;
        existing.revenue += lineRev;
        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values())
      .map((p) => ({
        ...p,
        revenueSharePercent: totalRevenueSum > 0 ? (p.revenue / totalRevenueSum) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, productMap]);

  // Overall Sales KPI Totals
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
  }, [filteredSales]);

  const totalTransactionsCount = filteredSales.length;

  const totalItemsSold = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const itemsCount = s.items?.reduce((cnt, it) => cnt + it.quantity, 0) || s.itemCount || 1;
      return acc + itemsCount;
    }, 0);
  }, [filteredSales]);

  const averageTransactionValue = totalTransactionsCount > 0 ? totalSalesRevenue / totalTransactionsCount : 0;

  // =========================================================================
  // 2. INVENTORY REPORT CALCULATIONS
  // =========================================================================

  // Enriched Current Inventory items
  const enrichedInventory = useMemo(() => {
    return inventory.map((inv) => {
      const prod = productMap.get(inv.productId);
      const costPrice = Number(prod?.purchasePrice) || 0;
      const sellingPrice = Number(prod?.sellingPrice) || 0;
      const currentQty = Number(inv.currentQuantity) || 0;
      const totalCostValue = currentQty * costPrice;
      const totalRetailValue = currentQty * sellingPrice;

      return {
        ...inv,
        costPrice,
        sellingPrice,
        categoryName: prod?.categoryName || 'General',
        supplierName: prod?.supplierName || 'Primary Supplier',
        totalCostValue,
        totalRetailValue,
      };
    });
  }, [inventory, productMap]);

  // Low Stock Items
  const lowStockItems = useMemo(() => {
    return enrichedInventory.filter((it) => it.stockStatus === 'LOW STOCK');
  }, [enrichedInventory]);

  // Out of Stock Items
  const outOfStockItems = useMemo(() => {
    return enrichedInventory.filter((it) => it.stockStatus === 'OUT OF STOCK');
  }, [enrichedInventory]);

  // Inventory Valuation by Category
  const categoryValuation = useMemo(() => {
    const map = new Map<
      string,
      {
        categoryName: string;
        itemCount: number;
        totalUnits: number;
        costValuation: number;
        retailValuation: number;
      }
    >();

    enrichedInventory.forEach((it) => {
      const cat = it.categoryName || 'General';
      const existing = map.get(cat) || {
        categoryName: cat,
        itemCount: 0,
        totalUnits: 0,
        costValuation: 0,
        retailValuation: 0,
      };

      existing.itemCount += 1;
      existing.totalUnits += it.currentQuantity;
      existing.costValuation += it.totalCostValue;
      existing.retailValuation += it.totalRetailValue;
      map.set(cat, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.costValuation - a.costValuation);
  }, [enrichedInventory]);

  const totalInventoryUnits = useMemo(() => {
    return enrichedInventory.reduce((acc, it) => acc + it.currentQuantity, 0);
  }, [enrichedInventory]);

  const totalCostValuation = useMemo(() => {
    return enrichedInventory.reduce((acc, it) => acc + it.totalCostValue, 0);
  }, [enrichedInventory]);

  const totalRetailValuation = useMemo(() => {
    return enrichedInventory.reduce((acc, it) => acc + it.totalRetailValue, 0);
  }, [enrichedInventory]);

  // Purchases Report (from inventory transaction store where type === 'PURCHASE')
  const purchasesTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.transactionType === 'PURCHASE')
      .map((tx) => {
        const prod = productMap.get(tx.productId);
        const costPrice = Number(prod?.purchasePrice) || 0;
        const totalPurchaseCost = Number(tx.quantity) * costPrice;
        return {
          ...tx,
          costPrice,
          totalPurchaseCost,
          supplierName: prod?.supplierName || 'Supplier Delivery',
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, productMap]);

  // Inventory Adjustments Report (from inventory transaction store where type !== 'SALE' && type !== 'PURCHASE')
  const adjustmentsTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.transactionType !== 'PURCHASE' && tx.transactionType !== 'SALE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions]);

  // =========================================================================
  // 3. CSV EXPORT HANDLERS
  // =========================================================================

  const handleExportCsv = () => {
    const timestampStr = new Date().toISOString().split('T')[0];

    if (mainTab === 'SALES') {
      if (salesSubtype === 'DAILY') {
        const headers = ['Date', 'Transactions Count', 'Items Sold', 'Revenue ($)', 'Average Transaction Value ($)'];
        const rows = dailySales.map((d) => [
          d.date,
          d.transactionCount,
          d.itemsSoldCount,
          d.revenue.toFixed(2),
          d.transactionCount > 0 ? (d.revenue / d.transactionCount).toFixed(2) : '0.00',
        ]);
        const filename = `daily_sales_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (salesSubtype === 'WEEKLY') {
        const headers = ['Week Period', 'Transactions Count', 'Items Sold', 'Revenue ($)', 'Average Transaction Value ($)'];
        const rows = weeklySales.map((w) => [
          w.weekLabel,
          w.transactionCount,
          w.itemsSoldCount,
          w.revenue.toFixed(2),
          w.transactionCount > 0 ? (w.revenue / w.transactionCount).toFixed(2) : '0.00',
        ]);
        const filename = `weekly_sales_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (salesSubtype === 'MONTHLY') {
        const headers = ['Month', 'Transactions Count', 'Items Sold', 'Revenue ($)', 'Average Transaction Value ($)'];
        const rows = monthlySales.map((m) => [
          m.monthLabel,
          m.transactionCount,
          m.itemsSoldCount,
          m.revenue.toFixed(2),
          m.transactionCount > 0 ? (m.revenue / m.transactionCount).toFixed(2) : '0.00',
        ]);
        const filename = `monthly_sales_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (salesSubtype === 'PRODUCT') {
        const headers = ['SKU', 'Product Name', 'Category', 'Unit', 'Units Sold', 'Orders Count', 'Total Revenue ($)', 'Revenue Share (%)', 'Avg Unit Price ($)'];
        const rows = productSales.map((p) => [
          p.sku,
          p.productName,
          p.categoryName,
          p.unit,
          p.unitsSold,
          p.transactionAppearances,
          p.revenue.toFixed(2),
          p.revenueSharePercent.toFixed(1),
          p.unitPriceAvg.toFixed(2),
        ]);
        const filename = `product_sales_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      }
    } else {
      // INVENTORY EXPORTS
      if (inventorySubtype === 'CURRENT') {
        const headers = ['SKU', 'Product Name', 'Category', 'Unit', 'On Hand Qty', 'Min Threshold', 'Status', 'Unit Cost ($)', 'Selling Price ($)', 'Cost Valuation ($)', 'Retail Valuation ($)'];
        const rows = enrichedInventory.map((i) => [
          i.productSku,
          i.productName,
          i.categoryName,
          i.unit,
          i.currentQuantity,
          i.minimumInventoryThreshold,
          i.stockStatus,
          i.costPrice.toFixed(2),
          i.sellingPrice.toFixed(2),
          i.totalCostValue.toFixed(2),
          i.totalRetailValue.toFixed(2),
        ]);
        const filename = `current_inventory_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (inventorySubtype === 'LOW_STOCK') {
        const headers = ['SKU', 'Product Name', 'Category', 'Current Qty', 'Min Threshold', 'Deficit to Reorder', 'Status', 'Supplier', 'Estimated Unit Cost ($)', 'Estimated Reorder Total ($)'];
        const rows = lowStockItems.map((i) => {
          const deficit = Math.max(0, i.minimumInventoryThreshold - i.currentQuantity);
          return [
            i.productSku,
            i.productName,
            i.categoryName,
            i.currentQuantity,
            i.minimumInventoryThreshold,
            deficit,
            i.stockStatus,
            i.supplierName,
            i.costPrice.toFixed(2),
            (deficit * i.costPrice).toFixed(2),
          ];
        });
        const filename = `low_stock_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (inventorySubtype === 'OUT_OF_STOCK') {
        const headers = ['SKU', 'Product Name', 'Category', 'Current Qty', 'Min Threshold', 'Status', 'Supplier', 'Estimated Unit Cost ($)', 'Estimated Restock Budget ($)'];
        const rows = outOfStockItems.map((i) => [
          i.productSku,
          i.productName,
          i.categoryName,
          i.currentQuantity,
          i.minimumInventoryThreshold,
          i.stockStatus,
          i.supplierName,
          i.costPrice.toFixed(2),
          (i.minimumInventoryThreshold * i.costPrice).toFixed(2),
        ]);
        const filename = `out_of_stock_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (inventorySubtype === 'VALUATION') {
        const headers = ['Category', 'Product Items Count', 'Total Units', 'Total Cost Valuation ($)', 'Total Retail Valuation ($)', 'Unrealized Margin ($)', 'Margin Markup (%)'];
        const rows = categoryValuation.map((c) => {
          const margin = c.retailValuation - c.costValuation;
          const markupPct = c.costValuation > 0 ? (margin / c.costValuation) * 100 : 0;
          return [
            c.categoryName,
            c.itemCount,
            c.totalUnits,
            c.costValuation.toFixed(2),
            c.retailValuation.toFixed(2),
            margin.toFixed(2),
            markupPct.toFixed(1),
          ];
        });
        const filename = `inventory_valuation_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (inventorySubtype === 'PURCHASES') {
        const headers = ['Date', 'Reference ID', 'SKU', 'Product Name', 'Qty Received', 'Unit Cost ($)', 'Total Value ($)', 'Supplier', 'New Stock Balance'];
        const rows = purchasesTransactions.map((p) => [
          new Date(p.createdAt).toISOString().split('T')[0],
          p.referenceId || `PO-${p.id}`,
          p.productSku,
          p.productName,
          p.quantity,
          p.costPrice.toFixed(2),
          p.totalPurchaseCost.toFixed(2),
          p.supplierName,
          p.newQuantity,
        ]);
        const filename = `purchases_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      } else if (inventorySubtype === 'ADJUSTMENTS') {
        const headers = ['Date', 'Adjustment Type', 'SKU', 'Product Name', 'Quantity Delta', 'Previous Qty', 'New Balance', 'Reason / Notes'];
        const rows = adjustmentsTransactions.map((a) => [
          new Date(a.createdAt).toISOString().split('T')[0],
          a.transactionType,
          a.productSku,
          a.productName,
          a.quantity,
          a.previousQuantity,
          a.newQuantity,
          a.reason || 'Manual inventory correction',
        ]);
        const filename = `inventory_adjustments_report_${timestampStr}.csv`;
        exportToCsv(filename, headers, rows);
        triggerExportSuccess(filename);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER & CONTROLS */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              Reports & Business Intelligence
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              Native Export
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Comprehensive sales and inventory performance reporting with CSV data export.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => loadReportData(true)}
            disabled={isRefreshing || loading}
            className="px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh reports data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-emerald-600' : 'text-stone-500'}`}
            />
            <span>Refresh</span>
          </button>

          {/* MAIN CSV EXPORT BUTTON */}
          <button
            onClick={handleExportCsv}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      {/* Export notification toast */}
      {exportSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{exportSuccessMsg}</span>
          </div>
          <button
            onClick={() => setExportSuccessMsg(null)}
            className="text-stone-400 hover:text-stone-600 text-sm cursor-pointer ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* PRIMARY TAB SELECTOR: SALES REPORTS vs INVENTORY REPORTS */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white border border-stone-200 rounded-xl p-2 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMainTab('SALES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'SALES'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Sales Reports</span>
          </button>

          <button
            onClick={() => setMainTab('INVENTORY')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainTab === 'INVENTORY'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory Reports</span>
          </button>
        </div>

        {/* Date Filter (for sales reports) or general indicator */}
        {mainTab === 'SALES' && (
          <div className="flex items-center gap-1.5 text-xs text-stone-500 pr-2">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[11px] font-medium hidden sm:inline">Range:</span>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as any)}
              className="bg-stone-50 border border-stone-300 rounded px-2 py-1 text-xs text-stone-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Recorded Time</option>
              <option value="LAST_7">Last 7 Days</option>
              <option value="LAST_30">Last 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 1. SALES REPORTS SECTION */}
      {/* ------------------------------------------------------------------- */}
      {mainTab === 'SALES' && (
        <div className="space-y-6">
          {/* Sub-tabs for Sales Reports: Daily, Weekly, Monthly, Product Sales */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
            {[
              { id: 'DAILY', label: 'Daily Sales', icon: Calendar },
              { id: 'WEEKLY', label: 'Weekly Sales', icon: BarChart3 },
              { id: 'MONTHLY', label: 'Monthly Sales', icon: FileSpreadsheet },
              { id: 'PRODUCT', label: 'Product Sales Breakdown', icon: Package },
            ].map((sub) => {
              const Icon = sub.icon;
              const isActive = salesSubtype === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSalesSubtype(sub.id as SalesReportSubtype)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sales Summary KPI Cards: Revenue, Transaction Count, Items Sold, Avg Order Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-emerald-700">
                  ${totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Gross completed sales revenue</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Transaction Count
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {totalTransactionsCount}
                </span>
                <span className="text-xs text-stone-500 font-medium">orders</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Completed POS customer receipts</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Items Sold
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {totalItemsSold.toFixed(1)}
                </span>
                <span className="text-xs text-stone-500 font-medium">units</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Physical units dispensed to customers</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Avg Transaction Value
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  ${averageTransactionValue.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Average ticket size per receipt</div>
            </div>
          </div>

          {/* TABLE: DAILY SALES */}
          {salesSubtype === 'DAILY' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Daily Sales Report</h3>
                  <p className="text-[11px] text-stone-500">Breakdown of store revenue and volume per day</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {dailySales.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No daily sales recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4 text-center">Transactions</th>
                        <th className="py-2.5 px-4 text-right">Items Sold</th>
                        <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                        <th className="py-2.5 px-4 text-right">Avg Order Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {dailySales.map((d) => (
                        <tr key={d.date} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-stone-900">
                            {d.date}
                            <span className="text-[10px] font-normal text-stone-500 ml-2">
                              ({new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' })})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-stone-800">
                            {d.transactionCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-700">
                            {d.itemsSoldCount.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${d.revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            ${(d.revenue / d.transactionCount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: WEEKLY SALES */}
          {salesSubtype === 'WEEKLY' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Weekly Sales Report</h3>
                  <p className="text-[11px] text-stone-500">Weekly revenue trends and transaction volume</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {weeklySales.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No weekly sales recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Week Range</th>
                        <th className="py-2.5 px-4 text-center">Transactions</th>
                        <th className="py-2.5 px-4 text-right">Items Sold</th>
                        <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                        <th className="py-2.5 px-4 text-right">Avg Order Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {weeklySales.map((w) => (
                        <tr key={w.weekKey} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-stone-900">
                            {w.weekLabel}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-stone-800">
                            {w.transactionCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-700">
                            {w.itemsSoldCount.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${w.revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            ${(w.revenue / w.transactionCount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: MONTHLY SALES */}
          {salesSubtype === 'MONTHLY' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Monthly Sales Report</h3>
                  <p className="text-[11px] text-stone-500">Month-over-month revenue performance and transaction counts</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {monthlySales.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No monthly sales recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Month</th>
                        <th className="py-2.5 px-4 text-center">Transactions</th>
                        <th className="py-2.5 px-4 text-right">Items Sold</th>
                        <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                        <th className="py-2.5 px-4 text-right">Avg Order Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {monthlySales.map((m) => (
                        <tr key={m.monthKey} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-stone-900">
                            {m.monthLabel}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-stone-800">
                            {m.transactionCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-700">
                            {m.itemsSoldCount.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${m.revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            ${(m.revenue / m.transactionCount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: PRODUCT SALES BREAKDOWN */}
          {salesSubtype === 'PRODUCT' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Product Sales Report</h3>
                  <p className="text-[11px] text-stone-500">Sales volume and revenue generated per product</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {productSales.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No product sales recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Units Sold</th>
                        <th className="py-2.5 px-4 text-center">Receipts Count</th>
                        <th className="py-2.5 px-4 text-right">Total Revenue</th>
                        <th className="py-2.5 px-4 text-right">Share of Sales</th>
                        <th className="py-2.5 px-4 text-right">Avg Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {productSales.map((p) => (
                        <tr key={p.productId} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900">{p.productName}</div>
                            <div className="font-mono text-[10px] text-stone-400">{p.sku}</div>
                          </td>
                          <td className="py-3 px-4 text-stone-600">
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px]">
                              {p.categoryName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                            {p.unitsSold.toFixed(1)} {p.unit}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-stone-700">
                            {p.transactionAppearances}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${p.revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                              <span className="text-stone-700 font-medium">{p.revenueSharePercent.toFixed(1)}%</span>
                              <div className="w-12 bg-stone-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full"
                                  style={{ width: `${Math.min(100, p.revenueSharePercent)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            ${p.unitPriceAvg.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. INVENTORY REPORTS SECTION */}
      {/* ------------------------------------------------------------------- */}
      {mainTab === 'INVENTORY' && (
        <div className="space-y-6">
          {/* Sub-tabs for Inventory Reports */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
            {[
              { id: 'CURRENT', label: 'Current Inventory', icon: Boxes },
              { id: 'LOW_STOCK', label: `Low-Stock Products (${lowStockItems.length})`, icon: AlertTriangle },
              { id: 'OUT_OF_STOCK', label: `Out-of-Stock Products (${outOfStockItems.length})`, icon: XCircle },
              { id: 'VALUATION', label: 'Inventory Valuation', icon: DollarSign },
              { id: 'PURCHASES', label: 'Purchases Audit', icon: Truck },
              { id: 'ADJUSTMENTS', label: 'Inventory Adjustments', icon: Sliders },
            ].map((sub) => {
              const Icon = sub.icon;
              const isActive = inventorySubtype === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setInventorySubtype(sub.id as InventoryReportSubtype)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-purple-50 text-purple-900 border border-purple-300 shadow-xs'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-700' : 'text-stone-400'}`} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* Inventory Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Inventory Units
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {totalInventoryUnits.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs text-stone-500 font-medium">units</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Across {enrichedInventory.length} catalog products</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Cost Valuation
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-purple-700">
                  ${totalCostValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">Capital tied up in current inventory</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Retail Potential Value
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-emerald-700">
                  ${totalRetailValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500">
                Potential Margin: +${(totalRetailValuation - totalCostValuation).toFixed(2)}
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Stock Attention Flags
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-600">
                  {lowStockItems.length + outOfStockItems.length}
                </span>
                <span className="text-xs text-stone-500 font-medium">alerts</span>
              </div>
              <div className="mt-2 text-[11px] text-stone-500 flex items-center gap-2">
                <span className="text-amber-700 font-semibold">{lowStockItems.length} Low</span>
                <span>·</span>
                <span className="text-rose-700 font-semibold">{outOfStockItems.length} Out of Stock</span>
              </div>
            </div>
          </div>

          {/* TABLE: CURRENT INVENTORY */}
          {inventorySubtype === 'CURRENT' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Current Inventory Report</h3>
                  <p className="text-[11px] text-stone-500">Live inventory balances, thresholds, and valuation across all items</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Product / SKU</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-right">On Hand Qty</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Unit Cost</th>
                      <th className="py-2.5 px-4 text-right">Selling Price</th>
                      <th className="py-2.5 px-4 text-right">Cost Value</th>
                      <th className="py-2.5 px-4 text-right">Retail Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {enrichedInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900">{item.productName}</div>
                          <div className="font-mono text-[10px] text-stone-400">{item.productSku}</div>
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px]">
                            {item.categoryName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                          {item.currentQuantity} {item.unit}
                          <div className="text-[10px] text-stone-400 font-normal">
                            Min: {item.minimumInventoryThreshold} {item.unit}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.stockStatus === 'OUT OF STOCK'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : item.stockStatus === 'LOW STOCK'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.stockStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-stone-700">
                          ${item.costPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-stone-700">
                          ${item.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                          ${item.totalCostValue.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          ${item.totalRetailValue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLE: LOW STOCK PRODUCTS */}
          {inventorySubtype === 'LOW_STOCK' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-900">Low-Stock Reorder Report</h3>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Items whose current on-hand quantity is below the minimum threshold
                  </p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-amber-300 hover:bg-amber-100 text-amber-900 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">No low stock items detected!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4 text-right">On Hand</th>
                        <th className="py-2.5 px-4 text-right">Threshold</th>
                        <th className="py-2.5 px-4 text-right">Deficit</th>
                        <th className="py-2.5 px-4">Supplier</th>
                        <th className="py-2.5 px-4 text-right">Est. Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Est. Reorder Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {lowStockItems.map((item) => {
                        const deficit = Math.max(0, item.minimumInventoryThreshold - item.currentQuantity);
                        return (
                          <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="font-mono text-[10px] text-stone-400">{item.productSku}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">
                              {item.currentQuantity} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-stone-500">
                              {item.minimumInventoryThreshold} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                              -{deficit} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-stone-600">{item.supplierName}</td>
                            <td className="py-3 px-4 text-right font-mono text-stone-700">
                              ${item.costPrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                              ${(deficit * item.costPrice).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: OUT OF STOCK PRODUCTS */}
          {inventorySubtype === 'OUT_OF_STOCK' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-rose-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-rose-900">Out-of-Stock Urgent Restock Report</h3>
                  </div>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Critical zero inventory items requiring immediate supplier purchase orders
                  </p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-rose-300 hover:bg-rose-100 text-rose-900 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {outOfStockItems.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-stone-700">Zero out-of-stock items!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4 text-center">On Hand</th>
                        <th className="py-2.5 px-4 text-right">Min Target</th>
                        <th className="py-2.5 px-4">Supplier</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Restock Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {outOfStockItems.map((item) => (
                        <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900">{item.productName}</div>
                            <div className="font-mono text-[10px] text-stone-400">{item.productSku}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              0 {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-stone-700">
                            {item.minimumInventoryThreshold} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-stone-600">{item.supplierName}</td>
                          <td className="py-3 px-4 text-right font-mono text-stone-700">
                            ${item.costPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            ${(item.minimumInventoryThreshold * item.costPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: INVENTORY VALUATION BY CATEGORY */}
          {inventorySubtype === 'VALUATION' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Inventory Valuation Report</h3>
                  <p className="text-[11px] text-stone-500">Valuation analysis, capital allocation, and markup margins by category</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-center">Products</th>
                      <th className="py-2.5 px-4 text-right">Units On Hand</th>
                      <th className="py-2.5 px-4 text-right">Cost Basis Value</th>
                      <th className="py-2.5 px-4 text-right">Retail Potential Value</th>
                      <th className="py-2.5 px-4 text-right">Unrealized Margin ($)</th>
                      <th className="py-2.5 px-4 text-right">Markup (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {categoryValuation.map((cat) => {
                      const margin = cat.retailValuation - cat.costValuation;
                      const markupPct = cat.costValuation > 0 ? (margin / cat.costValuation) * 100 : 0;
                      return (
                        <tr key={cat.categoryName} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-stone-900">{cat.categoryName}</td>
                          <td className="py-3 px-4 text-center font-mono text-stone-700">{cat.itemCount}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-stone-800">
                            {cat.totalUnits.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 text-sm">
                            ${cat.costValuation.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${cat.retailValuation.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-stone-800">
                            +${margin.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-600">
                            {markupPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-stone-100/70 border-t-2 border-stone-200 font-bold">
                    <tr>
                      <td className="py-3 px-4 text-stone-900">Total Store Inventory</td>
                      <td className="py-3 px-4 text-center font-mono">{enrichedInventory.length}</td>
                      <td className="py-3 px-4 text-right font-mono">{totalInventoryUnits.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-purple-800 text-sm">
                        ${totalCostValuation.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-800 text-sm">
                        ${totalRetailValuation.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-900">
                        +${(totalRetailValuation - totalCostValuation).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-700">
                        {totalCostValuation > 0
                          ? `${(((totalRetailValuation - totalCostValuation) / totalCostValuation) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TABLE: PURCHASES AUDIT REPORT */}
          {inventorySubtype === 'PURCHASES' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Purchases & Inbound Receipts Report</h3>
                  <p className="text-[11px] text-stone-500">Audit trail of supplier purchase deliveries added to inventory</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {purchasesTransactions.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No purchase transactions recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Reference</th>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4 text-right">Qty Received</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Total Cost</th>
                        <th className="py-2.5 px-4">Supplier / Source</th>
                        <th className="py-2.5 px-4 text-right">New Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {purchasesTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-stone-500 text-[11px]">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-stone-800">
                            {tx.referenceId || `PO-${tx.id}`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900">{tx.productName}</div>
                            <div className="font-mono text-[10px] text-stone-400">{tx.productSku}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            +{tx.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-700">
                            ${tx.costPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                            ${tx.totalPurchaseCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-stone-600">{tx.supplierName}</td>
                          <td className="py-3 px-4 text-right font-mono text-stone-500">
                            {tx.newQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TABLE: INVENTORY ADJUSTMENTS REPORT */}
          {inventorySubtype === 'ADJUSTMENTS' && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Inventory Adjustments Audit Report</h3>
                  <p className="text-[11px] text-stone-500">
                    Audit log of manual inventory adjustments, shrinkage, damages, and cycle count corrections
                  </p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-stone-300 hover:bg-stone-100 text-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {adjustmentsTransactions.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">No manual stock adjustments recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Product / SKU</th>
                        <th className="py-2.5 px-4 text-right">Adjustment Delta</th>
                        <th className="py-2.5 px-4 text-right">Previous Qty</th>
                        <th className="py-2.5 px-4 text-right">New Balance</th>
                        <th className="py-2.5 px-4">Audit Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {adjustmentsTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-stone-500 text-[11px]">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                tx.transactionType === 'DAMAGE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {tx.transactionType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-stone-900">{tx.productName}</div>
                            <div className="font-mono text-[10px] text-stone-400">{tx.productSku}</div>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-bold ${
                              tx.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-stone-500">
                            {tx.previousQuantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-stone-800">
                            {tx.newQuantity}
                          </td>
                          <td className="py-3 px-4 text-stone-600 text-[11px] max-w-[280px]">
                            {tx.reason || tx.referenceId || 'Manual adjustment'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
