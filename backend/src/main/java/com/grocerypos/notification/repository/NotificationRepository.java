package com.grocerypos.notification.repository;

import com.grocerypos.notification.entity.Notification;
import com.grocerypos.notification.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findAllByOrderByCreatedAtDesc();

    List<Notification> findByReadFalseOrderByCreatedAtDesc();

    long countByReadFalse();

    /**
     * Checks if an active unread notification of the given type already exists for this product.
     * Prevents duplicate notifications during frequent stock operations.
     */
    boolean existsByProductIdAndTypeAndReadFalse(Long productId, NotificationType type);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.read = false")
    int markAllAsRead();
}
