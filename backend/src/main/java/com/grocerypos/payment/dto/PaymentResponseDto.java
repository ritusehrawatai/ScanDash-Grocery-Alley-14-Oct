package com.grocerypos.payment.dto;

import com.grocerypos.payment.entity.Payment;
import com.grocerypos.payment.entity.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO representing payment transaction response.
 */
public class PaymentResponseDto {

    private Long id;
    private Long saleId;
    private BigDecimal amount;
    private String currency;
    private PaymentStatus status;
    private String provider;
    private String externalPaymentId;
    private String clientSecret;
    private String errorMessage;
    private Instant createdAt;
    private Instant updatedAt;

    public PaymentResponseDto() {
    }

    public static PaymentResponseDto fromEntity(Payment entity) {
        if (entity == null) return null;
        PaymentResponseDto dto = new PaymentResponseDto();
        dto.setId(entity.getId());
        if (entity.getSale() != null) {
            dto.setSaleId(entity.getSale().getId());
        }
        dto.setAmount(entity.getAmount());
        dto.setCurrency(entity.getCurrency());
        dto.setStatus(entity.getStatus());
        dto.setProvider(entity.getProvider());
        dto.setExternalPaymentId(entity.getExternalPaymentId());
        dto.setClientSecret(entity.getClientSecret());
        dto.setErrorMessage(entity.getErrorMessage());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSaleId() {
        return saleId;
    }

    public void setSaleId(Long saleId) {
        this.saleId = saleId;
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

    public PaymentStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentStatus status) {
        this.status = status;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getExternalPaymentId() {
        return externalPaymentId;
    }

    public void setExternalPaymentId(String externalPaymentId) {
        this.externalPaymentId = externalPaymentId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
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
}
