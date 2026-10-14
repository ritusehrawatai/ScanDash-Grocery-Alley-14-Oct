import React, { useState } from 'react';
import {
  CheckCircle2,
  Printer,
  Download,
  X,
  Store,
  Receipt,
  Package,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Check,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { SaleDto } from '../../types/sale';
import { cancelSale } from '../../api/auditApi';

interface SaleReceiptModalProps {
  sale: SaleDto;
  paymentMethod?: string;
  onClose: () => void;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  sale,
  paymentMethod = 'Cash (Register Counter)',
  onClose,
}) => {
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [saleStatus, setSaleStatus] = useState<string>(sale.status);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  const handleCancelSale = async () => {
    if (!window.confirm(`Void & cancel sale ${sale.receiptNumber}? This will restore all items back into inventory and log a SALE_CANCELLED audit event.`)) {
      return;
    }
    setCancelling(true);
    try {
      await cancelSale(sale.id, 'Counter void by cashier');
      setSaleStatus('CANCELLED');
      setCancelSuccessMsg('Sale cancelled! Items returned to stock & recorded in Audit Trail.');
    } catch (err: any) {
      alert(`Failed to cancel sale: ${err.message || 'Error'}`);
    } finally {
      setCancelling(false);
    }
  };

  const formattedDate = new Date(sale.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const storeName = 'ScanDash POS Fresh Market';
  const storeLocation = 'Central Grocery Hub · Terminal Lane 01';

  // 1. Print Receipt handler
  const handlePrint = () => {
    window.print();
  };

  // 2. Download Receipt handler
  const handleDownload = () => {
    // Generate ASCII/text receipt layout suitable for thermal or file saving
    const divider = '------------------------------------------------';
    const doubleDivider = '================================================';

    let content = '';
    content += `${doubleDivider}\n`;
    content += `          ${storeName.toUpperCase()}\n`;
    content += `         ${storeLocation}\n`;
    content += `${doubleDivider}\n`;
    content += `Store Name    : ${storeName}\n`;
    content += `Sale Number   : ${sale.receiptNumber}\n`;
    content += `Date / Time   : ${formattedDate}\n`;
    content += `Payment Method: ${sale.paymentMethod || paymentMethod}\n`;
    if (sale.paymentReference) {
      content += `Payment Ref   : ${sale.paymentReference}\n`;
    }
    content += `Sale Status   : ${sale.status}\n`;
    content += `${divider}\n`;
    content += `${'ITEM'.padEnd(22)} ${'QTY'.padStart(5)} ${'UNIT'.padStart(7)} ${'TAX'.padStart(6)} ${'TOTAL'.padStart(7)}\n`;
    content += `${divider}\n`;

    sale.items.forEach((item) => {
      const name = item.productName.length > 21 ? item.productName.substring(0, 20) + '…' : item.productName;
      const qty = Number(item.quantity).toFixed(1);
      const unitPrice = `$${Number(item.unitPrice).toFixed(2)}`;
      const tax = `$${Number(item.taxAmount).toFixed(2)}`;
      const total = `$${Number(item.totalAmount).toFixed(2)}`;

      content += `${name.padEnd(22)} ${qty.padStart(5)} ${unitPrice.padStart(7)} ${tax.padStart(6)} ${total.padStart(7)}\n`;
      if (item.productSku) {
        content += `  SKU: ${item.productSku}\n`;
      }
    });

    content += `${divider}\n`;
    content += `${'Subtotal:'.padEnd(38)} $${Number(sale.subtotal).toFixed(2).padStart(8)}\n`;
    content += `${'Tax:'.padEnd(38)} $${Number(sale.taxAmount).toFixed(2).padStart(8)}\n`;
    content += `${doubleDivider}\n`;
    content += `${'GRAND TOTAL:'.padEnd(38)} $${Number(sale.totalAmount).toFixed(2).padStart(8)}\n`;
    content += `${doubleDivider}\n`;
    content += `Payment Method: ${paymentMethod}\n`;
    content += `Total Items   : ${sale.itemCount}\n`;
    content += `\nThank you for shopping at ${storeName}!\n`;
    content += `Keep this receipt for returns or exchanges.\n`;
    content += `${doubleDivider}\n`;

    // Trigger download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${sale.receiptNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Receipt Header Banner (Screen only) */}
        <div className={`no-print p-4.5 flex items-center justify-between text-white ${saleStatus === 'CANCELLED' ? 'bg-rose-700' : 'bg-emerald-700'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              {saleStatus === 'CANCELLED' ? (
                <AlertTriangle className="w-6 h-6 text-white" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight leading-none">
                {saleStatus === 'CANCELLED' ? 'Sale Voided & Cancelled' : 'Sale Completed Successfully'}
              </h3>
              <p className="text-xs text-white/90 mt-1">
                {saleStatus === 'CANCELLED'
                  ? 'Inventory restored & logged in enterprise audit trail'
                  : 'Official purchase receipt generated'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div id="printable-receipt" className="p-6 bg-white space-y-4">
          {/* Store & Register Branding */}
          <div className="text-center pb-3 border-b-2 border-dashed border-stone-300">
            <div className="flex items-center justify-center gap-2 text-stone-900 font-extrabold text-lg tracking-tight">
              <Store className="w-5 h-5 text-emerald-600 no-print" />
              <span>{storeName}</span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{storeLocation}</p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded font-mono text-stone-800 border border-stone-200">
                <Receipt className="w-3.5 h-3.5 text-stone-500 no-print" />
                <span>Sale #: {sale.receiptNumber}</span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
              <Calendar className="w-3 h-3 text-stone-400 no-print" />
              <span>Date/Time: {formattedDate}</span>
            </div>
          </div>

          {/* Purchased Items Table */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2 flex items-center justify-between">
              <span>Itemized Purchases</span>
              <span>{sale.items.length} line items</span>
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5">Item</th>
                    <th className="py-2 px-1 text-center">Qty</th>
                    <th className="py-2 px-1.5 text-right">Unit Price</th>
                    <th className="py-2 px-1.5 text-right">Tax</th>
                    <th className="py-2 px-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sale.items.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50">
                      <td className="py-2 px-2.5">
                        <div className="font-medium text-stone-900">{item.productName}</div>
                        <div className="text-[10px] font-mono text-stone-400">{item.productSku}</div>
                      </td>
                      <td className="py-2 px-1 text-center font-mono text-stone-700">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono text-stone-700">
                        ${Number(item.unitPrice).toFixed(2)}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono text-stone-600">
                        ${Number(item.taxAmount).toFixed(2)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold text-stone-900">
                        ${Number(item.totalAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Totals Breakdown */}
          <div className="pt-2 border-t-2 border-dashed border-stone-300 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-stone-600">
              <span>Subtotal</span>
              <span className="font-mono text-stone-800">${Number(sale.subtotal).toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-stone-600">
              <span>Tax (State & Local)</span>
              <span className="font-mono text-stone-800">${Number(sale.taxAmount).toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-base font-extrabold text-stone-900">
              <span>Grand Total</span>
              <span className="font-mono text-lg text-emerald-700">${Number(sale.totalAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method & Transaction Information */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium">Payment Method:</span>
              <span className="font-bold text-stone-900 font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                {sale.paymentMethod || paymentMethod}
              </span>
            </div>
            {sale.paymentReference && (
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>Payment Reference:</span>
                <span className="font-mono text-stone-700 bg-white px-1.5 py-0.5 rounded border border-stone-200">{sale.paymentReference}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Sale Status:</span>
              <span className="font-semibold text-emerald-700">{sale.status}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Store Name:</span>
              <span>{storeName}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Sale Number:</span>
              <span className="font-mono">{sale.receiptNumber}</span>
            </div>
          </div>

          {/* Receipt Footer Message */}
          <div className="text-center pt-2 text-[11px] text-stone-400 border-t border-dashed border-stone-200">
            <p>Thank you for shopping at {storeName}!</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Please retain this receipt for returns or exchanges within 30 days.</p>
          </div>
        </div>

        {/* Cancellation Feedback Banner */}
        {cancelSuccessMsg && (
          <div className="no-print p-3 bg-rose-50 border-t border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{cancelSuccessMsg}</span>
          </div>
        )}

        {/* Modal Action Buttons (Screen only) */}
        <div className="no-print p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {/* Print Receipt */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 active:bg-stone-200 rounded-lg border border-stone-300 transition-colors shadow-xs cursor-pointer"
              title="Print official receipt"
            >
              <Printer className="w-3.5 h-3.5 text-stone-600" />
              <span>Print Receipt</span>
            </button>

            {/* Download Receipt */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 active:bg-stone-200 rounded-lg border border-stone-300 transition-colors shadow-xs cursor-pointer"
              title="Download text receipt slip"
            >
              {downloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>Download Receipt</span>
                </>
              )}
            </button>

            {/* Void / Cancel Sale Button */}
            {saleStatus !== 'CANCELLED' && (
              <button
                onClick={handleCancelSale}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-lg border border-rose-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                title="Cancel / void this transaction"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>{cancelling ? 'Voiding...' : 'Void Sale'}</span>
              </button>
            )}
          </div>

          {/* Start New Sale */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <span>Start New Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
};
