package com.grocerypos.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Map;

/**
 * DTO for initiating a POS payment transaction.
 */
public class PaymentRequestDto {

    @NotNull(message = "Payment amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero")
    private BigDecimal amount;

    private String currency = "USD";

    private Long saleId;

    private String provider = "STRIPE";

    private Map<String, String> metadata;

    public PaymentRequestDto() {
    }

    public PaymentRequestDto(BigDecimal amount, String currency, Long saleId, String provider) {
        this.amount = amount;
        this.currency = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "USD";
        this.saleId = saleId;
        this.provider = (provider != null && !provider.isBlank()) ? provider.toUpperCase() : "STRIPE";
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Long getSaleId() {
        return saleId;
    }

    public void setSaleId(Long saleId) {
        this.saleId = saleId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public Map<String, String> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, String> metadata) {
        this.metadata = metadata;
    }
}
