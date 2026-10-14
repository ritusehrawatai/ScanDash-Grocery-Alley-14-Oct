import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Edit3,
  Save,
  Download,
  RefreshCw,
  Search,
  Link2,
  Unlink,
  Plus,
  Info,
  Lock,
  FileText,
  FileImage,
  Sparkles,
  Boxes,
  FileCheck,
  X,
  RotateCcw,
  Sliders,
  Tag,
  Zap,
} from 'lucide-react';
import {
  PurchaseInvoice,
  ExtractedInvoiceItem,
  InvoiceReviewPayload,
  InvoiceReviewItemUpdate,
  InvoiceConfirmResponse,
  ProductMatchMethod,
} from '../../types/invoice';
import { Product } from '../../types/product';
import {
  saveInvoiceReview,
  confirmInvoice,
  getInvoiceDownloadUrl,
  InvoiceApiError,
} from '../../api/invoiceApi';
import { fetchProducts } from '../../api/productApi';
import {
  evaluateProductMatchOrder,
  MatchEvaluationResult,
} from '../../services/productMatchingService';

interface InvoiceReviewScreenProps {
  invoice: PurchaseInvoice;
  onBack: () => void;
  onInvoiceUpdated: (updatedInvoice: PurchaseInvoice) => void;
}

interface EditableHeader {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  notes: string;
}

interface EditableItemState {
  id: string;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  total: number;
  confidence: number;
  flaggedForReview: boolean;
  reviewReasons: string[];
  matchedProductId: number | null;
  matchedProductName: string | null;
  matchedProductSku: string | null;
  ignored: boolean;
  userModified: boolean;
  // Field-specific confidence & uncertainty info from OCR
  productNameConfidence: number;
  productNameFlagged: boolean;
  productNameReason?: string;
  skuConfidence: number;
  skuFlagged: boolean;
  skuReason?: string;
  barcodeConfidence: number;
  barcodeFlagged: boolean;
  barcodeReason?: string;
  quantityConfidence: number;
  quantityFlagged: boolean;
  unitPriceConfidence: number;
  unitPriceFlagged: boolean;
  totalConfidence: number;
  totalFlagged: boolean;
  totalReason?: string;
  // 4-Tier Match Engine state
  suggestedProductId?: number | null;
  suggestedProductName?: string | null;
  suggestedProductSku?: string | null;
  suggestedProductBarcode?: string | null;
  suggestedProductPrice?: number;
  matchMethod?: ProductMatchMethod;
  matchConfidence?: number; // 0 to 100
  matchReason?: string;
  isLowConfidenceMatch?: boolean; // < 75 or NO_MATCH
  manualSelectionRequired?: boolean;
  manualSelectionCompleted?: boolean;
  userConfirmedNewProduct?: boolean;
  uncertainMatchConfirmed?: boolean;
}

