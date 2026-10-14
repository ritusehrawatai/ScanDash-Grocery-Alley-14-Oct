package com.grocerypos.auth.controller;

import com.grocerypos.auth.dto.LoginRequestDto;
import com.grocerypos.auth.dto.LoginResponseDto;
import com.grocerypos.auth.dto.UserDto;
import com.grocerypos.auth.service.AuthService;
import com.grocerypos.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
@Tag(name = "Authentication API", description = "Spring Security endpoints for login, logout, and authenticated user access")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "User Login", description = "Authenticates user credentials using Spring Security and returns JWT Bearer token")
    public ResponseEntity<ApiResponse<LoginResponseDto>> login(@Valid @RequestBody LoginRequestDto request) {
        LoginResponseDto response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok(response, "Authentication successful"));
    }

    @PostMapping("/logout")
    @Operation(summary = "User Logout", description = "Logs out current user and invalidates authentication session")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
        authService.logout(token);
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(ApiResponse.ok(null, "Logged out successfully"));
    }

    @GetMapping("/me")
    @Operation(summary = "Current User Profile", description = "Retrieves authenticated user details from SecurityContext")
    public ResponseEntity<ApiResponse<UserDto>> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized: No authenticated user session"));
        }

        String username = authentication.getName();
        UserDto userDto = authService.getCurrentUser(username);
        return ResponseEntity.ok(ApiResponse.ok(userDto, "Authenticated user retrieved"));
    }
}
