package com.grocerypos.invoice.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class InvoiceOcrResultDto implements Serializable {

    private Long invoiceId;
    private ExtractedFieldDto<String> supplier;
    private ExtractedFieldDto<String> invoiceNumber;
    private ExtractedFieldDto<String> invoiceDate;
    private ExtractedFieldDto<BigDecimal> total;
    private List<InvoiceExtractedItemDto> items = new ArrayList<>();
    private int overallConfidence;
    private boolean hasLowConfidenceValues;
    private boolean manualReviewRequired;
    private String ocrEngine = "Tesseract OCR (open-source v5)";
    private Instant processedAt = Instant.now();
    private String rawText;
    private int flaggedFieldsCount;

    // Safety flags per specification
    private boolean inventoryUpdated = false;
    private boolean automaticallyConfirmed = false;

    public InvoiceOcrResultDto() {
    }

    public Long getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
    }

    public ExtractedFieldDto<String> getSupplier() {
        return supplier;
    }

    public void setSupplier(ExtractedFieldDto<String> supplier) {
        this.supplier = supplier;
    }

    public ExtractedFieldDto<String> getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(ExtractedFieldDto<String> invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public ExtractedFieldDto<String> getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(ExtractedFieldDto<String> invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public ExtractedFieldDto<BigDecimal> getTotal() {
        return total;
    }

    public void setTotal(ExtractedFieldDto<BigDecimal> total) {
        this.total = total;
    }

    public List<InvoiceExtractedItemDto> getItems() {
        return items;
    }

    public void setItems(List<InvoiceExtractedItemDto> items) {
        this.items = items != null ? items : new ArrayList<>();
    }

    public int getOverallConfidence() {
        return overallConfidence;
    }

    public void setOverallConfidence(int overallConfidence) {
        this.overallConfidence = overallConfidence;
    }

    public boolean isHasLowConfidenceValues() {
        return hasLowConfidenceValues;
    }

    public void setHasLowConfidenceValues(boolean hasLowConfidenceValues) {
        this.hasLowConfidenceValues = hasLowConfidenceValues;
    }

    public boolean isManualReviewRequired() {
        return manualReviewRequired;
    }

    public void setManualReviewRequired(boolean manualReviewRequired) {
        this.manualReviewRequired = manualReviewRequired;
    }

    public String getOcrEngine() {
        return ocrEngine;
    }

    public void setOcrEngine(String ocrEngine) {
        this.ocrEngine = ocrEngine;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }

    public int getFlaggedFieldsCount() {
        return flaggedFieldsCount;
    }

    public void setFlaggedFieldsCount(int flaggedFieldsCount) {
        this.flaggedFieldsCount = flaggedFieldsCount;
    }

    public boolean isInventoryUpdated() {
        return inventoryUpdated;
    }

    public void setInventoryUpdated(boolean inventoryUpdated) {
        this.inventoryUpdated = inventoryUpdated;
    }

    public boolean isAutomaticallyConfirmed() {
        return automaticallyConfirmed;
    }

    public void setAutomaticallyConfirmed(boolean automaticallyConfirmed) {
        this.automaticallyConfirmed = automaticallyConfirmed;
    }
}
