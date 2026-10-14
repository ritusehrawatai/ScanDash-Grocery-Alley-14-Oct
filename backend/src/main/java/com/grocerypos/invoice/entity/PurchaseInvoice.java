package com.grocerypos.invoice.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(
    name = "purchase_invoices",
    indexes = {
        @Index(name = "idx_invoices_status", columnList = "status"),
        @Index(name = "idx_invoices_number", columnList = "invoice_number"),
        @Index(name = "idx_invoices_created_at", columnList = "created_at")
    }
)
public class PurchaseInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Invoice number is required")
    @Column(name = "invoice_number", nullable = false, unique = true, length = 80)
    private String invoiceNumber;

    @NotBlank(message = "Original filename is required")
    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @NotBlank(message = "Stored filename is required")
    @Column(name = "stored_filename", nullable = false, unique = true, length = 255)
    private String storedFilename;

    @NotBlank(message = "File path is required")
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @NotNull(message = "File size is required")
    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @NotBlank(message = "MIME type is required")
    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @NotBlank(message = "File hash is required")
    @Column(name = "file_hash", nullable = false, length = 64)
    private String fileHash;

    @NotNull(message = "Invoice status is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private InvoiceStatus status = InvoiceStatus.UPLOADED;

    @Column(name = "uploaded_by", length = 100)
    private String uploadedBy = "Admin / Owner";

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "extracted_supplier", length = 255)
    private String extractedSupplier;

    @Column(name = "extracted_invoice_number", length = 100)
    private String extractedInvoiceNumber;

    @Column(name = "extracted_invoice_date", length = 50)
    private String extractedInvoiceDate;

    @Column(name = "extracted_total", precision = 12, scale = 2)
    private java.math.BigDecimal extractedTotal;

    @Column(name = "extracted_items_json", columnDefinition = "TEXT")
    private String extractedItemsJson;

    @Column(name = "ocr_raw_text", columnDefinition = "TEXT")
    private String ocrRawText;

    @Column(name = "ocr_overall_confidence")
    private Integer ocrOverallConfidence;

    @Column(name = "ocr_has_low_confidence_values")
    private Boolean ocrHasLowConfidenceValues = false;

    @Column(name = "ocr_manual_review_required")
    private Boolean ocrManualReviewRequired = false;

    @Column(name = "ocr_processed_at")
    private Instant ocrProcessedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public PurchaseInvoice() {
    }

    public PurchaseInvoice(
            String invoiceNumber,
            String originalFilename,
            String storedFilename,
            String filePath,
            Long fileSize,
            String mimeType,
            String fileHash,
            InvoiceStatus status,
            String uploadedBy,
            String notes) {
        this.invoiceNumber = invoiceNumber;
        this.originalFilename = originalFilename;
        this.storedFilename = storedFilename;
        this.filePath = filePath;
        this.fileSize = fileSize;
        this.mimeType = mimeType;
        this.fileHash = fileHash;
        this.status = status != null ? status : InvoiceStatus.UPLOADED;
        this.uploadedBy = uploadedBy != null ? uploadedBy : "Admin / Owner";
        this.notes = notes;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public String getStoredFilename() {
        return storedFilename;
    }

    public void setStoredFilename(String storedFilename) {
        this.storedFilename = storedFilename;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    public InvoiceStatus getStatus() {
        return status;
    }

    public void setStatus(InvoiceStatus status) {
        this.status = status;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getExtractedSupplier() {
        return extractedSupplier;
    }

    public void setExtractedSupplier(String extractedSupplier) {
        this.extractedSupplier = extractedSupplier;
    }

    public String getExtractedInvoiceNumber() {
        return extractedInvoiceNumber;
    }

    public void setExtractedInvoiceNumber(String extractedInvoiceNumber) {
        this.extractedInvoiceNumber = extractedInvoiceNumber;
    }

    public String getExtractedInvoiceDate() {
        return extractedInvoiceDate;
    }

    public void setExtractedInvoiceDate(String extractedInvoiceDate) {
        this.extractedInvoiceDate = extractedInvoiceDate;
    }

    public java.math.BigDecimal getExtractedTotal() {
        return extractedTotal;
    }

    public void setExtractedTotal(java.math.BigDecimal extractedTotal) {
        this.extractedTotal = extractedTotal;
    }

    public String getExtractedItemsJson() {
        return extractedItemsJson;
    }

    public void setExtractedItemsJson(String extractedItemsJson) {
        this.extractedItemsJson = extractedItemsJson;
    }

    public String getOcrRawText() {
        return ocrRawText;
    }

    public void setOcrRawText(String ocrRawText) {
        this.ocrRawText = ocrRawText;
    }

    public Integer getOcrOverallConfidence() {
        return ocrOverallConfidence;
    }

    public void setOcrOverallConfidence(Integer ocrOverallConfidence) {
        this.ocrOverallConfidence = ocrOverallConfidence;
    }

    public Boolean getOcrHasLowConfidenceValues() {
        return ocrHasLowConfidenceValues;
    }

    public void setOcrHasLowConfidenceValues(Boolean ocrHasLowConfidenceValues) {
        this.ocrHasLowConfidenceValues = ocrHasLowConfidenceValues;
    }

    public Boolean getOcrManualReviewRequired() {
        return ocrManualReviewRequired;
    }

    public void setOcrManualReviewRequired(Boolean ocrManualReviewRequired) {
        this.ocrManualReviewRequired = ocrManualReviewRequired;
    }

    public Instant getOcrProcessedAt() {
        return ocrProcessedAt;
    }

    public void setOcrProcessedAt(Instant ocrProcessedAt) {
        this.ocrProcessedAt = ocrProcessedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PurchaseInvoice that = (PurchaseInvoice) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "PurchaseInvoice{" +
                "id=" + id +
                ", invoiceNumber='" + invoiceNumber + '\'' +
                ", originalFilename='" + originalFilename + '\'' +
                ", status=" + status +
                ", fileSize=" + fileSize +
                ", mimeType='" + mimeType + '\'' +
                ", fileHash='" + fileHash + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
