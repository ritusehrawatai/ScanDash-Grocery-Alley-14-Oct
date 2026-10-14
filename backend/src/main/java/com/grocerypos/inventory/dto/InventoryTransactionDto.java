package com.grocerypos.inventory.dto;

import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;

import java.math.BigDecimal;
import java.time.Instant;

public class InventoryTransactionDto {

    private Long id;
    private Long productId;
    private String productName;
    private String productSku;
    private InventoryTransactionType transactionType;
    private BigDecimal quantity;
    private BigDecimal previousQuantity;
    private BigDecimal newQuantity;
    private String reason;
    private String referenceId;
    private Instant createdAt;

    public InventoryTransactionDto() {
    }

    public static InventoryTransactionDto fromEntity(InventoryTransaction entity) {
        if (entity == null) return null;
        InventoryTransactionDto dto = new InventoryTransactionDto();
        dto.setId(entity.getId());
        if (entity.getProduct() != null) {
            dto.setProductId(entity.getProduct().getId());
            dto.setProductName(entity.getProduct().getName());
            dto.setProductSku(entity.getProduct().getSku());
        }
        dto.setTransactionType(entity.getTransactionType());
        dto.setQuantity(entity.getQuantity());
        dto.setPreviousQuantity(entity.getPreviousQuantity());
        dto.setNewQuantity(entity.getNewQuantity());
        dto.setReason(entity.getReason());
        dto.setReferenceId(entity.getReferenceId());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getProductSku() {
        return productSku;
    }

    public void setProductSku(String productSku) {
        this.productSku = productSku;
    }

    public InventoryTransactionType getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(InventoryTransactionType transactionType) {
        this.transactionType = transactionType;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPreviousQuantity() {
        return previousQuantity;
    }

    public void setPreviousQuantity(BigDecimal previousQuantity) {
        this.previousQuantity = previousQuantity;
    }

    public BigDecimal getNewQuantity() {
        return newQuantity;
    }

    public void setNewQuantity(BigDecimal newQuantity) {
        this.newQuantity = newQuantity;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
