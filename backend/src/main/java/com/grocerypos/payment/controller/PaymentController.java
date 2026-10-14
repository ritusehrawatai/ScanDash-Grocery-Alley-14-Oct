package com.grocerypos.payment.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.payment.config.StripeProperties;
import com.grocerypos.payment.dto.ConnectionTokenRequestDto;
import com.grocerypos.payment.dto.ConnectionTokenResponseDto;
import com.grocerypos.payment.dto.PaymentConfigResponseDto;
import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;
import com.grocerypos.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "Payment Processing API", description = "Endpoints for initiating and querying POS payments (Stripe foundation)")
public class PaymentController {

    private final PaymentService paymentService;
    private final StripeProperties stripeProperties;

    @Autowired
    public PaymentController(PaymentService paymentService, StripeProperties stripeProperties) {
        this.paymentService = paymentService;
        this.stripeProperties = stripeProperties;
    }

    /**
     * Retrieves client-safe public Stripe configuration (publishable key, test mode, currency).
     * Guaranteed: Secrets (apiKey, webhookSecret) are NEVER exposed.
     * GET /api/v1/payments/config
     */
    @GetMapping("/config")
    @Operation(summary = "Get Public Payment Configuration", description = "Retrieves client-safe public Stripe configuration. Secret keys are never exposed.")
    public ResponseEntity<ApiResponse<PaymentConfigResponseDto>> getPublicConfig() {
        PaymentConfigResponseDto config = new PaymentConfigResponseDto(
                stripeProperties.getPublishableKey(),
                stripeProperties.getCurrency(),
                stripeProperties.isTestMode()
        );
        return ResponseEntity.ok(ApiResponse.ok(config, "Public payment configuration retrieved successfully"));
    }

