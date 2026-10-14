package com.grocerypos.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grocerypos.audit.dto.AuditLogDto;
import com.grocerypos.audit.entity.AuditLog;
import com.grocerypos.audit.repository.AuditLogRepository;
import com.grocerypos.audit.service.AuditLogServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private AuditLogServiceImpl auditLogService;

    @Test
    @DisplayName("Should successfully record audit log with user, action, entity, timestamp, old and new values")
    void testLogOperationSuccess() {
        AuditLog saved = new AuditLog(1L, "owner", "ROLE_OWNER", "PRICE_CHANGE", "Product", "1", "Price updated from $1.29 to $1.49", "{\"sellingPrice\":1.29}", "{\"sellingPrice\":1.49}");
        saved.setId(101L);

        when(auditLogRepository.save(any(AuditLog.class))).thenReturn(saved);

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "PRICE_CHANGE", "Product", "1",
                "Price updated from $1.29 to $1.49",
                Map.of("sellingPrice", 1.29),
                Map.of("sellingPrice", 1.49)
        );

        assertNotNull(result);
        assertEquals(101L, result.getId());
        assertEquals("owner", result.getUsername());
        assertEquals("PRICE_CHANGE", result.getAction());
        assertEquals("Product", result.getEntity());
        assertEquals("1", result.getEntityId());
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    @DisplayName("Audit Track: Product changes (attributes, name, category, SKU)")
    void testLogProductChange() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(201L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("name", "Gala Apple", "sku", "SKU-APP-01", "unit", "LB");
        Map<String, Object> newVal = Map.of("name", "Organic Gala Apple", "sku", "SKU-APP-01", "unit", "BAG");

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "PRODUCT_UPDATED", "Product", "10",
                "Updated product name and unit",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("PRODUCT_UPDATED", result.getAction());
        assertEquals("Product", result.getEntity());
        assertEquals("10", result.getEntityId());
        assertTrue(result.getOldValue().contains("Gala Apple"));
        assertTrue(result.getNewValue().contains("Organic Gala Apple"));
    }

    @Test
    @DisplayName("Audit Track: Inventory adjustments (cycle counts, additions, and removals)")
    void testLogInventoryAdjustment() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(202L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("quantity", 50, "stockStatus", "NORMAL");
        Map<String, Object> newVal = Map.of("quantity", 30, "stockStatus", "LOW STOCK", "reason", "Physical count adjustment");

        AuditLogDto result = auditLogService.logOperation(
                2L, "manager", "ROLE_ADMIN", "INVENTORY_ADJUSTED", "Inventory", "15",
                "Cycle count adjustment: changed from 50 to 30",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("INVENTORY_ADJUSTED", result.getAction());
        assertEquals("Inventory", result.getEntity());
        assertTrue(result.getOldValue().contains("50"));
        assertTrue(result.getNewValue().contains("30"));
    }

    @Test
    @DisplayName("Audit Track: Invoice confirmation (OCR invoice matching and stock intake)")
    void testLogInvoiceConfirmation() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(203L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("status", "UPLOADED", "itemsMatched", 0);
        Map<String, Object> newVal = Map.of("status", "CONFIRMED", "itemsMatched", 5, "totalAmount", 145.50);

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "INVOICE_CONFIRMED", "PurchaseInvoice", "1001",
                "Purchase invoice #INV-1001 confirmed by Store Owner",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("INVOICE_CONFIRMED", result.getAction());
        assertEquals("PurchaseInvoice", result.getEntity());
        assertEquals("1001", result.getEntityId());
        assertTrue(result.getNewValue().contains("CONFIRMED"));
    }

    @Test
    @DisplayName("Audit Track: Price changes (cost and selling prices)")
    void testLogPriceChange() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(204L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("sellingPrice", 2.99, "purchasePrice", 1.20);
        Map<String, Object> newVal = Map.of("sellingPrice", 3.49, "purchasePrice", 1.45);

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "PRICE_CHANGED", "Product", "5",
                "Updated pricing for Product #5",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("PRICE_CHANGED", result.getAction());
        assertTrue(result.getOldValue().contains("2.99"));
        assertTrue(result.getNewValue().contains("3.49"));
    }

    @Test
    @DisplayName("Audit Track: Threshold changes (minimum stock alert triggers)")
    void testLogThresholdChange() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(205L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("minimumInventoryThreshold", 10);
        Map<String, Object> newVal = Map.of("minimumInventoryThreshold", 15);

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "THRESHOLD_CHANGED", "Product", "5",
                "Increased minimum inventory alert threshold to 15",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("THRESHOLD_CHANGED", result.getAction());
        assertTrue(result.getOldValue().contains("10"));
        assertTrue(result.getNewValue().contains("15"));
    }

    @Test
    @DisplayName("Audit Track: Sale cancellation and inventory return")
    void testLogSaleCancellation() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(206L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("status", "COMPLETED", "receiptNumber", "REC-884-1234");
        Map<String, Object> newVal = Map.of("status", "CANCELLED", "receiptNumber", "REC-884-1234", "reason", "Customer return");

        AuditLogDto result = auditLogService.logOperation(
                2L, "manager", "ROLE_ADMIN", "SALE_CANCELLED", "Sale", "884",
                "Cancelled sale REC-884-1234 and restored item stocks",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("SALE_CANCELLED", result.getAction());
        assertEquals("Sale", result.getEntity());
        assertEquals("884", result.getEntityId());
        assertTrue(result.getNewValue().contains("CANCELLED"));
    }

    @Test
    @DisplayName("Audit Track: User and role changes (promotions, deactivations, permission updates)")
    void testLogUserRoleChange() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(207L);
            return arg;
        });

        Map<String, Object> oldVal = Map.of("username", "cashier1", "role", "ROLE_CASHIER", "active", true);
        Map<String, Object> newVal = Map.of("username", "cashier1", "role", "ROLE_ADMIN", "active", true);

        AuditLogDto result = auditLogService.logOperation(
                1L, "owner", "ROLE_OWNER", "USER_UPDATED", "User", "7",
                "Promoted user cashier1 from CASHIER to ADMIN role",
                oldVal, newVal
        );

        assertNotNull(result);
        assertEquals("USER_UPDATED", result.getAction());
        assertEquals("User", result.getEntity());
        assertEquals("7", result.getEntityId());
        assertTrue(result.getOldValue().contains("ROLE_CASHIER"));
        assertTrue(result.getNewValue().contains("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("Should never log sensitive information like passwords, salts, and secret keys")
    void testSensitiveInfoSanitization() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(invocation -> {
            AuditLog arg = invocation.getArgument(0);
            arg.setId(102L);
            return arg;
        });

        Map<String, Object> sensitiveData = new HashMap<>();
        sensitiveData.put("username", "john_doe");
        sensitiveData.put("password", "SecretPassword@123");
        sensitiveData.put("salt", "cryptoSalt123456");
        sensitiveData.put("passwordHash", "$2a$12$hashedPasswordBytesHere");
        sensitiveData.put("role", "ROLE_CASHIER");

        AuditLogDto result = auditLogService.logOperation(
                1L, "admin", "ROLE_ADMIN", "USER_CREATED", "User", "5",
                "Created new cashier user account",
                null,
                sensitiveData
        );

        assertNotNull(result);
        assertNotNull(result.getNewValue());
        assertFalse(result.getNewValue().contains("SecretPassword@123"), "Password must never appear in audit log");
        assertFalse(result.getNewValue().contains("cryptoSalt123456"), "Salt must never appear in audit log");
        assertFalse(result.getNewValue().contains("$2a$12$hashedPasswordBytesHere"), "Password hash must never appear in audit log");
        assertTrue(result.getNewValue().contains("john_doe"));
        assertTrue(result.getNewValue().contains("ROLE_CASHIER"));
    }
}
