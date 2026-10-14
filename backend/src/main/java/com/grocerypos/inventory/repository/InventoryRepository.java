package com.grocerypos.inventory.repository;

import com.grocerypos.inventory.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    /**
     * Find the inventory stock record for a specific product ID.
     */
    Optional<Inventory> findByProductId(Long productId);

    /**
     * Find the inventory stock record by product SKU.
     */
    @Query("SELECT i FROM Inventory i JOIN i.product p WHERE p.sku = :sku")
    Optional<Inventory> findByProductSku(@Param("sku") String sku);

    /**
     * Check if an inventory stock record exists for the product ID.
     */
    boolean existsByProductId(Long productId);

    /**
     * Find low-stock inventories below or equal to a quantity threshold.
     */
    List<Inventory> findByCurrentQuantityLessThanEqual(BigDecimal threshold);
}