    /**
     * Initiates a payment transaction with a modular provider (defaults to Stripe).
     * POST /api/v1/payments/initiate
     */
    @PostMapping("/initiate")
    @Operation(summary = "Initiate Payment", description = "Prepares a payment transaction linked to a sale using the configured provider abstraction")
    public ResponseEntity<ApiResponse<PaymentResponseDto>> initiatePayment(
            @Valid @RequestBody PaymentRequestDto request,
            @RequestParam(required = false, defaultValue = "STRIPE") String provider) {
        PaymentResponseDto response = paymentService.initiatePayment(request, provider);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response, "Payment initiated successfully with provider " + response.getProvider()));
    }

    /**
     * Creates a Stripe PaymentIntent for an existing checkout/sale suitable for Stripe Terminal card-present payments.
     * Computes the trusted amount exclusively on the backend from product catalog prices, quantities, and taxes.
     * Guarantees safe idempotency, stores PaymentIntent against local payment record, and does NOT deduct inventory.
     * POST /api/v1/payments/create-payment-intent
     */
    @PostMapping(path = {"/create-payment-intent", "/payment-intent"})
    @Operation(summary = "Create Terminal PaymentIntent", description = "Creates a Stripe Terminal card-present PaymentIntent for an existing checkout/sale with backend price calculation and idempotency protection")
    public ResponseEntity<ApiResponse<com.grocerypos.payment.dto.PaymentIntentResponseDto>> createPaymentIntent(
            @RequestBody com.grocerypos.payment.dto.CreatePaymentIntentRequestDto request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKeyHeader) {
        if (request == null) {
            request = new com.grocerypos.payment.dto.CreatePaymentIntentRequestDto();
        }
        if ((request.getIdempotencyKey() == null || request.getIdempotencyKey().isBlank()) && idempotencyKeyHeader != null) {
            request.setIdempotencyKey(idempotencyKeyHeader.trim());
        }
        com.grocerypos.payment.dto.PaymentIntentResponseDto response = paymentService.createPaymentIntent(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response, "Stripe Terminal PaymentIntent created successfully"));
    }

    /**
     * Generates an ephemeral Stripe Terminal connection token for connecting POS card readers.
     * Required by the official Stripe Terminal JavaScript SDK (terminal.create({ onFetchConnectionToken })).
     *
     * Security & RBAC:
     * - Restricts access to authenticated, authorized POS users (CASHIER, ADMIN, OWNER, MANAGER).
     * - Restricts readers to the authorized store/location configured in STRIPE_TERMINAL_LOCATION_ID.
     * - Returns strictly the connection-token secret required by the Terminal SDK.
     * - Connection tokens are ephemeral and are NEVER logged or persisted.
     *
     * POST /api/v1/payments/terminal/connection-token
     */
    @PostMapping(path = {"/terminal/connection-token", "/terminal/connection_token", "/connection-token"})
    @PreAuthorize("hasAnyRole('CASHIER', 'ADMIN', 'OWNER', 'MANAGER')")
    @Operation(summary = "Generate Stripe Terminal Connection Token",
            description = "Generates an ephemeral connection token secret for the Stripe Terminal JavaScript SDK. Requires authorized POS cashier credentials. Secrets are never persisted or logged.")
    public ResponseEntity<ConnectionTokenResponseDto> createConnectionToken(
            @RequestBody(required = false) ConnectionTokenRequestDto request) {
        String locationId = (request != null) ? request.getEffectiveLocation() : null;
        ConnectionTokenResponseDto response = paymentService.createTerminalConnectionToken(locationId);
        return ResponseEntity.ok(response);
    }


    /**
     * Retrieves payment details by ID.
     * GET /api/v1/payments/{id}
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get Payment by ID", description = "Retrieves payment details by internal database ID")
    public ResponseEntity<ApiResponse<PaymentResponseDto>> getPaymentById(@PathVariable Long id) {
        PaymentResponseDto payment = paymentService.getPaymentById(id);
        return ResponseEntity.ok(ApiResponse.ok(payment, "Payment retrieved successfully"));
    }

    /**
     * Retrieves payments associated with a sale ID.
     * GET /api/v1/payments/sale/{saleId}
     */
    @GetMapping("/sale/{saleId}")
    @Operation(summary = "Get Payments for Sale", description = "Retrieves all payment transactions associated with a given sale ID")
    public ResponseEntity<ApiResponse<List<PaymentResponseDto>>> getPaymentsBySaleId(@PathVariable Long saleId) {
        List<PaymentResponseDto> payments = paymentService.getPaymentsBySaleId(saleId);
        return ResponseEntity.ok(ApiResponse.ok(payments, "Payments for sale retrieved successfully"));
    }

    /**
     * Retrieves payment details by external provider reference ID (e.g. pi_...).
     * GET /api/v1/payments/external/{externalId}
     */
    @GetMapping("/external/{externalId}")
    @Operation(summary = "Get Payment by External Reference ID", description = "Retrieves payment by provider external reference ID (e.g. Stripe PaymentIntent ID)")
    public ResponseEntity<ApiResponse<PaymentResponseDto>> getPaymentByExternalId(@PathVariable String externalId) {
        PaymentResponseDto payment = paymentService.getPaymentByExternalId(externalId);
        return ResponseEntity.ok(ApiResponse.ok(payment, "Payment retrieved successfully"));
    }

    /**
     * Cancels an initiated payment.
     * POST /api/v1/payments/{id}/cancel
     */
    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel Payment", description = "Cancels a pending payment transaction")
    public ResponseEntity<ApiResponse<PaymentResponseDto>> cancelPayment(@PathVariable Long id) {
        PaymentResponseDto payment = paymentService.cancelPayment(id);
        return ResponseEntity.ok(ApiResponse.ok(payment, "Payment canceled successfully"));
    }

    /**
     * Verifies payment completion status with the payment provider.
     * Prevents client-side claims from being the sole authority for marking payment succeeded.
     * POST /api/v1/payments/{id}/verify
     */
    @PostMapping(path = {"/{id}/verify", "/{id}/confirm"})
    @Operation(summary = "Verify Payment Status", description = "Validates with payment provider and updates payment record to SUCCEEDED once confirmed")
    public ResponseEntity<ApiResponse<PaymentResponseDto>> verifyPayment(@PathVariable Long id) {
        PaymentResponseDto payment = paymentService.verifyPayment(id);
        return ResponseEntity.ok(ApiResponse.ok(payment, "Payment verified successfully as " + payment.getStatus()));
    }

    /**
     * Exact webhook endpoint for receiving asynchronous events from Stripe (e.g. payment_intent.succeeded).
     * Exempt from Bearer JWT authentication; verified cryptographically via the Stripe-Signature header.
     * POST /api/v1/payments/webhook
     */
    @PostMapping(path = {"/webhook", "/stripe/webhook"})
    @Operation(summary = "Stripe Webhook Receiver", description = "Receives signed asynchronous event notifications from Stripe. Verified via Stripe-Signature header.")
    public ResponseEntity<String> handleWebhook(
            @RequestBody(required = false) String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {
        paymentService.processStripeWebhook(payload, sigHeader);
        return ResponseEntity.ok("{\"status\":\"received\"}");
    }
}
