package com.grocerypos.sale.service;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryStatus;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class SaleServiceImpl implements SaleService {

    private final SaleRepository saleRepository;
    private final SaleItemRepository saleItemRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final NotificationService notificationService;

    @Autowired
    public SaleServiceImpl(
            SaleRepository saleRepository,
            SaleItemRepository saleItemRepository,
            ProductRepository productRepository,
            InventoryRepository inventoryRepository,
            InventoryTransactionRepository transactionRepository,
            NotificationService notificationService) {
        this.saleRepository = saleRepository;
        this.saleItemRepository = saleItemRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.transactionRepository = transactionRepository;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDto processSale(CreateSaleRequestDto request) {
        // 1. Validate cart
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new InvalidRequestException("Cart cannot be empty. At least one product is required to complete a sale.");
        }

        // Group quantities by product ID in case client sent duplicates
        Map<Long, BigDecimal> aggregatedItems = new LinkedHashMap<>();
        for (CreateSaleItemRequestDto itemDto : request.getItems()) {
            if (itemDto == null || itemDto.getProductId() == null) {
                throw new InvalidRequestException("Product ID is required for each cart line item.");
            }
            if (itemDto.getQuantity() == null || itemDto.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new InvalidRequestException("Item quantity must be greater than zero for product ID: " + itemDto.getProductId());
            }
            aggregatedItems.merge(itemDto.getProductId(), itemDto.getQuantity(), BigDecimal::add);
        }

        // 2. Validate product availability and collect data
        Map<Long, Product> productMap = new HashMap<>();
        Map<Long, Inventory> inventoryMap = new HashMap<>();

        for (Map.Entry<Long, BigDecimal> entry : aggregatedItems.entrySet()) {
            Long productId = entry.getKey();
            BigDecimal requestedQty = entry.getValue();

            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

            if (!product.isActive()) {
                throw new InvalidRequestException(
                        "Product '" + product.getName() + "' (SKU: " + product.getSku() + ") is inactive and cannot be sold."
                );
            }

            Inventory inventory = inventoryRepository.findByProductId(productId)
                    .orElseGet(() -> {
                        Inventory newInv = new Inventory(product, BigDecimal.ZERO);
                        return inventoryRepository.save(newInv);
                    });

            if (inventory.getCurrentQuantity().compareTo(requestedQty) < 0) {
                throw new InvalidRequestException(
                        String.format("Insufficient inventory for product '%s' (SKU: %s). Available: %s %s, Requested: %s %s",
                                product.getName(),
                                product.getSku(),
                                inventory.getCurrentQuantity().toPlainString(),
                                product.getUnit(),
                                requestedQty.toPlainString(),
                                product.getUnit()
                        )
                );
            }

            productMap.put(productId, product);
            inventoryMap.put(productId, inventory);
        }

        // 3. Calculate subtotal, 4. Calculate tax, 5. Calculate total
        BigDecimal orderSubtotal = BigDecimal.ZERO;
        BigDecimal orderTax = BigDecimal.ZERO;

        List<SaleItem> preparedItems = new ArrayList<>();
        int totalItemQuantityCount = 0;

        for (Map.Entry<Long, BigDecimal> entry : aggregatedItems.entrySet()) {
            Long productId = entry.getKey();
            BigDecimal qty = entry.getValue();
            Product product = productMap.get(productId);

            BigDecimal unitPrice = product.getSellingPrice() != null ? product.getSellingPrice() : BigDecimal.ZERO;
            BigDecimal lineSubtotal = unitPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);

            BigDecimal rawTaxRate = product.getTaxRate() != null ? product.getTaxRate() : BigDecimal.ZERO;
            BigDecimal taxRateMultiplier = rawTaxRate.compareTo(BigDecimal.ONE) > 0
                    ? rawTaxRate.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
                    : rawTaxRate;

            BigDecimal lineTax = lineSubtotal.multiply(taxRateMultiplier).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = lineSubtotal.add(lineTax).setScale(2, RoundingMode.HALF_UP);

            orderSubtotal = orderSubtotal.add(lineSubtotal);
            orderTax = orderTax.add(lineTax);
            totalItemQuantityCount += qty.intValue();

            SaleItem saleItem = new SaleItem(
                    product,
                    qty,
                    unitPrice,
                    rawTaxRate,
                    lineSubtotal,
                    lineTax,
                    lineTotal
            );
            preparedItems.add(saleItem);
        }

        BigDecimal orderTotal = orderSubtotal.add(orderTax).setScale(2, RoundingMode.HALF_UP);

        // 6. Create Sale
        SaleStatus initialStatus = (request.getStatus() != null && "PENDING".equalsIgnoreCase(request.getStatus().trim()))
                ? SaleStatus.PENDING
                : SaleStatus.COMPLETED;

        String receiptNumber = generateReceiptNumber();
        Sale sale = new Sale(
                receiptNumber,
                orderSubtotal,
                orderTax,
                orderTotal,
                initialStatus,
                totalItemQuantityCount
        );

        Sale savedSale = saleRepository.save(sale);

        // 7. Create SaleItems
        for (SaleItem item : preparedItems) {
            item.setSale(savedSale);
            saleItemRepository.save(item);
            savedSale.getItems().add(item);
        }

        // 8. Deduct inventory, 9. Create SALE inventory transactions, 10. Recalculate inventory status, 11. Trigger existing notification logic
        // Only deduct inventory when the sale is COMPLETED (never for PENDING card checkout drafts)
        if (initialStatus == SaleStatus.COMPLETED) {
            for (Map.Entry<Long, BigDecimal> entry : aggregatedItems.entrySet()) {
                Long productId = entry.getKey();
                BigDecimal deductionQty = entry.getValue();
                Product product = productMap.get(productId);
                Inventory inventory = inventoryMap.get(productId);

                BigDecimal previousQuantity = inventory.getCurrentQuantity();
                BigDecimal newQuantity = previousQuantity.subtract(deductionQty);

                // 8. Deduct inventory
                inventory.setCurrentQuantity(newQuantity);
                inventory.setLastUpdated(Instant.now());
                inventoryRepository.save(inventory);

                // 9. Create SALE inventory transaction
                InventoryTransaction transaction = new InventoryTransaction(
                        product,
                        InventoryTransactionType.SALE,
                        deductionQty,
                        previousQuantity,
                        newQuantity,
                        "Sale completed - " + receiptNumber,
                        receiptNumber
                );
                transactionRepository.save(transaction);

                // 10. Recalculate inventory status
                InventoryStatus status = InventoryStatus.calculate(newQuantity, product.getMinimumInventoryThreshold());

                // 11. Trigger existing notification logic
                notificationService.checkAndTriggerStockNotification(product, newQuantity);
            }
        }

        return SaleResponseDto.fromEntity(savedSale);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponseDto getSaleById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with ID: " + id));
        return SaleResponseDto.fromEntity(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponseDto getSaleByReceiptNumber(String receiptNumber) {
        Sale sale = saleRepository.findByReceiptNumber(receiptNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with receipt number: " + receiptNumber));
        return SaleResponseDto.fromEntity(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDto> getAllSales() {
        return saleRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(SaleResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDto cancelSale(Long id, String reason) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with ID: " + id));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new InvalidRequestException("Sale is already cancelled: " + sale.getReceiptNumber());
        }

        sale.setStatus(SaleStatus.CANCELLED);
        sale.setNotes((sale.getNotes() != null ? sale.getNotes() + " | " : "") + "Cancelled: " + (reason != null ? reason : "Customer request"));
        sale.setUpdatedAt(Instant.now());

        // Restore inventory for each item in the cancelled sale
        if (sale.getItems() != null) {
            for (SaleItem item : sale.getItems()) {
                Product product = item.getProduct();
                if (product != null) {
                    BigDecimal qtyToRestore = item.getQuantity();
                    Inventory inventory = inventoryRepository.findByProductId(product.getId())
                            .orElse(new Inventory(product, BigDecimal.ZERO));

                    BigDecimal previousQuantity = inventory.getCurrentQuantity();
                    BigDecimal newQuantity = previousQuantity.add(qtyToRestore);
                    inventory.setCurrentQuantity(newQuantity);
                    inventory.setStockStatus(InventoryStatus.calculate(newQuantity, product.getMinimumInventoryThreshold()));
                    inventory.setLastUpdated(Instant.now());
                    inventoryRepository.save(inventory);

                    InventoryTransaction transaction = new InventoryTransaction(
                            product,
                            InventoryTransactionType.RETURN,
                            qtyToRestore,
                            previousQuantity,
                            newQuantity,
                            "Sale cancelled - Restocked for receipt " + sale.getReceiptNumber() + (reason != null ? " (" + reason + ")" : ""),
                            sale.getReceiptNumber()
                    );
                    transactionRepository.save(transaction);
                    notificationService.checkAndTriggerStockNotification(product, newQuantity);
                }
            }
        }

        Sale saved = saleRepository.save(sale);
        return SaleResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDto recoverSale(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with ID: " + saleId));

        if (sale.getStatus() == SaleStatus.COMPLETED && (sale.getRequiresRecovery() == null || !sale.getRequiresRecovery())) {
            return SaleResponseDto.fromEntity(sale);
        }

        // Deduct inventory
        if (sale.getItems() != null) {
            for (SaleItem item : sale.getItems()) {
                Product product = item.getProduct();
                if (product != null) {
                    Inventory inventory = inventoryRepository.findByProductId(product.getId())
                            .orElse(new Inventory(product, BigDecimal.ZERO));
                    BigDecimal prevQty = inventory.getCurrentQuantity();
                    BigDecimal deductQty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE;
                    BigDecimal newQty = prevQty.subtract(deductQty);
                    inventory.setCurrentQuantity(newQty);
                    inventory.setStockStatus(InventoryStatus.calculate(newQty, product.getMinimumInventoryThreshold()));
                    inventory.setLastUpdated(Instant.now());
                    inventoryRepository.save(inventory);

                    InventoryTransaction tx = new InventoryTransaction(
                            product,
                            InventoryTransactionType.SALE,
                            deductQty,
                            prevQty,
                            newQty,
                            "Sale recovered & finalized via Stripe - " + sale.getReceiptNumber(),
                            sale.getReceiptNumber()
                    );
                    transactionRepository.save(tx);
                    notificationService.checkAndTriggerStockNotification(product, newQty);
                }
            }
        }

        sale.setStatus(SaleStatus.COMPLETED);
        sale.setRequiresRecovery(false);
        sale.setRecoveryStatus("NONE");
        sale.setRecoveryReason(null);
        Sale saved = saleRepository.save(sale);
        return SaleResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDto> getSalesNeedingRecovery() {
        return saleRepository.findAll().stream()
                .filter(s -> Boolean.TRUE.equals(s.getRequiresRecovery()))
                .map(SaleResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    private String generateReceiptNumber() {
        long timestamp = System.currentTimeMillis();
        int randomSuffix = (int) (Math.random() * 9000 + 1000);
        return "REC-" + timestamp + "-" + randomSuffix;
    }
}
