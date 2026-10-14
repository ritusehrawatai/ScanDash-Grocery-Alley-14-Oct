package com.grocerypos.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grocerypos.auth.controller.AuthController;
import com.grocerypos.auth.dto.LoginRequestDto;
import com.grocerypos.auth.dto.LoginResponseDto;
import com.grocerypos.auth.dto.UserDto;
import com.grocerypos.auth.service.AuthService;
import com.grocerypos.common.exception.InvalidRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @Test
    @DisplayName("POST /api/v1/auth/login returns 200 with JWT token")
    void testLoginSuccess() throws Exception {
        LoginRequestDto request = new LoginRequestDto("admin", "Admin@123");
        UserDto userDto = new UserDto(1L, "admin", "System Administrator", "admin@freshcartpos.com", "ROLE_ADMIN", true);
        LoginResponseDto response = new LoginResponseDto("mock.jwt.token", 86400L, userDto);

        when(authService.login(any(LoginRequestDto.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("mock.jwt.token"))
                .andExpect(jsonPath("$.data.user.username").value("admin"))
                .andExpect(jsonPath("$.data.user.role").value("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login with invalid credentials returns 400")
    void testLoginInvalidCredentials() throws Exception {
        LoginRequestDto request = new LoginRequestDto("admin", "WrongPass");

        when(authService.login(any(LoginRequestDto.class)))
                .thenThrow(new InvalidRequestException("Invalid username or password"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("POST /api/v1/auth/logout succeeds with 200")
    void testLogoutSuccess() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", "Bearer mock.jwt.token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Logged out successfully"));
    }
}
