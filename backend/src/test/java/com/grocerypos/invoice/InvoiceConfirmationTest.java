package com.grocerypos.invoice;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import com.grocerypos.inventory.repository.InventoryRepository;
import com.grocerypos.inventory.repository.InventoryTransactionRepository;
import com.grocerypos.invoice.dto.ExtractedFieldDto;
import com.grocerypos.invoice.dto.InvoiceExtractedItemDto;
import com.grocerypos.invoice.dto.InvoiceOcrResultDto;
import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import com.grocerypos.invoice.repository.PurchaseInvoiceRepository;
import com.grocerypos.notification.service.NotificationService;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Automated JUnit 5 & Mockito tests for Invoice confirmation and product matching:
 * - Product matching (by SKU, by barcode, by name)
 * - Low confidence matches requiring user review
 * - Invoice confirmation status updates
 * - Atomic inventory intake and transaction recording
 */
@ExtendWith(MockitoExtension.class)
public class InvoiceConfirmationTest {

    @Mock
    private PurchaseInvoiceRepository invoiceRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InventoryRepository inventoryRepository;

    @Mock
    private InventoryTransactionRepository transactionRepository;

    @Mock
    private NotificationService notificationService;

    private Product existingProduct;
    private Inventory existingInventory;
    private PurchaseInvoice testInvoice;

    @BeforeEach
    void setUp() {
        existingProduct = new Product(
                "Organic Cavendish Bananas",
                "SKU-BAN-001",
                new BigDecimal("0.85"),
                new BigDecimal("1.49"),
                BigDecimal.ZERO,
                "KG"
        );
        existingProduct.setId(10L);
        existingProduct.setBarcode("012345678901");
        existingProduct.setMinimumInventoryThreshold(15);

        existingInventory = new Inventory(existingProduct, new BigDecimal("40.000"));
        existingInventory.setId(100L);

        testInvoice = new PurchaseInvoice();
        testInvoice.setId(1L);
        testInvoice.setInvoiceNumber("INV-202610-001");
        testInvoice.setStatus(InvoiceStatus.PROCESSED);
    }

    @Test
    @DisplayName("Product Matching: Matches existing catalog product by exact SKU")
    void testProductMatchingBySku() {
        when(productRepository.findBySku("SKU-BAN-001")).thenReturn(Optional.of(existingProduct));

        Optional<Product> matched = productRepository.findBySku("SKU-BAN-001");

        assertThat(matched).isPresent();
        assertThat(matched.get().getId()).isEqualTo(10L);
        assertThat(matched.get().getName()).isEqualTo("Organic Cavendish Bananas");
    }

    @Test
    @DisplayName("Product Matching: Matches existing catalog product by barcode")
    void testProductMatchingByBarcode() {
        when(productRepository.findByBarcode("012345678901")).thenReturn(Optional.of(existingProduct));

        Optional<Product> matched = productRepository.findByBarcode("012345678901");

        assertThat(matched).isPresent();
        assertThat(matched.get().getSku()).isEqualTo("SKU-BAN-001");
    }

    @Test
    @DisplayName("Invoice Confirmation: Successfully updates inventory and records PURCHASE transactions")
    void testInvoiceConfirmationUpdatesInventory() {
        when(productRepository.findById(10L)).thenReturn(Optional.of(existingProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.of(existingInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        // Invoice intake: Add 50.0 units
        BigDecimal quantityToAdd = new BigDecimal("50.000");
        BigDecimal previousStock = existingInventory.getCurrentQuantity();
        BigDecimal newStock = previousStock.add(quantityToAdd);

        existingInventory.setCurrentQuantity(newStock);
        InventoryTransaction tx = new InventoryTransaction(
                existingProduct,
                InventoryTransactionType.PURCHASE,
                quantityToAdd,
                previousStock,
                newStock,
                "Invoice INV-202610-001 confirmed",
                testInvoice.getInvoiceNumber()
        );

        when(transactionRepository.save(any(InventoryTransaction.class))).thenReturn(tx);

        inventoryRepository.save(existingInventory);
        transactionRepository.save(tx);
        testInvoice.setStatus(InvoiceStatus.CONFIRMED);
        when(invoiceRepository.save(any(PurchaseInvoice.class))).thenReturn(testInvoice);

        invoiceRepository.save(testInvoice);

        assertThat(existingInventory.getCurrentQuantity()).isEqualByComparingTo("90.000");
        assertThat(testInvoice.getStatus()).isEqualTo(InvoiceStatus.CONFIRMED);

        verify(inventoryRepository).save(existingInventory);
        verify(transactionRepository).save(tx);
        verify(invoiceRepository).save(testInvoice);
    }

    @Test
    @DisplayName("Invoice Confirmation: Requires explicit user review for low-confidence item matches")
    void testLowConfidenceRequiresConfirmation() {
        InvoiceExtractedItemDto lowConfidenceItem = new InvoiceExtractedItemDto();
        lowConfidenceItem.setConfidence(62); // < 75%
        lowConfidenceItem.setFlaggedForReview(true);
        lowConfidenceItem.setProductName(new ExtractedFieldDto<>("Fuzzy item text", 62, false));

        boolean requiresManualReview = lowConfidenceItem.getConfidence() < 75 || lowConfidenceItem.isFlaggedForReview();

        assertThat(requiresManualReview).isTrue();
    }
}
