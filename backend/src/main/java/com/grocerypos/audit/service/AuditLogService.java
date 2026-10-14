package com.grocerypos.audit.service;

import com.grocerypos.audit.dto.AuditLogDto;
import com.grocerypos.audit.entity.AuditLog;

import java.util.List;

public interface AuditLogService {
    AuditLogDto logOperation(Long userId, String username, String userRole, String action, String entity, String entityId, String details, Object oldValue, Object newValue);
    List<AuditLogDto> getAllLogs();
    List<AuditLogDto> getLogsByEntity(String entity);
    List<AuditLogDto> getLogsByAction(String action);
    AuditLogDto getLogById(Long id);
}
