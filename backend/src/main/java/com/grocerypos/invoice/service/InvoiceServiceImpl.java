package com.grocerypos.invoice.service;

import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.invoice.entity.InvoiceStatus;
import com.grocerypos.invoice.entity.PurchaseInvoice;
import com.grocerypos.invoice.exception.InvalidInvoiceFileException;
import com.grocerypos.invoice.repository.PurchaseInvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class InvoiceServiceImpl implements InvoiceService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceServiceImpl.class);

    private static final long MAX_FILE_SIZE = 15L * 1024 * 1024; // 15 MB
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "pdf");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/pdf"
    );

    private final PurchaseInvoiceRepository invoiceRepository;
    private final Path storageDirectory;

    public InvoiceServiceImpl(
            PurchaseInvoiceRepository invoiceRepository,
            @Value("${grocerypos.invoice.upload-dir:uploads/invoices}") String uploadDir) {
        this.invoiceRepository = invoiceRepository;
        this.storageDirectory = Paths.get(uploadDir).toAbsolutePath().normalize();
        initStorageDirectory();
    }

    private void initStorageDirectory() {
        try {
            Files.createDirectories(this.storageDirectory);
            log.info("Initialized invoice storage directory at: {}", this.storageDirectory);
        } catch (IOException e) {
            throw new RuntimeException("Could not create the upload storage directory: " + this.storageDirectory, e);
        }
    }

    @Override
    @Transactional
    public PurchaseInvoice uploadInvoice(MultipartFile file, String notes, String uploadedBy) {
        if (file == null || file.isEmpty()) {
            throw new InvalidInvoiceFileException("Upload failed: No file provided or file is empty (0 bytes).");
        }

        // 1. Validate File Size
        long fileSize = file.getSize();
        if (fileSize <= 0) {
            throw new InvalidInvoiceFileException("Upload failed: File is empty (0 bytes).");
        }
        if (fileSize > MAX_FILE_SIZE) {
            throw new InvalidInvoiceFileException(String.format(
                    "Upload failed: File size (%d bytes) exceeds the maximum allowed limit of %d bytes (15MB).",
                    fileSize, MAX_FILE_SIZE
            ));
        }

        // 2. Validate File Name & Extension
        String rawFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "invoice"));
        if (rawFilename.contains("..") || rawFilename.contains("/") || rawFilename.contains("\\")) {
            throw new InvalidInvoiceFileException("Security violation: Filename contains invalid path traversal characters.");
        }

        String extension = getFileExtension(rawFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new InvalidInvoiceFileException(String.format(
                    "Upload failed: Unsupported file extension '%s'. Allowed formats: JPG, JPEG, PNG, PDF.",
                    extension
            ));
        }

        // 3. Validate MIME Type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            // Some systems might report 'image/pjpeg' or 'application/octet-stream', verify via extension + magic bytes
            if (contentType != null && !contentType.equalsIgnoreCase("application/octet-stream")
                    && !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
                throw new InvalidInvoiceFileException(String.format(
                        "Upload failed: Unsupported MIME type '%s'. Allowed formats: JPG, JPEG, PNG, PDF.",
                        contentType
                ));
            }
        }

        // 4. Validate File Integrity & Magic Byte Signature
        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidInvoiceFileException("Failed to read file content for integrity validation: " + e.getMessage(), e);
        }

        validateMagicBytes(fileBytes, extension);

        // 5. Compute Cryptographic SHA-256 Checksum for data integrity
        String sha256Hex = computeSha256(fileBytes);

        // 6. Securely Store File with UUID and Safe Extension
        String uniqueStoredFilename = UUID.randomUUID() + "." + extension;
        Path targetLocation = this.storageDirectory.resolve(uniqueStoredFilename).normalize();

        if (!targetLocation.startsWith(this.storageDirectory)) {
            throw new InvalidInvoiceFileException("Security violation: Cannot store file outside the configured storage directory.");
        }

        try {
            Files.write(targetLocation, fileBytes);
            log.info("Securely stored invoice file: {} (Original: {}, Size: {} bytes)",
                    uniqueStoredFilename, rawFilename, fileSize);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file securely on disk: " + e.getMessage(), e);
        }

        // 7. Generate Invoice Tracking Number
        String datePrefix = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String shortId = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String invoiceNumber = "INV-" + datePrefix + "-" + shortId;

        // 8. Create PurchaseInvoice Record (Status: UPLOADED)
        // NOTE: Strictly following requirements:
        // Do NOT run OCR yet.
        // Do NOT modify inventory.
        // Do NOT automatically create products.
        PurchaseInvoice purchaseInvoice = new PurchaseInvoice();
        purchaseInvoice.setInvoiceNumber(invoiceNumber);
        purchaseInvoice.setOriginalFilename(rawFilename);
        purchaseInvoice.setStoredFilename(uniqueStoredFilename);
        purchaseInvoice.setFilePath(targetLocation.toString());
        purchaseInvoice.setFileSize(fileSize);
        purchaseInvoice.setMimeType(contentType != null ? contentType : resolveMimeType(extension));
        purchaseInvoice.setFileHash(sha256Hex);
        purchaseInvoice.setStatus(InvoiceStatus.UPLOADED);
        purchaseInvoice.setUploadedBy(uploadedBy != null && !uploadedBy.isBlank() ? uploadedBy : "Admin / Owner");
        purchaseInvoice.setNotes(notes);

        PurchaseInvoice savedInvoice = invoiceRepository.save(purchaseInvoice);
        log.info("Created PurchaseInvoice record ID: {}, Invoice#: {}, Status: {}",
                savedInvoice.getId(), savedInvoice.getInvoiceNumber(), savedInvoice.getStatus());

        return savedInvoice;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PurchaseInvoice> getAllInvoices() {
        return invoiceRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    @Transactional(readOnly = true)
    public PurchaseInvoice getInvoiceById(Long id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseInvoice", "id", id));
    }

    @Override
    @Transactional(readOnly = true)
    public Resource getInvoiceFileResource(Long id) {
        PurchaseInvoice invoice = getInvoiceById(id);
        try {
            Path filePath = Paths.get(invoice.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("Invoice file not found or not readable on storage: " + invoice.getStoredFilename());
            }
        } catch (MalformedURLException e) {
            throw new RuntimeException("Error resolving invoice file path: " + e.getMessage(), e);
        }
    }

    private void validateMagicBytes(byte[] bytes, String extension) {
        if (bytes == null || bytes.length < 4) {
            throw new InvalidInvoiceFileException("Integrity check failed: File is corrupted or header is truncated.");
        }

        switch (extension) {
            case "pdf":
                // PDF header starts with '%PDF-' (0x25, 0x50, 0x44, 0x46)
                if (bytes[0] != 0x25 || bytes[1] != 0x50 || bytes[2] != 0x44 || bytes[3] != 0x46) {
                    throw new InvalidInvoiceFileException("Integrity check failed: File header does not match valid PDF specification.");
                }
                break;
            case "png":
                // PNG magic bytes 0x89, 0x50, 0x4E, 0x47 (89 50 4E 47 0D 0A 1A 0A)
                if ((bytes[0] & 0xFF) != 0x89 || bytes[1] != 0x50 || bytes[2] != 0x4E || bytes[3] != 0x47) {
                    throw new InvalidInvoiceFileException("Integrity check failed: File header does not match valid PNG specification.");
                }
                break;
            case "jpg":
            case "jpeg":
                // JPEG SOI (Start Of Image) marker 0xFF, 0xD8, 0xFF
                if (bytes.length < 3 || (bytes[0] & 0xFF) != 0xFF || (bytes[1] & 0xFF) != 0xD8 || (bytes[2] & 0xFF) != 0xFF) {
                    throw new InvalidInvoiceFileException("Integrity check failed: File header does not match valid JPEG/JPG specification.");
                }
                break;
            default:
                throw new InvalidInvoiceFileException("Unsupported file type: " + extension);
        }
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(data);
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1);
        }
        return "";
    }

    private String resolveMimeType(String extension) {
        switch (extension.toLowerCase()) {
            case "pdf":
                return "application/pdf";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
            default:
                return "image/jpeg";
        }
    }
}
