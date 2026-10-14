package com.grocerypos.payment.provider;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.PaymentGatewayException;
import com.grocerypos.payment.config.StripeProperties;
import com.grocerypos.payment.dto.ConnectionTokenResponseDto;
import com.grocerypos.payment.dto.PaymentIntentResponseDto;
import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;
import com.grocerypos.payment.entity.PaymentStatus;
import com.grocerypos.sale.entity.Sale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Concrete Stripe implementation of PaymentProvider.
 * Provides payment initiation and Stripe Terminal card-present PaymentIntent creation.
 */
@Component
public class StripePaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(StripePaymentProvider.class);
    public static final String PROVIDER_NAME = "STRIPE";

    private final StripeProperties stripeProperties;
    private final com.stripe.StripeClient stripeClient;

    @Autowired
    public StripePaymentProvider(StripeProperties stripeProperties, com.stripe.StripeClient stripeClient) {
        this.stripeProperties = stripeProperties;
        this.stripeClient = stripeClient;
    }

    public StripePaymentProvider(StripeProperties stripeProperties) {
        this(stripeProperties, new com.stripe.StripeClient("sk_test_mockPlaceholderKey"));
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public PaymentResponseDto initiatePayment(PaymentRequestDto request) {
        log.info("[StripePaymentProvider] Preparing payment initiation for saleId: {}, amount: {} {}",
                request.getSaleId(), request.getAmount(), request.getCurrency());

        String currency = (request.getCurrency() != null && !request.getCurrency().isBlank())
                ? request.getCurrency().toUpperCase()
                : stripeProperties.getCurrency().toUpperCase();

        PaymentResponseDto response = new PaymentResponseDto();
        response.setAmount(request.getAmount());
        response.setCurrency(currency);
        response.setSaleId(request.getSaleId());
        response.setProvider(PROVIDER_NAME);
        response.setStatus(PaymentStatus.PENDING);
        response.setExternalPaymentId("pi_prep_" + System.currentTimeMillis());
        response.setClientSecret("pi_prep_secret_" + System.currentTimeMillis());
        response.setCreatedAt(Instant.now());
        response.setUpdatedAt(Instant.now());

        return response;
    }

    @Override
    public PaymentIntentResponseDto createTerminalPaymentIntent(
            Sale sale,
            BigDecimal trustedAmount,
            String currency,
            String idempotencyKey) {
        String resolvedCurrency = (currency != null && !currency.isBlank())
                ? currency.toLowerCase()
                : stripeProperties.getCurrency().toLowerCase();

        long amountInCents = trustedAmount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).longValue();

        log.info("[StripePaymentProvider] Creating Stripe Terminal PaymentIntent: saleId={}, receipt={}, amount={} cents, currency={}",
                sale.getId(), sale.getReceiptNumber(), amountInCents, resolvedCurrency);

        // Check if real Stripe API credentials are configured and not in mock/offline mode
        boolean hasLiveCredentials = stripeProperties.getApiKey() != null
                && !stripeProperties.getApiKey().isBlank()
                && !stripeProperties.getApiKey().startsWith("sk_test_mock")
                && !stripeProperties.isTestMode();

        if (hasLiveCredentials) {
            try {
                com.stripe.param.PaymentIntentCreateParams.Builder paramsBuilder = com.stripe.param.PaymentIntentCreateParams.builder()
                        .setAmount(amountInCents)
                        .setCurrency(resolvedCurrency)
                        .addPaymentMethodType("card_present")
                        .setCaptureMethod(com.stripe.param.PaymentIntentCreateParams.CaptureMethod.AUTOMATIC)
                        .putMetadata("saleId", String.valueOf(sale.getId()))
                        .putMetadata("receiptNumber", sale.getReceiptNumber() != null ? sale.getReceiptNumber() : "")
                        .setDescription("FreshCart Grocery POS Sale " + sale.getReceiptNumber());

                com.stripe.net.RequestOptions.RequestOptionsBuilder optionsBuilder = com.stripe.net.RequestOptions.builder();
                if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                    optionsBuilder.setIdempotencyKey(idempotencyKey);
                }

                com.stripe.model.PaymentIntent intent = stripeClient.paymentIntents().create(paramsBuilder.build(), optionsBuilder.build());

                PaymentIntentResponseDto dto = new PaymentIntentResponseDto();
                dto.setPaymentIntentId(intent.getId());
                dto.setClientSecret(intent.getClientSecret());
                dto.setAmount(trustedAmount);
                dto.setCurrency(resolvedCurrency.toUpperCase());
                dto.setStatus(intent.getStatus());
                dto.setPaymentMethodTypes(List.of("card_present"));
                dto.setSaleId(sale.getId());
                dto.setReceiptNumber(sale.getReceiptNumber());
                dto.setIdempotencyKey(idempotencyKey);
                return dto;
            } catch (Exception e) {
                log.error("[StripePaymentProvider] Failed to create PaymentIntent via Stripe SDK: {}", e.getMessage(), e);
                throw new PaymentGatewayException("Stripe Terminal PaymentIntent creation failed: " + e.getMessage(), e);
            }
        }

        // Test mode / development without real API credentials:
        // Safely generate Stripe Terminal card-present PaymentIntent structure
        String piId = "pi_term_" + System.currentTimeMillis();
        String clientSecret = piId + "_secret_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        PaymentIntentResponseDto dto = new PaymentIntentResponseDto();
        dto.setPaymentIntentId(piId);
        dto.setClientSecret(clientSecret);
        dto.setAmount(trustedAmount);
        dto.setCurrency(resolvedCurrency.toUpperCase());
        dto.setStatus("requires_payment_method");
        dto.setPaymentMethodTypes(List.of("card_present"));
        dto.setSaleId(sale.getId());
        dto.setReceiptNumber(sale.getReceiptNumber());
        dto.setIdempotencyKey(idempotencyKey);
        return dto;
    }

    @Override
    public PaymentResponseDto getPaymentStatus(String externalPaymentId) {
        log.info("[StripePaymentProvider] Querying payment status for external ID: {}", externalPaymentId);
        PaymentResponseDto response = new PaymentResponseDto();
        response.setExternalPaymentId(externalPaymentId);
        response.setProvider(PROVIDER_NAME);
        response.setStatus(PaymentStatus.PENDING);
        response.setUpdatedAt(Instant.now());
        return response;
    }

    @Override
    public PaymentResponseDto cancelPayment(String externalPaymentId) {
        log.info("[StripePaymentProvider] Canceling payment session for external ID: {}", externalPaymentId);
        PaymentResponseDto response = new PaymentResponseDto();
        response.setExternalPaymentId(externalPaymentId);
        response.setProvider(PROVIDER_NAME);
        response.setStatus(PaymentStatus.CANCELED);
        response.setUpdatedAt(Instant.now());
        return response;
    }

    @Override
    public ConnectionTokenResponseDto createTerminalConnectionToken(String requestedLocationId) {
        // 1. Resolve and validate store / location
        String configuredLocation = stripeProperties.getTerminalLocationId() != null
                ? stripeProperties.getTerminalLocationId().trim()
                : "";

        String effectiveLocation = "";
        if (requestedLocationId != null && !requestedLocationId.isBlank()) {
            String trimmedRequested = requestedLocationId.trim();
            // Restrict access: if store location is configured, arbitrary/mismatched locations are forbidden
            if (!configuredLocation.isEmpty() && !configuredLocation.equalsIgnoreCase(trimmedRequested)) {
                log.warn("[StripePaymentProvider] Rejecting terminal token request: requested location '{}' does not match configured store location '{}'",
                        trimmedRequested, configuredLocation);
                throw new InvalidRequestException(
                        "Unauthorized terminal location: Requested location does not match the configured POS store location."
                );
            }
            effectiveLocation = trimmedRequested;
        } else if (!configuredLocation.isEmpty()) {
            effectiveLocation = configuredLocation;
        }

        // 2. Validate configuration: check for missing API key in live mode
        if (!stripeProperties.isTestMode() && !stripeProperties.isConfigured()) {
            log.error("[StripePaymentProvider] Terminal connection token failed: Stripe API secret key is missing in production mode.");
            throw new IllegalStateException("Stripe secret key (STRIPE_API_KEY) is required to generate Terminal connection tokens in live mode.");
        }

        log.info("[StripePaymentProvider] Generating Stripe Terminal connection token (location: {})",
                effectiveLocation.isEmpty() ? "[default]" : effectiveLocation);

        boolean hasLiveCredentials = stripeProperties.getApiKey() != null
                && !stripeProperties.getApiKey().isBlank()
                && !stripeProperties.getApiKey().startsWith("sk_test_mock")
                && !stripeProperties.isTestMode();

        if (hasLiveCredentials) {
            try {
                com.stripe.param.terminal.ConnectionTokenCreateParams.Builder paramsBuilder =
                        com.stripe.param.terminal.ConnectionTokenCreateParams.builder();

                if (!effectiveLocation.isEmpty()) {
                    paramsBuilder.setLocation(effectiveLocation);
                }

                com.stripe.model.terminal.ConnectionToken token =
                        stripeClient.terminal().connectionTokens().create(paramsBuilder.build());

                // Return ONLY the connection-token secret required by the Terminal SDK.
                // NEVER log or persist the secret token!
                return new ConnectionTokenResponseDto(token.getSecret());
            } catch (Exception e) {
                log.error("[StripePaymentProvider] Failed to generate Terminal connection token via Stripe SDK: {}", e.getMessage(), e);
                throw new PaymentGatewayException("Stripe Terminal connection token generation failed: " + e.getMessage(), e);
            }
        }

        // Safe test mode / dev mode without real Stripe live credentials:
        // Return valid pst_test_... formatted ephemeral secret. Never log or persist!
        String testSecret = "pst_test_" + UUID.randomUUID().toString().replace("-", "") + System.currentTimeMillis();
        return new ConnectionTokenResponseDto(testSecret);
    }
}
