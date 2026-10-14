package com.grocerypos.invoice.service;

import com.grocerypos.invoice.dto.InvoiceOcrResultDto;
import com.grocerypos.invoice.entity.PurchaseInvoice;

public interface InvoiceOcrService {

    /**
     * Executes OCR processing on an existing uploaded invoice record.
     * Uses free/open-source Tesseract OCR.
     * Extracts: Supplier, Invoice number, Invoice date, Product name, SKU, Barcode, Quantity, Unit price, Total.
     * Stores extracted data.
     * Low-confidence values (<75% or arithmetic discrepancies) are flagged for manual review.
     *
     * STRICT CONSTRAINTS:
     * - Do NOT update inventory.
     * - Do NOT automatically confirm the invoice.
     *
     * @param invoiceId ID of the uploaded PurchaseInvoice
     * @return Extracted OCR result DTO
     */
    InvoiceOcrResultDto processInvoiceOcr(Long invoiceId);

    /**
     * Executes OCR processing directly on an invoice entity.
     *
     * @param invoice PurchaseInvoice entity
     * @return Extracted OCR result DTO
     */
    InvoiceOcrResultDto processInvoice(PurchaseInvoice invoice);
}
