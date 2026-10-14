package com.grocerypos.auth.service;

import com.grocerypos.auth.dto.LoginRequestDto;
import com.grocerypos.auth.dto.LoginResponseDto;
import com.grocerypos.auth.dto.UserDto;
import com.grocerypos.auth.entity.Role;
import com.grocerypos.auth.entity.User;
import com.grocerypos.auth.repository.UserRepository;
import com.grocerypos.auth.security.JwtTokenProvider;
import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthServiceImpl(AuthenticationManager authenticationManager,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtTokenProvider tokenProvider) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostConstruct
    public void init() {
        initializeDefaultUsers();
    }

    @Override
    @Transactional(readOnly = true)
    public LoginResponseDto login(LoginRequestDto request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new InvalidRequestException("Invalid username or password"));

        if (!user.isEnabled()) {
            throw new InvalidRequestException("User account is disabled");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
        } catch (BadCredentialsException ex) {
            throw new InvalidRequestException("Invalid username or password");
        }

        String token = tokenProvider.generateToken(user.getUsername(), user.getRole().name());
        long expiresIn = tokenProvider.getExpirationDuration();

        return new LoginResponseDto(token, expiresIn, UserDto.fromEntity(user));
    }

    @Override
    public void logout(String token) {
        // Stateless JWT logout is handled on client by clearing the stored token.
        // Server-side invalidation can also track blacklisted tokens if stateful logout is required.
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
        return UserDto.fromEntity(user);
    }

    @Override
    @Transactional
    public void initializeDefaultUsers() {
        // 0. Owner account: owner / Owner@123
        if (!userRepository.existsByUsername("owner")) {
            User owner = new User(
                    "owner",
                    passwordEncoder.encode("Owner@123"),
                    "Store Owner",
                    "owner@freshcartpos.com",
                    Role.ROLE_OWNER
            );
            userRepository.save(owner);
        }

        // 1. Admin account: admin / Admin@123
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User(
                    "admin",
                    passwordEncoder.encode("Admin@123"),
                    "System Administrator",
                    "admin@freshcartpos.com",
                    Role.ROLE_ADMIN
            );
            userRepository.save(admin);
        }

        // 2. Manager account: manager / Manager@123
        if (!userRepository.existsByUsername("manager")) {
            User manager = new User(
                    "manager",
                    passwordEncoder.encode("Manager@123"),
                    "Store Manager",
                    "manager@freshcartpos.com",
                    Role.ROLE_MANAGER
            );
            userRepository.save(manager);
        }

        // 3. Cashier account: cashier / Cashier@123
        if (!userRepository.existsByUsername("cashier")) {
            User cashier = new User(
                    "cashier",
                    passwordEncoder.encode("Cashier@123"),
                    "Lead Cashier",
                    "cashier@freshcartpos.com",
                    Role.ROLE_CASHIER
            );
            userRepository.save(cashier);
        }
    }
}
