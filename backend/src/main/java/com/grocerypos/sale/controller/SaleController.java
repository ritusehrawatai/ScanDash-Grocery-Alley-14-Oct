package com.grocerypos.sale.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.sale.dto.CreateSaleRequestDto;
import com.grocerypos.sale.dto.SaleResponseDto;
import com.grocerypos.sale.service.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@Tag(name = "Sale Processing API", description = "Endpoints for processing POS checkout transactions, sales ledger, and receipt lookups")
public class SaleController {

    private final SaleService saleService;

    @Autowired
    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    /**
     * Complete and process a POS cart sale.
     * POST /api/sales
     */
    @PostMapping
    @Operation(summary = "Process Sale", description = "Validates cart and stock, calculates taxes and totals, deducts inventory, records transactions, and saves sale")
    public ResponseEntity<ApiResponse<SaleResponseDto>> processSale(
            @Valid @RequestBody CreateSaleRequestDto request) {
        SaleResponseDto sale = saleService.processSale(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(sale, "Sale completed successfully. Receipt: " + sale.getReceiptNumber()));
    }

    /**
     * List all completed sales.
     * GET /api/sales
     */
    @GetMapping
    @Operation(summary = "Get All Sales", description = "Returns historical completed POS sales ledger sorted by newest first")
    public ResponseEntity<ApiResponse<List<SaleResponseDto>>> getAllSales() {
        List<SaleResponseDto> sales = saleService.getAllSales();
        return ResponseEntity.ok(ApiResponse.ok(sales, "Sales retrieved successfully"));
    }

    /**
     * Get sale by internal ID.
     * GET /api/sales/{id}
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get Sale by ID", description = "Retrieves sale details and item line items by ID")
    public ResponseEntity<ApiResponse<SaleResponseDto>> getSaleById(@PathVariable Long id) {
        SaleResponseDto sale = saleService.getSaleById(id);
        return ResponseEntity.ok(ApiResponse.ok(sale, "Sale retrieved successfully"));
    }

    /**
     * Get sale by receipt number.
     * GET /api/sales/receipt/{receiptNumber}
     */
    @GetMapping("/receipt/{receiptNumber}")
    @Operation(summary = "Get Sale by Receipt", description = "Retrieves sale details by receipt number")
    public ResponseEntity<ApiResponse<SaleResponseDto>> getSaleByReceiptNumber(
            @PathVariable String receiptNumber) {
        SaleResponseDto sale = saleService.getSaleByReceiptNumber(receiptNumber);
        return ResponseEntity.ok(ApiResponse.ok(sale, "Sale retrieved successfully"));
    }

    /**
     * Cancel an existing sale and restore inventory.
     * POST /api/sales/{id}/cancel
     */
    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel Sale", description = "Cancels an existing sale, restores deducted inventory items, and logs audit record")
    public ResponseEntity<ApiResponse<SaleResponseDto>> cancelSale(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "Customer requested cancellation") String reason) {
        SaleResponseDto sale = saleService.cancelSale(id, reason);
        return ResponseEntity.ok(ApiResponse.ok(sale, "Sale cancelled successfully and stock restored"));
    }
}
