package com.grocerypos.config;

import com.grocerypos.auth.security.JwtAuthenticationEntryPoint;
import com.grocerypos.auth.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 6.x Configuration for FreshCart POS.
 * Enforces stateless JWT authentication, BCrypt password hashing, and endpoint protection.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationEntryPoint unauthorizedHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationEntryPoint unauthorizedHandler,
                          JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.unauthorizedHandler = unauthorizedHandler;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    /**
     * BCrypt Password Encoder bean.
     * Ensures passwords are never stored in plain text and are strongly salted & hashed.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Allow CORS pre-flight requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Public Health & Heartbeat APIs
                .requestMatchers("/api/v1/health/**", "/api/health/**").permitAll()

                // Public Auth endpoints (Login & Public Me check)
                .requestMatchers("/api/v1/auth/login", "/api/auth/login").permitAll()

                // Public OpenAPI / Swagger Documentation
                .requestMatchers(
                    "/api-docs/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**",
                    "/api/v1/docs/**"
                ).permitAll()

                // Public Stripe Webhook Endpoint (verified via Stripe-Signature header, not JWT)
                .requestMatchers(HttpMethod.POST, "/api/v1/payments/webhook", "/api/payments/webhook", "/api/v1/payments/stripe/webhook").permitAll()

                // ==========================================
                // Role-Based Access Control (RBAC) Enforcement
                // ==========================================

                // 1. CASHIER and OWNER/ADMIN accessible endpoints:
                // - Product lookup, barcode search, voice search
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**", "/api/products/**").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/v1/products/voice-search", "/api/products/voice-search").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/v1/products/search", "/api/products/search").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                
                // - POS Terminal checkout and sales receipts
                .requestMatchers(HttpMethod.POST, "/api/v1/sales/**", "/api/sales/**").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/v1/sales/**", "/api/sales/**").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")

                // - POS Payments initiation, Terminal connection tokens, and querying
                .requestMatchers(HttpMethod.POST, "/api/v1/payments/**", "/api/payments/**", "/api/v1/terminal/**", "/api/terminal/**").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                .requestMatchers(HttpMethod.GET, "/api/v1/payments/**", "/api/payments/**", "/api/v1/terminal/**", "/api/terminal/**").hasAnyRole("CASHIER", "ADMIN", "OWNER", "MANAGER")
                
                // - User profile self-service & logout
                .requestMatchers("/api/v1/auth/me", "/api/auth/me", "/api/v1/auth/logout", "/api/auth/logout").authenticated()

                // 2. OWNER & ADMIN restricted endpoints (CASHIER forbidden!):
                // - Products modifications (Create, Update, Delete) & Inventory Thresholds
                .requestMatchers(HttpMethod.POST, "/api/v1/products/**", "/api/products/**").hasAnyRole("ADMIN", "OWNER")
                .requestMatchers(HttpMethod.PUT, "/api/v1/products/**", "/api/products/**").hasAnyRole("ADMIN", "OWNER")
                .requestMatchers(HttpMethod.DELETE, "/api/v1/products/**", "/api/products/**").hasAnyRole("ADMIN", "OWNER")

                // - Inventory stock adjustments, purchase recordings, audits & thresholds
                .requestMatchers("/api/v1/inventory/**", "/api/inventory/**").hasAnyRole("ADMIN", "OWNER")

                // - Invoices OCR upload, processing, and management
                .requestMatchers("/api/v1/invoices/**", "/api/invoices/**").hasAnyRole("ADMIN", "OWNER")

                // - Business Reports (Daily, Weekly, Monthly, Sales, Revenue, CSV Export)
                .requestMatchers("/api/v1/reports/**", "/api/reports/**").hasAnyRole("ADMIN", "OWNER")

                // - Stock Notifications management & alert thresholds
                .requestMatchers("/api/v1/notifications/**", "/api/notifications/**").hasAnyRole("ADMIN", "OWNER")

                // - User Management (List users, create user, update roles, disable accounts)
                .requestMatchers("/api/v1/users/**", "/api/users/**").hasAnyRole("ADMIN", "OWNER")

                // - Audit Logs Trail (List, view, and CSV export)
                .requestMatchers("/api/v1/audit-logs/**", "/api/audit-logs/**").hasAnyRole("ADMIN", "OWNER")

                // Protect all other business REST APIs
                .requestMatchers("/api/**").authenticated()

                // Any other request
                .anyRequest().permitAll()
            );

        // Add custom JWT filter before standard UsernamePasswordAuthenticationFilter
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
