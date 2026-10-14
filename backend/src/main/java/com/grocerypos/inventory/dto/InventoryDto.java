package com.grocerypos.inventory.dto;

import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryStatus;

import java.math.BigDecimal;
import java.time.Instant;

public class InventoryDto {

    private Long id;
    private Long productId;
    private String productName;
    private String productSku;
    private String unit;
    private BigDecimal currentQuantity;
    private Integer minimumInventoryThreshold = 0;
    private InventoryStatus stockStatus;
    private Instant lastUpdated;

    public InventoryDto() {
    }

    public static InventoryDto fromEntity(Inventory entity) {
        if (entity == null) return null;
        InventoryDto dto = new InventoryDto();
        dto.setId(entity.getId());
        Integer threshold = 0;
        if (entity.getProduct() != null) {
            dto.setProductId(entity.getProduct().getId());
            dto.setProductName(entity.getProduct().getName());
            dto.setProductSku(entity.getProduct().getSku());
            dto.setUnit(entity.getProduct().getUnit());
            threshold = entity.getProduct().getMinimumInventoryThreshold();
            dto.setMinimumInventoryThreshold(threshold);
        }
        dto.setCurrentQuantity(entity.getCurrentQuantity());
        dto.setStockStatus(InventoryStatus.calculate(entity.getCurrentQuantity(), threshold));
        dto.setLastUpdated(entity.getLastUpdated());
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

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getCurrentQuantity() {
        return currentQuantity;
    }

    public void setCurrentQuantity(BigDecimal currentQuantity) {
        this.currentQuantity = currentQuantity;
    }

    public Integer getMinimumInventoryThreshold() {
        return minimumInventoryThreshold;
    }

    public void setMinimumInventoryThreshold(Integer minimumInventoryThreshold) {
        this.minimumInventoryThreshold = minimumInventoryThreshold;
    }

    public InventoryStatus getStockStatus() {
        return stockStatus;
    }

    public void setStockStatus(InventoryStatus stockStatus) {
        this.stockStatus = stockStatus;
    }

    public Instant getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(Instant lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
