package com.grocerypos.payment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Optional request payload for requesting a Stripe Terminal connection token.
 * Allows POS clients to request a token scoped to a specific store location.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectionTokenRequestDto {

    /**
     * Stripe Terminal Location ID (e.g. tml_123 or loc_123) or POS store identifier.
     */
    @JsonAlias({"locationId", "location_id", "storeId", "store_id"})
    private String location;

    public ConnectionTokenRequestDto() {
    }

    public ConnectionTokenRequestDto(String location) {
        this.location = location;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getEffectiveLocation() {
        return location != null && !location.isBlank() ? location.trim() : null;
    }
}
