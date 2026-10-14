package com.grocerypos.auth.controller;

import com.grocerypos.auth.dto.UserDto;
import com.grocerypos.auth.entity.Role;
import com.grocerypos.auth.entity.User;
import com.grocerypos.auth.repository.UserRepository;
import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * User Management Controller protected by Role-Based Access Control (RBAC).
 * Only OWNER and ADMIN roles are authorized to manage users, roles, and account status.
 * CASHIER role access results in 403 Forbidden.
 */
@RestController
@RequestMapping({"/api/v1/users", "/api/users"})
@Tag(name = "User Management", description = "RBAC-protected user administration endpoints (OWNER/ADMIN only)")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public static class CreateUserRequest {
        @NotBlank(message = "Username is required")
        private String username;
        @NotBlank(message = "Password is required")
        private String password;
        @NotBlank(message = "Full name is required")
        private String fullName;
        private String email;
        @NotBlank(message = "Role is required (ROLE_OWNER, ROLE_ADMIN, ROLE_CASHIER)")
        private String role;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public static class UpdateRoleRequest {
        @NotBlank(message = "Role is required")
        private String role;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public static class UpdateStatusRequest {
        private boolean enabled;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }

    @GetMapping
    @Operation(summary = "List all users", description = "Requires OWNER or ADMIN role")
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        List<UserDto> users = userRepository.findAll().stream()
                .map(UserDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(users, "Users retrieved successfully"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID", description = "Requires OWNER or ADMIN role")
    public ResponseEntity<ApiResponse<UserDto>> getUserById(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return ResponseEntity.ok(ApiResponse.success(UserDto.fromEntity(user), "User found"));
    }

    @PostMapping
    @Operation(summary = "Create a new user", description = "Requires OWNER or ADMIN role. Passwords are encrypted with BCrypt.")
    public ResponseEntity<ApiResponse<UserDto>> createUser(@Valid @RequestBody CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new InvalidRequestException("Username '" + request.getUsername() + "' is already taken");
        }

        Role assignedRole;
        try {
            String roleStr = request.getRole().toUpperCase();
            if (!roleStr.startsWith("ROLE_")) {
                roleStr = "ROLE_" + roleStr;
            }
            assignedRole = Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Invalid role. Must be ROLE_OWNER, ROLE_ADMIN, or ROLE_CASHIER");
        }

        User newUser = new User(
                request.getUsername().trim(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName().trim(),
                request.getEmail() != null ? request.getEmail().trim() : null,
                assignedRole
        );

        User saved = userRepository.save(newUser);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(UserDto.fromEntity(saved), "User created successfully with role " + assignedRole.name()));
    }

    @PutMapping("/{id}/role")
    @Operation(summary = "Update user role", description = "Requires OWNER or ADMIN role")
    public ResponseEntity<ApiResponse<UserDto>> updateUserRole(@PathVariable Long id, @Valid @RequestBody UpdateRoleRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        Role newRole;
        try {
            String roleStr = request.getRole().toUpperCase();
            if (!roleStr.startsWith("ROLE_")) {
                roleStr = "ROLE_" + roleStr;
            }
            newRole = Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Invalid role. Must be ROLE_OWNER, ROLE_ADMIN, or ROLE_CASHIER");
        }

        user.setRole(newRole);
        User updated = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(UserDto.fromEntity(updated), "User role updated to " + newRole.name()));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Enable or disable user account", description = "Requires OWNER or ADMIN role")
    public ResponseEntity<ApiResponse<UserDto>> updateUserStatus(@PathVariable Long id, @RequestBody UpdateStatusRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        user.setEnabled(request.isEnabled());
        User updated = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(UserDto.fromEntity(updated),
                "User status updated to " + (request.isEnabled() ? "Active" : "Disabled")));
    }
}
