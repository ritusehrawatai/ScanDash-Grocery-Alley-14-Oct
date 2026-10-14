package com.grocerypos.payment;

import com.grocerypos.payment.config.StripeConfig;
import com.grocerypos.payment.config.StripeProperties;
import com.stripe.Stripe;
import com.stripe.StripeClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class StripeConfigTest {

    private StripeProperties stripeProperties;

    @BeforeEach
    void setUp() {
        stripeProperties = new StripeProperties();
    }

    @Test
    @DisplayName("Validation: Should successfully accept valid test secret key (sk_test_...)")
    void testValidTestKey() {
        stripeProperties.setApiKey("sk_test_51MockSecretKeyForGroceryStorePOS12345");
        stripeProperties.validate();

        assertThat(stripeProperties.isConfigured()).isTrue();
        assertThat(stripeProperties.isTestMode()).isTrue();
        assertThat(stripeProperties.getMaskedApiKey()).isEqualTo("sk_test_...2345");
        assertThat(stripeProperties.getMaskedApiKey()).doesNotContain("MockSecretKey");
    }

    @Test
    @DisplayName("Validation: Should successfully accept valid live secret key (sk_live_...)")
    void testValidLiveKey() {
        stripeProperties.setApiKey("sk_live_51ProductionSecretKeyPOSLive9876");
        stripeProperties.setTestMode(false);
        stripeProperties.validate();

        assertThat(stripeProperties.isConfigured()).isTrue();
        assertThat(stripeProperties.isTestMode()).isFalse();
        assertThat(stripeProperties.getMaskedApiKey()).isEqualTo("sk_live_...9876");
        assertThat(stripeProperties.getMaskedApiKey()).doesNotContain("ProductionSecretKey");
    }

    @Test
    @DisplayName("Validation: Should successfully accept restricted key (rk_test_... or rk_live_...)")
    void testValidRestrictedKey() {
        stripeProperties.setApiKey("rk_test_51RestrictedKeyTesting9999");
        stripeProperties.validate();

        assertThat(stripeProperties.isConfigured()).isTrue();
        assertThat(stripeProperties.isTestMode()).isTrue();
    }

    @Test
    @DisplayName("Validation: Should throw IllegalArgumentException for malformed key prefix")
    void testMalformedKeyPrefixThrowsException() {
        stripeProperties.setApiKey("invalid_prefix_secret_12345");

        assertThatThrownBy(() -> stripeProperties.validate())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid Stripe secret key format");
    }

    @Test
    @DisplayName("Validation: Should throw IllegalStateException when running in live mode without an API key")
    void testLiveModeWithoutKeyThrowsException() {
        stripeProperties.setApiKey("");
        stripeProperties.setTestMode(false);

        assertThatThrownBy(() -> stripeProperties.validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Stripe secret key (STRIPE_API_KEY) is required when running in live/production mode");
    }

    @Test
    @DisplayName("Test Mode: Should safely allow empty API key when testMode is true (no credentials required)")
    void testEmptyKeyAllowedInTestMode() {
        stripeProperties.setApiKey("");
        stripeProperties.setTestMode(true);

        assertThatCode(() -> stripeProperties.validate()).doesNotThrowAnyException();
        assertThat(stripeProperties.isConfigured()).isFalse();
        assertThat(stripeProperties.getMaskedApiKey()).isEqualTo("[NOT_CONFIGURED]");
    }

    @Test
    @DisplayName("Security: Masking and toString should NEVER expose raw secret key or webhook secret")
    void testSecretsNeverExposedInToString() {
        stripeProperties.setApiKey("sk_test_51SecretThatMustNeverLeakIntoLogs1234");
        stripeProperties.setWebhookSecret("whsec_TopSecretWebhookSignatureBytes9999");
        stripeProperties.setPublishableKey("pk_test_public1234");

        String toStringResult = stripeProperties.toString();

        assertThat(toStringResult).doesNotContain("SecretThatMustNeverLeakIntoLogs");
        assertThat(toStringResult).doesNotContain("TopSecretWebhookSignatureBytes");
        assertThat(toStringResult).contains("maskedApiKey='sk_test_...1234'");
        assertThat(toStringResult).contains("maskedWebhookSecret='whsec_...9999'");
        assertThat(toStringResult).contains("publishableKey='pk_test_public1234'");
    }

    @Test
    @DisplayName("StripeConfig: initStripe should configure Stripe global SDK and StripeClient bean")
    void testStripeConfigInitialization() {
        stripeProperties.setApiKey("sk_test_51TestKeyForStripeConfigInitialization5555");
        StripeConfig config = new StripeConfig(stripeProperties);

        config.initStripe();
        assertThat(Stripe.apiKey).isEqualTo("sk_test_51TestKeyForStripeConfigInitialization5555");

        StripeClient client = config.stripeClient();
        assertThat(client).isNotNull();
    }

    @Test
    @DisplayName("StripeConfig: initStripe in unconfigured test mode should initialize fallback stub client without crashing")
    void testStripeConfigUnconfiguredTestMode() {
        stripeProperties.setApiKey("");
        stripeProperties.setTestMode(true);
        StripeConfig config = new StripeConfig(stripeProperties);

        assertThatCode(() -> config.initStripe()).doesNotThrowAnyException();

        StripeClient client = config.stripeClient();
        assertThat(client).isNotNull();
    }

    @Test
    @DisplayName("Terminal Location: terminalLocationId property should be properly set and read from configuration")
    void testTerminalLocationConfiguration() {
        stripeProperties.setTerminalLocationId("tml_store_main_101");
        assertThat(stripeProperties.getTerminalLocationId()).isEqualTo("tml_store_main_101");

        String toStringResult = stripeProperties.toString();
        assertThat(toStringResult).contains("terminalLocationId='tml_store_main_101'");
    }
}
