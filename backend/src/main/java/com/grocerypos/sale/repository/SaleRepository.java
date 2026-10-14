package com.grocerypos.sale.repository;

import com.grocerypos.sale.entity.Sale;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {

    @EntityGraph(attributePaths = {"items", "items.product"})
    Optional<Sale> findByReceiptNumber(String receiptNumber);

    @EntityGraph(attributePaths = {"items", "items.product"})
    List<Sale> findAllByOrderByCreatedAtDesc();
}
