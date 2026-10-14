package com.grocerypos.product.service;

import com.grocerypos.common.exception.DuplicateResourceException;
import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.product.dto.CreateProductRequestDto;
import com.grocerypos.product.dto.ProductResponseDto;
import com.grocerypos.product.dto.UpdateProductRequestDto;
import com.grocerypos.product.entity.Category;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.entity.Supplier;
import com.grocerypos.product.repository.CategoryRepository;
import com.grocerypos.product.repository.ProductRepository;
import com.grocerypos.product.repository.SupplierRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;

    @Autowired
    public ProductServiceImpl(
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            SupplierRepository supplierRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
    }

    @Override
    public ProductResponseDto createProduct(CreateProductRequestDto request) {
        validateBusinessRules(
                request.getName(),
                request.getSku(),
                request.getPurchasePrice(),
                request.getSellingPrice(),
                request.getTaxRate(),
                request.getMinimumInventoryThreshold()
        );

        // Check duplicate SKU
        if (productRepository.existsBySku(request.getSku())) {
            throw new DuplicateResourceException("A product with SKU '" + request.getSku() + "' already exists.");
        }

        // Check duplicate Barcode (when provided)
        String trimmedBarcode = cleanString(request.getBarcode());
        if (trimmedBarcode != null && productRepository.existsByBarcode(trimmedBarcode)) {
            throw new DuplicateResourceException("A product with barcode '" + trimmedBarcode + "' already exists.");
        }

        Product product = new Product();
        product.setName(request.getName().trim());
        product.setSku(request.getSku().trim());
        product.setBarcode(trimmedBarcode);
        product.setDescription(cleanString(request.getDescription()));
        product.setPurchasePrice(request.getPurchasePrice());
        product.setSellingPrice(request.getSellingPrice());
        product.setTaxRate(request.getTaxRate());
        product.setUnit(request.getUnit() != null ? request.getUnit().trim() : "PCS");
        product.setMinimumInventoryThreshold(request.getMinimumInventoryThreshold() != null ? request.getMinimumInventoryThreshold() : 0);
        product.setActive(request.getActive() != null ? request.getActive() : true);

        // Resolve Category if provided
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found with ID: " + request.getCategoryId()));
            product.setCategory(category);
        }

        // Resolve Supplier if provided
        if (request.getSupplierId() != null) {
            Supplier supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with ID: " + request.getSupplierId()));
            product.setSupplier(supplier);
        }

        Product saved = productRepository.save(product);
        return ProductResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDto> getAllProducts(String search, Long categoryId, Boolean activeOnly) {
        List<Product> products;

        if (search != null && !search.trim().isEmpty()) {
            products = productRepository.searchActiveProducts(search.trim());
        } else if (categoryId != null) {
            products = Boolean.TRUE.equals(activeOnly)
                    ? productRepository.findByCategoryIdAndActiveTrue(categoryId)
                    : productRepository.findAll().stream()
                        .filter(p -> p.getCategory() != null && categoryId.equals(p.getCategory().getId()))
                        .collect(Collectors.toList());
        } else if (Boolean.TRUE.equals(activeOnly)) {
            products = productRepository.findByActiveTrue();
        } else {
            products = productRepository.findAll();
        }

        return products.stream()
                .map(ProductResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponseDto getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + id));
        return ProductResponseDto.fromEntity(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDto> searchProducts(String query, Boolean activeOnly) {
        if (query == null || query.trim().isEmpty()) {
            return Boolean.TRUE.equals(activeOnly)
                    ? productRepository.findByActiveTrue().stream().map(ProductResponseDto::fromEntity).collect(Collectors.toList())
                    : productRepository.findAll().stream().map(ProductResponseDto::fromEntity).collect(Collectors.toList());
        }

        boolean filterActive = Boolean.TRUE.equals(activeOnly);
        List<Product> matches = productRepository.searchProducts(query.trim(), filterActive);

        return matches.stream()
                .map(ProductResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public ProductResponseDto updateProduct(Long id, UpdateProductRequestDto request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + id));

        validateBusinessRules(
                request.getName(),
                request.getSku(),
                request.getPurchasePrice(),
                request.getSellingPrice(),
                request.getTaxRate(),
                request.getMinimumInventoryThreshold()
        );

        // Check if SKU changed and is already taken
        String trimmedSku = request.getSku().trim();
        Optional<Product> existingWithSku = productRepository.findBySku(trimmedSku);
        if (existingWithSku.isPresent() && !existingWithSku.get().getId().equals(id)) {
            throw new DuplicateResourceException("A product with SKU '" + trimmedSku + "' already exists.");
        }

        // Check if Barcode changed and is already taken
        String trimmedBarcode = cleanString(request.getBarcode());
        if (trimmedBarcode != null) {
            Optional<Product> existingWithBarcode = productRepository.findByBarcode(trimmedBarcode);
            if (existingWithBarcode.isPresent() && !existingWithBarcode.get().getId().equals(id)) {
                throw new DuplicateResourceException("A product with barcode '" + trimmedBarcode + "' already exists.");
            }
        }

        product.setName(request.getName().trim());
        product.setSku(trimmedSku);
        product.setBarcode(trimmedBarcode);
        product.setDescription(cleanString(request.getDescription()));
        product.setPurchasePrice(request.getPurchasePrice());
        product.setSellingPrice(request.getSellingPrice());
        product.setTaxRate(request.getTaxRate());
        if (request.getUnit() != null) {
            product.setUnit(request.getUnit().trim());
        }
        if (request.getMinimumInventoryThreshold() != null) {
            product.setMinimumInventoryThreshold(request.getMinimumInventoryThreshold());
        }
        if (request.getActive() != null) {
            product.setActive(request.getActive());
        }

        // Update Category
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found with ID: " + request.getCategoryId()));
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }

        // Update Supplier
        if (request.getSupplierId() != null) {
            Supplier supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with ID: " + request.getSupplierId()));
            product.setSupplier(supplier);
        } else {
            product.setSupplier(null);
        }

        Product saved = productRepository.save(product);
        return ProductResponseDto.fromEntity(saved);
    }

    @Override
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with ID: " + id));
        productRepository.delete(product);
    }

    private void validateBusinessRules(
            String name,
            String sku,
            BigDecimal purchasePrice,
            BigDecimal sellingPrice,
            BigDecimal taxRate,
            Integer minimumThreshold) {
        if (name == null || name.trim().isEmpty()) {
            throw new InvalidRequestException("Product name is required.");
        }
        if (sku == null || sku.trim().isEmpty()) {
            throw new InvalidRequestException("SKU is required.");
        }
        if (purchasePrice == null || purchasePrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("Purchase price cannot be negative.");
        }
        if (sellingPrice == null || sellingPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("Selling price cannot be negative.");
        }
        if (taxRate == null || taxRate.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidRequestException("Tax rate cannot be negative.");
        }
        if (minimumThreshold != null && minimumThreshold < 0) {
            throw new InvalidRequestException("Minimum inventory threshold cannot be negative.");
        }
    }

    private String cleanString(String val) {
        if (val == null) return null;
        String trimmed = val.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
