package com.grocerypos.health.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.health.dto.HealthStatusDto;
import com.grocerypos.health.service.HealthCheckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST Controller for application health monitoring and readiness status.
 * Architecture path:
 * Frontend -> REST API -> HealthCheckController -> HealthCheckService -> DataSource -> PostgreSQL
 */
@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "Health Check API", description = "Endpoints for monitoring system health, database status, and module readiness")
public class HealthCheckController {

    private final HealthCheckService healthCheckService;

    @Autowired
    public HealthCheckController(HealthCheckService healthCheckService) {
        this.healthCheckService = healthCheckService;
    }

    @GetMapping
    @Operation(summary = "Get System Health Status", description = "Returns system uptime, database connection state, and architecture module readiness.")
    public ResponseEntity<ApiResponse<HealthStatusDto>> getHealthStatus() {
        HealthStatusDto status = healthCheckService.checkHealth();
        return ResponseEntity.ok(ApiResponse.ok(status, "System is healthy and operational"));
    }

    @GetMapping("/ping")
    @Operation(summary = "Simple Ping Endpoint", description = "Lightweight ping endpoint for uptime probes")
    public ResponseEntity<ApiResponse<String>> ping() {
        return ResponseEntity.ok(ApiResponse.ok("pong", "FreshCart POS API heartbeat"));
    }
}
