package com.grocerypos.inventory.service;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.inventory.dto.InventoryDto;
import com.grocerypos.inventory.dto.InventoryTransactionDto;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import com.grocerypos.inventory.repository.InventoryRepository;
import com.grocerypos.inventory.repository.InventoryTransactionRepository;
import com.grocerypos.notification.service.NotificationService;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryTransactionRepository transactionRepository;
    private final ProductRepository productRepository;
    private final NotificationService notificationService;

    @Autowired
    public InventoryServiceImpl(
            InventoryRepository inventoryRepository,
            InventoryTransactionRepository transactionRepository,
            ProductRepository productRepository,
            NotificationService notificationService) {
        this.inventoryRepository = inventoryRepository;
        this.transactionRepository = transactionRepository;
        this.productRepository = productRepository;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryDto getInventoryByProductId(Long productId) {
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseGet(() -> {
                    Product product = productRepository.findById(productId)
                            .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));
                    return new Inventory(product, BigDecimal.ZERO);
                });
        return InventoryDto.fromEntity(inventory);
    }

    @Override
    public InventoryDto initializeInventory(Long productId, BigDecimal initialQuantity) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        if (initialQuantity == null || initialQuantity.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("Initial quantity cannot be negative.");
        }

        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElse(new Inventory(product, BigDecimal.ZERO));

        BigDecimal previousQuantity = inventory.getCurrentQuantity();
        inventory.setCurrentQuantity(initialQuantity);
        inventory.setLastUpdated(Instant.now());
        Inventory saved = inventoryRepository.save(inventory);

        // Record audit transaction
        InventoryTransaction tx = new InventoryTransaction(
                product,
                InventoryTransactionType.ADJUSTMENT,
                initialQuantity.subtract(previousQuantity).abs(),
                previousQuantity,
                initialQuantity,
                "Initial inventory setup",
                "INIT-" + productId
        );
        transactionRepository.save(tx);

        // Check and trigger in-app stock notifications (LOW STOCK or OUT OF STOCK)
        notificationService.checkAndTriggerStockNotification(product, initialQuantity);

        return InventoryDto.fromEntity(saved);
    }

    @Override
    public InventoryTransactionDto recordTransaction(
            Long productId,
            InventoryTransactionType type,
            BigDecimal quantity,
            String reason,
            String referenceId) {

        if (type == null) {
            throw new InvalidRequestException("Transaction type is required.");
        }
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("Transaction quantity must be greater than zero.");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + productId));

        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseGet(() -> {
                    Inventory newInv = new Inventory(product, BigDecimal.ZERO);
                    return inventoryRepository.save(newInv);
                });

        BigDecimal previousQuantity = inventory.getCurrentQuantity();
        BigDecimal newQuantity;

        switch (type) {
            case PURCHASE:
            case RETURN:
                newQuantity = previousQuantity.add(quantity);
                break;

            case SALE:
            case DAMAGE:
            case EXPIRY:
                if (previousQuantity.compareTo(quantity) < 0) {
                    throw new InvalidRequestException(
                            "Insufficient inventory: current stock is " + previousQuantity +
                            ", but requested deduction is " + quantity);
                }
                newQuantity = previousQuantity.subtract(quantity);
                break;

            case ADJUSTMENT:
            case CORRECTION:
                // Adjustment/Correction can increase or decrease; here quantity represents the target level or delta
                newQuantity = previousQuantity.add(quantity);
                if (newQuantity.compareTo(BigDecimal.ZERO) < 0) {
                    throw new InvalidRequestException("Inventory balance cannot become negative.");
                }
                break;

            default:
                throw new InvalidRequestException("Unsupported transaction type: " + type);
        }

        // Update inventory record
        inventory.setCurrentQuantity(newQuantity);
        inventory.setLastUpdated(Instant.now());
        inventoryRepository.save(inventory);

        // Record immutable transaction audit entry
        InventoryTransaction transaction = new InventoryTransaction(
                product,
                type,
                quantity,
                previousQuantity,
                newQuantity,
                reason,
                referenceId
        );
        InventoryTransaction savedTx = transactionRepository.save(transaction);

        // Check and trigger in-app stock notifications (LOW STOCK or OUT OF STOCK)
        notificationService.checkAndTriggerStockNotification(product, newQuantity);

        return InventoryTransactionDto.fromEntity(savedTx);
    }

    @Override
    public InventoryTransactionDto addStock(com.grocerypos.inventory.dto.AddStockRequestDto request) {
        if (request == null) {
            throw new InvalidRequestException("Request payload is required.");
        }
        if (request.getProductId() == null) {
            throw new InvalidRequestException("Product ID is required.");
        }
        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("Quantity to add must be greater than zero.");
        }

        InventoryTransactionType txType = request.getTransactionType() != null
                ? request.getTransactionType()
                : InventoryTransactionType.PURCHASE;

        return recordTransaction(
                request.getProductId(),
                txType,
                request.getQuantity(),
                request.getReason() != null ? request.getReason() : "Stock addition",
                request.getReferenceId()
        );
    }

    @Override
    public InventoryTransactionDto removeStock(com.grocerypos.inventory.dto.RemoveStockRequestDto request) {
        if (request == null) {
            throw new InvalidRequestException("Request payload is required.");
        }
        if (request.getProductId() == null) {
            throw new InvalidRequestException("Product ID is required.");
        }
        if (request.getQuantity() == null || request.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("Quantity to remove must be greater than zero.");
        }

        InventoryTransactionType txType = request.getTransactionType() != null
                ? request.getTransactionType()
                : InventoryTransactionType.DAMAGE;

        return recordTransaction(
                request.getProductId(),
                txType,
                request.getQuantity(),
                request.getReason() != null ? request.getReason() : "Stock removal",
                request.getReferenceId()
        );
    }

    @Override
    public InventoryTransactionDto adjustStock(com.grocerypos.inventory.dto.AdjustStockRequestDto request) {
        if (request == null) {
            throw new InvalidRequestException("Request payload is required.");
        }
        if (request.getProductId() == null) {
            throw new InvalidRequestException("Product ID is required.");
        }
        if (request.getTargetQuantity() == null || request.getTargetQuantity().compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("Target stock quantity cannot be negative.");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + request.getProductId()));

        Inventory inventory = inventoryRepository.findByProductId(request.getProductId())
                .orElseGet(() -> {
                    Inventory newInv = new Inventory(product, BigDecimal.ZERO);
                    return inventoryRepository.save(newInv);
                });

        BigDecimal previousQuantity = inventory.getCurrentQuantity();
        BigDecimal targetQuantity = request.getTargetQuantity();
        BigDecimal delta = targetQuantity.subtract(previousQuantity).abs();

        inventory.setCurrentQuantity(targetQuantity);
        inventory.setLastUpdated(Instant.now());
        inventoryRepository.save(inventory);

        InventoryTransaction transaction = new InventoryTransaction(
                product,
                InventoryTransactionType.ADJUSTMENT,
                delta,
                previousQuantity,
                targetQuantity,
                request.getReason() != null ? request.getReason() : "Stock level adjustment",
                request.getReferenceId()
        );
        InventoryTransaction savedTx = transactionRepository.save(transaction);

        // Check and trigger in-app stock notifications (LOW STOCK or OUT OF STOCK)
        notificationService.checkAndTriggerStockNotification(product, targetQuantity);

        return InventoryTransactionDto.fromEntity(savedTx);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryTransactionDto> getTransactionHistory(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new ResourceNotFoundException("Product not found with ID: " + productId);
        }

        return transactionRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(InventoryTransactionDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryDto> getAllInventory() {
        return inventoryRepository.findAll()
                .stream()
                .map(InventoryDto::fromEntity)
                .collect(Collectors.toList());
    }
}
