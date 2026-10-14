package com.grocerypos.invoice.dto;

import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;

import java.time.Instant;

public class InvoiceUploadResponseDto {

    private Long id;
    private String invoiceNumber;
    private String originalFilename;
    private String storedFilename;
    private Long fileSize;
    private String mimeType;
    private String fileHash;
    private InvoiceStatus status;
    private String uploadedBy;
    private String notes;
    private Instant createdAt;

    public InvoiceUploadResponseDto() {
    }

    public static InvoiceUploadResponseDto fromEntity(PurchaseInvoice invoice) {
        InvoiceUploadResponseDto dto = new InvoiceUploadResponseDto();
        dto.setId(invoice.getId());
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setOriginalFilename(invoice.getOriginalFilename());
        dto.setStoredFilename(invoice.getStoredFilename());
        dto.setFileSize(invoice.getFileSize());
        dto.setMimeType(invoice.getMimeType());
        dto.setFileHash(invoice.getFileHash());
        dto.setStatus(invoice.getStatus());
        dto.setUploadedBy(invoice.getUploadedBy());
        dto.setNotes(invoice.getNotes());
        dto.setCreatedAt(invoice.getCreatedAt());
        return dto;
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
}
