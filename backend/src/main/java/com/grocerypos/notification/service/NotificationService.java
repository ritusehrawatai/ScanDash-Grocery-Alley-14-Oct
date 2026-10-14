package com.grocerypos.notification.service;

import com.grocerypos.notification.dto.NotificationDto;
import com.grocerypos.product.entity.Product;

import java.math.BigDecimal;
import java.util.List;

public interface NotificationService {

    List<NotificationDto> getNotifications(Boolean unreadOnly);

    NotificationDto markAsRead(Long id);

    int markAllAsRead();

    long getUnreadCount();

    /**
     * Evaluates current quantity against product thresholds and conditionally creates
     * LOW_STOCK or OUT_OF_STOCK notifications while strictly preventing duplicates.
     */
    void checkAndTriggerStockNotification(Product product, BigDecimal currentQuantity);
}
