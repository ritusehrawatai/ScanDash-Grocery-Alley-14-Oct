package com.grocerypos.invoice.service;

import com.grocerypos.invoice.entity.PurchaseInvoice;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface InvoiceService {

    PurchaseInvoice uploadInvoice(MultipartFile file, String notes, String uploadedBy);

    List<PurchaseInvoice> getAllInvoices();

    PurchaseInvoice getInvoiceById(Long id);

    Resource getInvoiceFileResource(Long id);
}
