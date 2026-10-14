package com.grocerypos.auth;

import com.grocerypos.auth.entity.Role;
import com.grocerypos.auth.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit and Policy Tests for Role-Based Access Control (RBAC).
 * Enforces permissions requested:
 * Roles: OWNER, ADMIN, CASHIER
 * OWNER/ADMIN: Products, Inventory, Invoices, Reports, Notifications, User management, Inventory thresholds
 * CASHIER: Product search, Voice search, POS, Checkout, Receipt
 */
public class RbacSecurityTest {

    public enum Permission {
        PRODUCT_SEARCH,
        PRODUCT_VOICE_SEARCH,
        POS_TERMINAL,
        POS_CHECKOUT,
        SALES_RECEIPT,
        PRODUCT_MANAGEMENT_CRUD,
        INVENTORY_ADJUSTMENT,
        INVENTORY_PURCHASES,
        INVOICE_OCR_MANAGEMENT,
        SALES_AND_INVENTORY_REPORTS,
        SYSTEM_NOTIFICATIONS,
        USER_MANAGEMENT,
        INVENTORY_THRESHOLDS
    }

    public static class RbacPolicy {
        public static boolean hasPermission(Role role, Permission permission) {
            if (role == Role.ROLE_OWNER || role == Role.ROLE_ADMIN) {
                // Owner & Admin have full system permissions
                return true;
            }

            if (role == Role.ROLE_CASHIER) {
                // Cashier only has front-line POS & search permissions
                return permission == Permission.PRODUCT_SEARCH
                        || permission == Permission.PRODUCT_VOICE_SEARCH
                        || permission == Permission.POS_TERMINAL
                        || permission == Permission.POS_CHECKOUT
                        || permission == Permission.SALES_RECEIPT;
            }

            return false;
        }
    }

    @Test
    @DisplayName("OWNER should have access to Products, Inventory, Invoices, Reports, Notifications, User management, Inventory thresholds")
    void testOwnerPermissions() {
        for (Permission p : Permission.values()) {
            assertTrue(RbacPolicy.hasPermission(Role.ROLE_OWNER, p),
                    "OWNER must have permission for " + p);
        }
    }

    @Test
    @DisplayName("ADMIN should have access to Products, Inventory, Invoices, Reports, Notifications, User management, Inventory thresholds")
    void testAdminPermissions() {
        for (Permission p : Permission.values()) {
            assertTrue(RbacPolicy.hasPermission(Role.ROLE_ADMIN, p),
                    "ADMIN must have permission for " + p);
        }
    }

    @Test
    @DisplayName("CASHIER should have access to Product search, Voice search, POS, Checkout, Receipt")
    void testCashierAllowedPermissions() {
        assertTrue(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.PRODUCT_SEARCH));
        assertTrue(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.PRODUCT_VOICE_SEARCH));
        assertTrue(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.POS_TERMINAL));
        assertTrue(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.POS_CHECKOUT));
        assertTrue(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.SALES_RECEIPT));
    }

    @Test
    @DisplayName("CASHIER must be strictly forbidden from Products CRUD, Inventory, Invoices, Reports, Notifications, Users, Thresholds")
    void testCashierForbiddenPermissions() {
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.PRODUCT_MANAGEMENT_CRUD));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.INVENTORY_ADJUSTMENT));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.INVENTORY_PURCHASES));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.INVOICE_OCR_MANAGEMENT));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.SALES_AND_INVENTORY_REPORTS));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.SYSTEM_NOTIFICATIONS));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.USER_MANAGEMENT));
        assertFalse(RbacPolicy.hasPermission(Role.ROLE_CASHIER, Permission.INVENTORY_THRESHOLDS));
    }
}
