package com.grocerypos.payment.config;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Objects;

/**
 * Configuration properties for Stripe payment integration.
 * Injected from environment variables / application.yml.
 * Safety: The Stripe API Secret Key must NEVER be shared, logged, or exposed to client-side code.
 */
@Configuration
@ConfigurationProperties(prefix = "stripe")
public class StripeProperties {

    /**
     * Stripe secret API key (server-side only, NEVER expose to client).
     * Read from STRIPE_API_KEY environment variable.
     */
    @JsonIgnore
    private String apiKey = "";

    /**
     * Stripe publishable key (safe for client-side configuration / Stripe Elements).
     * Read from STRIPE_PUBLISHABLE_KEY environment variable.
     */
    private String publishableKey = "";

    /**
     * Webhook signing secret for verifying Stripe webhooks.
     * Read from STRIPE_WEBHOOK_SECRET environment variable.
     */
    @JsonIgnore
    private String webhookSecret = "";

    /**
     * Default transaction currency (e.g., USD, CAD, EUR).
     */
    private String currency = "USD";

    /**
     * Stripe Terminal location ID for in-person POS readers (e.g., tml_xxx or loc_xxx).
     * Read from STRIPE_TERMINAL_LOCATION_ID environment variable.
     */
    private String terminalLocationId = "";

    /**
     * Test mode flag. When true, operates with test credentials or stubbed provider without requiring real keys.
     */
    private boolean testMode = true;

    public StripeProperties() {
    }

    /**
     * Validates configuration settings and key format.
     *
     * @throws IllegalArgumentException if an invalid key format is supplied
     * @throws IllegalStateException    if running in production/live mode without a key
     */
    public void validate() {
        if (apiKey != null && !apiKey.trim().isEmpty()) {
            String trimmedKey = apiKey.trim();
            // Validate standard Stripe secret key prefixes
            boolean validPrefix = trimmedKey.startsWith("sk_test_") ||
                    trimmedKey.startsWith("sk_live_") ||
                    trimmedKey.startsWith("rk_test_") ||
                    trimmedKey.startsWith("rk_live_");

            if (!validPrefix) {
                throw new IllegalArgumentException(
                        "Invalid Stripe secret key format: key must start with 'sk_test_', 'sk_live_', 'rk_test_', or 'rk_live_'"
                );
            }

            // Auto-detect test mode from key prefix if testMode was not explicitly disabled
            if (trimmedKey.startsWith("sk_test_") || trimmedKey.startsWith("rk_test_")) {
                this.testMode = true;
            }
        } else {
            // No API key provided
            if (!testMode) {
                throw new IllegalStateException(
                        "Stripe secret key (STRIPE_API_KEY) is required when running in live/production mode."
                );
            }
        }

        if (currency == null || currency.trim().isEmpty()) {
            this.currency = "USD";
        } else {
            this.currency = this.currency.trim().toUpperCase();
        }
    }

    /**
     * Returns true if a non-blank Stripe secret API key is configured.
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.trim().isEmpty();
    }

    /**
     * Returns a safely masked version of the Stripe API Secret Key for logging and status reports.
     * Guaranteed: Never reveals more than the prefix and last 4 characters.
     */
    public String getMaskedApiKey() {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            return "[NOT_CONFIGURED]";
        }
        String trimmed = apiKey.trim();
        if (trimmed.length() <= 8) {
            return "sk_***";
        }
        String prefix = trimmed.substring(0, Math.min(8, trimmed.indexOf('_') + 6));
        String suffix = trimmed.substring(trimmed.length() - 4);
        return prefix + "..." + suffix;
    }

    /**
     * Returns a safely masked version of the Stripe Webhook Signing Secret.
     */
    public String getMaskedWebhookSecret() {
        if (webhookSecret == null || webhookSecret.trim().isEmpty()) {
            return "[NOT_CONFIGURED]";
        }
        String trimmed = webhookSecret.trim();
        if (trimmed.length() <= 8) {
            return "whsec_***";
        }
        return "whsec_..." + trimmed.substring(trimmed.length() - 4);
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
    }

    public String getPublishableKey() {
        return publishableKey;
    }

    public void setPublishableKey(String publishableKey) {
        this.publishableKey = publishableKey != null ? publishableKey.trim() : "";
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret != null ? webhookSecret.trim() : "";
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

    public String getTerminalLocationId() {
        return terminalLocationId;
    }

    public void setTerminalLocationId(String terminalLocationId) {
        this.terminalLocationId = terminalLocationId != null ? terminalLocationId.trim() : "";
    }

    @Override
    public String toString() {
        return "StripeProperties{" +
                "configured=" + isConfigured() +
                ", testMode=" + testMode +
                ", currency='" + currency + '\'' +
                ", publishableKey='" + (publishableKey.isEmpty() ? "[NOT_SET]" : publishableKey) + '\'' +
                ", maskedApiKey='" + getMaskedApiKey() + '\'' +
                ", maskedWebhookSecret='" + getMaskedWebhookSecret() + '\'' +
                ", terminalLocationId='" + (terminalLocationId.isEmpty() ? "[NOT_SET]" : terminalLocationId) + '\'' +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        StripeProperties that = (StripeProperties) o;
        return testMode == that.testMode &&
                Objects.equals(apiKey, that.apiKey) &&
                Objects.equals(publishableKey, that.publishableKey) &&
                Objects.equals(webhookSecret, that.webhookSecret) &&
                Objects.equals(currency, that.currency) &&
                Objects.equals(terminalLocationId, that.terminalLocationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(apiKey, publishableKey, webhookSecret, currency, testMode, terminalLocationId);
    }
}
