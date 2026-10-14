package com.grocerypos.inventory.service;

import com.grocerypos.inventory.dto.InventoryDto;
import com.grocerypos.inventory.dto.InventoryTransactionDto;
import com.grocerypos.inventory.entity.InventoryTransactionType;

import java.math.BigDecimal;
import java.util.List;

public interface InventoryService {

    /**
     * Get current stock for a specific product.
     */
    InventoryDto getInventoryByProductId(Long productId);

    /**
     * Initialize or set base inventory for a product.
     */
    InventoryDto initializeInventory(Long productId, BigDecimal initialQuantity);

    /**
     * Record an inventory transaction (PURCHASE, SALE, RETURN, ADJUSTMENT, DAMAGE, EXPIRY, CORRECTION).
     * Atomically recalculates currentQuantity and writes an immutable audit record.
     */
    InventoryTransactionDto recordTransaction(
            Long productId,
            InventoryTransactionType type,
            BigDecimal quantity,
            String reason,
            String referenceId);

    /**
     * Add stock to product inventory (e.g. PURCHASE, RETURN).
     * Atomically increments currentQuantity and creates InventoryTransaction.
     */
    InventoryTransactionDto addStock(com.grocerypos.inventory.dto.AddStockRequestDto request);

    /**
     * Remove stock from product inventory (e.g. DAMAGE, EXPIRY, CORRECTION).
     * Strictly prevents negative inventory balance.
     * Atomically decrements currentQuantity and creates InventoryTransaction.
     */
    InventoryTransactionDto removeStock(com.grocerypos.inventory.dto.RemoveStockRequestDto request);

    /**
     * Adjust stock directly to target quantity (e.g. physical inventory count).
     * Atomically computes delta and creates ADJUSTMENT InventoryTransaction.
     */
    InventoryTransactionDto adjustStock(com.grocerypos.inventory.dto.AdjustStockRequestDto request);

    /**
     * Retrieve transaction history for a specific product.
     */
    List<InventoryTransactionDto> getTransactionHistory(Long productId);

    /**
     * Retrieve current inventory for all products.
     */
    List<InventoryDto> getAllInventory();
}
