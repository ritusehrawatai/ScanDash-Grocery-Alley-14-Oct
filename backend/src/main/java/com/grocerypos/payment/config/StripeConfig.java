package com.grocerypos.payment.config;

import com.stripe.Stripe;
import com.stripe.StripeClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot Configuration for the official Stripe SDK client.
 * Configures the Stripe environment, initializes the StripeClient bean,
 * and enforces server-side security (secret keys are never logged or exposed).
 */
@Configuration
public class StripeConfig {

    private static final Logger log = LoggerFactory.getLogger(StripeConfig.class);

    private static final String DEFAULT_TEST_STUB_KEY = "sk_test_mockPlaceholderKeyForLocalTestingOnly";

    private final StripeProperties stripeProperties;

    @Autowired
    public StripeConfig(StripeProperties stripeProperties) {
        this.stripeProperties = stripeProperties;
    }

    /**
     * Initializes Stripe global configuration on application startup.
     * Validates configuration properties and logs masked credentials.
     */
    @PostConstruct
    public void initStripe() {
        try {
            stripeProperties.validate();

            if (stripeProperties.isConfigured()) {
                Stripe.apiKey = stripeProperties.getApiKey();
                log.info("[StripeConfig] Stripe SDK initialized successfully in {} mode (Key: {}, Currency: {})",
                        stripeProperties.isTestMode() ? "TEST" : "LIVE",
                        stripeProperties.getMaskedApiKey(),
                        stripeProperties.getCurrency());
            } else {
                // Safe test mode without credentials
                Stripe.apiKey = DEFAULT_TEST_STUB_KEY;
                log.info("[StripeConfig] Stripe SDK running in UNCONFIGURED/TEST mode. No real API key configured in environment.");
            }
        } catch (IllegalArgumentException | IllegalStateException ex) {
            log.error("[StripeConfig] Stripe configuration error: {}", ex.getMessage());
            throw ex;
        }
    }

    /**
     * Provides an injectable StripeClient instance bean.
     * Supports both real credentials and test-mode stub credentials.
     */
    @Bean
    public StripeClient stripeClient() {
        if (stripeProperties.isConfigured()) {
            return new StripeClient(stripeProperties.getApiKey());
        }
        // Return a client initialized with the safe test placeholder key
        return new StripeClient(DEFAULT_TEST_STUB_KEY);
    }
}
