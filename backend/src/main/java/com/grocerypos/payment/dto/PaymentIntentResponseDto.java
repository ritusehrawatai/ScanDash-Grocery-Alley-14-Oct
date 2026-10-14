package com.grocerypos.payment.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Clean client-safe DTO returned to frontend to continue payment on Stripe Terminal.
 * Strictly guarantees that secret keys, backend tokens, or sensitive PAN/card data are NEVER exposed.
 */
public class PaymentIntentResponseDto {

    private String paymentIntentId;
    private String clientSecret;
    private BigDecimal amount;
    private String currency;
    private String status;
    private List<String> paymentMethodTypes;
    private Long saleId;
    private Long paymentId;
    private String receiptNumber;
    private String idempotencyKey;

    public PaymentIntentResponseDto() {
    }

    public PaymentIntentResponseDto(
            String paymentIntentId,
            String clientSecret,
            BigDecimal amount,
            String currency,
            String status,
            List<String> paymentMethodTypes,
            Long saleId,
            Long paymentId,
            String receiptNumber) {
        this.paymentIntentId = paymentIntentId;
        this.clientSecret = clientSecret;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.paymentMethodTypes = paymentMethodTypes;
        this.saleId = saleId;
        this.paymentId = paymentId;
        this.receiptNumber = receiptNumber;
    }

    public String getPaymentIntentId() {
        return paymentIntentId;
    }

    public void setPaymentIntentId(String paymentIntentId) {
        this.paymentIntentId = paymentIntentId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<String> getPaymentMethodTypes() {
        return paymentMethodTypes;
    }

    public void setPaymentMethodTypes(List<String> paymentMethodTypes) {
        this.paymentMethodTypes = paymentMethodTypes;
    }

    public Long getSaleId() {
        return saleId;
    }

    public void setSaleId(Long saleId) {
        this.saleId = saleId;
    }

    public Long getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
    }

    public String getReceiptNumber() {
        return receiptNumber;
    }

    public void setReceiptNumber(String receiptNumber) {
        this.receiptNumber = receiptNumber;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }
}
