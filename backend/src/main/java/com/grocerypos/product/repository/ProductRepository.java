package com.grocerypos.product.repository;

import com.grocerypos.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Find a product by its unique SKU (Stock Keeping Unit).
     */
    Optional<Product> findBySku(String sku);

    /**
     * Find a product by its unique Barcode (EAN, UPC, Code128, etc.).
     */
    Optional<Product> findByBarcode(String barcode);

    /**
     * Check if a product with the given SKU already exists.
     */
    boolean existsBySku(String sku);

    /**
     * Check if a product with the given barcode already exists.
     */
    boolean existsByBarcode(String barcode);

    /**
     * Find active products belonging to a specific category.
     */
    List<Product> findByCategoryIdAndActiveTrue(Long categoryId);

    /**
     * Find active products supplied by a specific vendor.
     */
    List<Product> findBySupplierIdAndActiveTrue(Long supplierId);

    /**
     * Find all active products.
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"category", "supplier"})
    List<Product> findByActiveTrue();

    /**
     * Case-insensitive search by product name with pagination.
     */
    Page<Product> findByNameContainingIgnoreCase(String name, Pageable pageable);

    /**
     * Partial matching search across Name, SKU, Barcode, and Category.
     * Supports both all products or active-only (ideal for POS checkout).
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"category", "supplier"})
    @Query("SELECT p FROM Product p LEFT JOIN p.category c WHERE " +
           "(:activeOnly = false OR p.active = true) AND (" +
           "LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "(p.barcode IS NOT NULL AND LOWER(p.barcode) LIKE LOWER(CONCAT('%', :query, '%'))) OR " +
           "(c.name IS NOT NULL AND LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')))" +
           ") ORDER BY p.name ASC")
    List<Product> searchProducts(
            @Param("query") String query,
            @Param("activeOnly") boolean activeOnly);
}
