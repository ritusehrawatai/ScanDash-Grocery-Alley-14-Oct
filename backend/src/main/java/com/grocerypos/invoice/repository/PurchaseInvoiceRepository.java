package com.grocerypos.invoice.repository;

import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseInvoiceRepository extends JpaRepository<PurchaseInvoice, Long> {

    Optional<PurchaseInvoice> findByInvoiceNumber(String invoiceNumber);

    Optional<PurchaseInvoice> findByFileHash(String fileHash);

    List<PurchaseInvoice> findAllByOrderByCreatedAtDesc();

    List<PurchaseInvoice> findByStatusOrderByCreatedAtDesc(InvoiceStatus status);
}
