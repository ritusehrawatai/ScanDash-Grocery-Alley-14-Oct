package com.grocerypos.audit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.grocerypos.audit.dto.AuditLogDto;
import com.grocerypos.audit.entity.AuditLog;
import com.grocerypos.audit.repository.AuditLogRepository;
import com.grocerypos.common.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AuditLogServiceImpl implements AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogServiceImpl.class);

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditLogServiceImpl(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    private String sanitizeAndSerialize(Object value) {
        if (value == null) return null;
        if (value instanceof String) {
            return (String) value;
        }
        try {
            String json = objectMapper.writeValueAsString(value);
            // Parse as JsonNode to sanitize sensitive fields if it's an object
            try {
                var node = objectMapper.readTree(json);
                if (node.isObject()) {
                    ObjectNode objectNode = (ObjectNode) node;
                    objectNode.remove("password");
                    objectNode.remove("passwordHash");
                    objectNode.remove("salt");
                    objectNode.remove("token");
                    objectNode.remove("secret");
                    return objectMapper.writeValueAsString(objectNode);
                }
            } catch (Exception ignored) {}
            return json;
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit log payload: {}", e.getMessage());
            return String.valueOf(value);
        }
    }

    @Override
    @Transactional
    public AuditLogDto logOperation(Long userId, String username, String userRole, String action, String entity, String entityId, String details, Object oldValue, Object newValue) {
        String sanitizedOld = sanitizeAndSerialize(oldValue);
        String sanitizedNew = sanitizeAndSerialize(newValue);

        AuditLog auditLog = new AuditLog(
                userId,
                username != null ? username : "system",
                userRole != null ? userRole : "ROLE_SYSTEM",
                action,
                entity,
                entityId,
                details,
                sanitizedOld,
                sanitizedNew
        );

        AuditLog saved = auditLogRepository.save(auditLog);
        log.info("[AUDIT] User: {} ({}) | Action: {} | Entity: {} #{} | Details: {}",
                saved.getUsername(), saved.getUserRole(), saved.getAction(), saved.getEntity(), saved.getEntityId(), saved.getDetails());

        return AuditLogDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogDto> getAllLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(AuditLogDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogDto> getLogsByEntity(String entity) {
        return auditLogRepository.findByEntityOrderByCreatedAtDesc(entity).stream()
                .map(AuditLogDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogDto> getLogsByAction(String action) {
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action).stream()
                .map(AuditLogDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AuditLogDto getLogById(Long id) {
        AuditLog auditLog = auditLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Audit log not found with ID: " + id));
        return AuditLogDto.fromEntity(auditLog);
    }
}
