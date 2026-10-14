package com.grocerypos.invoice.exception;

public class InvalidInvoiceFileException extends RuntimeException {
    public InvalidInvoiceFileException(String message) {
        super(message);
    }

    public InvalidInvoiceFileException(String message, Throwable cause) {
        super(message, cause);
    }
}
