package com.grocerypos.invoice.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class InvoiceExtractedItemDto implements Serializable {

    private String id;
    private ExtractedFieldDto<String> productName;
    private ExtractedFieldDto<String> sku;
    private ExtractedFieldDto<String> barcode;
    private ExtractedFieldDto<BigDecimal> quantity;
    private ExtractedFieldDto<BigDecimal> unitPrice;
    private ExtractedFieldDto<BigDecimal> total;
    private int confidence;
    private boolean flaggedForReview;
    private List<String> reviewReasons = new ArrayList<>();
    private Long matchedProductId;
    private String matchedProductName;
    private String matchedProductSku;
    private boolean ignored;
    private boolean userModified;

    public InvoiceExtractedItemDto() {
    }

    public Long getMatchedProductId() {
        return matchedProductId;
    }

    public void setMatchedProductId(Long matchedProductId) {
        this.matchedProductId = matchedProductId;
    }

    public String getMatchedProductName() {
        return matchedProductName;
    }

    public void setMatchedProductName(String matchedProductName) {
        this.matchedProductName = matchedProductName;
    }

    public String getMatchedProductSku() {
        return matchedProductSku;
    }

    public void setMatchedProductSku(String matchedProductSku) {
        this.matchedProductSku = matchedProductSku;
    }

    public boolean isIgnored() {
        return ignored;
    }

    public void setIgnored(boolean ignored) {
        this.ignored = ignored;
    }

    public boolean isUserModified() {
        return userModified;
    }

    public void setUserModified(boolean userModified) {
        this.userModified = userModified;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public ExtractedFieldDto<String> getProductName() {
        return productName;
    }

    public void setProductName(ExtractedFieldDto<String> productName) {
        this.productName = productName;
    }

    public ExtractedFieldDto<String> getSku() {
        return sku;
    }

    public void setSku(ExtractedFieldDto<String> sku) {
        this.sku = sku;
    }

    public ExtractedFieldDto<String> getBarcode() {
        return barcode;
    }

    public void setBarcode(ExtractedFieldDto<String> barcode) {
        this.barcode = barcode;
    }

    public ExtractedFieldDto<BigDecimal> getQuantity() {
        return quantity;
    }

    public void setQuantity(ExtractedFieldDto<BigDecimal> quantity) {
        this.quantity = quantity;
    }

    public ExtractedFieldDto<BigDecimal> getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(ExtractedFieldDto<BigDecimal> unitPrice) {
        this.unitPrice = unitPrice;
    }

    public ExtractedFieldDto<BigDecimal> getTotal() {
        return total;
    }

    public void setTotal(ExtractedFieldDto<BigDecimal> total) {
        this.total = total;
    }

    public int getConfidence() {
        return confidence;
    }

    public void setConfidence(int confidence) {
        this.confidence = confidence;
    }

    public boolean isFlaggedForReview() {
        return flaggedForReview;
    }

    public void setFlaggedForReview(boolean flaggedForReview) {
        this.flaggedForReview = flaggedForReview;
    }

    public List<String> getReviewReasons() {
        return reviewReasons;
    }

    public void setReviewReasons(List<String> reviewReasons) {
        this.reviewReasons = reviewReasons != null ? reviewReasons : new ArrayList<>();
    }
}
