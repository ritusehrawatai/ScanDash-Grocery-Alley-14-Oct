package com.grocerypos.payment.entity;

/**
 * Standard payment lifecycle statuses for POS transactions.
 */
public enum PaymentStatus {
    PENDING,
    SUCCEEDED,
    FAILED,
    CANCELED
}
