package com.grocerypos.inventory.dto;

import com.grocerypos.inventory.entity.InventoryTransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class AddStockRequestDto {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.001", message = "Quantity to add must be greater than zero")
    private BigDecimal quantity;

    private InventoryTransactionType transactionType = InventoryTransactionType.PURCHASE;

    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    private String reason;

    @Size(max = 100, message = "Reference ID cannot exceed 100 characters")
    private String referenceId;

    public AddStockRequestDto() {
    }

    public AddStockRequestDto(Long productId, BigDecimal quantity, String reason, String referenceId) {
        this.productId = productId;
        this.quantity = quantity;
        this.transactionType = InventoryTransactionType.PURCHASE;
        this.reason = reason;
        this.referenceId = referenceId;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public InventoryTransactionType getTransactionType() {
        return transactionType != null ? transactionType : InventoryTransactionType.PURCHASE;
    }

    public void setTransactionType(InventoryTransactionType transactionType) {
        this.transactionType = transactionType;
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
}
