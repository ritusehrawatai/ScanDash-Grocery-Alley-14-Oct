package com.grocerypos.health.service;

import com.grocerypos.health.dto.HealthStatusDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service providing system health checks, database connectivity verification,
 * and module readiness indicators.
 */
@Service
public class HealthCheckService {

    private final DataSource dataSource;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${app.version:1.0.0-SNAPSHOT}")
    private String appVersion;

    @Autowired
    public HealthCheckService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public HealthStatusDto checkHealth() {
        HealthStatusDto dto = new HealthStatusDto();
        dto.setStatus("UP");
        dto.setService("grocery-pos-backend");
        dto.setVersion(appVersion);
        dto.setEnvironment(activeProfile);

        // Uptime in seconds
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        dto.setUptimeSeconds(uptimeMs / 1000);

        // Memory stats
        Runtime runtime = Runtime.getRuntime();
        long mb = 1024 * 1024;
        dto.setMemory(new HealthStatusDto.SystemMemoryDto(
                runtime.totalMemory() / mb,
                runtime.freeMemory() / mb,
                runtime.maxMemory() / mb
        ));

        // Check PostgreSQL / DataSource connectivity
        dto.setDatabase(checkDatabaseConnection());

        // Modular Architecture readiness map
        Map<String, String> modules = new LinkedHashMap<>();
        modules.put("core-architecture", "READY (Initialized)");
        modules.put("database-layer", "READY (PostgreSQL JPA configured)");
        modules.put("health-check-api", "READY (Operational)");
        modules.put("product-database", "IMPLEMENTED (Product, Category, Supplier entities & JPA Repositories)");
        modules.put("product-management-api", "IMPLEMENTED (CRUD REST API + Search)");
        modules.put("inventory-foundation", "IMPLEMENTED (Inventory & InventoryTransaction entities, repositories & service)");
        modules.put("invoice-ocr-tesseract", "PLANNED (Phase 3)");
        modules.put("pos-checkout", "PLANNED (Phase 4)");
        modules.put("sales-reporting", "PLANNED (Phase 5)");
        modules.put("auth-rbac", "PLANNED (Phase 6)");
        dto.setModules(modules);

        return dto;
    }

    private HealthStatusDto.DatabaseHealthDto checkDatabaseConnection() {
        HealthStatusDto.DatabaseHealthDto dbDto = new HealthStatusDto.DatabaseHealthDto();
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            dbDto.setStatus("CONNECTED");
            dbDto.setDatabaseProductName(metaData.getDatabaseProductName() + " " + metaData.getDatabaseProductVersion());
            dbDto.setUrl(maskUrl(metaData.getURL()));
        } catch (Exception e) {
            dbDto.setStatus("DISCONNECTED: " + e.getMessage());
            dbDto.setDatabaseProductName("Unknown");
            dbDto.setUrl("N/A");
        }
        return dbDto;
    }

    private String maskUrl(String url) {
        if (url == null) return "unknown";
        return url.replaceAll("://.*@", "://***:***@");
    }
}
