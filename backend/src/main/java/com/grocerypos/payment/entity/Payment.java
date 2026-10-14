package com.grocerypos.payment.entity;

import com.grocerypos.sale.entity.Sale;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Entity representing a payment transaction linked to a POS sale.
 * Designed with a provider-agnostic abstraction for Stripe and future payment methods.
 * Guaranteed: Never stores raw credit/debit card numbers, CVVs, or cardholder PAN.
 */
@Entity
@Table(
    name = "payments",
    indexes = {
        @Index(name = "idx_payments_sale_id", columnList = "sale_id"),
        @Index(name = "idx_payments_status", columnList = "status"),
        @Index(name = "idx_payments_external_id", columnList = "external_payment_id"),
        @Index(name = "idx_payments_provider", columnList = "provider")
    }
)
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "sale_id",
        foreignKey = @ForeignKey(name = "fk_payments_sale")
    )
    private Sale sale;

    @NotNull(message = "Payment amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero")
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @NotBlank(message = "Currency is required")
    @Column(name = "currency", nullable = false, length = 10)
    private String currency = "USD";

    @NotNull(message = "Payment status is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PaymentStatus status = PaymentStatus.PENDING;

    @NotBlank(message = "Payment provider is required")
    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "external_payment_id", length = 255)
    private String externalPaymentId;

    @Column(name = "client_secret", length = 255)
    private String clientSecret;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Payment() {
    }

    public Payment(Sale sale, BigDecimal amount, String currency, String provider) {
        this.sale = sale;
        this.amount = amount;
        this.currency = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "USD";
        this.provider = provider;
        this.status = PaymentStatus.PENDING;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Sale getSale() {
        return sale;
    }

    public void setSale(Sale sale) {
        this.sale = sale;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Payment payment = (Payment) o;
        return Objects.equals(id, payment.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
