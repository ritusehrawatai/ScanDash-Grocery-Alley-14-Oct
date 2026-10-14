import React from 'react';
import { X, Edit2, Power, Barcode, DollarSign, Package, AlertCircle } from 'lucide-react';
import { Product } from '../../types/product';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onEdit,
  onToggleActive,
}) => {
  const margin =
    product.sellingPrice > 0
      ? (((product.sellingPrice - product.purchasePrice) / product.sellingPrice) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
              <span>SKU: {product.sku}</span>
              <span aria-hidden="true">·</span>
              <span>ID: #{product.id}</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">{product.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${
                product.active
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-stone-100 text-stone-700 border-stone-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${product.active ? 'bg-emerald-500' : 'bg-stone-400'}`}
              ></span>
              <span>{product.active ? 'Active' : 'Inactive'}</span>
            </span>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">
                Selling Price
              </span>
              <span className="text-lg font-bold font-mono text-stone-900 mt-0.5 block">
                ${product.sellingPrice.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-500">per {product.unit}</span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">
                Purchase Cost
              </span>
              <span className="text-lg font-bold font-mono text-stone-900 mt-0.5 block">
                ${product.purchasePrice.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-500">Margin: {margin}%</span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">
                Tax Rate
              </span>
              <span className="text-lg font-bold font-mono text-stone-900 mt-0.5 block">
                {product.taxRate.toFixed(2)}%
              </span>
              <span className="text-[10px] text-stone-500">Sales Tax</span>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">
                Min. Threshold
              </span>
              <span className="text-lg font-bold font-mono text-stone-900 mt-0.5 block">
                {product.minimumInventoryThreshold} {product.unit}
              </span>
              <span className="text-[10px] text-stone-500">Low Stock Trigger</span>
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-200 pt-4">
            <div>
              <span className="font-medium text-stone-500 block mb-1">Product Identification</span>
              <div className="space-y-2 bg-stone-50/60 p-3 rounded-md border border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-500">Stock Keeping Unit (SKU):</span>
                  <span className="font-mono font-bold text-stone-900">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Barcode:</span>
                  <span className="font-mono text-stone-900">
                    {product.barcode ? product.barcode : <span className="text-stone-400 italic">None assigned</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Unit of Measure:</span>
                  <span className="font-medium text-stone-900">{product.unit}</span>
                </div>
              </div>
            </div>

            <div>
              <span className="font-medium text-stone-500 block mb-1">Taxonomy & Vendor</span>
              <div className="space-y-2 bg-stone-50/60 p-3 rounded-md border border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-500">Category:</span>
                  <span className="font-medium text-stone-900">
                    {product.categoryName || <span className="text-stone-400 italic">Uncategorized</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Supplier:</span>
                  <span className="font-medium text-stone-900">
                    {product.supplierName || <span className="text-stone-400 italic">Direct / In-House</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Inventory Monitoring:</span>
                  <span className="text-stone-900">
                    Alert when &le; {product.minimumInventoryThreshold} {product.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="border-t border-stone-200 pt-4">
              <span className="font-medium text-stone-500 block mb-1">Description</span>
              <p className="text-stone-700 bg-stone-50/60 p-3 rounded-md border border-stone-200 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t border-stone-200 pt-4 flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
            <div>
              <span>Created: </span>
              <span className="font-mono text-stone-700">
                {new Date(product.createdAt).toLocaleString()}
              </span>
            </div>
            <span aria-hidden="true">·</span>
            <div>
              <span>Last Updated: </span>
              <span className="font-mono text-stone-700">
                {new Date(product.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <button
            onClick={() => onToggleActive(product)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              product.active
                ? 'bg-white hover:bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{product.active ? 'Deactivate Product' : 'Activate Product'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Product</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
