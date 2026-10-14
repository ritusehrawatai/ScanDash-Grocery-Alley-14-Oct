package com.grocerypos.invoice.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.invoice.dto.InvoiceOcrResultDto;
import com.grocerypos.invoice.dto.InvoiceUploadResponseDto;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import com.grocerypos.invoice.service.InvoiceOcrService;
import com.grocerypos.invoice.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/invoices")
@Tag(name = "Invoice Management API", description = "Endpoints for uploading, securing, OCR processing, and managing purchase invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final InvoiceOcrService invoiceOcrService;

    @Autowired
    public InvoiceController(InvoiceService invoiceService, InvoiceOcrService invoiceOcrService) {
        this.invoiceService = invoiceService;
        this.invoiceOcrService = invoiceOcrService;
    }

    /**
     * Upload a new purchase invoice.
     * Validates file type (JPG, JPEG, PNG, PDF), file size, and integrity.
     * Creates PurchaseInvoice record with initial status = UPLOADED.
     * Does NOT run OCR yet. Does NOT modify inventory. Does NOT create products.
     * POST /api/invoices/upload
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload Purchase Invoice", description = "Validates file type (JPG, JPEG, PNG, PDF), file size, and file integrity; stores securely; creates PurchaseInvoice record with status UPLOADED")
    public ResponseEntity<ApiResponse<InvoiceUploadResponseDto>> uploadInvoice(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "uploadedBy", required = false, defaultValue = "Admin / Owner") String uploadedBy) {

        PurchaseInvoice invoice = invoiceService.uploadInvoice(file, notes, uploadedBy);
        InvoiceUploadResponseDto dto = InvoiceUploadResponseDto.fromEntity(invoice);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(dto, "Invoice uploaded and secured successfully. Status: UPLOADED"));
    }

    /**
     * Get all purchase invoices.
     * GET /api/invoices
     */
    @GetMapping
    @Operation(summary = "Get All Invoices", description = "Lists all purchase invoices sorted by newest first")
    public ResponseEntity<ApiResponse<List<InvoiceUploadResponseDto>>> getAllInvoices() {
        List<PurchaseInvoice> invoices = invoiceService.getAllInvoices();
        List<InvoiceUploadResponseDto> dtoList = invoices.stream()
                .map(InvoiceUploadResponseDto::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(dtoList, "Invoices retrieved successfully"));
    }

    /**
     * Get purchase invoice by ID.
     * GET /api/invoices/{id}
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get Invoice by ID", description = "Retrieves purchase invoice metadata by ID")
    public ResponseEntity<ApiResponse<InvoiceUploadResponseDto>> getInvoiceById(@PathVariable Long id) {
        PurchaseInvoice invoice = invoiceService.getInvoiceById(id);
        InvoiceUploadResponseDto dto = InvoiceUploadResponseDto.fromEntity(invoice);

        return ResponseEntity.ok(ApiResponse.ok(dto, "Invoice details retrieved successfully"));
    }

    /**
     * Download or view the secure invoice file.
     * GET /api/invoices/{id}/download
     */
    @GetMapping("/{id}/download")
    @Operation(summary = "Download Invoice File", description = "Streams the securely stored invoice file")
    public ResponseEntity<Resource> downloadInvoiceFile(@PathVariable Long id) {
        PurchaseInvoice invoice = invoiceService.getInvoiceById(id);
        Resource resource = invoiceService.getInvoiceFileResource(id);

        String contentType = invoice.getMimeType();
        if (contentType == null || contentType.isBlank()) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + invoice.getOriginalFilename() + "\"")
                .body(resource);
    }

    /**
     * Process OCR on an uploaded purchase invoice.
     * Uses free/open-source Tesseract OCR.
     * Extracts: Supplier, Invoice number, Date, Line items (Product name, SKU, Barcode, Qty, Unit price, Total).
     * Flags low-confidence values for manual review.
     * Strict safeguards: Does NOT update inventory. Does NOT automatically confirm the invoice.
     * POST /api/invoices/{id}/ocr
     */
    @PostMapping("/{id}/ocr")
    @Operation(summary = "Process Tesseract OCR for Invoice", description = "Executes open-source OCR text extraction on uploaded invoice; extracts entities; flags low-confidence values for manual review; leaves inventory unchanged and invoice unconfirmed")
    public ResponseEntity<ApiResponse<InvoiceOcrResultDto>> processInvoiceOcr(@PathVariable Long id) {
        InvoiceOcrResultDto result = invoiceOcrService.processInvoiceOcr(id);
        return ResponseEntity.ok(ApiResponse.ok(result, "Invoice OCR processed successfully via Tesseract OCR engine. Low-confidence values flagged for manual review."));
    }
}
