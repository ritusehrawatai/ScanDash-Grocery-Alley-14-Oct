package com.grocerypos.auth;

import com.grocerypos.auth.dto.LoginRequestDto;
import com.grocerypos.auth.dto.LoginResponseDto;
import com.grocerypos.auth.entity.Role;
import com.grocerypos.auth.entity.User;
import com.grocerypos.auth.repository.UserRepository;
import com.grocerypos.auth.security.JwtTokenProvider;
import com.grocerypos.auth.service.AuthServiceImpl;
import com.grocerypos.common.exception.InvalidRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @InjectMocks
    private AuthServiceImpl authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User(
                "admin",
                "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // Sample BCrypt hash
                "System Administrator",
                "admin@freshcartpos.com",
                Role.ROLE_ADMIN
        );
    }

    @Test
    @DisplayName("Should successfully authenticate valid credentials and return JWT token")
    void testSuccessfulLogin() {
        LoginRequestDto request = new LoginRequestDto("admin", "Admin@123");

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(sampleUser));
        when(tokenProvider.generateToken("admin", "ROLE_ADMIN")).thenReturn("mock.jwt.token");
        when(tokenProvider.getExpirationDuration()).thenReturn(86400L);

        LoginResponseDto response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock.jwt.token", response.getToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals("admin", response.getUser().getUsername());
        assertEquals("ROLE_ADMIN", response.getUser().getRole());
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }

    @Test
    @DisplayName("Should reject authentication when password does not match")
    void testFailedLoginWithBadCredentials() {
        LoginRequestDto request = new LoginRequestDto("admin", "WrongPassword");

        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(sampleUser));
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(InvalidRequestException.class, () -> authService.login(request));
    }

    @Test
    @DisplayName("Should reject login for non-existent user")
    void testUserNotFoundLogin() {
        LoginRequestDto request = new LoginRequestDto("unknown", "Password123");

        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThrows(InvalidRequestException.class, () -> authService.login(request));
    }

    @Test
    @DisplayName("Should ensure passwords are never saved in plain text during user initialization")
    void testPasswordIsHashedWithBCrypt() {
        when(userRepository.existsByUsername("owner")).thenReturn(false);
        when(userRepository.existsByUsername("admin")).thenReturn(false);
        when(userRepository.existsByUsername("manager")).thenReturn(false);
        when(userRepository.existsByUsername("cashier")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$hashedPasswordSample");

        authService.initializeDefaultUsers();

        verify(passwordEncoder, atLeast(4)).encode(anyString());
        verify(userRepository, times(4)).save(argThat(user ->
                user.getPassword().startsWith("$2a$10$") && !user.getPassword().equals("Admin@123")
        ));
    }
}
