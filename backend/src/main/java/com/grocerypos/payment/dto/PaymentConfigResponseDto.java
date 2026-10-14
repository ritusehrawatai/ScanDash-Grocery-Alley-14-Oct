package com.grocerypos.payment.dto;

/**
 * Public payment configuration DTO for client-side Stripe Elements initialization.
 * Guaranteed: Only exposes publishable key and public metadata. Never contains secret keys!
 */
public class PaymentConfigResponseDto {

    private String publishableKey;
    private String currency;
    private boolean testMode;

    public PaymentConfigResponseDto() {
    }

    public PaymentConfigResponseDto(String publishableKey, String currency, boolean testMode) {
        this.publishableKey = publishableKey;
        this.currency = currency;
        this.testMode = testMode;
    }

    public String getPublishableKey() {
        return publishableKey;
    }

    public void setPublishableKey(String publishableKey) {
        this.publishableKey = publishableKey;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public boolean isTestMode() {
        return testMode;
    }

    public void setTestMode(boolean testMode) {
        this.testMode = testMode;
    }
}
