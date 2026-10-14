package com.grocerypos.inventory.entity;

import com.grocerypos.product.entity.Product;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Inventory entity tracking the live stock level of a product.
 * Enforces one-to-one mapping per product and non-negative stock balances.
 */
@Entity
@Table(
    name = "inventory",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_inventory_product_id", columnNames = {"product_id"})
    },
    indexes = {
        @Index(name = "idx_inventory_product_id", columnList = "product_id"),
        @Index(name = "idx_inventory_current_quantity", columnList = "current_quantity")
    }
)
@Check(constraints = "current_quantity >= 0")
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Product reference is required")
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "product_id",
        nullable = false,
        unique = true,
        foreignKey = @ForeignKey(name = "fk_inventory_product")
    )
    private Product product;

    @NotNull(message = "Current quantity is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Current quantity cannot be negative")
    @Column(name = "current_quantity", nullable = false, precision = 12, scale = 3)
    private BigDecimal currentQuantity = BigDecimal.ZERO;

    @UpdateTimestamp
    @Column(name = "last_updated", nullable = false)
    private Instant lastUpdated;

    public Inventory() {
        this.currentQuantity = BigDecimal.ZERO;
        this.lastUpdated = Instant.now();
    }

    public Inventory(Product product, BigDecimal currentQuantity) {
        this.product = product;
        this.currentQuantity = currentQuantity != null ? currentQuantity : BigDecimal.ZERO;
        this.lastUpdated = Instant.now();
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

    public BigDecimal getCurrentQuantity() {
        return currentQuantity;
    }

    public void setCurrentQuantity(BigDecimal currentQuantity) {
        this.currentQuantity = currentQuantity;
    }

    public Instant getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(Instant lastUpdated) {
        this.lastUpdated = lastUpdated;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Inventory inventory = (Inventory) o;
        return Objects.equals(id, inventory.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Inventory{" +
                "id=" + id +
                ", productId=" + (product != null ? product.getId() : null) +
                ", currentQuantity=" + currentQuantity +
                ", lastUpdated=" + lastUpdated +
                '}';
    }
}
