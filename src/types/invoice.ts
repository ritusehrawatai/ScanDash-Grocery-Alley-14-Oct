export type InvoiceStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'CONFIRMED' | 'FAILED';

export interface ExtractedField<T = string> {
  value: T;
  confidence: number; // 0 to 100
  flaggedForReview: boolean;
  reason?: string;
  originalValue?: T;
  userEdited?: boolean;
}

export interface ExtractedInvoiceItem {
  id: string;
  productName: ExtractedField<string>;
  sku: ExtractedField<string>;
  barcode: ExtractedField<string>;
  quantity: ExtractedField<number>;
  unitPrice: ExtractedField<number>;
  total: ExtractedField<number>;
  confidence: number;
  flaggedForReview: boolean;
  reviewReasons: string[];
  // Review modifications & matching:
  matchedProductId?: number | null;
  matchedProductName?: string | null;
  matchedProductSku?: string | null;
  matchMethod?: 'BARCODE' | 'SKU' | 'EXACT_NAME' | 'FUZZY_NAME' | 'MANUAL_SELECTION' | 'NO_MATCH';
  matchConfidence?: number;
  matchReason?: string;
  isLowConfidenceMatch?: boolean;
  manualSelectionRequired?: boolean;
  manualSelectionCompleted?: boolean;
  userConfirmedNewProduct?: boolean;
  ignored?: boolean;
  userModified?: boolean;
}

export type ProductMatchMethod =
  | 'BARCODE'
  | 'SKU'
  | 'EXACT_NAME'
  | 'FUZZY_NAME'
  | 'MANUAL_SELECTION'
  | 'NO_MATCH';

export interface ProductMatchSuggestion {
  itemId: string;
  suggestedProduct: {
    id: number;
    name: string;
    sku: string;
    barcode: string | null;
    unit: string;
    sellingPrice: number;
    purchasePrice: number;
    currentQuantity?: number;
    categoryName?: string | null;
  } | null;
  matchMethod: ProductMatchMethod;
  matchConfidence: number; // 0 to 100
  isLowConfidence: boolean; // < 75 or FUZZY_NAME or NO_MATCH
  matchReason: string;
  manualSelectionRequired: boolean;
  manualSelectionCompleted?: boolean;
  userConfirmedNewProduct?: boolean;
}

export interface InvoiceOcrResult {
  supplier: ExtractedField<string>;
  invoiceNumber: ExtractedField<string>;
  invoiceDate: ExtractedField<string>;
  total: ExtractedField<number>;
  items: ExtractedInvoiceItem[];
  overallConfidence: number; // 0 to 100
  hasLowConfidenceValues: boolean;
  manualReviewRequired: boolean;
  ocrEngine: string; // "Tesseract OCR (open-source v5)"
  processedAt: string;
  rawText: string;
  flaggedFieldsCount: number;
  // Safety & confirmation state:
  inventoryUpdated: boolean;
  automaticallyConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  status: InvoiceStatus;
  uploadedBy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  ocrResult?: InvoiceOcrResult;
  ocrProcessedAt?: string;
  confirmedAt?: string;
}

export interface PurchaseInvoiceItemRecord {
  id: number;
  purchaseInvoiceId: number;
  invoiceNumber: string;
  productId: number;
  productName: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  matchedBy: 'EXPLICIT_USER_SELECTION' | 'BARCODE' | 'SKU' | 'NAME' | 'NEW_PRODUCT_CREATED';
  createdAt: string;
}

export interface InvoiceReviewItemUpdate {
  id: string;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  total: number;
  matchedProductId?: number | null;
  matchedProductName?: string | null;
  matchedProductSku?: string | null;
  matchMethod?: ProductMatchMethod;
  matchConfidence?: number;
  matchReason?: string;
  isLowConfidenceMatch?: boolean;
  manualSelectionRequired?: boolean;
  manualSelectionCompleted?: boolean;
  userConfirmedNewProduct?: boolean;
  ignored?: boolean;
  userModified?: boolean;
  uncertainMatchConfirmed?: boolean;
}

export interface InvoiceReviewPayload {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  items: InvoiceReviewItemUpdate[];
  notes?: string;
}

export interface InvoiceConfirmOptions {
  confirmedUncertainMatches?: boolean;
  simulateFailure?: boolean;
  confirmedNewProductItemIds?: string[];
}

export interface InvoiceConfirmResponse {
  success: boolean;
  message: string;
  invoice: PurchaseInvoice;
  createdInvoiceItems: PurchaseInvoiceItemRecord[];
  inventoryUpdates: Array<{
    productId: number;
    productName: string;
    productSku: string;
    addedQuantity: number;
    newQuantity: number;
    transactionId: number;
    stockStatus: 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
  }>;
  skippedItemsCount: number; // ignored or zero qty
  notificationsTriggered: Array<{
    id: number;
    type: string;
    message: string;
    severity: string;
  }>;
  transactionStatus: 'COMMITTED';
  timestamp: string;
}

export interface InvoiceUploadResponse {
  success: boolean;
  message: string;
  data: PurchaseInvoice;
  timestamp: string;
}

export interface InvoiceListResponse {
  success: boolean;
  message: string;
  data: PurchaseInvoice[];
  timestamp: string;
}

export interface InvoiceOcrResponse {
  success: boolean;
  message: string;
  data: InvoiceOcrResult;
  invoice: PurchaseInvoice;
  timestamp: string;
}

