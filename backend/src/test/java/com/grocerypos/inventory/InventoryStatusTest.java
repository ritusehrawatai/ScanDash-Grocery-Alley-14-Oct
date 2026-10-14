package com.grocerypos.inventory;

import com.grocerypos.inventory.entity.InventoryStatus;
import com.grocerypos.inventory.service.InventoryStatusCalculator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

public class InventoryStatusTest {

    private final InventoryStatusCalculator calculator = new InventoryStatusCalculator();

    @Test
    @DisplayName("Rule 1: If current quantity == 0, status is OUT OF STOCK")
    void testQuantityZeroReturnsOutOfStock() {
        InventoryStatus status = InventoryStatus.calculate(BigDecimal.ZERO, 10);
        assertThat(status).isEqualTo(InventoryStatus.OUT_OF_STOCK);
        assertThat(status.getDisplayName()).isEqualTo("OUT OF STOCK");
    }

    @Test
    @DisplayName("Rule 1: If current quantity is null or negative, status is OUT OF STOCK")
    void testNegativeOrNullReturnsOutOfStock() {
        assertThat(InventoryStatus.calculate(null, 10)).isEqualTo(InventoryStatus.OUT_OF_STOCK);
        assertThat(InventoryStatus.calculate(new BigDecimal("-0.01"), 10)).isEqualTo(InventoryStatus.OUT_OF_STOCK);
        assertThat(InventoryStatus.calculate(new BigDecimal("-5.0"), 10)).isEqualTo(InventoryStatus.OUT_OF_STOCK);
    }

    @Test
    @DisplayName("Rule 2: If current quantity > 0 AND current quantity <= minimum threshold, status is LOW STOCK")
    void testQuantityPositiveAndLessOrEqualToThresholdReturnsLowStock() {
        // Less than threshold
        InventoryStatus status1 = InventoryStatus.calculate(new BigDecimal("5.0"), 10);
        assertThat(status1).isEqualTo(InventoryStatus.LOW_STOCK);
        assertThat(status1.getDisplayName()).isEqualTo("LOW STOCK");

        // Exactly equal to threshold
        InventoryStatus status2 = InventoryStatus.calculate(new BigDecimal("10.0"), 10);
        assertThat(status2).isEqualTo(InventoryStatus.LOW_STOCK);
        assertThat(status2.getDisplayName()).isEqualTo("LOW STOCK");

        // Small positive balance
        InventoryStatus status3 = InventoryStatus.calculate(new BigDecimal("0.001"), 10);
        assertThat(status3).isEqualTo(InventoryStatus.LOW_STOCK);
    }

    @Test
    @DisplayName("Rule 3: Otherwise (current quantity > threshold), status is IN STOCK")
    void testQuantityGreaterThanThresholdReturnsInStock() {
        // Just above threshold
        InventoryStatus status1 = InventoryStatus.calculate(new BigDecimal("10.001"), 10);
        assertThat(status1).isEqualTo(InventoryStatus.IN_STOCK);
        assertThat(status1.getDisplayName()).isEqualTo("IN STOCK");

        // Well above threshold
        InventoryStatus status2 = InventoryStatus.calculate(new BigDecimal("100.0"), 10);
        assertThat(status2).isEqualTo(InventoryStatus.IN_STOCK);
    }

    @Test
    @DisplayName("Threshold is 0: positive quantity is IN STOCK, 0 is OUT OF STOCK")
    void testThresholdZeroBehavior() {
        assertThat(InventoryStatus.calculate(new BigDecimal("1.0"), 0)).isEqualTo(InventoryStatus.IN_STOCK);
        assertThat(InventoryStatus.calculate(BigDecimal.ZERO, 0)).isEqualTo(InventoryStatus.OUT_OF_STOCK);
    }

    @ParameterizedTest(name = "quantity={0}, threshold={1} -> expected={2}")
    @CsvSource({
            "0.0, 15, OUT OF STOCK",
            "0, 5, OUT OF STOCK",
            "0.5, 10, LOW STOCK",
            "9.999, 10, LOW STOCK",
            "10.0, 10, LOW STOCK",
            "10.001, 10, IN STOCK",
            "25.0, 10, IN STOCK",
            "1.0, 0, IN STOCK",
            "0.0, 0, OUT OF STOCK"
    })
    @DisplayName("Parameterized verification of inventory status rules")
    void testParameterizedInventoryStatus(String quantityStr, int threshold, String expectedStatus) {
        BigDecimal qty = new BigDecimal(quantityStr);
        InventoryStatus status = calculator.determineStatus(qty, threshold);
        assertThat(status.getDisplayName()).isEqualTo(expectedStatus);
        assertThat(calculator.getStatusDisplayName(qty, threshold)).isEqualTo(expectedStatus);
    }
}
