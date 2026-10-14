package com.grocerypos.inventory.entity;

import com.grocerypos.product.entity.Product;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * InventoryTransaction entity maintaining an immutable audit log of all stock movements.
 */
@Entity
@Table(
    name = "inventory_transactions",
    indexes = {
        @Index(name = "idx_inv_tx_product_id", columnList = "product_id"),
        @Index(name = "idx_inv_tx_type", columnList = "transaction_type"),
        @Index(name = "idx_inv_tx_created_at", columnList = "created_at"),
        @Index(name = "idx_inv_tx_reference_id", columnList = "reference_id")
    }
)
public class InventoryTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Product reference is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "product_id",
        nullable = false,
        foreignKey = @ForeignKey(name = "fk_inv_tx_product")
    )
    private Product product;

    @NotNull(message = "Transaction type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 30)
    private InventoryTransactionType transactionType;

    @NotNull(message = "Quantity delta is required")
    @Column(name = "quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @NotNull(message = "Previous quantity is required")
    @Column(name = "previous_quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal previousQuantity;

    @NotNull(message = "New quantity is required")
    @Column(name = "new_quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal newQuantity;

    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    @Column(name = "reason", length = 500)
    private String reason;

    @Size(max = 100, message = "Reference ID cannot exceed 100 characters")
    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public InventoryTransaction() {
    }

    public InventoryTransaction(
            Product product,
            InventoryTransactionType transactionType,
            BigDecimal quantity,
            BigDecimal previousQuantity,
            BigDecimal newQuantity,
            String reason,
            String referenceId) {
        this.product = product;
        this.transactionType = transactionType;
        this.quantity = quantity;
        this.previousQuantity = previousQuantity;
        this.newQuantity = newQuantity;
        this.reason = reason;
        this.referenceId = referenceId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        InventoryTransaction that = (InventoryTransaction) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "InventoryTransaction{" +
                "id=" + id +
                ", productId=" + (product != null ? product.getId() : null) +
                ", transactionType=" + transactionType +
                ", quantity=" + quantity +
                ", previousQuantity=" + previousQuantity +
                ", newQuantity=" + newQuantity +
                ", referenceId='" + referenceId + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
