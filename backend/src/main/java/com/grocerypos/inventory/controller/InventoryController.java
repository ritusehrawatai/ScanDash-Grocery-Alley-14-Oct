package com.grocerypos.inventory.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.inventory.dto.AddStockRequestDto;
import com.grocerypos.inventory.dto.AdjustStockRequestDto;
import com.grocerypos.inventory.dto.InventoryDto;
import com.grocerypos.inventory.dto.InventoryTransactionDto;
import com.grocerypos.inventory.dto.RemoveStockRequestDto;
import com.grocerypos.inventory.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@Tag(name = "Inventory REST API", description = "Endpoints for managing product stock, additions, removals, adjustments, and transaction audit trails")
public class InventoryController {

    private final InventoryService inventoryService;

    @Autowired
    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    /**
     * Get inventory overview for all products.
     * GET /api/inventory
     */
    @GetMapping
    @Operation(summary = "Get All Inventory", description = "Retrieves stock levels for all products in the catalog")
    public ResponseEntity<ApiResponse<List<InventoryDto>>> getAllInventory() {
        List<InventoryDto> list = inventoryService.getAllInventory();
        return ResponseEntity.ok(ApiResponse.ok(list, "Inventory retrieved successfully"));
    }

    /**
     * Get current inventory balance for a specific product.
     * GET /api/inventory/product/{productId} or GET /api/inventory/{productId}
     */
    @GetMapping({"/product/{productId}", "/{productId:[0-9]+}"})
    @Operation(summary = "Get Inventory for Product", description = "Retrieves current stock balance for a product by its ID")
    public ResponseEntity<ApiResponse<InventoryDto>> getInventoryForProduct(@PathVariable Long productId) {
        InventoryDto dto = inventoryService.getInventoryByProductId(productId);
        return ResponseEntity.ok(ApiResponse.ok(dto, "Product inventory retrieved successfully"));
    }

    /**
     * Add stock to product inventory (e.g. PURCHASE, RETURN).
     * POST /api/inventory/add
     */
    @PostMapping("/add")
    @Operation(summary = "Add Stock", description = "Increases product inventory balance and logs an immutable audit transaction")
    public ResponseEntity<ApiResponse<InventoryTransactionDto>> addStock(
            @Valid @RequestBody AddStockRequestDto request) {
        InventoryTransactionDto tx = inventoryService.addStock(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(tx, "Stock added successfully"));
    }

    /**
     * Remove stock from product inventory (e.g. DAMAGE, EXPIRY, CORRECTION).
     * Prevents negative inventory balance by default.
     * POST /api/inventory/remove
     */
    @PostMapping("/remove")
    @Operation(summary = "Remove Stock", description = "Decreases product inventory balance while strictly guarding against negative stock")
    public ResponseEntity<ApiResponse<InventoryTransactionDto>> removeStock(
            @Valid @RequestBody RemoveStockRequestDto request) {
        InventoryTransactionDto tx = inventoryService.removeStock(request);
        return ResponseEntity.ok(ApiResponse.ok(tx, "Stock removed successfully"));
    }

    /**
     * Adjust stock directly to a target count (e.g. physical inventory count).
     * POST /api/inventory/adjust
     */
    @PostMapping("/adjust")
    @Operation(summary = "Adjust Stock", description = "Reconciles product inventory balance to a verified target count and records ADJUSTMENT transaction")
    public ResponseEntity<ApiResponse<InventoryTransactionDto>> adjustStock(
            @Valid @RequestBody AdjustStockRequestDto request) {
        InventoryTransactionDto tx = inventoryService.adjustStock(request);
        return ResponseEntity.ok(ApiResponse.ok(tx, "Stock adjusted successfully"));
    }

    /**
     * Get inventory transaction audit history for a product.
     * GET /api/inventory/{productId}/transactions or GET /api/inventory/transactions?productId={productId}
     */
    @GetMapping({"/product/{productId}/transactions", "/{productId:[0-9]+}/transactions"})
    @Operation(summary = "Get Inventory Transactions", description = "Retrieves historical audit ledger of all stock transactions for a product")
    public ResponseEntity<ApiResponse<List<InventoryTransactionDto>>> getTransactionsByProduct(
            @PathVariable Long productId) {
        List<InventoryTransactionDto> history = inventoryService.getTransactionHistory(productId);
        return ResponseEntity.ok(ApiResponse.ok(history, "Transaction history retrieved successfully"));
    }

    @GetMapping("/transactions")
    @Operation(summary = "Get Inventory Transactions by Param", description = "Retrieves historical audit ledger for a product passed as query parameter")
    public ResponseEntity<ApiResponse<List<InventoryTransactionDto>>> getTransactionsByParam(
            @RequestParam("productId") Long productId) {
        List<InventoryTransactionDto> history = inventoryService.getTransactionHistory(productId);
        return ResponseEntity.ok(ApiResponse.ok(history, "Transaction history retrieved successfully"));
    }
}
