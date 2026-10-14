package com.grocerypos.payment.dto;

import com.grocerypos.sale.dto.CreateSaleItemRequestDto;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

/**
 * DTO for creating a Stripe PaymentIntent for an existing checkout/sale.
 * Amount is intentionally calculated exclusively server-side from trusted product prices,
 * quantities, and taxes to prevent client-side price tampering.
 */
public class CreatePaymentIntentRequestDto {

    private Long saleId;

    private String idempotencyKey;

    private String currency = "USD";

    private List<CreateSaleItemRequestDto> items;

    private Map<String, String> metadata;

    public CreatePaymentIntentRequestDto() {
    }

    public CreatePaymentIntentRequestDto(Long saleId) {
        this.saleId = saleId;
    }

    public CreatePaymentIntentRequestDto(Long saleId, String idempotencyKey) {
        this.saleId = saleId;
        this.idempotencyKey = idempotencyKey;
    }

    public Long getSaleId() {
        return saleId;
    }

    public void setSaleId(Long saleId) {
        this.saleId = saleId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public List<CreateSaleItemRequestDto> getItems() {
        return items;
    }

    public void setItems(List<CreateSaleItemRequestDto> items) {
        this.items = items;
    }

    public Map<String, String> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, String> metadata) {
        this.metadata = metadata;
    }
}
