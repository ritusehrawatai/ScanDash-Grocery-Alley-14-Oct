package com.grocerypos.auth.entity;

/**
 * User roles within the FreshCart POS application.
 * OWNER: Full system control, reports, inventory, users, thresholds.
 * ADMIN: System administrator, store management, reports, users.
 * CASHIER: Front-line checkout, product search, voice search, receipts.
 */
public enum Role {
    ROLE_OWNER,
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_CASHIER
}
