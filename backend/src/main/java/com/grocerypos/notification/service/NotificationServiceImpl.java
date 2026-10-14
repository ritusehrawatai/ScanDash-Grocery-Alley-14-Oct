package com.grocerypos.notification.service;

import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.inventory.entity.InventoryStatus;
import com.grocerypos.notification.dto.NotificationDto;
import com.grocerypos.notification.entity.Notification;
import com.grocerypos.notification.entity.NotificationSeverity;
import com.grocerypos.notification.entity.NotificationType;
import com.grocerypos.notification.repository.NotificationRepository;
import com.grocerypos.product.entity.Product;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;

    @Autowired
    public NotificationServiceImpl(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getNotifications(Boolean unreadOnly) {
        List<Notification> list = Boolean.TRUE.equals(unreadOnly)
                ? notificationRepository.findByReadFalseOrderByCreatedAtDesc()
                : notificationRepository.findAllByOrderByCreatedAtDesc();

        return list.stream()
                .map(NotificationDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public NotificationDto markAsRead(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with ID: " + id));

        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        return NotificationDto.fromEntity(saved);
    }

    @Override
    public int markAllAsRead() {
        return notificationRepository.markAllAsRead();
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount() {
        return notificationRepository.countByReadFalse();
    }

    @Override
    public void checkAndTriggerStockNotification(Product product, BigDecimal currentQuantity) {
        if (product == null) {
            return;
        }

        // 1. Calculate inventory status consistently
        InventoryStatus status = InventoryStatus.calculate(currentQuantity, product.getMinimumInventoryThreshold());

        // 2. Detect LOW STOCK or OUT OF STOCK
        if (status == InventoryStatus.OUT_OF_STOCK) {
            // Avoid creating duplicate unread OUT_OF_STOCK notifications
            boolean alreadyNotified = notificationRepository.existsByProductIdAndTypeAndReadFalse(
                    product.getId(),
                    NotificationType.OUT_OF_STOCK
            );

            if (!alreadyNotified) {
                String msg = String.format(
                        "Product '%s' (SKU: %s) is OUT OF STOCK. Current quantity: 0 %s.",
                        product.getName(),
                        product.getSku(),
                        product.getUnit()
                );

                Notification notification = new Notification(
                        NotificationType.OUT_OF_STOCK,
                        msg,
                        NotificationSeverity.CRITICAL,
                        product
                );
                notificationRepository.save(notification);
            }
        } else if (status == InventoryStatus.LOW_STOCK) {
            // Avoid creating duplicate unread LOW_STOCK notifications
            boolean alreadyNotified = notificationRepository.existsByProductIdAndTypeAndReadFalse(
                    product.getId(),
                    NotificationType.LOW_STOCK
            );

            if (!alreadyNotified) {
                String msg = String.format(
                        "Product '%s' (SKU: %s) is running LOW ON STOCK. Current quantity: %s %s (Minimum threshold: %d).",
                        product.getName(),
                        product.getSku(),
                        currentQuantity != null ? currentQuantity.toPlainString() : "0",
                        product.getUnit(),
                        product.getMinimumInventoryThreshold() != null ? product.getMinimumInventoryThreshold() : 0
                );

                Notification notification = new Notification(
                        NotificationType.LOW_STOCK,
                        msg,
                        NotificationSeverity.WARNING,
                        product
                );
                notificationRepository.save(notification);
            }
        }
    }
}
