package com.grocerypos.product.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Product entity representing retail grocery stock keeping items.
 *
 * Enforces business rules and database constraints:
 * - Unique SKU
 * - Unique Barcode (when provided)
 * - Required Name
 * - Non-negative Selling Price, Purchase Price, Tax Rate, and Minimum Inventory Threshold.
 */
@Entity
@Table(
    name = "products",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_products_sku", columnNames = {"sku"}),
        @UniqueConstraint(name = "uk_products_barcode", columnNames = {"barcode"})
    },
    indexes = {
        @Index(name = "idx_products_sku", columnList = "sku"),
        @Index(name = "idx_products_barcode", columnList = "barcode"),
        @Index(name = "idx_products_name", columnList = "name"),
        @Index(name = "idx_products_category_id", columnList = "category_id"),
        @Index(name = "idx_products_supplier_id", columnList = "supplier_id"),
        @Index(name = "idx_products_active", columnList = "active")
    }
)
@Check(constraints = "purchase_price >= 0 AND selling_price >= 0 AND tax_rate >= 0 AND minimum_inventory_threshold >= 0")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Product name is required")
    @Size(max = 200, message = "Product name must not exceed 200 characters")
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @NotBlank(message = "SKU is required")
    @Size(max = 50, message = "SKU must not exceed 50 characters")
    @Column(name = "sku", nullable = false, unique = true, length = 50)
    private String sku;

    @Size(max = 50, message = "Barcode must not exceed 50 characters")
    @Column(name = "barcode", unique = true, length = 50)
    private String barcode;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    @Column(name = "description", length = 2000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "category_id",
        foreignKey = @ForeignKey(name = "fk_products_category")
    )
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "supplier_id",
        foreignKey = @ForeignKey(name = "fk_products_supplier")
    )
    private Supplier supplier;

    @NotNull(message = "Purchase price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Purchase price cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Purchase price must have at most 10 integer digits and 2 decimal places")
    @Column(name = "purchase_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal purchasePrice = BigDecimal.ZERO;

    @NotNull(message = "Selling price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Selling price cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Selling price must have at most 10 integer digits and 2 decimal places")
    @Column(name = "selling_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal sellingPrice = BigDecimal.ZERO;

    @NotNull(message = "Tax rate is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Tax rate cannot be negative")
    @Digits(integer = 3, fraction = 2, message = "Tax rate must have at most 3 integer digits and 2 decimal places")
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @NotBlank(message = "Unit is required")
    @Size(max = 20, message = "Unit must not exceed 20 characters")
    @Column(name = "unit", nullable = false, length = 20)
    private String unit = "PCS";

    @NotNull(message = "Minimum inventory threshold is required")
    @Min(value = 0, message = "Minimum inventory threshold cannot be negative")
    @Column(name = "minimum_inventory_threshold", nullable = false)
    private Integer minimumInventoryThreshold = 0;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Product() {
    }

    public Product(String name, String sku, BigDecimal purchasePrice, BigDecimal sellingPrice, BigDecimal taxRate, String unit) {
        this.name = name;
        this.sku = sku;
        this.purchasePrice = purchasePrice;
        this.sellingPrice = sellingPrice;
        this.taxRate = taxRate;
        this.unit = unit != null ? unit : "PCS";
        this.active = true;
        this.minimumInventoryThreshold = 0;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = (barcode != null && barcode.trim().isEmpty()) ? null : barcode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public BigDecimal getPurchasePrice() {
        return purchasePrice;
    }

    public void setPurchasePrice(BigDecimal purchasePrice) {
        this.purchasePrice = purchasePrice;
    }

    public BigDecimal getSellingPrice() {
        return sellingPrice;
    }

    public void setSellingPrice(BigDecimal sellingPrice) {
        this.sellingPrice = sellingPrice;
    }

    public BigDecimal getTaxRate() {
        return taxRate;
    }

    public void setTaxRate(BigDecimal taxRate) {
        this.taxRate = taxRate;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public Integer getMinimumInventoryThreshold() {
        return minimumInventoryThreshold;
    }

    public void setMinimumInventoryThreshold(Integer minimumInventoryThreshold) {
        this.minimumInventoryThreshold = minimumInventoryThreshold;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
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
        Product product = (Product) o;
        return Objects.equals(id, product.id) || (sku != null && Objects.equals(sku, product.sku));
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, sku);
    }

    @Override
    public String toString() {
        return "Product{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", sku='" + sku + '\'' +
                ", barcode='" + barcode + '\'' +
                ", sellingPrice=" + sellingPrice +
                ", unit='" + unit + '\'' +
                ", active=" + active +
                '}';
    }
}
