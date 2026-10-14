package com.grocerypos.inventory.repository;

import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    /**
     * Find transaction history for a specific product, newest first.
     */
    List<InventoryTransaction> findByProductIdOrderByCreatedAtDesc(Long productId);

    /**
     * Find paginated transactions for a product.
     */
    Page<InventoryTransaction> findByProductId(Long productId, Pageable pageable);

    /**
     * Find transactions by type (e.g. all PURCHASES or ADJUSTMENTS).
     */
    List<InventoryTransaction> findByTransactionTypeOrderByCreatedAtDesc(InventoryTransactionType transactionType);

    /**
     * Find transactions by external reference ID (e.g. invoice or ticket ID).
     */
    List<InventoryTransaction> findByReferenceId(String referenceId);
}
