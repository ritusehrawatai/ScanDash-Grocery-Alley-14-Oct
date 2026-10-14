package com.grocerypos.product;

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
import com.grocerypos.product.service.ProductServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private SupplierRepository supplierRepository;

    @InjectMocks
    private ProductServiceImpl productService;

    private Category sampleCategory;
    private Supplier sampleSupplier;

    @BeforeEach
    void setUp() {
        sampleCategory = new Category("Bakery", "Fresh baked goods");
        sampleCategory.setId(10L);

        sampleSupplier = new Supplier("Apex Bakes", "Alice", "alice@apexbakes.com", "1234567890");
        sampleSupplier.setId(20L);
    }

    @Test
    @DisplayName("createProduct: Should save and return ProductResponseDto successfully")
    void testCreateProductSuccess() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Sourdough Bread", "SKU-BRD-001",
                new BigDecimal("2.00"), new BigDecimal("4.50"), new BigDecimal("0.00"), "LOAF");
        req.setBarcode("998877665544");
        req.setDescription("Artisan sourdough loaf");
        req.setCategoryId(10L);
        req.setSupplierId(20L);
        req.setMinimumInventoryThreshold(5);

        when(productRepository.existsBySku("SKU-BRD-001")).thenReturn(false);
        when(productRepository.existsByBarcode("998877665544")).thenReturn(false);
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(sampleCategory));
        when(supplierRepository.findById(20L)).thenReturn(Optional.of(sampleSupplier));

        Product savedEntity = new Product();
        savedEntity.setId(1L);
        savedEntity.setName("Sourdough Bread");
        savedEntity.setSku("SKU-BRD-001");
        savedEntity.setBarcode("998877665544");
        savedEntity.setPurchasePrice(new BigDecimal("2.00"));
        savedEntity.setSellingPrice(new BigDecimal("4.50"));
        savedEntity.setTaxRate(new BigDecimal("0.00"));
        savedEntity.setUnit("LOAF");
        savedEntity.setCategory(sampleCategory);
        savedEntity.setSupplier(sampleSupplier);
        savedEntity.setMinimumInventoryThreshold(5);
        savedEntity.setActive(true);

        when(productRepository.save(any(Product.class))).thenReturn(savedEntity);

        ProductResponseDto result = productService.createProduct(req);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("Sourdough Bread");
        assertThat(result.getSku()).isEqualTo("SKU-BRD-001");
        assertThat(result.getCategoryName()).isEqualTo("Bakery");
        assertThat(result.getSupplierName()).isEqualTo("Apex Bakes");
        verify(productRepository).save(any(Product.class));
    }

    @Test
    @DisplayName("createProduct: Should throw DuplicateResourceException on duplicate SKU")
    void testCreateProductDuplicateSku() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Whole Wheat Bread", "SKU-DUP-01",
                new BigDecimal("1.50"), new BigDecimal("3.00"), BigDecimal.ZERO, "LOAF");

        when(productRepository.existsBySku("SKU-DUP-01")).thenReturn(true);

        assertThatThrownBy(() -> productService.createProduct(req))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("SKU 'SKU-DUP-01' already exists");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("createProduct: Should throw DuplicateResourceException on duplicate Barcode")
    void testCreateProductDuplicateBarcode() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Rye Bread", "SKU-RYE-01",
                new BigDecimal("1.50"), new BigDecimal("3.00"), BigDecimal.ZERO, "LOAF");
        req.setBarcode("BAR-DUP-999");

        when(productRepository.existsBySku("SKU-RYE-01")).thenReturn(false);
        when(productRepository.existsByBarcode("BAR-DUP-999")).thenReturn(true);

        assertThatThrownBy(() -> productService.createProduct(req))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("barcode 'BAR-DUP-999' already exists");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("createProduct: Should throw InvalidRequestException on negative selling price")
    void testCreateProductNegativeSellingPrice() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Invalid Bread", "SKU-INV-01",
                new BigDecimal("1.50"), new BigDecimal("-3.00"), BigDecimal.ZERO, "LOAF");

        assertThatThrownBy(() -> productService.createProduct(req))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Selling price cannot be negative");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("createProduct: Should throw InvalidRequestException on negative tax rate")
    void testCreateProductNegativeTaxRate() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Invalid Tax", "SKU-INV-02",
                new BigDecimal("1.50"), new BigDecimal("3.00"), new BigDecimal("-1.00"), "LOAF");

        assertThatThrownBy(() -> productService.createProduct(req))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Tax rate cannot be negative");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("createProduct: Should throw InvalidRequestException on negative threshold")
    void testCreateProductNegativeThreshold() {
        CreateProductRequestDto req = new CreateProductRequestDto(
                "Invalid Threshold", "SKU-INV-03",
                new BigDecimal("1.50"), new BigDecimal("3.00"), BigDecimal.ZERO, "LOAF");
        req.setMinimumInventoryThreshold(-10);

        assertThatThrownBy(() -> productService.createProduct(req))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Minimum inventory threshold cannot be negative");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("getProductById: Should return ProductResponseDto when product exists")
    void testGetProductByIdSuccess() {
        Product product = new Product("Bagel", "SKU-BGL-01",
                new BigDecimal("0.50"), new BigDecimal("1.25"), BigDecimal.ZERO, "PCS");
        product.setId(5L);

        when(productRepository.findById(5L)).thenReturn(Optional.of(product));

        ProductResponseDto result = productService.getProductById(5L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(5L);
        assertThat(result.getName()).isEqualTo("Bagel");
    }

    @Test
    @DisplayName("getProductById: Should throw ResourceNotFoundException when product not found")
    void testGetProductByIdNotFound() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getProductById(999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Product not found with ID: 999");
    }

    @Test
    @DisplayName("updateProduct: Should update existing product and return DTO")
    void testUpdateProductSuccess() {
        Product existing = new Product("Old Name", "SKU-OLD-01",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        existing.setId(7L);

        UpdateProductRequestDto updateDto = new UpdateProductRequestDto();
        updateDto.setName("New Croissant");
        updateDto.setSku("SKU-CR-01");
        updateDto.setPurchasePrice(new BigDecimal("1.20"));
        updateDto.setSellingPrice(new BigDecimal("2.50"));
        updateDto.setTaxRate(BigDecimal.ZERO);
        updateDto.setUnit("PCS");
        updateDto.setMinimumInventoryThreshold(10);
        updateDto.setActive(true);

        when(productRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(productRepository.findBySku("SKU-CR-01")).thenReturn(Optional.empty());
        when(productRepository.save(any(Product.class))).thenReturn(existing);

        ProductResponseDto updated = productService.updateProduct(7L, updateDto);

        assertThat(updated).isNotNull();
        assertThat(existing.getName()).isEqualTo("New Croissant");
        assertThat(existing.getSku()).isEqualTo("SKU-CR-01");
        verify(productRepository).save(existing);
    }

    @Test
    @DisplayName("updateProduct: Should throw DuplicateResourceException if SKU taken by another product")
    void testUpdateProductDuplicateSkuOnAnotherProduct() {
        Product currentProduct = new Product("Current", "SKU-CURR",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        currentProduct.setId(7L);

        Product anotherProduct = new Product("Other", "SKU-OTHER",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        anotherProduct.setId(8L);

        UpdateProductRequestDto updateDto = new UpdateProductRequestDto();
        updateDto.setName("Updated");
        updateDto.setSku("SKU-OTHER");
        updateDto.setPurchasePrice(new BigDecimal("1.00"));
        updateDto.setSellingPrice(new BigDecimal("2.00"));
        updateDto.setTaxRate(BigDecimal.ZERO);

        when(productRepository.findById(7L)).thenReturn(Optional.of(currentProduct));
        when(productRepository.findBySku("SKU-OTHER")).thenReturn(Optional.of(anotherProduct));

        assertThatThrownBy(() -> productService.updateProduct(7L, updateDto))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("SKU 'SKU-OTHER' already exists");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateProduct: Should throw DuplicateResourceException if Barcode taken by another product")
    void testUpdateProductDuplicateBarcodeOnAnotherProduct() {
        Product currentProduct = new Product("Current", "SKU-CURR",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        currentProduct.setId(7L);

        Product anotherProduct = new Product("Other", "SKU-OTHER",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        anotherProduct.setId(8L);
        anotherProduct.setBarcode("BAR-DUP-888");

        UpdateProductRequestDto updateDto = new UpdateProductRequestDto();
        updateDto.setName("Updated");
        updateDto.setSku("SKU-CURR");
        updateDto.setBarcode("BAR-DUP-888");
        updateDto.setPurchasePrice(new BigDecimal("1.00"));
        updateDto.setSellingPrice(new BigDecimal("2.00"));
        updateDto.setTaxRate(BigDecimal.ZERO);

        when(productRepository.findById(7L)).thenReturn(Optional.of(currentProduct));
        when(productRepository.findBySku("SKU-CURR")).thenReturn(Optional.of(currentProduct));
        when(productRepository.findByBarcode("BAR-DUP-888")).thenReturn(Optional.of(anotherProduct));

        assertThatThrownBy(() -> productService.updateProduct(7L, updateDto))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("barcode 'BAR-DUP-888' already exists");

        verify(productRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteProduct: Should delete product when found")
    void testDeleteProductSuccess() {
        Product product = new Product("To Delete", "SKU-DEL",
                new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "PCS");
        product.setId(3L);

        when(productRepository.findById(3L)).thenReturn(Optional.of(product));
        doNothing().when(productRepository).delete(product);

        productService.deleteProduct(3L);

        verify(productRepository).delete(product);
    }

    @Test
    @DisplayName("deleteProduct: Should throw ResourceNotFoundException when product not found")
    void testDeleteProductNotFound() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.deleteProduct(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Product not found with ID: 99");

        verify(productRepository, never()).delete(any());
    }

    @Test
    @DisplayName("searchProducts: Should return partial matching products (e.g. 'milk' finds 'Whole Milk', 'Organic Milk')")
    void testSearchProductsPartialMatchSuccess() {
        Product p1 = new Product("Whole Milk 1 Gallon", "SKU-MLK-01", new BigDecimal("2.50"), new BigDecimal("3.89"), BigDecimal.ZERO, "GALLON");
        p1.setId(101L);
        Product p2 = new Product("Organic Milk Half Gallon", "SKU-MLK-02", new BigDecimal("3.00"), new BigDecimal("4.49"), BigDecimal.ZERO, "GALLON");
        p2.setId(102L);
        Product p3 = new Product("Chocolate Milk Quart", "SKU-MLK-03", new BigDecimal("1.80"), new BigDecimal("2.99"), BigDecimal.ZERO, "QUART");
        p3.setId(103L);

        when(productRepository.searchProducts("milk", false)).thenReturn(List.of(p1, p2, p3));

        List<ProductResponseDto> results = productService.searchProducts("milk", false);

        assertThat(results).hasSize(3);
        assertThat(results).extracting(ProductResponseDto::getName)
                .containsExactly("Whole Milk 1 Gallon", "Organic Milk Half Gallon", "Chocolate Milk Quart");
        verify(productRepository).searchProducts("milk", false);
    }

    @Test
    @DisplayName("searchProducts: Should return all products when query is empty or blank")
    void testSearchProductsEmptyQuery() {
        Product p = new Product("Bananas", "SKU-BAN-01", new BigDecimal("0.50"), new BigDecimal("0.99"), BigDecimal.ZERO, "KG");
        p.setId(201L);

        when(productRepository.findAll()).thenReturn(List.of(p));

        List<ProductResponseDto> results = productService.searchProducts("   ", false);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getName()).isEqualTo("Bananas");
        verify(productRepository).findAll();
    }
}