export const InvoiceReviewScreen: React.FC<InvoiceReviewScreenProps> = ({
  invoice,
  onBack,
  onInvoiceUpdated,
}) => {
  // Available catalog products for matching
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  // Editable Header State
  const [headerState, setHeaderState] = useState<EditableHeader>({
    supplier: invoice.ocrResult?.supplier.value || '',
    invoiceNumber: invoice.ocrResult?.invoiceNumber.value || invoice.invoiceNumber,
    invoiceDate: invoice.ocrResult?.invoiceDate.value || '',
    notes: invoice.notes || '',
  });

  // Editable Line Items State
  const [items, setItems] = useState<EditableItemState[]>(() => {
    if (!invoice.ocrResult?.items) return [];
    return invoice.ocrResult.items.map((it: ExtractedInvoiceItem, idx: number) => ({
      id: it.id || `item-${idx + 1}`,
      productName: it.productName.value,
      sku: it.sku.value,
      barcode: it.barcode.value,
      quantity: Number(it.quantity.value) || 1,
      unitPrice: Number(it.unitPrice.value) || 0,
      total: Number(it.total.value) || 0,
      confidence: it.confidence,
      flaggedForReview: it.flaggedForReview,
      reviewReasons: it.reviewReasons || [],
      matchedProductId: it.matchedProductId ?? null,
      matchedProductName: it.matchedProductName ?? null,
      matchedProductSku: it.matchedProductSku ?? null,
      ignored: Boolean(it.ignored),
      userModified: Boolean(it.userModified),
      productNameConfidence: it.productName.confidence,
      productNameFlagged: it.productName.flaggedForReview,
      productNameReason: it.productName.reason,
      skuConfidence: it.sku.confidence,
      skuFlagged: it.sku.flaggedForReview,
      skuReason: it.sku.reason,
      barcodeConfidence: it.barcode.confidence,
      barcodeFlagged: it.barcode.flaggedForReview,
      barcodeReason: it.barcode.reason,
      quantityConfidence: it.quantity.confidence,
      quantityFlagged: it.quantity.flaggedForReview,
      unitPriceConfidence: it.unitPrice.confidence,
      unitPriceFlagged: it.unitPrice.flaggedForReview,
      totalConfidence: it.total.confidence,
      totalFlagged: it.total.flaggedForReview,
      totalReason: it.total.reason,
    }));
  });

  // Filters and search
  const [itemFilter, setItemFilter] = useState<'ALL' | 'UNCERTAIN' | 'LOW_CONFIDENCE' | 'ACTIVE' | 'IGNORED' | 'UNMATCHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI state
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Product Matching Modal State
  const [matchingModalItem, setMatchingModalItem] = useState<EditableItemState | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmUncertainMatchesChecked, setConfirmUncertainMatchesChecked] = useState<boolean>(false);
  const [simulateRollbackFailure, setSimulateRollbackFailure] = useState<boolean>(false);
  const [verifiedItemIds, setVerifiedItemIds] = useState<Set<string>>(new Set());
  const [activeStepTab, setActiveStepTab] = useState<'OVERVIEW' | 'STEPS' | 'UNCERTAIN'>('OVERVIEW');
  const [confirmationResult, setConfirmationResult] = useState<InvoiceConfirmResponse | null>(null);

  // Original Document Viewer panel toggle
  const [showDocPreview, setShowDocPreview] = useState<boolean>(false);

  // Load catalog products for auto-matching and manual match selection
  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      try {
        setLoadingProducts(true);
        const prods = await fetchProducts();
        if (mounted) {
          setCatalogProducts(prods);
        }
      } catch (err) {
        console.warn('Could not load products for matching:', err);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    };
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Run 4-Tier Product Matching Engine on line items:
   * 1. Barcode
   * 2. SKU
   * 3. Exact normalized name
   * 4. Fuzzy name matching
   *
   * Rules:
   * - If confidence is high (>= 75%), pre-link matched product.
   * - If confidence is low (< 75%), require manual selection (do NOT auto-link).
   * - Do not automatically create a new product without user confirmation.
   */
  const runFourTierMatchingOnItems = (catalog: Product[]) => {
    if (catalog.length === 0) return;
    setItems((prevItems) =>
      prevItems.map((item) => {
        // If user already manually selected or explicitly confirmed new product, preserve
        if (item.manualSelectionCompleted || item.userConfirmedNewProduct) {
          return item;
        }

        const evalResult = evaluateProductMatchOrder(
          {
            productName: item.productName,
            sku: item.sku,
            barcode: item.barcode,
          },
          catalog
        );

        const isLow = evalResult.isLowConfidence;
        const autoLink = !isLow && evalResult.suggestedProduct !== null;

        return {
          ...item,
          suggestedProductId: evalResult.suggestedProduct?.id ?? null,
          suggestedProductName: evalResult.suggestedProduct?.name ?? null,
          suggestedProductSku: evalResult.suggestedProduct?.sku ?? null,
          suggestedProductBarcode: evalResult.suggestedProduct?.barcode ?? null,
          suggestedProductPrice: evalResult.suggestedProduct?.purchasePrice ?? 0,
          matchMethod: evalResult.matchMethod,
          matchConfidence: evalResult.matchConfidence,
          matchReason: evalResult.matchReason,
          isLowConfidenceMatch: evalResult.isLowConfidence,
          manualSelectionRequired: evalResult.manualSelectionRequired,
          matchedProductId: autoLink ? evalResult.suggestedProduct!.id : (item.matchedProductId ?? null),
          matchedProductName: autoLink ? evalResult.suggestedProduct!.name : (item.matchedProductName ?? null),
          matchedProductSku: autoLink ? evalResult.suggestedProduct!.sku : (item.matchedProductSku ?? null),
        };
      })
    );
  };

  // Run 4-Tier matching when catalog loads
  useEffect(() => {
    if (catalogProducts.length > 0) {
      runFourTierMatchingOnItems(catalogProducts);
    }
  }, [catalogProducts]);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlert({ type, text });
    setTimeout(() => {
      setAlert((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Header change handlers
  const handleHeaderChange = (field: keyof EditableHeader, value: string) => {
    setHeaderState((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  // Item change handlers
  const handleItemFieldChange = (
    itemId: string,
    field: 'productName' | 'sku' | 'barcode' | 'quantity' | 'unitPrice',
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;

        const updated = { ...it, userModified: true };

        if (field === 'quantity') {
          const q = Math.max(0, Number(value) || 0);
          updated.quantity = q;
          updated.total = Number((q * updated.unitPrice).toFixed(2));
          updated.quantityFlagged = false;
        } else if (field === 'unitPrice') {
          const p = Math.max(0, Number(value) || 0);
          updated.unitPrice = p;
          updated.total = Number((updated.quantity * p).toFixed(2));
          updated.unitPriceFlagged = false;
        } else if (field === 'productName') {
          updated.productName = String(value);
          updated.productNameFlagged = false;
        } else if (field === 'sku') {
          updated.sku = String(value);
          updated.skuFlagged = false;
        } else if (field === 'barcode') {
          updated.barcode = String(value);
          updated.barcodeFlagged = false;
        }

        // Re-evaluate 4-tier match immediately if identifier fields change
        if (
          (field === 'productName' || field === 'sku' || field === 'barcode') &&
          catalogProducts.length > 0 &&
          !updated.manualSelectionCompleted
        ) {
          const evalResult = evaluateProductMatchOrder(
            {
              productName: updated.productName,
              sku: updated.sku,
              barcode: updated.barcode,
            },
            catalogProducts
          );

          updated.suggestedProductId = evalResult.suggestedProduct?.id ?? null;
          updated.suggestedProductName = evalResult.suggestedProduct?.name ?? null;
          updated.suggestedProductSku = evalResult.suggestedProduct?.sku ?? null;
          updated.suggestedProductBarcode = evalResult.suggestedProduct?.barcode ?? null;
          updated.suggestedProductPrice = evalResult.suggestedProduct?.purchasePrice ?? 0;
          updated.matchMethod = evalResult.matchMethod;
          updated.matchConfidence = evalResult.matchConfidence;
          updated.matchReason = evalResult.matchReason;
          updated.isLowConfidenceMatch = evalResult.isLowConfidence;
          updated.manualSelectionRequired = evalResult.manualSelectionRequired;

          // If high confidence, pre-link. If low confidence, clear matchedProductId to enforce manual selection!
          if (!evalResult.isLowConfidence && evalResult.suggestedProduct) {
            updated.matchedProductId = evalResult.suggestedProduct.id;
            updated.matchedProductName = evalResult.suggestedProduct.name;
            updated.matchedProductSku = evalResult.suggestedProduct.sku;
          } else {
            updated.matchedProductId = null;
            updated.matchedProductName = null;
            updated.matchedProductSku = null;
          }
        }

        // Update overall item review flag if all specific flags cleared
        if (
          !updated.productNameFlagged &&
          !updated.skuFlagged &&
          !updated.barcodeFlagged &&
          !updated.quantityFlagged &&
          !updated.unitPriceFlagged
        ) {
          updated.flaggedForReview = false;
        }

        return updated;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Ignore / Exclude item toggle
  const handleToggleIgnore = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const newIgnored = !it.ignored;
        return {
          ...it,
          ignored: newIgnored,
          userModified: true,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Reset item field to OCR original value
  const handleResetToOcr = (itemId: string) => {
    const originalItem = invoice.ocrResult?.items.find((x) => x.id === itemId);
    if (!originalItem) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          productName: originalItem.productName.value,
          sku: originalItem.sku.value,
          barcode: originalItem.barcode.value,
          quantity: Number(originalItem.quantity.value) || 1,
          unitPrice: Number(originalItem.unitPrice.value) || 0,
          total: Number(originalItem.total.value) || 0,
          confidence: originalItem.confidence,
          flaggedForReview: originalItem.flaggedForReview,
          reviewReasons: originalItem.reviewReasons || [],
          userModified: false,
          ignored: false,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Mark an item as manually verified / resolved
  const handleMarkVerified = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          flaggedForReview: false,
          productNameFlagged: false,
          skuFlagged: false,
          barcodeFlagged: false,
          quantityFlagged: false,
          unitPriceFlagged: false,
          totalFlagged: false,
          reviewReasons: [],
          userModified: true,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Product Matching Handlers
  const handleOpenMatchingModal = (item: EditableItemState) => {
    setMatchingModalItem(item);
    setProductSearchQuery(item.sku || item.productName || '');
  };

  // Select a product from manual search in catalog
  const handleSelectMatchedProduct = (product: Product) => {
    if (!matchingModalItem) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== matchingModalItem.id) return it;
        return {
          ...it,
          matchedProductId: product.id,
          matchedProductName: product.name,
          matchedProductSku: product.sku,
          matchMethod: 'MANUAL_SELECTION',
          matchConfidence: 100,
          matchReason: `Manually selected from catalog by user`,
          isLowConfidenceMatch: false,
          manualSelectionRequired: false,
          manualSelectionCompleted: true,
          userConfirmedNewProduct: false,
          // Enrich missing SKU or barcode if needed
          sku: it.sku && it.sku !== 'Missing' && it.sku !== 'SKU-UNRESOLVED' ? it.sku : product.sku,
          barcode:
            it.barcode && it.barcode !== 'Not detected' && it.barcode !== 'Missing / Illegible'
              ? it.barcode
              : product.barcode || it.barcode,
          userModified: true,
        };
      })
    );
    setMatchingModalItem(null);
    setHasUnsavedChanges(true);
    showAlert('success', `Matched line item to '${product.name}' (SKU: ${product.sku}).`);
  };

  // Accept the suggested product from the 4-tier engine
  const handleAcceptSuggestion = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (!it.suggestedProductId) return it;
        return {
          ...it,
          matchedProductId: it.suggestedProductId,
          matchedProductName: it.suggestedProductName ?? null,
          matchedProductSku: it.suggestedProductSku ?? null,
          manualSelectionCompleted: true,
          manualSelectionRequired: false,
          isLowConfidenceMatch: false,
          userConfirmedNewProduct: false,
          userModified: true,
        };
      })
    );
    if (matchingModalItem?.id === itemId) {
      setMatchingModalItem(null);
    }
    setHasUnsavedChanges(true);
    showAlert('success', 'Accepted suggested product match.');
  };

  // Explicitly confirm creating a new product in the catalog
  // (Requirement: Do not automatically create a new product without user confirmation)
  const handleConfirmNewProduct = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          matchedProductId: null,
          matchedProductName: null,
          matchedProductSku: null,
          userConfirmedNewProduct: true,
          manualSelectionCompleted: true,
          manualSelectionRequired: false,
          isLowConfidenceMatch: false,
          userModified: true,
        };
      })
    );
    if (matchingModalItem?.id === itemId) {
      setMatchingModalItem(null);
    }
    setHasUnsavedChanges(true);
    showAlert('info', 'Confirmed: Item will be created as a new catalog product upon invoice confirmation.');
  };

  // Clear matched product
  const handleClearMatch = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          matchedProductId: null,
          matchedProductName: null,
          matchedProductSku: null,
          manualSelectionCompleted: false,
          manualSelectionRequired: true,
          userConfirmedNewProduct: false,
          userModified: true,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Calculations
  const activeItems = useMemo(() => items.filter((it) => !it.ignored), [items]);
  const activeSum = useMemo(
    () => activeItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0),
    [activeItems]
  );
  const ocrHeaderTotal = Number(invoice.ocrResult?.total.value) || 0;
  const totalDifference = Number((activeSum - ocrHeaderTotal).toFixed(2));

  // Count of uncertain values across items
  const uncertainItemsCount = useMemo(
    () => items.filter((it) => !it.ignored && (it.flaggedForReview || it.confidence < 75)).length,
    [items]
  );

  const ignoredItemsCount = useMemo(() => items.filter((it) => it.ignored).length, [items]);

  // Product Matching Metrics
  const highConfidenceCount = useMemo(
    () =>
      items.filter(
        (it) => !it.ignored && Boolean(it.matchedProductId) && (it.matchConfidence ?? 100) >= 75
      ).length,
    [items]
  );

  const lowConfidenceCount = useMemo(
    () =>
      items.filter(
        (it) =>
          !it.ignored &&
          (it.isLowConfidenceMatch || (it.matchConfidence !== undefined && it.matchConfidence < 75)) &&
          !it.matchedProductId &&
          !it.userConfirmedNewProduct
      ).length,
    [items]
  );

  const unmatchedItemsCount = useMemo(
    () => items.filter((it) => !it.ignored && !it.matchedProductId && !it.userConfirmedNewProduct).length,
    [items]
  );

  const confirmedNewProductsCount = useMemo(
    () => items.filter((it) => !it.ignored && !it.matchedProductId && it.userConfirmedNewProduct).length,
    [items]
  );

  // Active items requiring explicit verification for Step 4 of confirmation:
  // - Items with low OCR confidence (< 75%)
  // - Items flagged for review
  // - Items with low match confidence (< 75%) and unconfirmed
  // - Unmatched items without explicit user confirmation as new product
  // - Items with field-level uncertainty flags
  const uncertainActiveItems = useMemo(() => {
    return items.filter((it) => {
      if (it.ignored) return false;
      if (it.flaggedForReview) return true;
      if (it.confidence < 75) return true;
      // Low match confidence (< 75%) requires manual selection or explicit approval
      if (it.isLowConfidenceMatch || (it.matchConfidence !== undefined && it.matchConfidence < 75)) {
        if (!it.manualSelectionCompleted && !it.uncertainMatchConfirmed) return true;
      }
      // Unmatched items require explicit user confirmation to create as new product
      if (!it.matchedProductId && !it.userConfirmedNewProduct) return true;
      if (it.productNameFlagged || it.skuFlagged || it.barcodeFlagged) return true;
      return false;
    });
  }, [items]);

  // Filtered line items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Filter tab
      if (itemFilter === 'UNCERTAIN' && (it.ignored || (!it.flaggedForReview && it.confidence >= 75))) {
        return false;
      }
      if (
        itemFilter === 'LOW_CONFIDENCE' &&
        (it.ignored || (!it.isLowConfidenceMatch && (it.matchConfidence === undefined || it.matchConfidence >= 75)))
      ) {
        return false;
      }
      if (itemFilter === 'ACTIVE' && it.ignored) return false;
      if (itemFilter === 'IGNORED' && !it.ignored) return false;
      if (itemFilter === 'UNMATCHED' && (it.ignored || Boolean(it.matchedProductId) || it.userConfirmedNewProduct)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = it.productName.toLowerCase().includes(q);
        const matchesSku = it.sku.toLowerCase().includes(q);
        const matchesBarcode = it.barcode.toLowerCase().includes(q);
        const matchesMatched = it.matchedProductName?.toLowerCase().includes(q);
        const matchesSuggested = it.suggestedProductName?.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesMatched && !matchesSuggested) return false;
      }

      return true;
    });
  }, [items, itemFilter, searchQuery]);

  // Save Draft (STRICT NON-MUTATION OF INVENTORY)
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const payload: InvoiceReviewPayload = {
        supplier: headerState.supplier,
        invoiceNumber: headerState.invoiceNumber,
        invoiceDate: headerState.invoiceDate,
        total: activeSum,
        notes: headerState.notes,
        items: items.map((it): InvoiceReviewItemUpdate => ({
          id: it.id,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          matchedProductId: it.matchedProductId,
          matchedProductName: it.matchedProductName,
          matchedProductSku: it.matchedProductSku,
          matchMethod: it.matchMethod,
          matchConfidence: it.matchConfidence,
          matchReason: it.matchReason,
          isLowConfidenceMatch: it.isLowConfidenceMatch,
          manualSelectionRequired: it.manualSelectionRequired,
          manualSelectionCompleted: it.manualSelectionCompleted,
          userConfirmedNewProduct: it.userConfirmedNewProduct,
          ignored: it.ignored,
          userModified: it.userModified,
          uncertainMatchConfirmed: confirmUncertainMatchesChecked || verifiedItemIds.has(it.id),
        })),
      };

      const updatedInvoice = await saveInvoiceReview(invoice.id, payload);
      setHasUnsavedChanges(false);
      onInvoiceUpdated(updatedInvoice);
      showAlert('success', 'Review draft saved successfully. Inventory remains completely unchanged.');
    } catch (err: any) {
      console.error('Failed to save review draft:', err);
      showAlert('error', err.message || 'Failed to save review draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Explicit Confirm (10-STEP TRANSACTIONAL CONFIRMATION WITH ATOMIC ROLLBACK)
  const handleExplicitConfirm = async () => {
    setIsConfirming(true);
    try {
      // First save current review draft to ensure latest values are committed
      const payload: InvoiceReviewPayload = {
        supplier: headerState.supplier,
        invoiceNumber: headerState.invoiceNumber,
        invoiceDate: headerState.invoiceDate,
        total: activeSum,
        notes: headerState.notes,
        items: items.map((it): InvoiceReviewItemUpdate => ({
          id: it.id,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          matchedProductId: it.matchedProductId,
          matchedProductName: it.matchedProductName,
          matchedProductSku: it.matchedProductSku,
          matchMethod: it.matchMethod,
          matchConfidence: it.matchConfidence,
          matchReason: it.matchReason,
          isLowConfidenceMatch: it.isLowConfidenceMatch,
          manualSelectionRequired: it.manualSelectionRequired,
          manualSelectionCompleted: it.manualSelectionCompleted,
          userConfirmedNewProduct: it.userConfirmedNewProduct,
          ignored: it.ignored,
          userModified: it.userModified,
          uncertainMatchConfirmed: confirmUncertainMatchesChecked || verifiedItemIds.has(it.id),
        })),
      };

      await saveInvoiceReview(invoice.id, payload);

      // Call explicit confirmation endpoint with confirmation options
      const result = await confirmInvoice(invoice.id, {
        confirmedUncertainMatches: confirmUncertainMatchesChecked || uncertainActiveItems.length === 0,
        simulateFailure: simulateRollbackFailure,
        confirmedNewProductItemIds: items.filter((it) => it.userConfirmedNewProduct).map((it) => it.id),
      });

      setConfirmationResult(result);
      setShowConfirmModal(false);
      setHasUnsavedChanges(false);
      onInvoiceUpdated(result.invoice);
      showAlert(
        'success',
        `Invoice ${result.invoice.invoiceNumber} explicitly confirmed via database transaction! Created ${result.createdInvoiceItems?.length || 0} invoice items and updated ${result.inventoryUpdates.length} stock balances.`
      );
    } catch (err: any) {
      console.error('Failed to confirm invoice:', err);
      showAlert(
        'error',
        err.message || 'Failed to confirm invoice. Database transaction was rolled back cleanly.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const isConfirmed = invoice.status === 'CONFIRMED';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Navigation & Action Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Breadcrumb & Title */}
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
              <button
                onClick={onBack}
                className="hover:text-stone-900 flex items-center gap-1 font-medium cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Invoices Ledger</span>
              </button>
              <span>/</span>
              <span className="font-semibold text-stone-700">Invoice Review & Verification</span>
              <span>/</span>
              <span className="font-mono text-emerald-800 font-bold">{invoice.invoiceNumber}</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>Purchase Invoice Review Screen</span>
              </h1>

              {isConfirmed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  CONFIRMED & STOCKED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-100 text-amber-800 border border-amber-300">
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  DRAFT REVIEW MODE
                </span>
              )}

              {uncertainItemsCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{uncertainItemsCount} uncertain value{uncertainItemsCount !== 1 ? 's' : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All values verified</span>
                </span>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Original Scanned File Toggle */}
            <button
              onClick={() => setShowDocPreview(!showDocPreview)}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 bg-stone-50 hover:bg-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              {invoice.mimeType.includes('pdf') ? (
                <FileText className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <FileImage className="w-3.5 h-3.5 text-blue-500" />
              )}
              <span>{showDocPreview ? 'Hide Scanned File' : 'Inspect Scanned File'}</span>
            </button>

            {/* Save Review Draft Button */}
            {!isConfirmed && (
              <button
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${
                  hasUnsavedChanges
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                    : 'border-stone-300 bg-white hover:bg-stone-50 text-stone-700'
                }`}
                title="Saves edits without altering inventory"
              >
                {isSavingDraft ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Draft...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Save Review Draft</span>
                    {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </>
                )}
              </button>
            )}

            {/* Explicit Confirm Button */}
            {!isConfirmed ? (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Confirm Invoice & Update Inventory</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Inventory Updated on {new Date(invoice.confirmedAt || '').toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Strict Non-Mutation Architecture Assurance Notice */}
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-semibold text-stone-800">Strict Non-Mutation Safeguard:</span>
            <span>
              Inventory quantities remain <strong>100% untouched</strong> while editing fields, matching products, or
              ignoring items. Inventory is only adjusted when explicitly confirmed.
            </span>
          </div>

          <a
            href={getInvoiceDownloadUrl(invoice.id)}
            download={invoice.originalFilename}
            className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px] font-medium"
          >
            <Download className="w-3 h-3" />
            <span>Download Original File</span>
          </a>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : alert.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span className="font-medium">{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scanned Document Side-by-Side Preview (Collapsible) */}
      {showDocPreview && (
        <div className="bg-stone-900 rounded-xl p-4 text-white border border-stone-800 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-300">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Source Scanned Document ({invoice.originalFilename})</span>
              <span className="text-[10px] text-stone-500 font-mono">
                {(invoice.fileSize / 1024).toFixed(1)} KB · {invoice.mimeType}
              </span>
            </div>
            <button
              onClick={() => setShowDocPreview(false)}
              className="text-stone-400 hover:text-white text-xs cursor-pointer"
            >
              Close Preview
            </button>
          </div>

          <div className="max-h-96 overflow-auto bg-stone-950 p-2 rounded-lg flex items-center justify-center border border-stone-800">
            {invoice.mimeType.startsWith('image/') ? (
              <img
                src={getInvoiceDownloadUrl(invoice.id)}
                alt="Scanned invoice document"
                className="max-h-96 w-auto object-contain rounded"
              />
            ) : (
              <div className="py-12 text-center space-y-2">
                <FileText className="w-12 h-12 text-red-400 mx-auto" />
                <div className="text-xs font-semibold text-stone-200">
                  PDF Document: {invoice.originalFilename}
                </div>
                <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                  PDF preview is available for download or via browser viewer.
                </p>
                <a
                  href={getInvoiceDownloadUrl(invoice.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold mt-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open PDF in New Tab</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVOICE HEADER DETAILS EDITORS */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
            <span>Invoice Header & Supplier Information</span>
            <span className="text-stone-400 text-[11px] font-normal">
              (Extracted via Tesseract OCR · Click to edit any value)
            </span>
          </h2>

          <div className="text-[11px] text-stone-500 font-mono">
            Overall OCR Confidence: <strong>{invoice.ocrResult?.overallConfidence ?? 0}%</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Supplier Name Editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <label htmlFor="header-supplier" className="flex items-center gap-1.5">
                <span>Supplier</span>
                {invoice.ocrResult?.supplier.flaggedForReview && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                    Uncertain
                  </span>
                )}
              </label>
              <span className="text-[10px] text-stone-400 font-mono">
                {invoice.ocrResult?.supplier.confidence ?? 0}% conf
              </span>
            </div>
            <input
              id="header-supplier"
              type="text"
              disabled={isConfirmed}
              value={headerState.supplier}
              onChange={(e) => handleHeaderChange('supplier', e.target.value)}
              placeholder="e.g. Green Valley Organics LLC"
              className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors ${
                invoice.ocrResult?.supplier.flaggedForReview
                  ? 'border-amber-400 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-amber-500'
                  : 'border-stone-300 focus:ring-1 focus:ring-emerald-500'
              } ${isConfirmed ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : 'bg-white'}`}
            />
            {invoice.ocrResult?.supplier.flaggedForReview && (
              <div className="text-[10px] text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>{invoice.ocrResult.supplier.reason || 'Check supplier name against scan'}</span>
              </div>
            )}
          </div>

          {/* Invoice Number Editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <label htmlFor="header-invnum" className="flex items-center gap-1.5">
                <span>Invoice Number</span>
                {invoice.ocrResult?.invoiceNumber.flaggedForReview && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                    Uncertain
                  </span>
                )}
              </label>
              <span className="text-[10px] text-stone-400 font-mono">
                {invoice.ocrResult?.invoiceNumber.confidence ?? 0}% conf
              </span>
            </div>
            <input
              id="header-invnum"
              type="text"
              disabled={isConfirmed}
              value={headerState.invoiceNumber}
              onChange={(e) => handleHeaderChange('invoiceNumber', e.target.value)}
              placeholder="e.g. INV-2026-94812"
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition-colors ${
                invoice.ocrResult?.invoiceNumber.flaggedForReview
                  ? 'border-amber-400 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-amber-500'
                  : 'border-stone-300 focus:ring-1 focus:ring-emerald-500'
              } ${isConfirmed ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : 'bg-white font-bold'}`}
            />
            {invoice.ocrResult?.invoiceNumber.flaggedForReview && (
              <div className="text-[10px] text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Low confidence on invoice number text</span>
              </div>
            )}
          </div>

          {/* Invoice Date Editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <label htmlFor="header-invdate" className="flex items-center gap-1.5">
                <span>Invoice Date</span>
                {invoice.ocrResult?.invoiceDate.flaggedForReview && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                    Uncertain
                  </span>
                )}
              </label>
              <span className="text-[10px] text-stone-400 font-mono">
                {invoice.ocrResult?.invoiceDate.confidence ?? 0}% conf
              </span>
            </div>
            <input
              id="header-invdate"
              type="text"
              disabled={isConfirmed}
              value={headerState.invoiceDate}
              onChange={(e) => handleHeaderChange('invoiceDate', e.target.value)}
              placeholder="YYYY-MM-DD"
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition-colors ${
                invoice.ocrResult?.invoiceDate.flaggedForReview
                  ? 'border-amber-400 bg-amber-50/40 focus:bg-white focus:ring-1 focus:ring-amber-500'
                  : 'border-stone-300 focus:ring-1 focus:ring-emerald-500'
              } ${isConfirmed ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : 'bg-white'}`}
            />
            {invoice.ocrResult?.invoiceDate.flaggedForReview && (
              <div className="text-[10px] text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Verify date format (YYYY-MM-DD)</span>
              </div>
            )}
          </div>

          {/* Calculated Grand Total Box */}
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
              <span>Active Items Total</span>
              <span className="text-[10px] text-stone-400 font-mono">{activeItems.length} active</span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-xl font-bold text-emerald-800 tabular-nums">
                ${activeSum.toFixed(2)}
              </span>

              {totalDifference !== 0 && (
                <span
                  className="text-[10px] font-mono text-stone-500"
                  title={`Original OCR Total: $${ocrHeaderTotal.toFixed(2)}`}
                >
                  OCR: ${ocrHeaderTotal.toFixed(2)} ({totalDifference > 0 ? `+${totalDifference}` : totalDifference})
                </span>
              )}
            </div>

            {totalDifference !== 0 && (
              <div className="text-[9.5px] text-stone-500 mt-1 leading-tight">
                {ignoredItemsCount > 0
                  ? `Reflects exclusion of ${ignoredItemsCount} ignored item(s).`
                  : 'Calculated from edited quantities and unit prices.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4-TIER PRODUCT MATCHING ENGINE STATUS BANNER */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 rounded-xl p-4 text-white shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] uppercase font-bold tracking-wider">
                Matching Order
              </span>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>4-Tier Product Matching Engine:</span>
              </h3>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-stone-300 font-mono">
                <span className="bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700">1. Barcode</span>
                <span className="text-stone-500">➔</span>
                <span className="bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700">2. SKU</span>
                <span className="text-stone-500">➔</span>
                <span className="bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700">3. Exact Name</span>
                <span className="text-stone-500">➔</span>
                <span className="bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700">4. Fuzzy Name</span>
              </div>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed max-w-3xl">
              Strict matching precedence. High confidence (&ge; 75%) items auto-link. Low confidence items require manual
              selection. New products are never created automatically without explicit user confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => runFourTierMatchingOnItems(catalogProducts)}
              disabled={loadingProducts}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="Re-run 4-tier matching sequence across all line items"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Run 4-Tier Auto-Match</span>
            </button>
          </div>
        </div>

        {/* Engine Match Metrics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-stone-800 text-xs">
          <div className="bg-stone-800/80 border border-stone-700/80 rounded-lg p-2">
            <div className="text-[10px] text-stone-400 font-medium">High Confidence Matches</div>
            <div className="text-emerald-400 font-bold text-sm font-mono mt-0.5">
              {highConfidenceCount} <span className="text-[10px] font-normal text-stone-400 font-sans">(&ge; 75%)</span>
            </div>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-lg p-2">
            <div className="text-[10px] text-amber-300 font-medium">Low Confidence (&lt; 75%)</div>
            <div className="text-amber-400 font-bold text-sm font-mono mt-0.5">
              {lowConfidenceCount}{' '}
              <span className="text-[10px] font-normal text-amber-300/80 font-sans">· Manual Selection Required</span>
            </div>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-lg p-2">
            <div className="text-[10px] text-stone-400 font-medium">Unmatched Items</div>
            <div className="text-stone-200 font-bold text-sm font-mono mt-0.5">
              {unmatchedItemsCount}{' '}
              <span className="text-[10px] font-normal text-stone-400 font-sans">· Awaiting Choice</span>
            </div>
          </div>

          <div className="bg-stone-800/80 border border-stone-700/80 rounded-lg p-2">
            <div className="text-[10px] text-blue-300 font-medium">Confirmed New Products</div>
            <div className="text-blue-300 font-bold text-sm font-mono mt-0.5">
              {confirmedNewProductsCount}{' '}
              <span className="text-[10px] font-normal text-stone-400 font-sans">· Explicitly Approved</span>
            </div>
          </div>
        </div>
      </div>

      {/* LINE ITEMS REVIEW GRID */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        {/* Table Controls Bar */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
              <span>Extracted Line Items ({items.length})</span>
            </h2>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-lg text-[11px] flex-wrap">
              <button
                onClick={() => setItemFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'ALL'
                    ? 'bg-white shadow-2xs text-stone-900 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All ({items.length})
              </button>

              <button
                onClick={() => setItemFilter('LOW_CONFIDENCE')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'LOW_CONFIDENCE'
                    ? 'bg-amber-100 shadow-2xs text-amber-900 font-bold ring-1 ring-amber-300'
                    : 'text-stone-600 hover:text-amber-800'
                }`}
              >
                Low Confidence ({lowConfidenceCount})
              </button>

              <button
                onClick={() => setItemFilter('UNCERTAIN')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'UNCERTAIN'
                    ? 'bg-white shadow-2xs text-amber-800 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Uncertain OCR ({uncertainItemsCount})
              </button>

              <button
                onClick={() => setItemFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'ACTIVE'
                    ? 'bg-white shadow-2xs text-emerald-800 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Active ({activeItems.length})
              </button>

              <button
                onClick={() => setItemFilter('IGNORED')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'IGNORED'
                    ? 'bg-white shadow-2xs text-stone-800 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ignored ({ignoredItemsCount})
              </button>

              <button
                onClick={() => setItemFilter('UNMATCHED')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  itemFilter === 'UNMATCHED'
                    ? 'bg-white shadow-2xs text-blue-800 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Unmatched ({unmatchedItemsCount})
              </button>
            </div>
          </div>

          {/* Search inside table */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, barcode..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 text-stone-600 text-[10.5px] uppercase font-bold tracking-wider border-b border-stone-200">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[200px]">Product Name</th>
                <th className="py-2.5 px-3 min-w-[120px]">SKU</th>
                <th className="py-2.5 px-3 min-w-[130px]">Barcode / UPC</th>
                <th className="py-2.5 px-3 w-20 text-right">Quantity</th>
                <th className="py-2.5 px-3 w-24 text-right">Unit Price</th>
                <th className="py-2.5 px-3 w-24 text-right">Line Total</th>
                <th className="py-2.5 px-3 min-w-[290px]">Catalog Match & Suggestions (4-Tier)</th>
                <th className="py-2.5 px-3 w-24 text-center">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-400 text-xs">
                    No items match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const isUncertain = !it.ignored && (it.flaggedForReview || it.confidence < 75);

                  return (
                    <tr
                      key={it.id}
                      className={`transition-colors ${
                        it.ignored
                          ? 'bg-stone-100/70 text-stone-400 opacity-60'
                          : isUncertain
                          ? 'bg-amber-50/50 hover:bg-amber-50/80'
                          : 'bg-white hover:bg-stone-50/70'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-3 px-3 text-center text-[10px] text-stone-400 font-mono font-medium">
                        {idx + 1}
                      </td>

                      {/* EDIT PRODUCT NAME */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="relative">
                            <input
                              type="text"
                              disabled={isConfirmed || it.ignored}
                              value={it.productName}
                              onChange={(e) => handleItemFieldChange(it.id, 'productName', e.target.value)}
                              placeholder="Product name"
                              className={`w-full px-2.5 py-1.5 text-xs rounded-md border font-medium ${
                                it.productNameFlagged
                                  ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300'
                                  : 'border-stone-300 text-stone-900 bg-white focus:ring-1 focus:ring-emerald-500'
                              } ${it.ignored ? 'line-through text-stone-400 bg-stone-100' : ''}`}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 text-[9.5px]">
                            <span
                              className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                                it.productNameConfidence >= 80
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : it.productNameConfidence >= 65
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {it.productNameConfidence}% OCR
                            </span>

                            {it.productNameFlagged && (
                              <span className="text-amber-800 font-semibold flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                <span>Uncertain recognition</span>
                              </span>
                            )}

                            {it.userModified && (
                              <span className="text-emerald-700 font-medium">· Edited</span>
                            )}
                          </div>

                          {it.reviewReasons.length > 0 && !it.ignored && (
                            <div className="space-y-0.5 pt-0.5">
                              {it.reviewReasons.map((r, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="text-[9px] text-amber-800 flex items-center gap-1 bg-amber-100/60 p-0.5 px-1 rounded"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span>{r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* EDIT SKU */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            disabled={isConfirmed || it.ignored}
                            value={it.sku}
                            onChange={(e) => handleItemFieldChange(it.id, 'sku', e.target.value)}
                            placeholder="SKU"
                            className={`w-full px-2 py-1 text-xs font-mono rounded-md border ${
                              it.skuFlagged || it.sku === 'Missing' || it.sku === 'SKU-UNRESOLVED'
                                ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300 font-bold'
                                : 'border-stone-300 text-stone-800 bg-white focus:ring-1 focus:ring-emerald-500'
                            } ${it.ignored ? 'line-through text-stone-400 bg-stone-100' : ''}`}
                          />
                          <div className="flex items-center gap-1 text-[9.5px]">
                            <span className="text-stone-400 font-mono">{it.skuConfidence}%</span>
                            {(it.skuFlagged || it.sku === 'Missing' || it.sku === 'SKU-UNRESOLVED') && (
                              <span className="text-amber-700 font-semibold">Verify SKU</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* EDIT BARCODE */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            disabled={isConfirmed || it.ignored}
                            value={it.barcode}
                            onChange={(e) => handleItemFieldChange(it.id, 'barcode', e.target.value)}
                            placeholder="Barcode"
                            className={`w-full px-2 py-1 text-xs font-mono rounded-md border ${
                              it.barcodeFlagged || it.barcode === 'Not detected' || it.barcode === 'Missing / Illegible'
                                ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300'
                                : 'border-stone-300 text-stone-800 bg-white focus:ring-1 focus:ring-emerald-500'
                            } ${it.ignored ? 'line-through text-stone-400 bg-stone-100' : ''}`}
                          />
                          <div className="flex items-center gap-1 text-[9.5px]">
                            <span className="text-stone-400 font-mono">{it.barcodeConfidence}%</span>
                            {(it.barcodeFlagged || it.barcode === 'Not detected') && (
                              <span className="text-amber-700 font-semibold">Missing barcode</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* EDIT QUANTITY */}
                      <td className="py-3 px-3 text-right">
                        <div className="space-y-1 inline-block text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isConfirmed || it.ignored}
                            value={it.quantity}
                            onChange={(e) => handleItemFieldChange(it.id, 'quantity', e.target.value)}
                            className={`w-20 px-2 py-1 text-xs font-mono font-bold text-right rounded-md border ${
                              it.quantityFlagged
                                ? 'border-amber-400 bg-amber-50 text-amber-950'
                                : 'border-stone-300 text-stone-900 bg-white focus:ring-1 focus:ring-emerald-500'
                            } ${it.ignored ? 'line-through text-stone-400 bg-stone-100' : ''}`}
                          />
                          <div className="text-[9.5px] text-stone-400 font-mono">{it.quantityConfidence}%</div>
                        </div>
                      </td>

                      {/* EDIT UNIT PRICE */}
                      <td className="py-3 px-3 text-right">
                        <div className="space-y-1 inline-block text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1 text-stone-400 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={isConfirmed || it.ignored}
                              value={it.unitPrice}
                              onChange={(e) => handleItemFieldChange(it.id, 'unitPrice', e.target.value)}
                              className={`w-24 pl-5 pr-2 py-1 text-xs font-mono font-medium text-right rounded-md border ${
                                it.unitPriceFlagged
                                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                                  : 'border-stone-300 text-stone-900 bg-white focus:ring-1 focus:ring-emerald-500'
                              } ${it.ignored ? 'line-through text-stone-400 bg-stone-100' : ''}`}
                            />
                          </div>
                          <div className="text-[9.5px] text-stone-400 font-mono">{it.unitPriceConfidence}%</div>
                        </div>
                      </td>

                      {/* LINE TOTAL (Auto-computed & editable) */}
                      <td className="py-3 px-3 text-right">
                        <div className="space-y-1">
                          <span
                            className={`font-mono font-bold text-xs tabular-nums block ${
                              it.ignored ? 'line-through text-stone-400' : 'text-stone-900'
                            }`}
                          >
                            ${Number(it.total).toFixed(2)}
                          </span>
                          <span className="text-[9.5px] text-stone-400 font-mono">
                            {it.quantity} × ${Number(it.unitPrice).toFixed(2)}
                          </span>
                        </div>
                      </td>

                      {/* MATCH PRODUCT & 4-TIER SUGGESTIONS */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5">
                          {/* Case 1: Item is actively matched to catalog product */}
                          {it.matchedProductId ? (
                            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate flex items-center gap-1.5 text-emerald-900">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{it.matchedProductName}</span>
                                </span>
                                {!isConfirmed && (
                                  <button
                                    onClick={() => handleClearMatch(it.id)}
                                    title="Unlink product match"
                                    className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5"
                                  >
                                    <Unlink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-1 text-[10px] text-emerald-800 font-mono">
                                <span>SKU: {it.matchedProductSku}</span>
                                <span className="px-1.5 py-0.2 rounded font-bold text-[9.5px] bg-emerald-200/80 text-emerald-900">
                                  {it.matchMethod === 'BARCODE'
                                    ? '100% Barcode (Tier 1)'
                                    : it.matchMethod === 'SKU'
                                    ? '95% SKU (Tier 2)'
                                    : it.matchMethod === 'EXACT_NAME'
                                    ? '90% Exact Name (Tier 3)'
                                    : it.matchMethod === 'FUZZY_NAME'
                                    ? `${it.matchConfidence ?? 80}% Fuzzy (Tier 4)`
                                    : 'Manual Match'}
                                </span>
                              </div>

                              {it.matchReason && (
                                <div className="text-[9.5px] text-emerald-700 leading-tight truncate" title={it.matchReason}>
                                  {it.matchReason}
                                </div>
                              )}

                              {!isConfirmed && (
                                <div className="pt-0.5 border-t border-emerald-100 flex items-center justify-end">
                                  <button
                                    onClick={() => handleOpenMatchingModal(it)}
                                    className="text-emerald-800 hover:underline font-sans text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>Change Match</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : it.suggestedProductId ? (
                            /* Case 2: 4-Tier engine suggested a candidate, but confidence is low (< 75%) */
                            /* Requirement: If confidence is low, require manual selection */
                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] space-y-1.5 shadow-2xs">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <div className="text-[10px] uppercase font-bold tracking-wider text-amber-800 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>Low Confidence Match ({it.matchConfidence ?? 65}%)</span>
                                  </div>
                                  <div className="font-semibold text-stone-900 mt-0.5 truncate" title={it.suggestedProductName || ''}>
                                    Suggested: {it.suggestedProductName}
                                  </div>
                                </div>
                                <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] bg-amber-200 text-amber-900 shrink-0">
                                  Tier 4 Fuzzy
                                </span>
                              </div>

                              <div className="text-[9.5px] text-amber-800 leading-tight">
                                Manual selection required. Automatic linking is restricted.
                              </div>

                              {!isConfirmed && !it.ignored && (
                                <div className="pt-1 border-t border-amber-200 flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenMatchingModal(it)}
                                    className="flex-1 py-1 px-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold text-center cursor-pointer transition-colors"
                                  >
                                    Select Product
                                  </button>
                                  <button
                                    onClick={() => handleAcceptSuggestion(it.id)}
                                    className="py-1 px-1.5 rounded bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-semibold cursor-pointer transition-colors"
                                    title="Accept this suggested candidate"
                                  >
                                    Accept
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : it.userConfirmedNewProduct ? (
                            /* Case 3: User explicitly confirmed creating as new product */
                            /* Requirement: Do not automatically create a new product without user confirmation */
                            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 text-[11px] space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold flex items-center gap-1 text-blue-900 text-[10.5px]">
                                  <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>Confirmed New Product</span>
                                </span>
                                {!isConfirmed && (
                                  <button
                                    onClick={() => handleClearMatch(it.id)}
                                    className="text-stone-400 hover:text-stone-600 text-[10px] cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <p className="text-[9.5px] text-blue-700">
                                Will create new catalog product upon invoice confirmation (SKU: {it.sku || 'Auto-catalog'}).
                              </p>
                              {!isConfirmed && (
                                <button
                                  onClick={() => handleOpenMatchingModal(it)}
                                  className="text-[10px] text-blue-800 underline font-semibold cursor-pointer"
                                >
                                  Match to existing instead
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Case 4: Unmatched item */
                            /* Requirement: Do not automatically create without confirmation */
                            <div className="p-2 rounded-lg bg-stone-50 border border-dashed border-stone-300 text-stone-700 text-[11px] space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-stone-600 text-[10.5px]">No Catalog Match (0%)</span>
                                <span className="text-[9px] font-mono text-stone-400">Tier 0</span>
                              </div>
                              <p className="text-[9.5px] text-stone-500 leading-tight">
                                Item not found. Manual selection or explicit new product confirmation required.
                              </p>
                              {!isConfirmed && !it.ignored && (
                                <div className="flex items-center gap-1 pt-0.5">
                                  <button
                                    onClick={() => handleOpenMatchingModal(it)}
                                    className="flex-1 py-1 px-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold text-center cursor-pointer transition-colors"
                                  >
                                    Select Product
                                  </button>
                                  <button
                                    onClick={() => handleConfirmNewProduct(it.id)}
                                    className="py-1 px-1.5 rounded bg-stone-200 hover:bg-stone-300 text-stone-800 text-[10px] font-semibold cursor-pointer transition-colors"
                                    title="Explicitly approve creating as new product in catalog"
                                  >
                                    Confirm New
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* STATUS & ACTIONS (Ignore Item / Verify / Reset) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {/* Toggle Ignore Item Button */}
                          {!isConfirmed && (
                            <button
                              onClick={() => handleToggleIgnore(it.id)}
                              className={`px-2 py-1 rounded text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors w-full justify-center ${
                                it.ignored
                                  ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900'
                              }`}
                              title={it.ignored ? 'Restore item to invoice' : 'Exclude item from confirmation'}
                            >
                              {it.ignored ? (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Restore</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Ignore</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Quick Mark as Verified */}
                          {!isConfirmed && !it.ignored && isUncertain && (
                            <button
                              onClick={() => handleMarkVerified(it.id)}
                              title="Confirm this item's data is verified"
                              className="px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-2.5 h-2.5" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Reset to OCR original */}
                          {!isConfirmed && it.userModified && (
                            <button
                              onClick={() => handleResetToOcr(it.id)}
                              title="Reset to original OCR extraction"
                              className="text-[9.5px] text-stone-400 hover:text-stone-600 flex items-center gap-0.5 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-600 gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total Extracted Items: <strong>{items.length}</strong>
            </span>
            <span>·</span>
            <span className="text-emerald-800 font-semibold">
              Active Items: <strong>{activeItems.length}</strong>
            </span>
            <span>·</span>
            <span className="text-stone-500">
              Ignored Items: <strong>{ignoredItemsCount}</strong>
            </span>
            <span>·</span>
            <span className={uncertainItemsCount > 0 ? 'text-amber-800 font-semibold' : 'text-stone-500'}>
              Uncertain Items: <strong>{uncertainItemsCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-stone-500">Invoice Total to Confirm:</span>
            <span className="font-mono text-base font-bold text-emerald-900 tabular-nums">
              ${activeSum.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* INVOICE NOTES */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs space-y-2">
        <label htmlFor="review-notes" className="block text-xs font-semibold text-stone-700">
          Review Notes / Delivery Audit Comments
        </label>
        <textarea
          id="review-notes"
          rows={2}
          disabled={isConfirmed}
          value={headerState.notes}
          onChange={(e) => handleHeaderChange('notes', e.target.value)}
          placeholder="e.g. Scanned produce invoice reviewed against physical delivery; bulk item SKU confirmed."
          className={`w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none ${
            isConfirmed ? 'bg-stone-100 text-stone-500' : 'bg-white'
          }`}
        />
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices Ledger</span>
        </button>

        <div className="flex items-center gap-3">
          {!isConfirmed && (
            <button
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-stone-600" />
              <span>Save Draft Changes</span>
            </button>
          )}

          {!isConfirmed ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
              <span>Confirm Invoice & Update Inventory ({activeItems.length} items)</span>
            </button>
          ) : (
            <div className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Invoice Confirmed & Archived</span>
            </div>
          )}
        </div>
      </div>

      {/* PRODUCT MATCHING MODAL WITH 4-TIER MATCHING ENGINE */}
      {matchingModalItem && (() => {
        const modalMatchEval = evaluateProductMatchOrder(matchingModalItem, catalogProducts);
        const filteredCatalog = catalogProducts.filter((p) => {
          if (!productSearchQuery.trim()) return true;
          const q = productSearchQuery.toLowerCase().trim();
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] uppercase font-bold">
                      Order: 1. Barcode ➔ 2. SKU ➔ 3. Exact Name ➔ 4. Fuzzy Name
                    </span>
                  </div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mt-1">
                    <Link2 className="w-4 h-4 text-emerald-400" />
                    <span>4-Tier Product Matching & Manual Selection</span>
                  </h3>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Match invoice line item to store inventory or explicitly confirm as a new catalog product.
                  </p>
                </div>

                <button
                  onClick={() => setMatchingModalItem(null)}
                  className="text-stone-400 hover:text-white p-1 rounded hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {/* 1. SCANNED INVOICE ITEM DETAILS */}
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">
                      Scanned Invoice Line Item
                    </span>
                    <span className="font-mono text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200 text-[10px]">
                      OCR Confidence: {matchingModalItem.confidence}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-medium">Scanned Name</div>
                      <div className="font-bold text-stone-900 mt-0.5 truncate" title={matchingModalItem.productName}>
                        {matchingModalItem.productName}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-medium">Scanned SKU / Code</div>
                      <div className="font-mono font-bold text-stone-900 mt-0.5">
                        {matchingModalItem.sku || 'None detected'}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <div className="text-[10px] text-stone-400 font-medium">Scanned Barcode / UPC</div>
                      <div className="font-mono font-bold text-stone-900 mt-0.5">
                        {matchingModalItem.barcode || 'None detected'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-600 px-1 pt-1">
                    <span>
                      Unit Cost: <strong>${matchingModalItem.unitPrice.toFixed(2)}</strong> · Quantity: <strong>{matchingModalItem.quantity}</strong>
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      Line Total: ${matchingModalItem.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 2. 4-TIER MATCH ENGINE EVALUATION & SUGGESTED PRODUCT */}
                <div
                  className={`p-3.5 rounded-lg border space-y-3 ${
                    modalMatchEval.isLowConfidence
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-emerald-50/70 border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                          modalMatchEval.isLowConfidence
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-emerald-200 text-emerald-900'
                        }`}
                      >
                        {modalMatchEval.tierLabel}
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {modalMatchEval.suggestedProduct ? 'Suggested Product Candidate' : 'No Suggested Product'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-stone-600">Match Confidence:</span>
                      <span
                        className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                          modalMatchEval.matchConfidence >= 75
                            ? 'bg-emerald-600 text-white'
                            : modalMatchEval.matchConfidence > 0
                            ? 'bg-amber-500 text-white'
                            : 'bg-stone-300 text-stone-700'
                        }`}
                      >
                        {modalMatchEval.matchConfidence}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Confidence Progress Bar */}
                  <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 transition-all ${
                        modalMatchEval.matchConfidence >= 75
                          ? 'bg-emerald-600'
                          : modalMatchEval.matchConfidence > 0
                          ? 'bg-amber-500'
                          : 'bg-stone-400'
                      }`}
                      style={{ width: `${Math.max(4, modalMatchEval.matchConfidence)}%` }}
                    />
                  </div>

                  {/* Match Reason Text */}
                  <div className="text-[11px] text-stone-700 bg-white/80 p-2 rounded border border-stone-200/80">
                    <strong>Engine Result:</strong> {modalMatchEval.matchReason}
                  </div>

                  {/* Suggested Product Card (if candidate found) */}
                  {modalMatchEval.suggestedProduct && (
                    <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-stone-900 flex items-center gap-2">
                            <span>{modalMatchEval.suggestedProduct.name}</span>
                            <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded">
                              SKU: {modalMatchEval.suggestedProduct.sku}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-3 flex-wrap">
                            {modalMatchEval.suggestedProduct.barcode && (
                              <span>UPC: {modalMatchEval.suggestedProduct.barcode}</span>
                            )}
                            {modalMatchEval.suggestedProduct.categoryName && (
                              <span>Category: {modalMatchEval.suggestedProduct.categoryName}</span>
                            )}
                            <span>Catalog Cost: ${modalMatchEval.suggestedProduct.purchasePrice.toFixed(2)}</span>
                            <span>Unit: {modalMatchEval.suggestedProduct.unit}</span>
                          </div>
                        </div>

                        {/* Button to accept suggested product */}
                        <button
                          type="button"
                          onClick={() => handleSelectMatchedProduct(modalMatchEval.suggestedProduct!)}
                          className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                            modalMatchEval.matchConfidence >= 75
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {modalMatchEval.matchConfidence >= 75
                            ? '✓ Accept Suggested Match'
                            : 'Accept Suggestion (Override)'}
                        </button>
                      </div>

                      {modalMatchEval.isLowConfidence && (
                        <div className="text-[10.5px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            <strong>Low Confidence Rule:</strong> Fuzzy similarity is below 75%. Manual selection from
                            the catalog below is recommended to avoid linking the wrong inventory item.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. MANUAL PRODUCT SELECTION FROM STORE CATALOG */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-stone-500" />
                      <span>Manual Selection from Store Catalog ({catalogProducts.length} items)</span>
                    </span>
                    <span className="text-[11px] font-normal text-stone-500">
                      Search by name, SKU, or UPC barcode
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Type to filter catalog by product name, SKU, or barcode..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Catalog List */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-stone-200 rounded-lg p-2 bg-stone-50/50">
                    {loadingProducts ? (
                      <div className="py-8 text-center text-xs text-stone-400">Loading catalog products...</div>
                    ) : filteredCatalog.length === 0 ? (
                      <div className="py-8 text-center space-y-1">
                        <Boxes className="w-6 h-6 text-stone-300 mx-auto" />
                        <div className="text-xs text-stone-500 font-medium">
                          No catalog products found matching "{productSearchQuery}"
                        </div>
                      </div>
                    ) : (
                      filteredCatalog.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => handleSelectMatchedProduct(prod)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            matchingModalItem.matchedProductId === prod.id
                              ? 'border-emerald-500 bg-emerald-50/80 shadow-2xs'
                              : 'border-stone-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs text-stone-900 flex items-center gap-2">
                              <span>{prod.name}</span>
                              <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                                {prod.sku}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-stone-500 flex items-center gap-3">
                              {prod.barcode && <span>UPC: {prod.barcode}</span>}
                              {prod.categoryName && <span>Category: {prod.categoryName}</span>}
                              <span>Cost: ${prod.purchasePrice.toFixed(2)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-2.5 py-1 rounded bg-stone-800 hover:bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer shrink-0 transition-colors"
                          >
                            Select Product
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. EXPLICIT NEW PRODUCT CREATION CONFIRMATION */}
                {/* Requirement: Do not automatically create a new product without user confirmation */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Item Not in Catalog? Confirm as New Product</span>
                    </div>
                    <span className="text-[10px] text-blue-800 font-semibold bg-blue-100 px-2 py-0.5 rounded">
                      User Confirmation Required
                    </span>
                  </div>

                  <p className="text-[11px] text-blue-900 leading-relaxed">
                    To prevent accidental duplicates, products are <strong>never created automatically</strong>. If this
                    line item is genuinely new, explicitly confirm it below. It will be added to the catalog upon invoice
                    confirmation.
                  </p>

                  <div className="bg-white p-2.5 rounded border border-blue-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold text-stone-900">{matchingModalItem.productName}</div>
                      <div className="text-[10.5px] text-stone-500 font-mono">
                        New SKU: {matchingModalItem.sku || `SKU-${matchingModalItem.productName.slice(0, 3).toUpperCase()}-NEW`} · Barcode: {matchingModalItem.barcode || 'None'} · Purchase Price: ${matchingModalItem.unitPrice.toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmNewProduct(matchingModalItem.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span>Confirm as New Catalog Product</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
                <button
                  onClick={() => handleClearMatch(matchingModalItem.id)}
                  className="text-stone-500 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                >
                  Clear Match / Leave Unmatched
                </button>

                <button
                  onClick={() => setMatchingModalItem(null)}
                  className="px-4 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 10-STEP TRANSACTIONAL CONFIRMATION DIALOG MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-emerald-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-800/80 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>10-Step Transactional Confirmation</span>
                    <span className="font-mono text-[11px] text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded">
                      {headerState.invoiceNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-300/80">
                    Atomic database transaction · Zero duplicate products · Rollback safeguard on failure
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex border-b border-stone-200 bg-stone-50 px-4 pt-2 shrink-0 gap-2">
              <button
                onClick={() => setActiveStepTab('OVERVIEW')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-t border-x ${
                  activeStepTab === 'OVERVIEW'
                    ? 'bg-white text-emerald-900 border-stone-200 -mb-px'
                    : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
                }`}
              >
                Stock Impact ({activeItems.length})
              </button>
              <button
                onClick={() => setActiveStepTab('UNCERTAIN')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-t border-x flex items-center gap-1.5 ${
                  activeStepTab === 'UNCERTAIN'
                    ? 'bg-white text-emerald-900 border-stone-200 -mb-px'
                    : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
                }`}
              >
                <span>Step 4: Uncertain Matches</span>
                {uncertainActiveItems.length > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                    {uncertainActiveItems.length}
                  </span>
                ) : (
                  <Check className="w-3 h-3 text-emerald-600" />
                )}
              </button>
              <button
                onClick={() => setActiveStepTab('STEPS')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-t border-x ${
                  activeStepTab === 'STEPS'
                    ? 'bg-white text-emerald-900 border-stone-200 -mb-px'
                    : 'bg-transparent text-stone-600 border-transparent hover:text-stone-900'
                }`}
              >
                10-Step Execution Protocol
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {activeStepTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Ready to confirm Purchase Invoice {headerState.invoiceNumber}</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Executing confirmation will run an atomic database transaction through all 10 validation,
                      product matching, purchase ledger, inventory increment, and notification steps.
                    </p>
                  </div>

                  {/* Stock to be Added */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                      <span>Line Items to Stock ({activeItems.length}):</span>
                      <span className="font-mono text-stone-500 text-[11px]">
                        Supplier: {headerState.supplier} · {headerState.invoiceDate}
                      </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                      {activeItems.map((it) => (
                        <div key={it.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-stone-50">
                          <div>
                            <div className="font-semibold text-stone-800 flex items-center gap-2">
                              <span>{it.productName}</span>
                              {it.matchedProductName ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                                  <Link2 className="w-3 h-3 text-emerald-600" />
                                  {it.matchedProductName}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200 font-medium">
                                  <Sparkles className="w-3 h-3 text-amber-600" />
                                  New Catalog Product
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                              SKU: {it.sku || 'Auto-catalog'} · UPC: {it.barcode || 'None'} · Confidence: {it.confidence}%
                            </div>
                          </div>
                          <div className="font-mono font-bold text-emerald-700 text-right shrink-0">
                            +{it.quantity} units
                            <div className="text-[10px] text-stone-500 font-normal">
                              ${(it.quantity * it.unitPrice).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {ignoredItemsCount > 0 && (
                    <div className="p-2.5 bg-stone-100 border border-stone-200 rounded text-[11px] text-stone-600 flex items-center gap-2">
                      <EyeOff className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>
                        <strong>{ignoredItemsCount} ignored item(s)</strong> are excluded and will completely bypass
                        inventory updates and purchase ledger records.
                      </span>
                    </div>
                  )}

                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-medium">Total Confirmed Invoice Value:</span>
                    <span className="font-mono font-bold text-base text-emerald-800 tabular-nums">
                      ${activeSum.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {activeStepTab === 'UNCERTAIN' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Requirement: User Confirmation Required for Uncertain Matches</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      To prevent inventory corruption and ensure no duplicate products are created, you must explicitly
                      review and approve all uncertain OCR extractions or new product catalog additions before
                      confirming.
                    </p>
                  </div>

                  {uncertainActiveItems.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-emerald-300 rounded-lg bg-emerald-50/50 space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div className="text-xs font-bold text-emerald-900">All Matches Verified & Certain</div>
                      <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
                        Every active line item has high OCR confidence and is linked to a validated catalog product.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                        <span>Items Requiring Verification ({uncertainActiveItems.length}):</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = new Set(uncertainActiveItems.map((u) => u.id));
                            setVerifiedItemIds(allIds);
                            setConfirmUncertainMatchesChecked(true);
                          }}
                          className="text-emerald-700 hover:underline text-[11px] font-semibold cursor-pointer"
                        >
                          Mark All Verified
                        </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {uncertainActiveItems.map((item) => {
                          const isItemVerified = verifiedItemIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                                isItemVerified
                                  ? 'border-emerald-300 bg-emerald-50/50'
                                  : 'border-amber-300 bg-amber-50/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="font-bold text-stone-900 flex items-center gap-2">
                                    <span>{item.productName}</span>
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-stone-200 text-stone-700">
                                      OCR: {item.confidence}%
                                    </span>
                                  </div>

                                  {/* Matched product / Suggested product / Unmatched status */}
                                  <div className="text-[11px] space-y-1 mt-1">
                                    {item.matchedProductName ? (
                                      <div className="text-emerald-900 font-medium flex items-center gap-1.5 bg-emerald-100/70 px-2 py-1 rounded">
                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>
                                          Matched to: <strong>{item.matchedProductName}</strong> (SKU: {item.matchedProductSku})
                                        </span>
                                      </div>
                                    ) : item.suggestedProductName ? (
                                      <div className="text-amber-900 bg-amber-100/70 px-2 py-1 rounded space-y-0.5">
                                        <div className="flex items-center gap-1.5 font-bold">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                          <span>
                                            Suggested Product: <strong>{item.suggestedProductName}</strong> (SKU: {item.suggestedProductSku})
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-amber-800">
                                          Match Confidence: <strong>{item.matchConfidence ?? 65}%</strong> (Tier 4 Fuzzy) · Manual selection required
                                        </div>
                                      </div>
                                    ) : item.userConfirmedNewProduct ? (
                                      <div className="text-blue-900 bg-blue-100/70 px-2 py-1 rounded flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span>
                                          Explicitly confirmed to create new product in catalog (SKU: {item.sku || 'Auto-catalog'})
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-rose-900 bg-rose-100/70 px-2 py-1 rounded space-y-0.5">
                                        <div className="flex items-center gap-1.5 font-bold">
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                          <span>Unmatched Item (0% Confidence)</span>
                                        </div>
                                        <div className="text-[10px] text-rose-800">
                                          Cannot automatically create without confirmation. Please select from catalog or confirm as new product below.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMatchingModal(item)}
                                    className="px-2.5 py-1 rounded border border-stone-300 bg-white hover:bg-stone-50 text-[10px] font-semibold text-stone-700 cursor-pointer"
                                  >
                                    Review / Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVerifiedItemIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(item.id)) next.delete(item.id);
                                        else next.add(item.id);
                                        return next;
                                      });
                                    }}
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                      isItemVerified
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                    }`}
                                  >
                                    {isItemVerified ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>Verified</span>
                                      </>
                                    ) : (
                                      <span>Verify Match</span>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {item.reviewReasons.length > 0 && (
                                <div className="text-[10px] text-stone-500 bg-white/80 p-1.5 rounded border border-stone-200">
                                  <strong>Uncertainty Reasons:</strong> {item.reviewReasons.join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mandatory Explicit Confirmation Checkbox */}
                  {uncertainActiveItems.length > 0 && (
                    <label className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-stone-100/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={confirmUncertainMatchesChecked}
                        onChange={(e) => setConfirmUncertainMatchesChecked(e.target.checked)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900">
                          I explicitly confirm and approve all {uncertainActiveItems.length} uncertain item matches and new
                          catalog additions.
                        </span>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Confirms that product names, SKUs, and barcodes have been inspected and no duplicate products will
                          be erroneously introduced into the catalog.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {activeStepTab === 'STEPS' && (
                <div className="space-y-3">
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>The 10-Step Confirmation Sequence</span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Executed within a single database transaction. If any step fails or encounters a conflict, the
                      entire operation automatically rolls back.
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {[
                      { step: 1, title: 'Validate invoice', desc: 'Checks supplier, date, number format & uniqueness' },
                      { step: 2, title: 'Validate invoice items', desc: 'Verifies positive quantities, prices, and non-empty names' },
                      {
                        step: 3,
                        title: 'Match each item to a product',
                        desc: 'Evaluates in strict order: 1. Barcode ➔ 2. SKU ➔ 3. Exact normalized name ➔ 4. Fuzzy name matching',
                      },
                      {
                        step: 4,
                        title: 'Require user confirmation for uncertain matches',
                        desc: 'Requires manual selection for low confidence (< 75%); prohibits automatic new product creation without user confirmation',
                      },
                      { step: 5, title: 'Create purchase invoice', desc: 'Transitions status to CONFIRMED with timestamp & ledger reference' },
                      { step: 6, title: 'Create invoice items', desc: 'Persists formal purchase invoice line item records' },
                      { step: 7, title: 'Increase inventory', desc: 'Adds purchased quantities to store product inventory balances' },
                      { step: 8, title: 'Create PURCHASE inventory transactions', desc: 'Appends immutable audit transactions to stock ledger' },
                      { step: 9, title: 'Recalculate stock status', desc: 'Re-evaluates OUT_OF_STOCK, LOW_STOCK, and IN_STOCK statuses' },
                      { step: 10, title: 'Trigger notification logic', desc: 'Emits restock notifications & inventory threshold alerts' },
                    ].map((s) => (
                      <div key={s.step} className="p-2 rounded border border-stone-200 bg-white flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                          {s.step}
                        </span>
                        <div>
                          <div className="font-semibold text-stone-800">{s.title}</div>
                          <div className="text-[10px] text-stone-500">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction Rollback Simulation Option */}
              <div className="p-3 bg-stone-100/80 rounded-lg border border-stone-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-stone-700 font-medium">Verify Database Rollback Behavior:</span>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-stone-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulateRollbackFailure}
                    onChange={(e) => setSimulateRollbackFailure(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Simulate Step Failure (Test Rollback)</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {uncertainActiveItems.length > 0 && !confirmUncertainMatchesChecked && (
                  <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Approve uncertain matches above to enable confirmation</span>
                  </span>
                )}

                <button
                  onClick={handleExplicitConfirm}
                  disabled={isConfirming || (uncertainActiveItems.length > 0 && !confirmUncertainMatchesChecked)}
                  className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
                    uncertainActiveItems.length > 0 && !confirmUncertainMatchesChecked
                      ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                      : simulateRollbackFailure
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isConfirming ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Database Transaction...</span>
                    </>
                  ) : simulateRollbackFailure ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Test Transaction Rollback</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Invoice & Update Inventory</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUCCESS RECEIPT MODAL */}
      {confirmationResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-stone-200 overflow-hidden space-y-4 max-h-[92vh] flex flex-col">
            <div className="p-5 bg-emerald-600 text-white text-center space-y-2 shrink-0">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-base font-bold">Database Transaction Committed!</h3>
              <p className="text-xs text-emerald-100">
                Invoice {confirmationResult.invoice.invoiceNumber} confirmed across all 10 steps. Store inventory has
                been updated.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-mono font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                TRANSACTION STATUS: {confirmationResult.transactionStatus || 'COMMITTED'}
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Created Invoice Line Items */}
              {confirmationResult.createdInvoiceItems && confirmationResult.createdInvoiceItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span>Created Purchase Invoice Items:</span>
                    <span className="font-mono text-[11px] text-stone-500">
                      {confirmationResult.createdInvoiceItems.length} records persisted
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg text-xs">
                    {confirmationResult.createdInvoiceItems.map((item) => (
                      <div key={item.id} className="p-2 flex items-center justify-between hover:bg-stone-50">
                        <div>
                          <div className="font-semibold text-stone-900">{item.productName}</div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            SKU: {item.sku} · Item #{item.id} · Matched: {item.matchedBy}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-stone-800">{item.quantity} × ${item.unitPrice.toFixed(2)}</span>
                          <div className="text-[10px] text-emerald-700 font-bold">${item.totalPrice.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Updated Inventory Balances */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                  <span>Updated Inventory Balances:</span>
                  <span className="font-mono text-[11px] text-stone-500">
                    {confirmationResult.inventoryUpdates.length} product(s) stocked
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-lg">
                  {confirmationResult.inventoryUpdates.map((u) => (
                    <div key={u.transactionId} className="p-2.5 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-stone-900 flex items-center gap-2">
                          <span>{u.productName}</span>
                          {u.stockStatus && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                u.stockStatus === 'IN STOCK'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : u.stockStatus === 'LOW STOCK'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {u.stockStatus}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          SKU: {u.productSku} · Transaction #{u.transactionId}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="font-bold text-emerald-700">+{u.addedQuantity} added</div>
                        <div className="text-[10px] text-stone-500">New balance: {u.newQuantity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Triggered Notifications */}
              {confirmationResult.notificationsTriggered && confirmationResult.notificationsTriggered.length > 0 && (
                <div className="space-y-1.5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Triggered Notification Logic ({confirmationResult.notificationsTriggered.length}):</span>
                  </div>
                  {confirmationResult.notificationsTriggered.map((n) => (
                    <div key={n.id} className="text-[11px] text-blue-800 pl-5">
                      • <strong>{n.type}:</strong> {n.message}
                    </div>
                  ))}
                </div>
              )}

              {confirmationResult.skippedItemsCount > 0 && (
                <div className="text-[11px] text-stone-500 italic">
                  Note: {confirmationResult.skippedItemsCount} ignored item(s) were excluded from inventory update.
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => setConfirmationResult(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Close Receipt
              </button>

              <button
                onClick={() => {
                  setConfirmationResult(null);
                  onBack();
                }}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Return to Invoices Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
