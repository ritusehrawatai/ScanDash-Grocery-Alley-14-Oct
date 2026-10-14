package com.grocerypos.audit.controller;

import com.grocerypos.audit.dto.AuditLogDto;
import com.grocerypos.audit.service.AuditLogService;
import com.grocerypos.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Audit Log Controller.
 * Restricted to OWNER and ADMIN roles via Spring Security RBAC.
 * Returns comprehensive audit trails for important business operations.
 */
@RestController
@RequestMapping({"/api/v1/audit-logs", "/api/audit-logs"})
@Tag(name = "Audit Logs", description = "Audit trail for important business operations (OWNER/ADMIN only)")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    @Operation(summary = "List audit logs", description = "Retrieve chronological audit records with optional filters")
    public ResponseEntity<ApiResponse<List<AuditLogDto>>> getAuditLogs(
            @RequestParam(required = false) String entity,
            @RequestParam(required = false) String action
    ) {
        List<AuditLogDto> logs;
        if (entity != null && !entity.isBlank()) {
            logs = auditLogService.getLogsByEntity(entity);
        } else if (action != null && !action.isBlank()) {
            logs = auditLogService.getLogsByAction(action);
        } else {
            logs = auditLogService.getAllLogs();
        }
        return ResponseEntity.ok(ApiResponse.success(logs, "Audit logs retrieved successfully"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get audit log by ID")
    public ResponseEntity<ApiResponse<AuditLogDto>> getAuditLogById(@PathVariable Long id) {
        AuditLogDto dto = auditLogService.getLogById(id);
        return ResponseEntity.ok(ApiResponse.success(dto, "Audit log retrieved"));
    }

    @GetMapping(value = "/export/csv", produces = "text/csv")
    @Operation(summary = "Export audit trail to CSV format")
    public ResponseEntity<byte[]> exportCsv() {
        List<AuditLogDto> logs = auditLogService.getAllLogs();
        StringBuilder csv = new StringBuilder();
        csv.append("ID,Timestamp,User,Role,Action,Entity,EntityID,Details,OldValue,NewValue\n");

        for (AuditLogDto log : logs) {
            csv.append(log.getId()).append(",")
               .append("\"").append(log.getCreatedAt() != null ? log.getCreatedAt().toString() : "").append("\",")
               .append("\"").append(escapeCsv(log.getUsername())).append("\",")
               .append("\"").append(escapeCsv(log.getUserRole())).append("\",")
               .append("\"").append(escapeCsv(log.getAction())).append("\",")
               .append("\"").append(escapeCsv(log.getEntity())).append("\",")
               .append("\"").append(escapeCsv(log.getEntityId())).append("\",")
               .append("\"").append(escapeCsv(log.getDetails())).append("\",")
               .append("\"").append(escapeCsv(log.getOldValue())).append("\",")
               .append("\"").append(escapeCsv(log.getNewValue())).append("\"\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"freshcart-audit-logs.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }
}
