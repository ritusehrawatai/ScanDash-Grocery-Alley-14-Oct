package com.grocerypos.inventory.service;

import com.grocerypos.inventory.entity.InventoryStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Reusable backend component for determining inventory status consistently
 * throughout all store subsystems (Inventory, Catalog, Checkout, and Auditing).
 *
 * Rules:
 * - If current quantity == 0: OUT OF STOCK
 * - If current quantity > 0 AND current quantity <= minimum threshold: LOW STOCK
 * - Otherwise: IN STOCK
 */
@Component
public class InventoryStatusCalculator {

    /**
     * Determine inventory status from integer minimum threshold.
     */
    public InventoryStatus determineStatus(BigDecimal currentQuantity, Integer minimumThreshold) {
        return InventoryStatus.calculate(currentQuantity, minimumThreshold);
    }

    /**
     * Determine inventory status from BigDecimal minimum threshold.
     */
    public InventoryStatus determineStatus(BigDecimal currentQuantity, BigDecimal minimumThreshold) {
        return InventoryStatus.calculate(currentQuantity, minimumThreshold);
    }

    /**
     * Helper to return the standardized display string: "IN STOCK", "LOW STOCK", or "OUT OF STOCK".
     */
    public String getStatusDisplayName(BigDecimal currentQuantity, Integer minimumThreshold) {
        return determineStatus(currentQuantity, minimumThreshold).getDisplayName();
    }
}
