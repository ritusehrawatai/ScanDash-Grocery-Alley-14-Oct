package com.grocerypos.invoice;

import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import com.grocerypos.invoice.exception.InvalidInvoiceFileException;
import com.grocerypos.invoice.repository.PurchaseInvoiceRepository;
import com.grocerypos.invoice.service.InvoiceServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class InvoiceServiceTest {

    @Mock
    private PurchaseInvoiceRepository invoiceRepository;

    @TempDir
    Path tempDir;

    private InvoiceServiceImpl invoiceService;

    @BeforeEach
    void setUp() {
        invoiceService = new InvoiceServiceImpl(invoiceRepository, tempDir.toString());
    }

    @Test
    @DisplayName("Should successfully upload valid PDF invoice with status UPLOADED")
    void shouldUploadValidPdfInvoice() {
        // Valid PDF starts with %PDF- (0x25, 0x50, 0x44, 0x46)
        byte[] pdfContent = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0x45, 0x4F, 0x46};
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "supplier-invoice-101.pdf",
                "application/pdf",
                pdfContent
        );

        when(invoiceRepository.save(any(PurchaseInvoice.class))).thenAnswer(invocation -> {
            PurchaseInvoice invoice = invocation.getArgument(0);
            invoice.setId(1L);
            return invoice;
        });

        PurchaseInvoice result = invoiceService.uploadInvoice(file, "Batch order supplier A", "Owner");

        assertNotNull(result);
        assertEquals(InvoiceStatus.UPLOADED, result.getStatus());
        assertEquals("supplier-invoice-101.pdf", result.getOriginalFilename());
        assertEquals("application/pdf", result.getMimeType());
        assertEquals((long) pdfContent.length, result.getFileSize());
        assertNotNull(result.getFileHash());
        assertFalse(result.getFileHash().isBlank());
        assertTrue(result.getInvoiceNumber().startsWith("INV-"));

        verify(invoiceRepository, times(1)).save(any(PurchaseInvoice.class));
    }

    @Test
    @DisplayName("Should successfully upload valid JPEG image invoice with status UPLOADED")
    void shouldUploadValidJpegInvoice() {
        // JPEG starts with 0xFF, 0xD8, 0xFF
        byte[] jpegContent = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46};
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "receipt-photo.jpg",
                "image/jpeg",
                jpegContent
        );

        when(invoiceRepository.save(any(PurchaseInvoice.class))).thenAnswer(invocation -> {
            PurchaseInvoice invoice = invocation.getArgument(0);
            invoice.setId(2L);
            return invoice;
        });

        PurchaseInvoice result = invoiceService.uploadInvoice(file, "Paper invoice photo", "Admin");

        assertNotNull(result);
        assertEquals(InvoiceStatus.UPLOADED, result.getStatus());
        assertEquals("receipt-photo.jpg", result.getOriginalFilename());
        assertEquals("image/jpeg", result.getMimeType());
    }

    @Test
    @DisplayName("Should reject file with disallowed extension (e.g. .exe or .txt)")
    void shouldRejectDisallowedExtension() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invoice.txt",
                "text/plain",
                "some plain text".getBytes()
        );

        InvalidInvoiceFileException ex = assertThrows(
                InvalidInvoiceFileException.class,
                () -> invoiceService.uploadInvoice(file, "test", "Admin")
        );

        assertTrue(ex.getMessage().contains("Unsupported file extension"));
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should reject file when magic bytes do not match PDF specification")
    void shouldRejectCorruptPdf() {
        // Named .pdf but containing plain text
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "fake.pdf",
                "application/pdf",
                "THIS IS NOT A VALID PDF FILE".getBytes()
        );

        InvalidInvoiceFileException ex = assertThrows(
                InvalidInvoiceFileException.class,
                () -> invoiceService.uploadInvoice(file, "test", "Admin")
        );

        assertTrue(ex.getMessage().contains("Integrity check failed"));
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should reject empty file (0 bytes)")
    void shouldRejectEmptyFile() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "empty.png",
                "image/png",
                new byte[0]
        );

        InvalidInvoiceFileException ex = assertThrows(
                InvalidInvoiceFileException.class,
                () -> invoiceService.uploadInvoice(file, "test", "Admin")
        );

        assertTrue(ex.getMessage().contains("empty"));
        verify(invoiceRepository, never()).save(any());
    }
}
