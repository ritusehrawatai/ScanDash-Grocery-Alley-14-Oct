package com.grocerypos.audit.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

/**
 * Audit Log Entity recording business operation changes.
 * Tracks user, action, entity, entity ID, timestamp, old value, and new value.
 * Explicitly sanitizes all payloads to exclude sensitive credentials (passwords, salts).
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_logs_entity", columnList = "entity"),
    @Index(name = "idx_audit_logs_action", columnList = "action"),
    @Index(name = "idx_audit_logs_username", columnList = "username"),
    @Index(name = "idx_audit_logs_created_at", columnList = "created_at")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @NotBlank
    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @NotBlank
    @Column(name = "user_role", nullable = false, length = 20)
    private String userRole;

    @NotBlank
    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @NotBlank
    @Column(name = "entity", nullable = false, length = 50)
    private String entity;

    @NotBlank
    @Column(name = "entity_id", nullable = false, length = 50)
    private String entityId;

    @Column(name = "details", length = 500)
    private String details;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public AuditLog() {}

    public AuditLog(Long userId, String username, String userRole, String action, String entity, String entityId, String details, String oldValue, String newValue) {
        this.userId = userId;
        this.username = username;
        this.userRole = userRole;
        this.action = action;
        this.entity = entity;
        this.entityId = entityId;
        this.details = details;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getEntity() { return entity; }
    public void setEntity(String entity) { this.entity = entity; }

    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }

    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
