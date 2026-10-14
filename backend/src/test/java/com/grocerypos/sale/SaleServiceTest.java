package com.grocerypos.sale;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import com.grocerypos.inventory.repository.InventoryRepository;
import com.grocerypos.inventory.repository.InventoryTransactionRepository;
import com.grocerypos.notification.service.NotificationService;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.repository.ProductRepository;
import com.grocerypos.sale.dto.CreateSaleItemRequestDto;
import com.grocerypos.sale.dto.CreateSaleRequestDto;
import com.grocerypos.sale.dto.SaleResponseDto;
import com.grocerypos.sale.entity.Sale;
import com.grocerypos.sale.entity.SaleItem;
import com.grocerypos.sale.entity.SaleStatus;
import com.grocerypos.sale.repository.SaleItemRepository;
import com.grocerypos.sale.repository.SaleRepository;
import com.grocerypos.sale.service.SaleServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SaleServiceTest {

    @Mock
    private SaleRepository saleRepository;

    @Mock
    private SaleItemRepository saleItemRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InventoryRepository inventoryRepository;

    @Mock
    private InventoryTransactionRepository transactionRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private SaleServiceImpl saleService;

    private Product testProduct;
    private Inventory testInventory;

    @BeforeEach
    void setUp() {
        testProduct = new Product(
                "Whole Milk 1 Gallon",
                "SKU-MLK-001",
                new BigDecimal("2.40"),
                new BigDecimal("3.89"),
                new BigDecimal("5.00"), // 5% tax
                "GALLON"
        );
        testProduct.setId(1L);
        testProduct.setActive(true);
        testProduct.setMinimumInventoryThreshold(10);

        testInventory = new Inventory(testProduct, new BigDecimal("25.0"));
        testInventory.setId(10L);
    }

    @Test
    @DisplayName("processSale: Should successfully complete sale, calculate subtotal/tax/total, deduct inventory, and record SALE transaction")
    void testProcessSaleSuccess() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(1L)).thenReturn(Optional.of(testInventory));
        when(saleRepository.save(any(Sale.class))).thenAnswer(invocation -> {
            Sale s = invocation.getArgument(0);
            s.setId(101L);
            return s;
        });
        when(saleItemRepository.save(any(SaleItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreateSaleRequestDto request = new CreateSaleRequestDto(
                Collections.singletonList(new CreateSaleItemRequestDto(1L, new BigDecimal("2.0")))
        );

        SaleResponseDto result = saleService.processSale(request);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(101L);
        assertThat(result.getStatus()).isEqualTo(SaleStatus.COMPLETED);

        // Subtotal: 2 * 3.89 = 7.78
        // Tax: 7.78 * 0.05 = 0.39
        // Total: 7.78 + 0.39 = 8.17
        assertThat(result.getSubtotal()).isEqualByComparingTo(new BigDecimal("7.78"));
        assertThat(result.getTaxAmount()).isEqualByComparingTo(new BigDecimal("0.39"));
        assertThat(result.getTotalAmount()).isEqualByComparingTo(new BigDecimal("8.17"));

        // Verify inventory deducted: 25.0 - 2.0 = 23.0
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo(new BigDecimal("23.0"));
        verify(inventoryRepository).save(testInventory);

        // Verify SALE transaction recorded
        ArgumentCaptor<InventoryTransaction> txCaptor = ArgumentCaptor.forClass(InventoryTransaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        InventoryTransaction recordedTx = txCaptor.getValue();
        assertThat(recordedTx.getTransactionType()).isEqualTo(InventoryTransactionType.SALE);
        assertThat(recordedTx.getQuantity()).isEqualByComparingTo(new BigDecimal("2.0"));
        assertThat(recordedTx.getPreviousQuantity()).isEqualByComparingTo(new BigDecimal("25.0"));
        assertThat(recordedTx.getNewQuantity()).isEqualByComparingTo(new BigDecimal("23.0"));

        // Verify notification logic called
        verify(notificationService).checkAndTriggerStockNotification(testProduct, new BigDecimal("23.0"));
    }

    @Test
    @DisplayName("processSale: Should throw InvalidRequestException when cart is empty")
    void testProcessSaleEmptyCartThrowsException() {
        CreateSaleRequestDto emptyRequest = new CreateSaleRequestDto(Collections.emptyList());

        assertThatThrownBy(() -> saleService.processSale(emptyRequest))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Cart cannot be empty");

        verify(saleRepository, never()).save(any());
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("processSale: Should throw ResourceNotFoundException when product does not exist")
    void testProcessSaleProductNotFoundThrowsException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        CreateSaleRequestDto request = new CreateSaleRequestDto(
                Collections.singletonList(new CreateSaleItemRequestDto(999L, new BigDecimal("1.0")))
        );

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Product not found with ID: 999");

        verify(saleRepository, never()).save(any());
    }

    @Test
    @DisplayName("processSale: Should throw InvalidRequestException when product is deactivated")
    void testProcessSaleInactiveProductThrowsException() {
        testProduct.setActive(false);
        when(productRepository.findById(1L)).thenReturn(Optional.of(testProduct));

        CreateSaleRequestDto request = new CreateSaleRequestDto(
                Collections.singletonList(new CreateSaleItemRequestDto(1L, new BigDecimal("1.0")))
        );

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("is inactive and cannot be sold");

        verify(saleRepository, never()).save(any());
    }

    @Test
    @DisplayName("processSale: Should throw InvalidRequestException and roll back when inventory is insufficient")
    void testProcessSaleInsufficientInventoryThrowsException() {
        testInventory.setCurrentQuantity(new BigDecimal("1.0")); // only 1 in stock
        when(productRepository.findById(1L)).thenReturn(Optional.of(testProduct));
        when(inventoryRepository.findByProductId(1L)).thenReturn(Optional.of(testInventory));

        CreateSaleRequestDto request = new CreateSaleRequestDto(
                Collections.singletonList(new CreateSaleItemRequestDto(1L, new BigDecimal("5.0"))) // wants 5
        );

        assertThatThrownBy(() -> saleService.processSale(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Insufficient inventory for product");

        // Verify that no sale was saved and no inventory deduction occurred
        verify(saleRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cancelSale: Should cancel sale, restore inventory, and record RETURN transaction")
    void testCancelSaleSuccess() {
        Sale completedSale = new Sale("REC-999-1234", new BigDecimal("7.78"), new BigDecimal("0.39"), new BigDecimal("8.17"), SaleStatus.COMPLETED);
        completedSale.setId(50L);
        SaleItem item = new SaleItem(completedSale, testProduct, new BigDecimal("2.0"), new BigDecimal("3.89"), new BigDecimal("7.78"), new BigDecimal("0.39"), new BigDecimal("8.17"));
        completedSale.setItems(Collections.singletonList(item));

        testInventory.setCurrentQuantity(new BigDecimal("23.0"));

        when(saleRepository.findById(50L)).thenReturn(Optional.of(completedSale));
        when(inventoryRepository.findByProductId(1L)).thenReturn(Optional.of(testInventory));
        when(saleRepository.save(any(Sale.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SaleResponseDto result = saleService.cancelSale(50L, "Customer returned goods");

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(SaleStatus.CANCELLED);

        // Verify inventory restored: 23.0 + 2.0 = 25.0
        assertThat(testInventory.getCurrentQuantity()).isEqualByComparingTo(new BigDecimal("25.0"));
        verify(inventoryRepository).save(testInventory);

        // Verify RETURN transaction recorded
        ArgumentCaptor<InventoryTransaction> txCaptor = ArgumentCaptor.forClass(InventoryTransaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        InventoryTransaction tx = txCaptor.getValue();
        assertThat(tx.getTransactionType()).isEqualTo(InventoryTransactionType.RETURN);
        assertThat(tx.getQuantity()).isEqualByComparingTo(new BigDecimal("2.0"));
        assertThat(tx.getPreviousQuantity()).isEqualByComparingTo(new BigDecimal("23.0"));
        assertThat(tx.getNewQuantity()).isEqualByComparingTo(new BigDecimal("25.0"));

        verify(notificationService).checkAndTriggerStockNotification(testProduct, new BigDecimal("25.0"));
    }

    @Test
    @DisplayName("cancelSale: Should throw InvalidRequestException when sale is already cancelled")
    void testCancelSaleAlreadyCancelledThrowsException() {
        Sale cancelledSale = new Sale("REC-999-5555", new BigDecimal("7.78"), new BigDecimal("0.39"), new BigDecimal("8.17"), SaleStatus.CANCELLED);
        cancelledSale.setId(51L);

        when(saleRepository.findById(51L)).thenReturn(Optional.of(cancelledSale));

        assertThatThrownBy(() -> saleService.cancelSale(51L, "Second cancellation attempt"))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Sale is already cancelled");

        verify(inventoryRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("cancelSale: Should throw ResourceNotFoundException when sale ID does not exist")
    void testCancelSaleNotFoundThrowsException() {
        when(saleRepository.findById(9999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> saleService.cancelSale(9999L, "Missing sale"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Sale not found with ID: 9999");
    }
}
