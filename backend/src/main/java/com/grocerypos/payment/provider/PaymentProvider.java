package com.grocerypos.payment.provider;

import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;

/**
 * Provider SPI interface for payment gateways.
 * Keeps POS business and checkout logic decoupled from concrete payment vendors.
 */
public interface PaymentProvider {

    /**
     * Unique identifier for the payment provider (e.g. "STRIPE", "SQUARE").
     */
    String getProviderName();

    /**
     * Initiates a payment session/intent with the gateway.
     */
    PaymentResponseDto initiatePayment(PaymentRequestDto request);

    /**
     * Retrieves the latest status of a payment from the gateway.
     */
    PaymentResponseDto getPaymentStatus(String externalPaymentId);

    /**
     * Cancels an in-flight or uncaptured payment.
     */
    PaymentResponseDto cancelPayment(String externalPaymentId);

    /**
     * Creates a card-present PaymentIntent suitable for Stripe Terminal or in-person reader devices.
     */
    default com.grocerypos.payment.dto.PaymentIntentResponseDto createTerminalPaymentIntent(
            com.grocerypos.sale.entity.Sale sale,
            java.math.BigDecimal trustedAmount,
            String currency,
            String idempotencyKey) {
        throw new UnsupportedOperationException("Terminal payment intents not supported by provider " + getProviderName());
    }

    /**
     * Creates an ephemeral connection token secret for the Stripe Terminal JavaScript SDK.
     * Guarantees: Never exposes secret keys or logs sensitive credentials.
     *
     * @param locationId Optional store or reader location identifier
     * @return ConnectionTokenResponseDto with only the connection token secret
     */
    default com.grocerypos.payment.dto.ConnectionTokenResponseDto createTerminalConnectionToken(String locationId) {
        throw new UnsupportedOperationException("Terminal connection tokens not supported by provider " + getProviderName());
    }
}

