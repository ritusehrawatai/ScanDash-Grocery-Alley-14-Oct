package com.grocerypos.inventory.entity;

import com.fasterxml.jackson.annotation.JsonValue;

import java.math.BigDecimal;

/**
 * Reusable inventory status representation and calculation rules:
 * - If current quantity == 0: OUT OF STOCK
 * - If current quantity > 0 AND current quantity <= minimum threshold: LOW STOCK
 * - Otherwise: IN STOCK
 */
public enum InventoryStatus {
    IN_STOCK("IN STOCK"),
    LOW_STOCK("LOW STOCK"),
    OUT_OF_STOCK("OUT OF STOCK");

    private final String displayName;

    InventoryStatus(String displayName) {
        this.displayName = displayName;
    }

    @JsonValue
    public String getDisplayName() {
        return displayName;
    }

    /**
     * Calculates the inventory status based on current quantity and minimum inventory threshold.
     *
     * @param currentQuantity  the current stock balance
     * @param minimumThreshold the configured minimum inventory threshold
     * @return OUT_OF_STOCK, LOW_STOCK, or IN_STOCK
     */
    public static InventoryStatus calculate(BigDecimal currentQuantity, Integer minimumThreshold) {
        if (currentQuantity == null || currentQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return OUT_OF_STOCK;
        }

        BigDecimal threshold = minimumThreshold != null
                ? BigDecimal.valueOf(minimumThreshold)
                : BigDecimal.ZERO;

        if (currentQuantity.compareTo(BigDecimal.ZERO) > 0 && currentQuantity.compareTo(threshold) <= 0) {
            return LOW_STOCK;
        }

        return IN_STOCK;
    }

    /**
     * Overload supporting BigDecimal threshold for weighed goods.
     */
    public static InventoryStatus calculate(BigDecimal currentQuantity, BigDecimal minimumThreshold) {
        if (currentQuantity == null || currentQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return OUT_OF_STOCK;
        }

        BigDecimal threshold = minimumThreshold != null ? minimumThreshold : BigDecimal.ZERO;

        if (currentQuantity.compareTo(BigDecimal.ZERO) > 0 && currentQuantity.compareTo(threshold) <= 0) {
            return LOW_STOCK;
        }

        return IN_STOCK;
    }
}
