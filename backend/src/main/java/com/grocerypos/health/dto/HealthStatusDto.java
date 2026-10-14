package com.grocerypos.health.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Data Transfer Object representing system health and architectural status.
 */
public class HealthStatusDto {

    private String status;
    private String service;
    private String version;
    private String environment;
    private DatabaseHealthDto database;
    private SystemMemoryDto memory;
    private long uptimeSeconds;
    private Map<String, String> modules;
    private Instant timestamp;

    public HealthStatusDto() {
        this.timestamp = Instant.now();
    }

    public static class DatabaseHealthDto {
        private String status;
        private String databaseProductName;
        private String url;

        public DatabaseHealthDto() {}

        public DatabaseHealthDto(String status, String databaseProductName, String url) {
            this.status = status;
            this.databaseProductName = databaseProductName;
            this.url = url;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getDatabaseProductName() {
            return databaseProductName;
        }

        public void setDatabaseProductName(String databaseProductName) {
            this.databaseProductName = databaseProductName;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }

    public static class SystemMemoryDto {
        private long totalMemoryMb;
        private long freeMemoryMb;
        private long maxMemoryMb;

        public SystemMemoryDto() {}

        public SystemMemoryDto(long totalMemoryMb, long freeMemoryMb, long maxMemoryMb) {
            this.totalMemoryMb = totalMemoryMb;
            this.freeMemoryMb = freeMemoryMb;
            this.maxMemoryMb = maxMemoryMb;
        }

        public long getTotalMemoryMb() {
            return totalMemoryMb;
        }

        public void setTotalMemoryMb(long totalMemoryMb) {
            this.totalMemoryMb = totalMemoryMb;
        }

        public long getFreeMemoryMb() {
            return freeMemoryMb;
        }

        public void setFreeMemoryMb(long freeMemoryMb) {
            this.freeMemoryMb = freeMemoryMb;
        }

        public long getMaxMemoryMb() {
            return maxMemoryMb;
        }

        public void setMaxMemoryMb(long maxMemoryMb) {
            this.maxMemoryMb = maxMemoryMb;
        }
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public DatabaseHealthDto getDatabase() {
        return database;
    }

    public void setDatabase(DatabaseHealthDto database) {
        this.database = database;
    }

    public SystemMemoryDto getMemory() {
        return memory;
    }

    public void setMemory(SystemMemoryDto memory) {
        this.memory = memory;
    }

    public long getUptimeSeconds() {
        return uptimeSeconds;
    }

    public void setUptimeSeconds(long uptimeSeconds) {
        this.uptimeSeconds = uptimeSeconds;
    }

    public Map<String, String> getModules() {
        return modules;
    }

    public void setModules(Map<String, String> modules) {
        this.modules = modules;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
