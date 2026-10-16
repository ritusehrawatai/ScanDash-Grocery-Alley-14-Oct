import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, AlertCircle, Barcode, Check } from 'lucide-react';
import { Product, CreateProductInput, UpdateProductInput } from '../../types/product';
import { ProductCategory } from '../../types/category';
import { fetchCategories } from '../../api/categoryApi';

interface ProductFormModalProps {
  productToEdit?: Product | null;
  onClose: () => void;
  onSubmit: (data: CreateProductInput | UpdateProductInput) => Promise<void>;
}

const SUPPLIERS = [
  { id: 1, name: 'Green Valley Produce' },
  { id: 2, name: 'Sunny Ridge Dairies' },
  { id: 3, name: 'Apex Bakes & Milling' },
  { id: 4, name: 'Pacific Coast Distributors' },
  { id: 5, name: 'Direct Farm Alliance' },
];

const UNITS = ['PCS', 'KG', 'LB', 'GALLON', 'LITER', 'PACK', 'BOX', 'BUNCH', 'BAG'];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  productToEdit,
  onClose,
  onSubmit,
}) => {
  const isEditing = Boolean(productToEdit);

  const [name, setName] = useState(productToEdit?.name || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [barcode, setBarcode] = useState(productToEdit?.barcode || '');
  const [description, setDescription] = useState(productToEdit?.description || '');
  const [categoryId, setCategoryId] = useState<number | ''>(productToEdit?.categoryId || '');
  const [supplierId, setSupplierId] = useState<number | ''>(productToEdit?.supplierId || '');
  const [purchasePrice, setPurchasePrice] = useState<string>(
    productToEdit ? productToEdit.purchasePrice.toString() : '0.00'
  );
  const [sellingPrice, setSellingPrice] = useState<string>(
    productToEdit ? productToEdit.sellingPrice.toString() : '0.00'
  );
  const [taxRate, setTaxRate] = useState<string>(
    productToEdit ? productToEdit.taxRate.toString() : '0.00'
  );
  const [unit, setUnit] = useState<string>(productToEdit?.unit || 'PCS');
  const [minimumInventoryThreshold, setMinimumInventoryThreshold] = useState<string>(
    productToEdit ? productToEdit.minimumInventoryThreshold.toString() : '0'
  );
  const [active, setActive] = useState<boolean>(productToEdit ? productToEdit.active : true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Managed Categories from backend
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted) {
          setAvailableCategories(cats);
          setLoadingCategories(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load categories:', err);
        if (isMounted) setLoadingCategories(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const displayedCategories = useMemo(() => {
    return availableCategories.filter((c) => {
      if (c.active) return true;
      // If editing a product whose current category is inactive, preserve and display it
      if (productToEdit && productToEdit.categoryId === c.id) return true;
      return false;
    });
  }, [availableCategories, productToEdit]);

  // Barcode scanning support
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [justScanned, setJustScanned] = useState<boolean>(false);

  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = 0;
    let scanTimer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const elapsed = now - lastKeyTime;
      lastKeyTime = now;

      // Scanners typically send Enter or Tab after completing a scan
      if (e.key === 'Enter' || e.key === 'Tab') {
        // If a burst of characters arrived rapidly (scanner signature of >= 3 chars)
        if (scanBuffer.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          const scannedBarcode = scanBuffer.trim();
          // Preserve exact barcode value including leading zeros as a string
          setBarcode(scannedBarcode);
          setJustScanned(true);
          setTimeout(() => setJustScanned(false), 2500);

          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
          scanBuffer = '';
          return;
        }

        // Prevent accidental form submission when scanner or user sends Enter in the barcode field
        if (document.activeElement === barcodeInputRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }

        scanBuffer = '';
        return;
      }

      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Single printable characters
      if (e.key.length === 1) {
        // Keystrokes arriving with interval < 80ms (characteristic of hardware scanners)
        if (elapsed < 80 || scanBuffer.length > 0) {
          scanBuffer += e.key;

          // If the user was focused on another field (e.g. name or sku), prevent the rapid scanner characters from dirtying it
          if (document.activeElement !== barcodeInputRef.current && scanBuffer.length >= 2) {
            e.preventDefault();
          }
        } else {
          // Initial character of a potential scan
          scanBuffer = e.key;
        }

        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          scanBuffer = '';
        }, 120);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(scanTimer);
    };
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Product name is required.';
    }

    if (!sku.trim()) {
      errs.sku = 'SKU is required.';
    }

    const pCost = parseFloat(purchasePrice);
    if (isNaN(pCost)) {
      errs.purchasePrice = 'Purchase price must be a valid number.';
    } else if (pCost < 0) {
      errs.purchasePrice = 'Purchase price cannot be negative.';
    }

    const sPrice = parseFloat(sellingPrice);
    if (isNaN(sPrice)) {
      errs.sellingPrice = 'Selling price must be a valid number.';
    } else if (sPrice < 0) {
      errs.sellingPrice = 'Selling price cannot be negative.';
    }

    const tax = parseFloat(taxRate);
    if (isNaN(tax)) {
      errs.taxRate = 'Tax rate must be a valid number.';
    } else if (tax < 0) {
      errs.taxRate = 'Tax rate cannot be negative.';
    }

    const thresh = parseInt(minimumInventoryThreshold, 10);
    if (isNaN(thresh)) {
      errs.minimumInventoryThreshold = 'Threshold must be an integer.';
    } else if (thresh < 0) {
      errs.minimumInventoryThreshold = 'Threshold cannot be negative.';
    }

    if (!unit.trim()) {
      errs.unit = 'Unit is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateProductInput = {
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() ? barcode.trim() : null,
        description: description.trim() ? description.trim() : null,
        categoryId: categoryId === '' ? null : Number(categoryId),
        supplierId: supplierId === '' ? null : Number(supplierId),
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        taxRate: parseFloat(taxRate),
        unit: unit.trim(),
        minimumInventoryThreshold: parseInt(minimumInventoryThreshold, 10),
        active,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'An error occurred while saving the product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
              <span>{isEditing ? `Edit Product ID #${productToEdit?.id}` : 'Catalog Management'}</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              {isEditing ? 'Edit Grocery Product' : 'Add New Grocery Product'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
            {serverError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Backend Error: </span>
                  {serverError}
                </div>
              </div>
            )}

            {/* Row 1: Name */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Organic Cavendish Bananas"
                className={`w-full px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                  errors.name ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                }`}
              />
              {errors.name && <p className="text-red-600 text-[11px] mt-1">{errors.name}</p>}
            </div>

            {/* Row 2: SKU and Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  SKU (Stock Keeping Unit) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. SKU-BAN-001"
                  className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                    errors.sku ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                  }`}
                />
                {errors.sku && <p className="text-red-600 text-[11px] mt-1">{errors.sku}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-stone-700">
                    Barcode (UPC / EAN) <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  {justScanned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-in fade-in">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Barcode Scanned</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault(); // Prevent accidental form submission when scanner sends Enter
                      }
                    }}
                    placeholder="e.g. 012345678901 (or scan barcode)"
                    className={`w-full font-mono pl-3 pr-9 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white transition-colors ${
                      justScanned ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-stone-300'
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <Barcode className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Category and Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={loadingCategories}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white cursor-pointer disabled:bg-stone-100"
                >
                  <option value="">{loadingCategories ? 'Loading categories...' : 'Select Category...'}</option>
                  {displayedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.active ? '(Inactive - Current Category)' : ''}
                    </option>
                  ))}
                </select>
                {categoryId !== '' && availableCategories.some((c) => c.id === categoryId && !c.active) && (
                  <p className="mt-1 text-[11px] text-amber-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>This product is assigned to an inactive category. Keep it or select an active category.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white cursor-pointer"
                >
                  <option value="">Select Supplier...</option>
                  {SUPPLIERS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Pricing & Tax */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-stone-200 pt-3">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Purchase Price ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                    errors.purchasePrice ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                  }`}
                />
                {errors.purchasePrice && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.purchasePrice}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Selling Price ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                    errors.sellingPrice ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                  }`}
                />
                {errors.sellingPrice && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.sellingPrice}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Tax Rate (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                    errors.taxRate ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                  }`}
                />
                {errors.taxRate && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.taxRate}</p>
                )}
              </div>
            </div>

            {/* Row 5: Unit & Minimum Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Unit of Measure <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white cursor-pointer"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                {errors.unit && <p className="text-red-600 text-[11px] mt-1">{errors.unit}</p>}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Min. Inventory Threshold <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minimumInventoryThreshold}
                  onChange={(e) => setMinimumInventoryThreshold(e.target.value)}
                  placeholder="0"
                  className={`w-full font-mono px-3 py-2 border rounded-md text-xs focus:outline-emerald-600 bg-white ${
                    errors.minimumInventoryThreshold ? 'border-red-400 bg-red-50/20' : 'border-stone-300'
                  }`}
                />
                {errors.minimumInventoryThreshold && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.minimumInventoryThreshold}</p>
                )}
              </div>
            </div>

            {/* Row 6: Description */}
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Description <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description, packaging info, or notes..."
                className="w-full px-3 py-2 border border-stone-300 rounded-md text-xs focus:outline-emerald-600 bg-white"
              />
            </div>

            {/* Row 7: Status Active Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-medium text-stone-800">
                  Active (Available in POS Catalog)
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
