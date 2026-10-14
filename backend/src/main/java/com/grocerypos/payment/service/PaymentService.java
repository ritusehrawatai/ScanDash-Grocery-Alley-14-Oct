package com.grocerypos.payment.service;

import com.grocerypos.payment.dto.ConnectionTokenResponseDto;
import com.grocerypos.payment.dto.CreatePaymentIntentRequestDto;
import com.grocerypos.payment.dto.PaymentIntentResponseDto;
import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;

import java.util.List;

/**
 * Service interface for POS payment operations.
 * Coordinates with pluggable PaymentProviders (Stripe, etc.) and persists payment records.
 */
public interface PaymentService {

    /**
     * Initiates a payment session with the specified provider (defaults to STRIPE).
     */
    PaymentResponseDto initiatePayment(PaymentRequestDto request, String providerName);

    /**
     * Creates a Stripe Terminal card-present PaymentIntent for an existing checkout/sale.
     * Calculates the amount strictly server-side from trusted product prices, quantities, and taxes.
     * Uses idempotency handling to prevent accidental duplicate payment intents.
     * Does NOT deduct inventory or mark the sale completed at this stage.
     */
    PaymentIntentResponseDto createPaymentIntent(CreatePaymentIntentRequestDto request);

    /**
     * Generates a Stripe Terminal connection token for connecting POS readers via Terminal JavaScript SDK.
     * Authenticated and authorized cashiers and managers only.
     * Returns strictly the connection-token secret without persisting or logging it.
     */
    ConnectionTokenResponseDto createTerminalConnectionToken(String locationId);

    /**
     * Retrieves payment details by internal database ID.
     */
    PaymentResponseDto getPaymentById(Long id);

    /**
     * Retrieves payment details by external provider reference ID (e.g. pi_...).
     */
    PaymentResponseDto getPaymentByExternalId(String externalPaymentId);

    /**
     * Retrieves all payments associated with a sale/order.
     */
    List<PaymentResponseDto> getPaymentsBySaleId(Long saleId);

    /**
     * Cancels an initiated/pending payment.
     */
    PaymentResponseDto cancelPayment(Long paymentId);

    /**
     * Server-side verification of payment confirmation status with the payment provider.
     * Prevents trusting client-side claims alone for marking payment succeeded.
     */
    PaymentResponseDto verifyPayment(Long paymentId);

    /**
     * Cryptographically verifies Stripe webhook signatures, deduplicates events by event ID,
     * matches events to local payment and sale records, and updates payment/sale status consistently.
     *
     * @param rawPayload      The exact raw JSON body payload received from Stripe
     * @param signatureHeader The Stripe-Signature header string (t=...,v1=...)
     */
    void processStripeWebhook(String rawPayload, String signatureHeader);
}
