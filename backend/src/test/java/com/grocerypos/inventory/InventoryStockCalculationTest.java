package com.grocerypos.inventory;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.inventory.dto.AddStockRequestDto;
import com.grocerypos.inventory.dto.AdjustStockRequestDto;
import com.grocerypos.inventory.dto.InventoryTransactionDto;
import com.grocerypos.inventory.dto.RemoveStockRequestDto;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class InventoryStockCalculationTest {

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

    private Product testProduct;
    private Inventory testInventory;

    @BeforeEach
    void setUp() {
        testProduct = new Product("Bananas", "SKU-BAN-01", new BigDecimal("0.50"), new BigDecimal("1.20"), BigDecimal.ZERO, "KG");
        testProduct.setId(100L);

        testInventory = new Inventory(testProduct, new BigDecimal("20.000"));
        testInventory.setId(1L);
    }

    @Test
    @DisplayName("addStock (PURCHASE): Should accurately calculate newQuantity = previousQuantity + addition")
    void testAddStockPurchaseCalculation() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        when(transactionRepository.save(any(InventoryTransaction.class))).thenAnswer(i -> {
            InventoryTransaction tx = i.getArgument(0);
            tx.setId(501L);
            tx.setCreatedAt(Instant.now());
            return tx;
        });

        AddStockRequestDto request = new AddStockRequestDto(
                100L, new BigDecimal("15.500"), "Direct supplier delivery", "PO-778"
        );

        InventoryTransactionDto result = inventoryService.addStock(request);

        assertThat(result).isNotNull();
        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.PURCHASE);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("20.000");
        assertThat(result.getQuantity()).isEqualByComparingTo("15.500");
        assertThat(result.getNewQuantity()).isEqualByComparingTo("35.500");

        // Verify inventory saved with 35.500
        ArgumentCaptor<Inventory> invCaptor = ArgumentCaptor.forClass(Inventory.class);
        verify(inventoryRepository).save(invCaptor.capture());
        assertThat(invCaptor.getValue().getCurrentQuantity()).isEqualByComparingTo("35.500");
    }

    @Test
    @DisplayName("addStock (RETURN): Should accurately calculate newQuantity on customer return")
    void testAddStockReturnCalculation() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        when(transactionRepository.save(any(InventoryTransaction.class))).thenAnswer(i -> {
            InventoryTransaction tx = i.getArgument(0);
            tx.setId(502L);
            return tx;
        });

        AddStockRequestDto request = new AddStockRequestDto(
                100L, new BigDecimal("2.250"), "Customer return", "RET-11"
        );
        request.setTransactionType(InventoryTransactionType.RETURN);

        InventoryTransactionDto result = inventoryService.addStock(request);

        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.RETURN);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("20.000");
        assertThat(result.getNewQuantity()).isEqualByComparingTo("22.250");
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo("22.250");
    }

    @Test
    @DisplayName("removeStock (DAMAGE): Should accurately calculate newQuantity = previousQuantity - deduction")
    void testRemoveStockDamageCalculation() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        when(transactionRepository.save(any(InventoryTransaction.class))).thenAnswer(i -> {
            InventoryTransaction tx = i.getArgument(0);
            tx.setId(503L);
            return tx;
        });

        RemoveStockRequestDto request = new RemoveStockRequestDto(
                100L, new BigDecimal("4.500"), InventoryTransactionType.DAMAGE, "Dropped on floor", "DMG-88"
        );

        InventoryTransactionDto result = inventoryService.removeStock(request);

        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.DAMAGE);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("20.000");
        assertThat(result.getQuantity()).isEqualByComparingTo("4.500");
        assertThat(result.getNewQuantity()).isEqualByComparingTo("15.500");
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo("15.500");
    }

    @Test
    @DisplayName("removeStock: Should prevent negative inventory when deduction exceeds current stock")
    void testPreventNegativeInventoryOnRemoval() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));

        RemoveStockRequestDto request = new RemoveStockRequestDto(
                100L, new BigDecimal("25.000"), InventoryTransactionType.DAMAGE, "Excessive damage", "DMG-FAIL"
        );

        // Current stock is 20.000; attempting to remove 25.000 must fail
        assertThatThrownBy(() -> inventoryService.removeStock(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Insufficient inventory: current stock is 20.000, but requested deduction is 25.000");

        // Verify balance was NOT mutated
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo("20.000");
        verify(inventoryRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("adjustStock (Upwards): Should calculate positive delta and set target balance")
    void testAdjustStockUpwards() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        when(transactionRepository.save(any(InventoryTransaction.class))).thenAnswer(i -> {
            InventoryTransaction tx = i.getArgument(0);
            tx.setId(504L);
            return tx;
        });

        // Current stock: 20.000 -> Target: 28.000
        AdjustStockRequestDto request = new AdjustStockRequestDto(
                100L, new BigDecimal("28.000"), "Cycle count found extra boxes", "AUDIT-01"
        );

        InventoryTransactionDto result = inventoryService.adjustStock(request);

        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.ADJUSTMENT);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("20.000");
        assertThat(result.getQuantity()).isEqualByComparingTo("8.000"); // delta
        assertThat(result.getNewQuantity()).isEqualByComparingTo("28.000"); // target
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo("28.000");
    }

    @Test
    @DisplayName("adjustStock (Downwards): Should calculate negative delta and set target balance")
    void testAdjustStockDownwards() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(100L)).thenReturn(Optional.of(testInventory));
        when(inventoryRepository.save(any(Inventory.class))).thenAnswer(i -> i.getArgument(0));

        when(transactionRepository.save(any(InventoryTransaction.class))).thenAnswer(i -> {
            InventoryTransaction tx = i.getArgument(0);
            tx.setId(505L);
            return tx;
        });

        // Current stock: 20.000 -> Target: 14.500
        AdjustStockRequestDto request = new AdjustStockRequestDto(
                100L, new BigDecimal("14.500"), "Shrinkage reconciliation", "AUDIT-02"
        );

        InventoryTransactionDto result = inventoryService.adjustStock(request);

        assertThat(result.getTransactionType()).isEqualTo(InventoryTransactionType.ADJUSTMENT);
        assertThat(result.getPreviousQuantity()).isEqualByComparingTo("20.000");
        assertThat(result.getQuantity()).isEqualByComparingTo("5.500"); // absolute delta
        assertThat(result.getNewQuantity()).isEqualByComparingTo("14.500"); // target
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo("14.500");
    }

    @Test
    @DisplayName("adjustStock: Should reject negative target quantity")
    void testAdjustStockRejectNegativeTarget() {
        AdjustStockRequestDto request = new AdjustStockRequestDto(
                100L, new BigDecimal("-1.000"), "Negative audit", "AUDIT-ERR"
        );

        assertThatThrownBy(() -> inventoryService.adjustStock(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Target stock quantity cannot be negative");

        verify(inventoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("addStock: Should reject zero or negative quantities")
    void testAddStockRejectZeroQuantity() {
        AddStockRequestDto request = new AddStockRequestDto(
                100L, BigDecimal.ZERO, "Zero addition", "ERR-ZERO"
        );

        assertThatThrownBy(() -> inventoryService.addStock(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Quantity to add must be greater than zero");
    }
}
