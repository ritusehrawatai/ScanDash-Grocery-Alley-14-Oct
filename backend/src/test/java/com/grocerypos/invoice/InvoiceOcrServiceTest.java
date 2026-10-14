package com.grocerypos.invoice;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grocerypos.invoice.dto.InvoiceExtractedItemDto;
import com.grocerypos.invoice.dto.InvoiceOcrResultDto;
import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import com.grocerypos.invoice.repository.PurchaseInvoiceRepository;
import com.grocerypos.invoice.service.InvoiceOcrServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceOcrServiceTest {

    @Mock
    private PurchaseInvoiceRepository invoiceRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private InvoiceOcrServiceImpl invoiceOcrService;

    private PurchaseInvoice mockInvoice;

    @BeforeEach
    void setUp() {
        invoiceOcrService = new InvoiceOcrServiceImpl(invoiceRepository, objectMapper);

        mockInvoice = new PurchaseInvoice();
        mockInvoice.setInvoiceNumber("INV-20261005-001");
        mockInvoice.setOriginalFilename("invoice_scan.jpg");
        mockInvoice.setStoredFilename("uuid-invoice.jpg");
        mockInvoice.setFilePath("/tmp/nonexistent.jpg");
        mockInvoice.setFileSize(204800L);
        mockInvoice.setMimeType("image/jpeg");
        mockInvoice.setFileHash("abcdef1234567890");
        mockInvoice.setStatus(InvoiceStatus.UPLOADED);
    }

    @Test
    @DisplayName("Should extract invoice header and items with high confidence when format is clear")
    void testProcessInvoiceOcrSuccess() {
        when(invoiceRepository.findById(1L)).thenReturn(Optional.of(mockInvoice));
        when(invoiceRepository.save(any(PurchaseInvoice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        InvoiceOcrResultDto result = invoiceOcrService.processInvoiceOcr(1L);

        assertThat(result).isNotNull();
        assertThat(result.getSupplier()).isNotNull();
        assertThat(result.getSupplier().getValue()).contains("GREEN VALLEY ORGANICS");
        assertThat(result.getInvoiceNumber()).isNotNull();
        assertThat(result.getInvoiceNumber().getValue()).isEqualTo("INV-20261005-001");
        assertThat(result.getInvoiceDate()).isNotNull();
        assertThat(result.getTotal()).isNotNull();
        assertThat(result.getTotal().getValue()).isEqualByComparingTo(new BigDecimal("106.25"));

        // Items verification
        assertThat(result.getItems()).isNotEmpty();
        InvoiceExtractedItemDto item1 = result.getItems().get(0);
        assertThat(item1.getProductName().getValue()).contains("Organic Hass Avocados");
        assertThat(item1.getSku().getValue()).isEqualTo("AVO-ORG-01");
        assertThat(item1.getBarcode().getValue()).isEqualTo("072527273070");
        assertThat(item1.getQuantity().getValue()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(item1.getUnitPrice().getValue()).isEqualByComparingTo(new BigDecimal("1.99"));
        assertThat(item1.getTotal().getValue()).isEqualByComparingTo(new BigDecimal("19.90"));

        // Strict constraints verification
        assertThat(result.isInventoryUpdated()).isFalse();
        assertThat(result.isAutomaticallyConfirmed()).isFalse();
        assertThat(mockInvoice.getStatus()).isEqualTo(InvoiceStatus.PROCESSED);

        verify(invoiceRepository).save(mockInvoice);
    }

    @Test
    @DisplayName("Should flag low-confidence values and arithmetic mismatches for manual review")
    void testFlagLowConfidenceValuesForManualReview() {
        String noisyRawText = "UNKNOWN SUPPLIER LLC\n" +
                "Inv # UNREADABLE\n" +
                "Date: Unknown\n" +
                "Mystery Produce | Qty: 5 | Unit: 2.00 | Total: 25.00\n" +
                "Total: 25.00";

        InvoiceOcrResultDto result = invoiceOcrService.parseExtractedData(noisyRawText, 60, 2L);

        assertThat(result).isNotNull();
        assertThat(result.isHasLowConfidenceValues()).isTrue();
        assertThat(result.isManualReviewRequired()).isTrue();
        assertThat(result.getFlaggedFieldsCount()).isGreaterThan(0);

        // Check arithmetic mismatch flagging on the item
        InvoiceExtractedItemDto item = result.getItems().get(0);
        assertThat(item.isFlaggedForReview()).isTrue();
        assertThat(item.getReviewReasons()).anyMatch(reason -> reason.contains("Arithmetic discrepancy") || reason.contains("SKU missing"));

        // Must still adhere to strict non-modification rules
        assertThat(result.isInventoryUpdated()).isFalse();
        assertThat(result.isAutomaticallyConfirmed()).isFalse();
    }
}
