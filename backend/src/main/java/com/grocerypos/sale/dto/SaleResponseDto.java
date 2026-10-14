package com.grocerypos.sale.dto;

import com.grocerypos.sale.entity.Sale;
import com.grocerypos.sale.entity.SaleStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class SaleResponseDto {

    private Long id;
    private String receiptNumber;
    private BigDecimal subtotal;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private SaleStatus status;
    private int itemCount;
    private List<SaleItemResponseDto> items = new ArrayList<>();
    private Instant createdAt;
    private String paymentMethod;
    private String paymentReference;
    private Long paymentId;
    private Boolean requiresRecovery;
    private String recoveryStatus;
    private String recoveryReason;

    public SaleResponseDto() {
    }

    public static SaleResponseDto fromEntity(Sale entity) {
        if (entity == null) return null;
        SaleResponseDto dto = new SaleResponseDto();
        dto.setId(entity.getId());
        dto.setReceiptNumber(entity.getReceiptNumber());
        dto.setSubtotal(entity.getSubtotal());
        dto.setTaxAmount(entity.getTaxAmount());
        dto.setTotalAmount(entity.getTotalAmount());
        dto.setStatus(entity.getStatus());
        dto.setItemCount(entity.getItemCount());
        if (entity.getItems() != null) {
            dto.setItems(entity.getItems().stream()
                    .map(SaleItemResponseDto::fromEntity)
                    .collect(Collectors.toList()));
        }
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setPaymentMethod(entity.getPaymentMethod());
        dto.setPaymentReference(entity.getPaymentReference());
        dto.setPaymentId(entity.getPaymentId());
        dto.setRequiresRecovery(entity.getRequiresRecovery());
        dto.setRecoveryStatus(entity.getRecoveryStatus());
        dto.setRecoveryReason(entity.getRecoveryReason());
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getReceiptNumber() {
        return receiptNumber;
    }

    public void setReceiptNumber(String receiptNumber) {
        this.receiptNumber = receiptNumber;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public SaleStatus getStatus() {
        return status;
    }

    public void setStatus(SaleStatus status) {
        this.status = status;
    }

    public int getItemCount() {
        return itemCount;
    }

    public void setItemCount(int itemCount) {
        this.itemCount = itemCount;
    }

    public List<SaleItemResponseDto> getItems() {
        return items;
    }

    public void setItems(List<SaleItemResponseDto> items) {
        this.items = items;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public Long getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
    }

    public Boolean getRequiresRecovery() {
        return requiresRecovery;
    }

    public void setRequiresRecovery(Boolean requiresRecovery) {
        this.requiresRecovery = requiresRecovery;
    }

    public String getRecoveryStatus() {
        return recoveryStatus;
    }

    public void setRecoveryStatus(String recoveryStatus) {
        this.recoveryStatus = recoveryStatus;
    }

    public String getRecoveryReason() {
        return recoveryReason;
    }

    public void setRecoveryReason(String recoveryReason) {
        this.recoveryReason = recoveryReason;
    }
}
