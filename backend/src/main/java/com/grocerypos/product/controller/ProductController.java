package com.grocerypos.product.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.product.dto.CreateProductRequestDto;
import com.grocerypos.product.dto.ProductResponseDto;
import com.grocerypos.product.dto.UpdateProductRequestDto;
import com.grocerypos.product.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Product REST API", description = "Endpoints for managing products, prices, barcodes, and stock parameters")
public class ProductController {

    private final ProductService productService;

    @Autowired
    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    /**
     * Create a new product.
     * Returns 201 Created with the created product DTO.
     */
    @PostMapping
    @Operation(summary = "Create Product", description = "Creates a new grocery product item with unique SKU and optional Barcode")
    public ResponseEntity<ApiResponse<ProductResponseDto>> createProduct(
            @Valid @RequestBody CreateProductRequestDto request) {
        ProductResponseDto created = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(created, "Product created successfully"));
    }

    /**
     * Get all products with optional search query, category, and active status filters.
     * Returns 200 OK.
     */
    @GetMapping
    @Operation(summary = "Get All Products", description = "Retrieves all products with optional search and category filters")
    public ResponseEntity<ApiResponse<List<ProductResponseDto>>> getAllProducts(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly) {
        List<ProductResponseDto> products = productService.getAllProducts(search, categoryId, activeOnly);
        return ResponseEntity.ok(ApiResponse.ok(products, "Products retrieved successfully"));
    }

    /**
     * Search products by Name, SKU, Barcode, or Category with partial matching.
     * GET /api/products/search?q={query}
     */
    @GetMapping("/search")
    @Operation(summary = "Search Products", description = "Searches products by partial matching on Name, SKU, Barcode, or Category")
    public ResponseEntity<ApiResponse<List<ProductResponseDto>>> searchProducts(
            @RequestParam("q") String query,
            @RequestParam(value = "activeOnly", required = false, defaultValue = "false") Boolean activeOnly) {
        List<ProductResponseDto> results = productService.searchProducts(query, activeOnly);
        return ResponseEntity.ok(ApiResponse.ok(results, "Products found"));
    }

    /**
     * Get product by ID.
     * Returns 200 OK if found, or 404 Not Found if missing.
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get Product by ID", description = "Fetches a specific product by its internal database ID")
    public ResponseEntity<ApiResponse<ProductResponseDto>> getProductById(@PathVariable Long id) {
        ProductResponseDto product = productService.getProductById(id);
        return ResponseEntity.ok(ApiResponse.ok(product, "Product retrieved successfully"));
    }

    /**
     * Update an existing product by ID.
     * Returns 200 OK with updated product DTO.
     */
    @PutMapping("/{id}")
    @Operation(summary = "Update Product", description = "Updates details of an existing product")
    public ResponseEntity<ApiResponse<ProductResponseDto>> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductRequestDto request) {
        ProductResponseDto updated = productService.updateProduct(id, request);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Product updated successfully"));
    }

    /**
     * Delete a product by ID.
     * Returns 204 No Content.
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Product", description = "Deletes a product item from the catalog")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
}
