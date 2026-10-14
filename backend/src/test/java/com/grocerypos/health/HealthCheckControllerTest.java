package com.grocerypos.health;

import com.grocerypos.health.controller.HealthCheckController;
import com.grocerypos.health.dto.HealthStatusDto;
import com.grocerypos.health.service.HealthCheckService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
public class HealthCheckControllerTest {

    private MockMvc mockMvc;

    @Mock
    private HealthCheckService healthCheckService;

    @InjectMocks
    private HealthCheckController healthCheckController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(healthCheckController).build();
    }

    @Test
    @DisplayName("GET /api/v1/health should return UP status and healthy response")
    void testGetHealthStatus() throws Exception {
        HealthStatusDto mockStatus = new HealthStatusDto();
        mockStatus.setStatus("UP");
        mockStatus.setService("grocery-pos-backend");
        mockStatus.setVersion("1.0.0-SNAPSHOT");
        mockStatus.setEnvironment("test");
        mockStatus.setUptimeSeconds(120);
        mockStatus.setDatabase(new HealthStatusDto.DatabaseHealthDto("CONNECTED", "PostgreSQL 15", "jdbc:postgresql://localhost:5432/grocerypos"));
        mockStatus.setMemory(new HealthStatusDto.SystemMemoryDto(256, 128, 512));
        mockStatus.setModules(Collections.singletonMap("core-architecture", "READY"));

        when(healthCheckService.checkHealth()).thenReturn(mockStatus);

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.status", is("UP")))
                .andExpect(jsonPath("$.data.service", is("grocery-pos-backend")))
                .andExpect(jsonPath("$.data.database.status", is("CONNECTED")));
    }

    @Test
    @DisplayName("GET /api/v1/health/ping should return pong")
    void testPingEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/health/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", is("pong")));
    }
}
