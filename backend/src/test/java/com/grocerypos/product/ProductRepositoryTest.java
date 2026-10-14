package com.grocerypos.product;

import com.grocerypos.product.entity.Category;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.entity.Supplier;
import com.grocerypos.product.repository.CategoryRepository;
import com.grocerypos.product.repository.ProductRepository;
import com.grocerypos.product.repository.SupplierRepository;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@ActiveProfiles("test")
public class ProductRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    private Category testCategory;
    private Supplier testSupplier;

    @BeforeEach
    void setUp() {
        testCategory = new Category("Produce", "Fresh fruits and vegetables");
        testCategory = categoryRepository.save(testCategory);

        testSupplier = new Supplier("Green Valley Farms", "John Farmer", "orders@greenvalley.com", "+1-555-0199");
        testSupplier = supplierRepository.save(testSupplier);
    }

    @Test
    @DisplayName("Should successfully persist product and auto-generate ID")
    void testSaveProductSuccess() {
        Product product = new Product("Organic Bananas", "SKU-BAN-001",
                new BigDecimal("0.80"), new BigDecimal("1.49"), new BigDecimal("0.00"), "KG");
        product.setBarcode("012345678901");
        product.setDescription("Fair-trade organic Cavendish bananas");
        product.setCategory(testCategory);
        product.setSupplier(testSupplier);
        product.setMinimumInventoryThreshold(25);

        Product saved = productRepository.save(product);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getName()).isEqualTo("Organic Bananas");
        assertThat(saved.getSku()).isEqualTo("SKU-BAN-001");
        assertThat(saved.getBarcode()).isEqualTo("012345678901");
        assertThat(saved.getPurchasePrice()).isEqualByComparingTo("0.80");
        assertThat(saved.getSellingPrice()).isEqualByComparingTo("1.49");
        assertThat(saved.getTaxRate()).isEqualByComparingTo("0.00");
        assertThat(saved.getUnit()).isEqualTo("KG");
        assertThat(saved.getMinimumInventoryThreshold()).isEqualTo(25);
        assertThat(saved.getActive()).isTrue();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Should find product by SKU and Barcode")
    void testFindBySkuAndBarcode() {
        Product product = new Product("Whole Milk 1 Gallon", "SKU-MLK-001",
                new BigDecimal("2.50"), new BigDecimal("3.89"), new BigDecimal("0.00"), "GALLON");
        product.setBarcode("885544332211");
        productRepository.save(product);

        Optional<Product> bySku = productRepository.findBySku("SKU-MLK-001");
        assertThat(bySku).isPresent();
        assertThat(bySku.get().getName()).isEqualTo("Whole Milk 1 Gallon");

        Optional<Product> byBarcode = productRepository.findByBarcode("885544332211");
        assertThat(byBarcode).isPresent();
        assertThat(byBarcode.get().getSku()).isEqualTo("SKU-MLK-001");
    }

    @Test
    @DisplayName("Should enforce unique SKU constraint")
    void testEnforceUniqueSku() {
        Product p1 = new Product("Item One", "SKU-DUP-001",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("5.00"), "PCS");
        productRepository.saveAndFlush(p1);

        Product p2 = new Product("Item Two", "SKU-DUP-001",
                new BigDecimal("1.50"), new BigDecimal("2.50"), new BigDecimal("5.00"), "PCS");

        assertThatThrownBy(() -> productRepository.saveAndFlush(p2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Should enforce unique Barcode constraint when provided")
    void testEnforceUniqueBarcode() {
        Product p1 = new Product("Item Alpha", "SKU-ALP-001",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("5.00"), "PCS");
        p1.setBarcode("BARCODE-UNIQUE-123");
        productRepository.saveAndFlush(p1);

        Product p2 = new Product("Item Beta", "SKU-BET-002",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("5.00"), "PCS");
        p2.setBarcode("BARCODE-UNIQUE-123");

        assertThatThrownBy(() -> productRepository.saveAndFlush(p2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Should reject blank product name")
    void testRejectBlankName() {
        Product product = new Product("", "SKU-NONAME",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("0.00"), "PCS");

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Should reject negative selling price")
    void testRejectNegativeSellingPrice() {
        Product product = new Product("Negative Price Item", "SKU-NEG-SELL",
                new BigDecimal("1.00"), new BigDecimal("-0.50"), new BigDecimal("0.00"), "PCS");

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Should reject negative purchase price")
    void testRejectNegativePurchasePrice() {
        Product product = new Product("Negative Cost Item", "SKU-NEG-COST",
                new BigDecimal("-1.00"), new BigDecimal("2.00"), new BigDecimal("0.00"), "PCS");

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Should reject negative tax rate")
    void testRejectNegativeTaxRate() {
        Product product = new Product("Negative Tax Item", "SKU-NEG-TAX",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("-1.00"), "PCS");

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Should reject negative minimum inventory threshold")
    void testRejectNegativeMinimumThreshold() {
        Product product = new Product("Negative Threshold Item", "SKU-NEG-THRESH",
                new BigDecimal("1.00"), new BigDecimal("2.00"), new BigDecimal("0.00"), "PCS");
        product.setMinimumInventoryThreshold(-5);

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    @DisplayName("Should query products by category and active status")
    void testQueryByCategory() {
        Product p1 = new Product("Apples", "SKU-APL-001", new BigDecimal("1.00"), new BigDecimal("2.00"), BigDecimal.ZERO, "KG");
        p1.setCategory(testCategory);
        productRepository.save(p1);

        Product p2 = new Product("Oranges", "SKU-ORG-002", new BigDecimal("1.20"), new BigDecimal("2.20"), BigDecimal.ZERO, "KG");
        p2.setCategory(testCategory);
        productRepository.save(p2);

        List<Product> products = productRepository.findByCategoryIdAndActiveTrue(testCategory.getId());
        assertThat(products).hasSize(2);
    }
}
