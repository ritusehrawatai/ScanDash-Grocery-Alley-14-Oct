package com.grocerypos.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Clean response DTO returned strictly to the Stripe Terminal JavaScript SDK.
 * Contains only the ephemeral connection-token secret.
 *
 * Guarantees:
 * - Never includes backend API keys, secrets, or internal user credentials.
 * - Masked in toString() to prevent accidental leakage into logs.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConnectionTokenResponseDto {

    /**
     * Ephemeral Stripe Terminal connection token secret string (e.g. pst_test_... or pst_live_...).
     * Required by StripeTerminal.create({ onFetchConnectionToken }).
     */
    private String secret;

    public ConnectionTokenResponseDto() {
    }

    public ConnectionTokenResponseDto(String secret) {
        this.secret = secret;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    /**
     * Defense-in-depth: Never log the actual secret even if this DTO is passed to a logger.
     */
    @Override
    public String toString() {
        return "ConnectionTokenResponseDto{secret='[PROTECTED]'}";
    }
}
