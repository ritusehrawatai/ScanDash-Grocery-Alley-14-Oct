package com.grocerypos.payment;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.payment.config.StripeProperties;
import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;
import com.grocerypos.payment.entity.Payment;
import com.grocerypos.payment.entity.PaymentStatus;
import com.grocerypos.payment.provider.PaymentProvider;
import com.grocerypos.payment.provider.StripePaymentProvider;
import com.grocerypos.payment.repository.PaymentRepository;
import com.grocerypos.payment.service.PaymentServiceImpl;
import com.grocerypos.sale.entity.Sale;
import com.grocerypos.sale.entity.SaleStatus;
import com.grocerypos.sale.repository.SaleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private SaleRepository saleRepository;

    private StripeProperties stripeProperties;
    private StripePaymentProvider stripePaymentProvider;
    private PaymentServiceImpl paymentService;

    private Sale sampleSale;

    @BeforeEach
    void setUp() {
        stripeProperties = new StripeProperties();
        stripeProperties.setApiKey("sk_test_mockPlaceholderKey");
        stripeProperties.setPublishableKey("pk_test_mockPlaceholderKey");
        stripeProperties.setCurrency("USD");

        stripeProperties.setWebhookSecret("whsec_test_mockTestKey");

        stripePaymentProvider = new StripePaymentProvider(stripeProperties);

        paymentService = new PaymentServiceImpl(
                paymentRepository,
                saleRepository,
                stripeProperties,
                Collections.singletonList(stripePaymentProvider)
        );

        sampleSale = new Sale("REC-2026-101", new BigDecimal("25.00"), new BigDecimal("1.25"), new BigDecimal("26.25"), SaleStatus.COMPLETED);
        sampleSale.setId(10L);
    }

    @Test
    @DisplayName("initiatePayment: Should successfully prepare Stripe payment session and persist Payment entity")
    void testInitiateStripePaymentSuccess() {
        when(saleRepository.findById(10L)).thenReturn(Optional.of(sampleSale));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(1001L);
            return p;
        });

        PaymentRequestDto request = new PaymentRequestDto(new BigDecimal("26.25"), "USD", 10L, "STRIPE");

        PaymentResponseDto result = paymentService.initiatePayment(request, "STRIPE");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1001L);
        assertThat(result.getSaleId()).isEqualTo(10L);
        assertThat(result.getAmount()).isEqualByComparingTo(new BigDecimal("26.25"));
        assertThat(result.getCurrency()).isEqualTo("USD");
        assertThat(result.getProvider()).isEqualTo("STRIPE");
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(result.getExternalPaymentId()).startsWith("pi_prep_");

        verify(saleRepository).findById(10L);
        verify(paymentRepository).save(any(Payment.class));
    }

    @Test
    @DisplayName("initiatePayment: Should throw InvalidRequestException when unknown payment provider requested")
    void testInitiatePaymentUnsupportedProviderThrowsException() {
        PaymentRequestDto request = new PaymentRequestDto(new BigDecimal("15.00"), "USD", 10L, "UNSUPPORTED_GATEWAY");

        assertThatThrownBy(() -> paymentService.initiatePayment(request, "UNSUPPORTED_GATEWAY"))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Unsupported payment provider");

        verify(paymentRepository, never()).save(any());
    }

    @Test
    @DisplayName("initiatePayment: Should throw ResourceNotFoundException when referenced sale does not exist")
    void testInitiatePaymentSaleNotFoundThrowsException() {
        when(saleRepository.findById(999L)).thenReturn(Optional.empty());

        PaymentRequestDto request = new PaymentRequestDto(new BigDecimal("15.00"), "USD", 999L, "STRIPE");

        assertThatThrownBy(() -> paymentService.initiatePayment(request, "STRIPE"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Sale not found with ID: 999");

        verify(paymentRepository, never()).save(any());
    }

    @Test
    @DisplayName("getPaymentById: Should return PaymentResponseDto when payment exists")
    void testGetPaymentByIdSuccess() {
        Payment payment = new Payment(sampleSale, new BigDecimal("26.25"), "USD", "STRIPE");
        payment.setId(500L);
        payment.setExternalPaymentId("pi_prep_12345");
        payment.setStatus(PaymentStatus.PENDING);

        when(paymentRepository.findById(500L)).thenReturn(Optional.of(payment));

        PaymentResponseDto result = paymentService.getPaymentById(500L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(500L);
        assertThat(result.getExternalPaymentId()).isEqualTo("pi_prep_12345");
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    @DisplayName("cancelPayment: Should cancel pending payment and update status to CANCELED")
    void testCancelPendingPaymentSuccess() {
        Payment payment = new Payment(sampleSale, new BigDecimal("26.25"), "USD", "STRIPE");
        payment.setId(501L);
        payment.setExternalPaymentId("pi_prep_99999");
        payment.setStatus(PaymentStatus.PENDING);

        when(paymentRepository.findById(501L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PaymentResponseDto result = paymentService.cancelPayment(501L);

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.CANCELED);
        verify(paymentRepository).save(payment);
    }

    @Test
    @DisplayName("cancelPayment: Should throw InvalidRequestException when payment has already SUCCEEDED")
    void testCancelAlreadySucceededPaymentThrowsException() {
        Payment succeededPayment = new Payment(sampleSale, new BigDecimal("26.25"), "USD", "STRIPE");
        succeededPayment.setId(502L);
        succeededPayment.setStatus(PaymentStatus.SUCCEEDED);

        when(paymentRepository.findById(502L)).thenReturn(Optional.of(succeededPayment));

        assertThatThrownBy(() -> paymentService.cancelPayment(502L))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Cannot cancel an already completed (SUCCEEDED) payment");

        verify(paymentRepository, never()).save(any());
    }

    @Test
    @DisplayName("StripePaymentProvider: Should generate valid provider response with external reference ID")
    void testStripePaymentProviderDirectInitiate() {
        PaymentRequestDto request = new PaymentRequestDto(new BigDecimal("100.00"), "USD", 1L, "STRIPE");

        PaymentResponseDto response = stripePaymentProvider.initiatePayment(request);

        assertThat(response).isNotNull();
        assertThat(response.getProvider()).isEqualTo("STRIPE");
        assertThat(response.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(response.getAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(response.getExternalPaymentId()).startsWith("pi_prep_");
        assertThat(response.getClientSecret()).startsWith("pi_prep_secret_");
    }

    @Test
    @DisplayName("createPaymentIntent: Should create Stripe Terminal card-present PaymentIntent with trusted server-side total")
    void testCreateTerminalPaymentIntentSuccess() {
        when(saleRepository.findById(10L)).thenReturn(Optional.of(sampleSale));
        when(paymentRepository.findBySaleId(10L)).thenReturn(Collections.emptyList());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(2001L);
            return p;
        });

        com.grocerypos.payment.dto.CreatePaymentIntentRequestDto request =
                new com.grocerypos.payment.dto.CreatePaymentIntentRequestDto(10L, "test_idempotency_key_1");

        com.grocerypos.payment.dto.PaymentIntentResponseDto response = paymentService.createPaymentIntent(request);

        assertThat(response).isNotNull();
        assertThat(response.getPaymentIntentId()).startsWith("pi_term_");
        assertThat(response.getClientSecret()).contains("_secret_");
        assertThat(response.getAmount()).isEqualByComparingTo(new BigDecimal("26.25"));
        assertThat(response.getCurrency()).isEqualTo("USD");
        assertThat(response.getStatus()).isEqualTo("requires_payment_method");
        assertThat(response.getPaymentMethodTypes()).containsExactly("card_present");
        assertThat(response.getSaleId()).isEqualTo(10L);
        assertThat(response.getPaymentId()).isEqualTo(2001L);

        verify(paymentRepository).save(any(Payment.class));
    }

    @Test
    @DisplayName("createPaymentIntent: Idempotency check returns existing pending PaymentIntent without creating duplicate")
    void testCreatePaymentIntentIdempotency() {
        Payment existingPending = new Payment(sampleSale, new BigDecimal("26.25"), "USD", "STRIPE");
        existingPending.setId(3001L);
        existingPending.setExternalPaymentId("pi_term_existing_999");
        existingPending.setClientSecret("pi_term_existing_999_secret_abc");
        existingPending.setStatus(PaymentStatus.PENDING);

        when(saleRepository.findById(10L)).thenReturn(Optional.of(sampleSale));
        when(paymentRepository.findBySaleId(10L)).thenReturn(Collections.singletonList(existingPending));

        com.grocerypos.payment.dto.CreatePaymentIntentRequestDto request =
                new com.grocerypos.payment.dto.CreatePaymentIntentRequestDto(10L, "idempotency_retry_key");

        com.grocerypos.payment.dto.PaymentIntentResponseDto response = paymentService.createPaymentIntent(request);

        assertThat(response).isNotNull();
        assertThat(response.getPaymentIntentId()).isEqualTo("pi_term_existing_999");
        assertThat(response.getClientSecret()).isEqualTo("pi_term_existing_999_secret_abc");
        assertThat(response.getPaymentId()).isEqualTo(3001L);

        // Crucial: paymentRepository.save must NOT be called again
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("createPaymentIntent: Throws InvalidRequestException if sale is already CANCELLED")
    void testCreatePaymentIntentCancelledSaleThrowsException() {
        sampleSale.setStatus(SaleStatus.CANCELLED);
        when(saleRepository.findById(10L)).thenReturn(Optional.of(sampleSale));

        com.grocerypos.payment.dto.CreatePaymentIntentRequestDto request =
                new com.grocerypos.payment.dto.CreatePaymentIntentRequestDto(10L);

        assertThatThrownBy(() -> paymentService.createPaymentIntent(request))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Cannot create payment intent for a CANCELLED sale");

        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("createTerminalConnectionToken: Successfully returns only connection token secret and never persists to database")
    void testCreateTerminalConnectionTokenSuccess() {
        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "cashier_jane",
                        "password",
                        Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CASHIER"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            com.grocerypos.payment.dto.ConnectionTokenResponseDto tokenResponse =
                    paymentService.createTerminalConnectionToken(null);

            assertThat(tokenResponse).isNotNull();
            assertThat(tokenResponse.getSecret()).isNotNull();
            assertThat(tokenResponse.getSecret()).startsWith("pst_test_");
            // Must NEVER leak secret in toString()
            assertThat(tokenResponse.toString()).doesNotContain(tokenResponse.getSecret());
            assertThat(tokenResponse.toString()).contains("[PROTECTED]");

            // Guarantee: Connection tokens are ephemeral and must NEVER be persisted in payments table
            verify(paymentRepository, never()).save(any(Payment.class));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    @DisplayName("createTerminalConnectionToken: Restricts access to configured store location; throws exception on mismatch")
    void testCreateTerminalConnectionTokenLocationMismatchThrowsException() {
        stripeProperties.setTerminalLocationId("tml_store_main_101");

        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "cashier_jane",
                        "password",
                        Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CASHIER"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            assertThatThrownBy(() -> paymentService.createTerminalConnectionToken("tml_unauthorized_store_999"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("does not match the configured POS store location");

            verify(paymentRepository, never()).save(any(Payment.class));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    @DisplayName("createTerminalConnectionToken: Succeeds when requested location matches configured store location")
    void testCreateTerminalConnectionTokenLocationMatchSuccess() {
        stripeProperties.setTerminalLocationId("tml_store_main_101");

        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "cashier_jane",
                        "password",
                        Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CASHIER"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            com.grocerypos.payment.dto.ConnectionTokenResponseDto tokenResponse =
                    paymentService.createTerminalConnectionToken("tml_store_main_101");

            assertThat(tokenResponse).isNotNull();
            assertThat(tokenResponse.getSecret()).startsWith("pst_test_");
            verify(paymentRepository, never()).save(any(Payment.class));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    @DisplayName("createTerminalConnectionToken: Rejects arbitrary unprivileged user without authorized POS role")
    void testCreateTerminalConnectionTokenUnauthorizedRoleThrowsException() {
        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "customer_bob",
                        "password",
                        Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CUSTOMER"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            assertThatThrownBy(() -> paymentService.createTerminalConnectionToken(null))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("is not authorized to generate Terminal connection tokens");

            verify(paymentRepository, never()).save(any(Payment.class));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    @DisplayName("createTerminalConnectionToken: Throws IllegalStateException when missing API key in live mode")
    void testCreateTerminalConnectionTokenMissingApiKeyInLiveModeThrowsException() {
        stripeProperties.setApiKey("");
        stripeProperties.setTestMode(false);

        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "admin_alice",
                        "password",
                        Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
                );
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            assertThatThrownBy(() -> paymentService.createTerminalConnectionToken(null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Stripe secret key (STRIPE_API_KEY) is required");

            verify(paymentRepository, never()).save(any(Payment.class));
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    private String computeStripeSignature(String payload, long timestamp, String secret) {
        String payloadToSign = timestamp + "." + payload;
        try {
            javax.crypto.Mac hmac = javax.crypto.Mac.getInstance("HmacSHA256");
            javax.crypto.spec.SecretKeySpec secretKey =
                    new javax.crypto.spec.SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(payloadToSign.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) sb.append('0');
                sb.append(hex);
            }
            return "t=" + timestamp + ",v1=" + sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    @DisplayName("processStripeWebhook: Valid signature on payment_intent.succeeded updates payment and sale")
    void testProcessStripeWebhookValidSignatureSucceeded() {
        Payment pendingPayment = new Payment();
        pendingPayment.setId(501L);
        pendingPayment.setExternalPaymentId("pi_test_valid_123");
        pendingPayment.setStatus(PaymentStatus.PENDING);
        pendingPayment.setSale(sampleSale);

        when(paymentRepository.findByExternalPaymentId("pi_test_valid_123")).thenReturn(Optional.of(pendingPayment));

        long nowSec = java.time.Instant.now().getEpochSecond();
        String payload = "{" +
                "\"id\":\"evt_test_valid_101\"," +
                "\"object\":\"event\"," +
                "\"type\":\"payment_intent.succeeded\"," +
                "\"data\":{" +
                "  \"object\":{" +
                "    \"id\":\"pi_test_valid_123\"," +
                "    \"amount\":2625," +
                "    \"currency\":\"usd\"," +
                "    \"status\":\"succeeded\"" +
                "  }" +
                "}" +
                "}";

        String signatureHeader = computeStripeSignature(payload, nowSec, "whsec_test_mockTestKey");

        paymentService.processStripeWebhook(payload, signatureHeader);

        assertThat(pendingPayment.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        verify(paymentRepository).save(pendingPayment);
    }

    @Test
    @DisplayName("processStripeWebhook: Invalid signature throws InvalidRequestException")
    void testProcessStripeWebhookInvalidSignatureThrowsException() {
        long nowSec = java.time.Instant.now().getEpochSecond();
        String payload = "{\"id\":\"evt_test_bad_102\",\"object\":\"event\",\"type\":\"payment_intent.succeeded\"}";
        String badHeader = "t=" + nowSec + ",v1=0000000000000000000000000000000000000000000000000000000000000000";

        assertThatThrownBy(() -> paymentService.processStripeWebhook(payload, badHeader))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Invalid Stripe webhook signature");

        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("processStripeWebhook: Repeated events are deduplicated without re-updating state")
    void testProcessStripeWebhookRepeatedEventsDeduplicated() {
        Payment pendingPayment = new Payment();
        pendingPayment.setId(502L);
        pendingPayment.setExternalPaymentId("pi_test_dedup_201");
        pendingPayment.setStatus(PaymentStatus.PENDING);

        when(paymentRepository.findByExternalPaymentId("pi_test_dedup_201")).thenReturn(Optional.of(pendingPayment));

        long nowSec = java.time.Instant.now().getEpochSecond();
        String payload = "{" +
                "\"id\":\"evt_test_duplicate_999\"," +
                "\"object\":\"event\"," +
                "\"type\":\"payment_intent.succeeded\"," +
                "\"data\":{" +
                "  \"object\":{" +
                "    \"id\":\"pi_test_dedup_201\"," +
                "    \"status\":\"succeeded\"" +
                "  }" +
                "}" +
                "}";

        String signatureHeader = computeStripeSignature(payload, nowSec, "whsec_test_mockTestKey");

        // First delivery: processes successfully
        paymentService.processStripeWebhook(payload, signatureHeader);
        assertThat(pendingPayment.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        verify(paymentRepository, times(1)).save(pendingPayment);

        // Second delivery: deduplicated, no additional save
        paymentService.processStripeWebhook(payload, signatureHeader);
        verify(paymentRepository, times(1)).save(pendingPayment);
    }

    @Test
    @DisplayName("processStripeWebhook: payment_intent.payment_failed updates status to FAILED and stores error message")
    void testProcessStripeWebhookPaymentFailed() {
        Payment pendingPayment = new Payment();
        pendingPayment.setId(503L);
        pendingPayment.setExternalPaymentId("pi_test_failed_301");
        pendingPayment.setStatus(PaymentStatus.PENDING);

        when(paymentRepository.findByExternalPaymentId("pi_test_failed_301")).thenReturn(Optional.of(pendingPayment));

        long nowSec = java.time.Instant.now().getEpochSecond();
        String payload = "{" +
                "\"id\":\"evt_test_fail_777\"," +
                "\"object\":\"event\"," +
                "\"type\":\"payment_intent.payment_failed\"," +
                "\"data\":{" +
                "  \"object\":{" +
                "    \"id\":\"pi_test_failed_301\"," +
                "    \"status\":\"requires_payment_method\"," +
                "    \"last_payment_error\":{" +
                "      \"message\":\"Card was declined by the issuer\"" +
                "    }" +
                "  }" +
                "}" +
                "}";

        String signatureHeader = computeStripeSignature(payload, nowSec, "whsec_test_mockTestKey");

        paymentService.processStripeWebhook(payload, signatureHeader);

        assertThat(pendingPayment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(pendingPayment.getErrorMessage()).isEqualTo("Card was declined by the issuer");
        verify(paymentRepository).save(pendingPayment);
    }
}
