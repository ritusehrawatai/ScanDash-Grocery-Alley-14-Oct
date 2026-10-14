package com.grocerypos.inventory;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.inventory.dto.InventoryDto;
import com.grocerypos.inventory.dto.InventoryTransactionDto;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import com.grocerypos.inventory.repository.InventoryRepository;
import com.grocerypos.inventory.repository.InventoryTransactionRepository;
import com.grocerypos.inventory.service.InventoryServiceImpl;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class InventoryServiceTest {

    @Mock
    private InventoryRepository inventoryRepository;

    @Mock
    private InventoryTransactionRepository transactionRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private com.grocerypos.notification.service.NotificationService notificationService;

    @InjectMocks
    private InventoryServiceImpl inventoryService;

    private Product sampleProduct;

    @BeforeEach
    void setUp() {
        sampleProduct = new Product("Whole Milk 1 Gallon", "SKU-MLK-01",
                new BigDecimal("2.50"), new BigDecimal("3.89"), BigDecimal.ZERO, "GALLON");
        sampleProduct.setId(10L);
    }

    @Test
    @DisplayName("recordTransaction: PURCHASE should increase inventory and record transaction")
    void testPurchaseIncreasesInventory() {
        Inventory existingInventory = new Inventory(sampleProduct, new BigDecimal("10.000"));
        existingInventory.setId(1L);

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.of(existingInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        InventoryTransaction savedTx = new InventoryTransaction(
                sampleProduct,
                InventoryTransactionType.PURCHASE,
                new BigDecimal("20.000"),
                new BigDecimal("10.000"),
                new BigDecimal("30.000"),
                "Restock delivery",
                "PO-991"
        );
        savedTx.setId(100L);
        savedTx.setCreatedAt(Instant.now());
        when(transactionRepository.save(any(InventoryTransaction.class))).thenReturn(savedTx);

        InventoryTransactionDto result = inventoryService.recordTransaction(
                10L,
                InventoryTransactionType.PURCHASE,
                new BigDecimal("20.000"),
                "Restock delivery",
                "PO-991"
        );

        assertThat(result).isNotNull();
        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.PURCHASE);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("10.000");
        assertThat(result.getNewQuantity()).isEqualByComparingTo("30.000");
        assertThat(existingInventory.getCurrentQuantity()).isEqualByComparingTo("30.000");
        verify(inventoryRepository).save(existingInventory);
        verify(transactionRepository).save(any(InventoryTransaction.class));
    }

    @Test
    @DisplayName("recordTransaction: SALE should decrease inventory and record transaction")
    void testSaleDecreasesInventory() {
        Inventory existingInventory = new Inventory(sampleProduct, new BigDecimal("15.000"));
        existingInventory.setId(1L);

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.of(existingInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        InventoryTransaction savedTx = new InventoryTransaction(
                sampleProduct,
                InventoryTransactionType.SALE,
                new BigDecimal("3.000"),
                new BigDecimal("15.000"),
                new BigDecimal("12.000"),
                "Register checkout",
                "RECEIPT-101"
        );
        savedTx.setId(101L);
        savedTx.setCreatedAt(Instant.now());
        when(transactionRepository.save(any(InventoryTransaction.class))).thenReturn(savedTx);

        InventoryTransactionDto result = inventoryService.recordTransaction(
                10L,
                InventoryTransactionType.SALE,
                new BigDecimal("3.000"),
                "Register checkout",
                "RECEIPT-101"
        );

        assertThat(result).isNotNull();
        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.SALE);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("15.000");
        assertThat(result.getNewQuantity()).isEqualByComparingTo("12.000");
        assertThat(existingInventory.getCurrentQuantity()).isEqualByComparingTo("12.000");
    }

    @Test
    @DisplayName("recordTransaction: SALE with insufficient stock should throw InvalidRequestException")
    void testSaleInsufficientStockThrowsException() {
        Inventory existingInventory = new Inventory(sampleProduct, new BigDecimal("2.000"));
        existingInventory.setId(1L);

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.of(existingInventory));

        assertThatThrownBy(() -> inventoryService.recordTransaction(
                10L,
                InventoryTransactionType.SALE,
                new BigDecimal("5.000"),
                "Over sale",
                "RECEIPT-ERR"
        ))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("Insufficient inventory");

        verify(inventoryRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("recordTransaction: DAMAGE and EXPIRY should deduct stock")
    void testDamageAndExpiryDeductsStock() {
        Inventory existingInventory = new Inventory(sampleProduct, new BigDecimal("10.000"));
        existingInventory.setId(1L);

        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.of(existingInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        InventoryTransaction savedTx = new InventoryTransaction(
                sampleProduct,
                InventoryTransactionType.EXPIRY,
                new BigDecimal("2.000"),
                new BigDecimal("10.000"),
                new BigDecimal("8.000"),
                "Expired milk",
                "DISPOSAL-01"
        );
        savedTx.setId(102L);
        savedTx.setCreatedAt(Instant.now());
        when(transactionRepository.save(any(InventoryTransaction.class))).thenReturn(savedTx);

        InventoryTransactionDto result = inventoryService.recordTransaction(
                10L,
                InventoryTransactionType.EXPIRY,
                new BigDecimal("2.000"),
                "Expired milk",
                "DISPOSAL-01"
        );

        assertThat(result.getNewQuantity()).isEqualByComparingTo("8.000");
        assertThat(existingInventory.getCurrentQuantity()).isEqualByComparingTo("8.000");
    }

    @Test
    @DisplayName("recordTransaction: Should throw when quantity is zero or negative")
    void testInvalidQuantityThrowsException() {
        assertThatThrownBy(() -> inventoryService.recordTransaction(
                10L,
                InventoryTransactionType.PURCHASE,
                BigDecimal.ZERO,
                "Zero amount",
                "REF-0"
        ))
        .isInstanceOf(InvalidRequestException.class)
        .hasMessageContaining("Transaction quantity must be greater than zero");
    }

    @Test
    @DisplayName("recordTransaction: Should throw ResourceNotFoundException when product does not exist")
    void testProductNotFoundThrowsException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> inventoryService.recordTransaction(
                999L,
                InventoryTransactionType.PURCHASE,
                new BigDecimal("5.000"),
                "Missing prod",
                "REF-99"
        ))
        .isInstanceOf(ResourceNotFoundException.class)
        .hasMessageContaining("Product not found with ID: 999");
    }

    @Test
    @DisplayName("initializeInventory: Should set base quantity and record ADJUSTMENT")
    void testInitializeInventorySuccess() {
        when(productRepository.findById(10L)).thenReturn(Optional.of(sampleProduct));
        when(inventoryRepository.findByProductId(10L)).thenReturn(Optional.empty());

        Inventory savedInv = new Inventory(sampleProduct, new BigDecimal("50.000"));
        savedInv.setId(5L);
        when(inventoryRepository.save(any(Inventory.class))).thenReturn(savedInv);

        InventoryDto dto = inventoryService.initializeInventory(10L, new BigDecimal("50.000"));

        assertThat(dto).isNotNull();
        assertThat(dto.getCurrentQuantity()).isEqualByComparingTo("50.000");
        verify(transactionRepository).save(any(InventoryTransaction.class));
    }

    @Test
    @DisplayName("getTransactionHistory: Should return list of transactions for product")
    void testGetTransactionHistory() {
        when(productRepository.existsById(10L)).thenReturn(true);
        InventoryTransaction tx1 = new InventoryTransaction(
                sampleProduct, InventoryTransactionType.PURCHASE, new BigDecimal("10.0"), BigDecimal.ZERO, new BigDecimal("10.0"), "Init", "REF-1"
        );
        tx1.setId(1L);

        when(transactionRepository.findByProductIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(tx1));

        List<InventoryTransactionDto> history = inventoryService.getTransactionHistory(10L);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).getTransactionType()).isEqualTo(InventoryTransactionType.PURCHASE);
    }
}
