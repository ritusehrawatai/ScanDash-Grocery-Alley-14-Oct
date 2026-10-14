package com.grocerypos.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public class AdjustStockRequestDto {

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Target quantity is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Target quantity cannot be negative")
    private BigDecimal targetQuantity;

    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    private String reason;

    @Size(max = 100, message = "Reference ID cannot exceed 100 characters")
    private String referenceId;

    public AdjustStockRequestDto() {
    }

    public AdjustStockRequestDto(Long productId, BigDecimal targetQuantity, String reason, String referenceId) {
        this.productId = productId;
        this.targetQuantity = targetQuantity;
        this.reason = reason;
        this.referenceId = referenceId;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public BigDecimal getTargetQuantity() {
        return targetQuantity;
    }

    public void setTargetQuantity(BigDecimal targetQuantity) {
        this.targetQuantity = targetQuantity;
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
