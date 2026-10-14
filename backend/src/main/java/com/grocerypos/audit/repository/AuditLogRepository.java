package com.grocerypos.audit.repository;

import com.grocerypos.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEntityOrderByCreatedAtDesc(String entity);
    List<AuditLog> findByActionOrderByCreatedAtDesc(String action);
    List<AuditLog> findByUsernameOrderByCreatedAtDesc(String username);
    List<AuditLog> findAllByOrderByCreatedAtDesc();
}
