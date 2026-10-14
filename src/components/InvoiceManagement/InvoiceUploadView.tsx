import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  FileImage,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  Copy,
  Info,
  Clock,
  HardDrive,
  FileCheck,
  X,
  Lock,
  Sparkles,
  AlertTriangle,
  Cpu,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Layers,
  HelpCircle,
  SlidersHorizontal,
  Edit3,
} from 'lucide-react';
import { PurchaseInvoice, InvoiceOcrResult, ExtractedInvoiceItem } from '../../types/invoice';
import {
  uploadInvoice,
  fetchInvoices,
  deleteInvoice,
  getInvoiceDownloadUrl,
  processInvoiceOcr,
  InvoiceApiError,
} from '../../api/invoiceApi';
import { InvoiceReviewScreen } from './InvoiceReviewScreen';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

interface FileValidationResult {
  valid: boolean;
  error?: string;
  extension: string;
  mimeType: string;
  sha256Hex?: string;
}

export const InvoiceUploadView: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationInfo, setValidationInfo] = useState<FileValidationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [uploadedBy, setUploadedBy] = useState<string>('Store Owner / Admin');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [viewInvoiceModal, setViewInvoiceModal] = useState<PurchaseInvoice | null>(null);
  const [reviewingInvoice, setReviewingInvoice] = useState<PurchaseInvoice | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedRawText, setCopiedRawText] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'ocr' | 'rawText'>('ocr');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPLOADED' | 'PROCESSED' | 'CONFIRMED' | 'REVIEW'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // OCR Processing State
  const [processingOcrId, setProcessingOcrId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      showAlert('error', err.message || 'Failed to load purchase invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Inspect file integrity: magic bytes + SHA-256
  const validateFileIntegrity = async (file: File): Promise<FileValidationResult> => {
    if (!file || file.size === 0) {
      return { valid: false, error: 'File is empty (0 bytes).', extension: '', mimeType: '' };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 15 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`,
        extension: '',
        mimeType: '',
      };
    }

    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex > 0 ? file.name.substring(dotIndex + 1).toLowerCase() : '';

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported file extension '.${ext}'. Allowed formats: JPG, JPEG, PNG, PDF.`,
        extension: ext,
        mimeType: file.type,
      };
    }

    try {
      const arrayBuffer = await file.slice(0, 16).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (bytes.length < 4) {
        return {
          valid: false,
          error: 'File header is truncated or unreadable.',
          extension: ext,
          mimeType: file.type,
        };
      }

      if (ext === 'pdf') {
        const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        if (!isPdf) {
          return {
            valid: false,
            error: 'File header does not match PDF format (%PDF-).',
            extension: ext,
            mimeType: 'application/pdf',
          };
        }
      } else if (ext === 'png') {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        if (!isPng) {
          return {
            valid: false,
            error: 'File header does not match PNG format.',
            extension: ext,
            mimeType: 'image/png',
          };
        }
      } else if (ext === 'jpg' || ext === 'jpeg') {
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (!isJpg) {
          return {
            valid: false,
            error: 'File header does not match JPEG/JPG format.',
            extension: ext,
            mimeType: 'image/jpeg',
          };
        }
      }

      // Compute client-side SHA-256 for instant verification
      const fullBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', fullBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      return {
        valid: true,
        extension: ext,
        mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/' + ext),
        sha256Hex,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Could not verify file integrity: ${err.message}`,
        extension: ext,
        mimeType: file.type,
      };
    }
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    const result = await validateFileIntegrity(file);
    setValidationInfo(result);

    if (result.valid && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !validationInfo?.valid) {
      showAlert('error', 'Please select a valid invoice file (JPG, JPEG, PNG, or PDF).');
      return;
    }

    setUploading(true);
    try {
      const created = await uploadInvoice(selectedFile, notes, uploadedBy);
      showAlert('success', `Invoice ${created.invoiceNumber} uploaded successfully. Initial status: UPLOADED.`);
      // Reset form
      setSelectedFile(null);
      setValidationInfo(null);
      setPreviewUrl(null);
      setNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadInvoices();
    } catch (err: any) {
      console.error('Upload error:', err);
      showAlert('error', err.message || 'Upload rejected by server.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunOcr = async (invoiceId: number) => {
    setProcessingOcrId(invoiceId);
    try {
      const response = await processInvoiceOcr(invoiceId);
      showAlert(
        'success',
        `Tesseract OCR completed for ${response.invoice.invoiceNumber}. Extracted ${response.ocrResult.items.length} line items. Low-confidence values flagged for manual review.`
      );
      await loadInvoices();

      // If viewing modal for this invoice, update the modal record
      if (viewInvoiceModal && viewInvoiceModal.id === invoiceId) {
        setViewInvoiceModal({
          ...viewInvoiceModal,
          status: 'PROCESSED',
          ocrResult: response.ocrResult,
          ocrProcessedAt: response.ocrResult.processedAt,
        });
        setActiveTab('ocr');
      }
    } catch (err: any) {
      console.error('OCR processing error:', err);
      showAlert('error', err.message || 'Failed to process invoice OCR.');
    } finally {
      setProcessingOcrId(null);
    }
  };

  const handleDelete = async (invoice: PurchaseInvoice) => {
    if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?`)) {
      try {
        await deleteInvoice(invoice.id);
        showAlert('info', `Invoice ${invoice.invoiceNumber} removed.`);
        await loadInvoices();
        if (viewInvoiceModal?.id === invoice.id) {
          setViewInvoiceModal(null);
        }
      } catch (err: any) {
        showAlert('error', err.message || 'Failed to delete invoice.');
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const copyRawOcrText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRawText(true);
    setTimeout(() => setCopiedRawText(false), 2500);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string): string => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (confidence >= 70) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-rose-100 text-rose-800 border-rose-200';
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'UPLOADED' && inv.status !== 'UPLOADED') return false;
    if (statusFilter === 'PROCESSED' && inv.status !== 'PROCESSED') return false;
    if (statusFilter === 'CONFIRMED' && inv.status !== 'CONFIRMED') return false;
    if (statusFilter === 'REVIEW') {
      if (inv.status !== 'PROCESSED' || !inv.ocrResult?.hasLowConfidenceValues) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchFile = inv.originalFilename.toLowerCase().includes(q);
      const matchSupplier = inv.ocrResult?.supplier.value.toLowerCase().includes(q);
      return matchNum || matchFile || matchSupplier;
    }
    return true;
  });

  if (reviewingInvoice) {
    return (
      <InvoiceReviewScreen
        invoice={reviewingInvoice}
        onBack={() => setReviewingInvoice(null)}
        onInvoiceUpdated={(updated) => {
          setReviewingInvoice(updated);
          loadInvoices();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200">
                Phase 4 Milestone
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Tesseract OCR (Open-Source)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                Owner / Admin Only
              </span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mt-2">
              Purchase Invoice Intake & OCR Extraction
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-3xl leading-relaxed">
              Upload vendor invoices (JPG, JPEG, PNG, PDF) with cryptographic integrity verification, then process
              itemization and metadata using <strong>Tesseract OCR</strong>. Low-confidence values and arithmetic
              discrepancies are automatically flagged for manual review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInvoices}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Safeguards & Architectural Boundaries Card */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50/80 via-blue-50/50 to-emerald-50/60 border border-amber-200/80 rounded-lg text-xs text-stone-800">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-stone-900">
                  Strict Operational Safeguards & Pipeline Rules:
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                  ✓ Inventory Untouched (0 Deductions/Additions)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                  ✓ Invoices NOT Auto-Confirmed
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold text-[10px]">
                  ✓ Low-Confidence & Discrepancies Flagged
                </span>
              </div>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Extracted data includes Supplier, Invoice Number, Invoice Date, Product Name, SKU, Barcode,
                Quantity, Unit Price, and Total. High-confidence items are verified; any uncertain readings (&lt;75%)
                are flagged for manual cashier review without mutating current store stock.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert banner if any */}
      {alertMessage && (
        <div
          className={`p-4 rounded-lg text-xs font-medium border flex items-center justify-between ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : alertMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : alertMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            onClick={() => setAlertMessage(null)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Upload Dropzone & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Form (Left Column, 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-5">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Upload Vendor Invoice</span>
            </h2>
            <p className="text-[11px] text-stone-500 mt-1">
              Accepted formats: <span className="font-medium text-stone-700">JPG, JPEG, PNG, PDF</span> (Max 15MB)
            </p>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    {/* Preview if image */}
                    {previewUrl ? (
                      <div className="w-full h-32 flex items-center justify-center bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                        <img
                          src={previewUrl}
                          alt="Invoice Preview"
                          className="h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 mx-auto rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                        <FileText className="w-8 h-8" />
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-semibold text-stone-800 truncate max-w-xs mx-auto">
                        {selectedFile.name}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {formatBytes(selectedFile.size)} • {selectedFile.type || 'Document'}
                      </div>
                    </div>

                    {validationInfo?.valid ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Validated & Integrity Verified</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Validation error</span>
                      </div>
                    )}

                    <div className="text-[10px] text-stone-400">
                      Click or drag a different file to replace
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 text-stone-600 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6 text-stone-500" />
                    </div>
                    <div className="text-xs font-medium text-stone-700">
                      Drag and drop invoice file here, or{' '}
                      <span className="text-emerald-600 font-semibold underline">browse</span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Supports JPG, JPEG, PNG, or PDF up to 15MB
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-upload Validation Checklist Card */}
              {selectedFile && (
                <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-stone-700 uppercase tracking-wider">
                    Pre-Upload Validation Checks
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-600">File Format (JPG, JPEG, PNG, PDF):</span>
                      {validationInfo?.valid ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>.{validationInfo.extension.toUpperCase()}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Invalid format</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-600">File Size (&lt; 15MB):</span>
                      {selectedFile.size <= MAX_FILE_SIZE_BYTES ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{formatBytes(selectedFile.size)}</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Exceeds limit</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-stone-600">File Header & Magic Bytes:</span>
                      {validationInfo?.valid ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Signature verified</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Header mismatch</span>
                        </span>
                      )}
                    </div>

                    {validationInfo?.sha256Hex && (
                      <div className="pt-1.5 border-t border-stone-200">
                        <div className="text-[10px] text-stone-500 font-medium flex items-center justify-between">
                          <span>SHA-256 Checksum:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(validationInfo.sha256Hex!)}
                            className="text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedHash === validationInfo.sha256Hex ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="font-mono text-[9.5px] text-stone-700 break-all bg-white p-1 rounded border border-stone-200 mt-1">
                          {validationInfo.sha256Hex}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Uploaded By */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Uploader Role
                </label>
                <select
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="Store Owner / Admin">Store Owner / Admin</option>
                  <option value="Inventory Manager">Inventory Manager</option>
                  <option value="Head Cashier">Head Cashier</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Supplier / Invoice Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white resize-none"
                  placeholder="e.g. Weekly organic produce delivery from Valley Wholesalers"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedFile || !validationInfo?.valid || uploading}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs ${
                  !selectedFile || !validationInfo?.valid || uploading
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validating & Storing Securely...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Upload & Create PurchaseInvoice Record</span>
                  </>
                )}
              </button>

              <div className="text-[10px] text-center text-stone-400">
                Stored in isolated storage directory with UUID filename sanitization.
              </div>
            </form>
          </div>
        </div>

        {/* Ledger / History Table (Right Column, 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-3">
              <div>
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Purchase Invoices Ledger</span>
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Showing {filteredInvoices.length} of {invoices.length} invoices
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg text-[11px]">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'ALL' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All ({invoices.length})
                </button>
                <button
                  onClick={() => setStatusFilter('UPLOADED')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'UPLOADED' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Uploaded ({invoices.filter((i) => i.status === 'UPLOADED').length})
                </button>
                <button
                  onClick={() => setStatusFilter('PROCESSED')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'PROCESSED' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  OCR Extracted ({invoices.filter((i) => i.status === 'PROCESSED').length})
                </button>
                <button
                  onClick={() => setStatusFilter('CONFIRMED')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'CONFIRMED' ? 'bg-white shadow-xs text-purple-700 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Confirmed ({invoices.filter((i) => i.status === 'CONFIRMED').length})
                </button>
                <button
                  onClick={() => setStatusFilter('REVIEW')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'REVIEW' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Needs Review ({invoices.filter((i) => i.status === 'PROCESSED' && i.ocrResult?.hasLowConfidenceValues).length})
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-3 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices by number, supplier, or filename..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {loading ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                Loading purchase invoices ledger...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-16 text-center text-stone-400 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 text-stone-400 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div className="text-xs font-medium text-stone-600">
                  No purchase invoices found matching filter
                </div>
                <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                  Upload an invoice or switch filters to see records in other stages.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 text-[11px] font-semibold">
                      <th className="py-2.5 px-3">Invoice & Supplier</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">OCR Confidence</th>
                      <th className="py-2.5 px-3">Total</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <button
                            onClick={() => {
                              setViewInvoiceModal(inv);
                              setActiveTab(inv.status === 'PROCESSED' ? 'ocr' : 'details');
                            }}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline font-mono font-bold text-xs cursor-pointer text-left block"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <div className="text-[11px] text-stone-800 font-medium truncate max-w-[150px] mt-0.5">
                            {inv.ocrResult?.supplier?.value || (
                              <span className="text-stone-400 italic">Pending OCR extraction</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {inv.status === 'UPLOADED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                              UPLOADED
                            </span>
                          )}
                          {inv.status === 'PROCESSING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-800 border border-amber-200">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              PROCESSING
                            </span>
                          )}
                          {inv.status === 'PROCESSED' && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check className="w-2.5 h-2.5" />
                                PROCESSED
                              </span>
                              {inv.ocrResult?.hasLowConfidenceValues && (
                                <div className="text-[9.5px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block">
                                  Review Needed
                                </div>
                              )}
                            </div>
                          )}
                          {inv.status === 'CONFIRMED' && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                CONFIRMED
                              </span>
                              <div className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-block">
                                Stock Updated
                              </div>
                            </div>
                          )}
                          {inv.status === 'FAILED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                              FAILED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {inv.ocrResult ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getConfidenceBadgeColor(
                                  inv.ocrResult.overallConfidence
                                )}`}
                              >
                                {inv.ocrResult.overallConfidence}%
                              </span>
                              {inv.ocrResult.hasLowConfidenceValues ? (
                                <span
                                  className="text-amber-600 hover:text-amber-800"
                                  title={`${inv.ocrResult.flaggedFieldsCount} values flagged for review`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="text-emerald-600" title="High confidence extraction">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono font-medium text-[11px] text-stone-900">
                          {inv.ocrResult?.total?.value !== undefined
                            ? `$${Number(inv.ocrResult.total.value).toFixed(2)}`
                            : '—'}
                        </td>

                        <td className="py-3 px-3 text-stone-500">
                          <div className="flex items-center gap-1">
                            {inv.mimeType.includes('pdf') ? (
                              <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            ) : (
                              <FileImage className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="text-[10px] font-mono">
                              {inv.originalFilename.split('.').pop()?.toUpperCase()}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Run Tesseract OCR button */}
                            {inv.status === 'UPLOADED' && (
                              <button
                                onClick={() => handleRunOcr(inv.id)}
                                disabled={processingOcrId === inv.id}
                                title="Run open-source Tesseract OCR extraction"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold cursor-pointer shadow-2xs transition-colors"
                              >
                                {processingOcrId === inv.id ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Scanning...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    <span>Run Tesseract OCR</span>
                                  </>
                                )}
                              </button>
                            )}

                            {inv.status === 'PROCESSED' && (
                              <>
                                <button
                                  onClick={() => setReviewingInvoice(inv)}
                                  title="Open Invoice Review Screen to edit fields, match products, and confirm"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold cursor-pointer shadow-2xs transition-colors"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Review & Edit</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setViewInvoiceModal(inv);
                                    setActiveTab('ocr');
                                  }}
                                  title="Inspect Extracted Data & Confidence"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold border border-stone-200 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Details</span>
                                </button>
                              </>
                            )}

                            {inv.status === 'CONFIRMED' && (
                              <button
                                onClick={() => setReviewingInvoice(inv)}
                                title="View Confirmed Invoice and Product Matches"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-300 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>View Review</span>
                              </button>
                            )}

                            <a
                              href={getInvoiceDownloadUrl(inv.id)}
                              download={inv.originalFilename}
                              title="Download Stored File"
                              className="p-1.5 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => handleDelete(inv)}
                              title="Delete Invoice"
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Details & OCR Inspection Modal */}
      {viewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-stone-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-stone-900 text-stone-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Invoice Inspection</span>
                    <span className="font-mono text-xs bg-stone-800 px-2 py-0.5 rounded text-emerald-300 font-semibold">
                      {viewInvoiceModal.invoiceNumber}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        viewInvoiceModal.status === 'PROCESSED'
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                          : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                      }`}
                    >
                      {viewInvoiceModal.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewInvoiceModal(null)}
                className="text-stone-400 hover:text-white p-1 rounded hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="flex items-center justify-between px-5 pt-3 border-b border-stone-200 bg-stone-50 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('ocr')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeTab === 'ocr'
                      ? 'border-emerald-600 text-emerald-700 bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>OCR Extracted Data</span>
                  {viewInvoiceModal.ocrResult?.hasLowConfidenceValues && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                    activeTab === 'details'
                      ? 'border-emerald-600 text-emerald-700 bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>File Storage & Hash</span>
                </button>

                {viewInvoiceModal.ocrResult?.rawText && (
                  <button
                    onClick={() => setActiveTab('rawText')}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                      activeTab === 'rawText'
                        ? 'border-emerald-600 text-emerald-700 bg-white'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Raw OCR Text</span>
                  </button>
                )}
              </div>

              {/* Action in header if not processed */}
              {viewInvoiceModal.status === 'UPLOADED' && (
                <button
                  onClick={() => handleRunOcr(viewInvoiceModal.id)}
                  disabled={processingOcrId === viewInvoiceModal.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer mb-2"
                >
                  {processingOcrId === viewInvoiceModal.id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Running Tesseract OCR...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Tesseract OCR Now</span>
                    </>
                  )}
                </button>
              )}

              {(viewInvoiceModal.status === 'PROCESSED' || viewInvoiceModal.status === 'CONFIRMED') && (
                <button
                  onClick={() => {
                    const inv = viewInvoiceModal;
                    setViewInvoiceModal(null);
                    setReviewingInvoice(inv);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer mb-2"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open Review Screen</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: OCR EXTRACTED DATA */}
              {activeTab === 'ocr' && (
                <div className="space-y-4">
                  {!viewInvoiceModal.ocrResult ? (
                    <div className="py-12 text-center space-y-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                      <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-stone-800">
                        OCR has not been run on this invoice yet
                      </div>
                      <p className="text-xs text-stone-500 max-w-md mx-auto">
                        Click below to launch the free & open-source <strong>Tesseract OCR</strong> engine to extract
                        Supplier, Invoice Number, Date, Product Name, SKU, Barcode, Quantity, Unit Price, and Total.
                      </p>
                      <button
                        onClick={() => handleRunOcr(viewInvoiceModal.id)}
                        disabled={processingOcrId === viewInvoiceModal.id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                      >
                        {processingOcrId === viewInvoiceModal.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Document with Tesseract...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Execute Tesseract OCR Processing</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Extraction Summary Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {/* Supplier */}
                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase">
                            <span>Supplier</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${getConfidenceBadgeColor(
                                viewInvoiceModal.ocrResult.supplier.confidence
                              )}`}
                            >
                              {viewInvoiceModal.ocrResult.supplier.confidence}%
                            </span>
                          </div>
                          <div className="font-bold text-xs text-stone-900 mt-1 break-words">
                            {viewInvoiceModal.ocrResult.supplier.value}
                          </div>
                          {viewInvoiceModal.ocrResult.supplier.flaggedForReview && (
                            <div className="mt-1 text-[9.5px] text-amber-700 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{viewInvoiceModal.ocrResult.supplier.reason || 'Flagged for review'}</span>
                            </div>
                          )}
                        </div>

                        {/* Invoice Number */}
                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase">
                            <span>Invoice Number</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${getConfidenceBadgeColor(
                                viewInvoiceModal.ocrResult.invoiceNumber.confidence
                              )}`}
                            >
                              {viewInvoiceModal.ocrResult.invoiceNumber.confidence}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-xs text-stone-900 mt-1">
                            {viewInvoiceModal.ocrResult.invoiceNumber.value}
                          </div>
                          {viewInvoiceModal.ocrResult.invoiceNumber.flaggedForReview && (
                            <div className="mt-1 text-[9.5px] text-amber-700 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Flagged for review</span>
                            </div>
                          )}
                        </div>

                        {/* Invoice Date */}
                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase">
                            <span>Invoice Date</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${getConfidenceBadgeColor(
                                viewInvoiceModal.ocrResult.invoiceDate.confidence
                              )}`}
                            >
                              {viewInvoiceModal.ocrResult.invoiceDate.confidence}%
                            </span>
                          </div>
                          <div className="font-bold text-xs text-stone-900 mt-1">
                            {viewInvoiceModal.ocrResult.invoiceDate.value}
                          </div>
                          {viewInvoiceModal.ocrResult.invoiceDate.flaggedForReview && (
                            <div className="mt-1 text-[9.5px] text-amber-700 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Flagged for review</span>
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase">
                            <span>Grand Total</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${getConfidenceBadgeColor(
                                viewInvoiceModal.ocrResult.total.confidence
                              )}`}
                            >
                              {viewInvoiceModal.ocrResult.total.confidence}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-sm text-emerald-800 mt-1">
                            ${Number(viewInvoiceModal.ocrResult.total.value).toFixed(2)}
                          </div>
                          {viewInvoiceModal.ocrResult.total.flaggedForReview && (
                            <div className="mt-1 text-[9.5px] text-amber-700 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{viewInvoiceModal.ocrResult.total.reason || 'Flagged for review'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manual Review Alert Banner (if any value is low-confidence or math mismatch) */}
                      {viewInvoiceModal.ocrResult.manualReviewRequired ? (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-bold text-amber-950 flex items-center gap-2">
                              <span>Manual Review Required</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono text-[10px]">
                                {viewInvoiceModal.ocrResult.flaggedFieldsCount} values flagged
                              </span>
                            </div>
                            <p className="text-amber-800/90 leading-relaxed text-[11px]">
                              One or more items had low OCR recognition certainty (&lt;75%), missing barcode/SKU, or
                              arithmetic discrepancy between Quantity × Unit Price and Line Total. Please review
                              highlighted rows carefully.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-medium">
                            High-confidence extraction completed across all fields ({viewInvoiceModal.ocrResult.overallConfidence}% average). No critical discrepancies found.
                          </span>
                        </div>
                      )}

                      {/* Line Items Table */}
                      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                        <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                          <span className="font-bold text-xs text-stone-800">
                            Extracted Line Items ({viewInvoiceModal.ocrResult.items.length})
                          </span>
                          <span className="text-[10px] text-stone-500 font-mono">
                            Engine: {viewInvoiceModal.ocrResult.ocrEngine}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-stone-200 bg-stone-100/60 text-stone-500 text-[10px] uppercase font-semibold">
                                <th className="py-2 px-3">Product Name</th>
                                <th className="py-2 px-3">SKU</th>
                                <th className="py-2 px-3">Barcode</th>
                                <th className="py-2 px-3 text-right">Qty</th>
                                <th className="py-2 px-3 text-right">Unit Price</th>
                                <th className="py-2 px-3 text-right">Line Total</th>
                                <th className="py-2 px-3 text-center">Confidence</th>
                                <th className="py-2 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-stone-700">
                              {viewInvoiceModal.ocrResult.items.map((it) => (
                                <tr
                                  key={it.id}
                                  className={it.flaggedForReview ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-stone-50/50'}
                                >
                                  {/* Product Name */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-stone-900">{it.productName.value}</div>
                                    {it.reviewReasons.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {it.reviewReasons.map((r, rIdx) => (
                                          <div
                                            key={rIdx}
                                            className="text-[9.5px] text-amber-800 font-medium flex items-center gap-1"
                                          >
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span>{r}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>

                                  {/* SKU */}
                                  <td className="py-2.5 px-3 font-mono text-[11px]">
                                    {it.sku.value ? (
                                      <span
                                        className={
                                          it.sku.flaggedForReview
                                            ? 'text-amber-800 bg-amber-100 px-1 py-0.5 rounded font-bold'
                                            : 'text-stone-700'
                                        }
                                      >
                                        {it.sku.value}
                                      </span>
                                    ) : (
                                      <span className="text-stone-400 italic">Missing</span>
                                    )}
                                  </td>

                                  {/* Barcode */}
                                  <td className="py-2.5 px-3 font-mono text-[11px]">
                                    {it.barcode.value && it.barcode.value !== 'Not detected' ? (
                                      <span
                                        className={
                                          it.barcode.flaggedForReview
                                            ? 'text-amber-800 bg-amber-100 px-1 py-0.5 rounded font-bold'
                                            : 'text-stone-700'
                                        }
                                      >
                                        {it.barcode.value}
                                      </span>
                                    ) : (
                                      <span className="text-stone-400 italic">Not detected</span>
                                    )}
                                  </td>

                                  {/* Qty */}
                                  <td className="py-2.5 px-3 text-right font-mono font-medium">
                                    {it.quantity.value}
                                  </td>

                                  {/* Unit Price */}
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    ${Number(it.unitPrice.value).toFixed(2)}
                                  </td>

                                  {/* Total */}
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                                    ${Number(it.total.value).toFixed(2)}
                                  </td>

                                  {/* Confidence Badge */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getConfidenceBadgeColor(
                                        it.confidence
                                      )}`}
                                    >
                                      {it.confidence}%
                                    </span>
                                  </td>

                                  {/* Review Status */}
                                  <td className="py-2.5 px-3 text-center">
                                    {it.flaggedForReview ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        <span>Needs Review</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span>Verified</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Strict Non-Mutation Assurances Box */}
                      <div className="p-3 bg-stone-100/80 rounded-lg border border-stone-200 text-[11px] text-stone-600 space-y-1">
                        <div className="font-bold text-stone-800 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-stone-600" />
                          <span>Strict Architectural Integrity Safeguards</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5 text-stone-600">
                          <li>
                            <strong>Inventory Stock:</strong> Completely unmodified. No inventory quantities have been added or subtracted.
                          </li>
                          <li>
                            <strong>Invoice Confirmation:</strong> This invoice is <strong>NOT</strong> automatically confirmed. It remains in review status.
                          </li>
                          <li>
                            <strong>Product Catalog:</strong> No new products have been created automatically.
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: FILE STORAGE & HASH */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Grid details */}
                  <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-200 text-stone-600">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Original Filename:</span>
                      <span className="font-medium text-stone-800 break-all">{viewInvoiceModal.originalFilename}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">MIME Content-Type:</span>
                      <span className="font-mono text-stone-800">{viewInvoiceModal.mimeType}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">File Size:</span>
                      <span className="font-mono text-stone-800">{formatBytes(viewInvoiceModal.fileSize)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Uploaded By:</span>
                      <span className="font-medium text-stone-800">{viewInvoiceModal.uploadedBy}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Uploaded Timestamp:</span>
                      <span className="text-stone-800">{formatDate(viewInvoiceModal.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">OCR Processed At:</span>
                      <span className="text-stone-800">
                        {viewInvoiceModal.ocrProcessedAt ? formatDate(viewInvoiceModal.ocrProcessedAt) : 'Not processed yet'}
                      </span>
                    </div>
                    {viewInvoiceModal.notes && (
                      <div className="col-span-2 pt-1 border-t border-stone-200">
                        <span className="text-stone-400 block text-[10px]">Notes:</span>
                        <span className="text-stone-700 italic">{viewInvoiceModal.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* SHA-256 Cryptographic Integrity */}
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between text-stone-500 mb-1">
                      <span className="font-semibold text-[10px]">SHA-256 Integrity Checksum:</span>
                      <button
                        onClick={() => copyToClipboard(viewInvoiceModal.fileHash)}
                        className="text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer text-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedHash === viewInvoiceModal.fileHash ? 'Copied!' : 'Copy Hash'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-[10px] text-stone-800 bg-white p-2 rounded border border-stone-200 break-all select-all">
                      {viewInvoiceModal.fileHash}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: RAW OCR TEXT */}
              {activeTab === 'rawText' && viewInvoiceModal.ocrResult?.rawText && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-700">
                      Unprocessed Text Captured by Tesseract Engine:
                    </span>
                    <button
                      onClick={() => copyRawOcrText(viewInvoiceModal.ocrResult!.rawText)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedRawText ? 'Copied!' : 'Copy Raw Text'}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-stone-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed border border-stone-800">
                    {viewInvoiceModal.ocrResult.rawText}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <a
                  href={getInvoiceDownloadUrl(viewInvoiceModal.id)}
                  download={viewInvoiceModal.originalFilename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File ({formatBytes(viewInvoiceModal.fileSize)})</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {viewInvoiceModal.status === 'UPLOADED' && (
                  <button
                    onClick={() => handleRunOcr(viewInvoiceModal.id)}
                    disabled={processingOcrId === viewInvoiceModal.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Tesseract OCR</span>
                  </button>
                )}
                {(viewInvoiceModal.status === 'PROCESSED' || viewInvoiceModal.status === 'CONFIRMED') && (
                  <button
                    onClick={() => {
                      const inv = viewInvoiceModal;
                      setViewInvoiceModal(null);
                      setReviewingInvoice(inv);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Open Invoice Review Screen</span>
                  </button>
                )}
                <button
                  onClick={() => setViewInvoiceModal(null)}
                  className="px-4 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
