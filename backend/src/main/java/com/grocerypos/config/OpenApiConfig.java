package com.grocerypos.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 / Swagger Documentation Configuration.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI groceryPosOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("FreshCart Grocery Store POS API")
                        .description("REST API for Grocery Store POS System architecture including Health Check, " +
                                "planned Product Catalog, Inventory, Invoices with Tesseract OCR, POS Checkout, and Reports.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("FreshCart POS Engineering")
                                .email("engineering@freshcart-pos.local"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://spring.io")));
    }
}
