package com.grocerypos.auth.service;

import com.grocerypos.auth.dto.LoginRequestDto;
import com.grocerypos.auth.dto.LoginResponseDto;
import com.grocerypos.auth.dto.UserDto;

public interface AuthService {
    LoginResponseDto login(LoginRequestDto request);
    void logout(String token);
    UserDto getCurrentUser(String username);
    void initializeDefaultUsers();
}
