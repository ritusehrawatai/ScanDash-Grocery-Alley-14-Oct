package com.grocerypos.notification;

import com.grocerypos.notification.dto.NotificationDto;
import com.grocerypos.notification.entity.Notification;
import com.grocerypos.notification.entity.NotificationSeverity;
import com.grocerypos.notification.entity.NotificationType;
import com.grocerypos.notification.repository.NotificationRepository;
import com.grocerypos.notification.service.NotificationServiceImpl;
import com.grocerypos.product.entity.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private Product testProduct;

    @BeforeEach
    void setUp() {
        testProduct = new Product("Whole Milk 1 Gallon", "SKU-MLK-01",
                new BigDecimal("2.50"), new BigDecimal("3.89"), BigDecimal.ZERO, "GALLON");
        testProduct.setId(10L);
        testProduct.setMinimumInventoryThreshold(15);
    }

    @Test
    @DisplayName("checkAndTriggerStockNotification: Should create CRITICAL OUT_OF_STOCK notification when quantity == 0")
    void testTriggerOutOfStockNotification() {
        when(notificationRepository.existsByProductIdAndTypeAndReadFalse(10L, NotificationType.OUT_OF_STOCK))
                .thenReturn(false);

        notificationService.checkAndTriggerStockNotification(testProduct, BigDecimal.ZERO);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification saved = captor.getValue();
        assertThat(saved.getType()).isEqualTo(NotificationType.OUT_OF_STOCK);
        assertThat(saved.getSeverity()).isEqualTo(NotificationSeverity.CRITICAL);
        assertThat(saved.getMessage()).contains("is OUT OF STOCK");
        assertThat(saved.isRead()).isFalse();
        assertThat(saved.getProduct()).isEqualTo(testProduct);
    }

    @Test
    @DisplayName("checkAndTriggerStockNotification: Should avoid duplicate OUT_OF_STOCK notification if unread exists")
    void testAvoidDuplicateOutOfStockNotification() {
        // Unread OUT_OF_STOCK already exists
        when(notificationRepository.existsByProductIdAndTypeAndReadFalse(10L, NotificationType.OUT_OF_STOCK))
                .thenReturn(true);

        notificationService.checkAndTriggerStockNotification(testProduct, BigDecimal.ZERO);

        // Verify save was NEVER called again
        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("checkAndTriggerStockNotification: Should create WARNING LOW_STOCK notification when quantity <= threshold")
    void testTriggerLowStockNotification() {
        when(notificationRepository.existsByProductIdAndTypeAndReadFalse(10L, NotificationType.LOW_STOCK))
                .thenReturn(false);

        // Threshold is 15, current quantity is 10.0
        notificationService.checkAndTriggerStockNotification(testProduct, new BigDecimal("10.0"));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification saved = captor.getValue();
        assertThat(saved.getType()).isEqualTo(NotificationType.LOW_STOCK);
        assertThat(saved.getSeverity()).isEqualTo(NotificationSeverity.WARNING);
        assertThat(saved.getMessage()).contains("is running LOW ON STOCK");
        assertThat(saved.isRead()).isFalse();
    }

    @Test
    @DisplayName("checkAndTriggerStockNotification: Should avoid duplicate LOW_STOCK notification if unread exists")
    void testAvoidDuplicateLowStockNotification() {
        // Unread LOW_STOCK already exists
        when(notificationRepository.existsByProductIdAndTypeAndReadFalse(10L, NotificationType.LOW_STOCK))
                .thenReturn(true);

        notificationService.checkAndTriggerStockNotification(testProduct, new BigDecimal("10.0"));

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("checkAndTriggerStockNotification: Should NOT create notification when stock is healthy (IN STOCK)")
    void testHealthyStockDoesNotTriggerNotification() {
        // Threshold is 15, current quantity is 50.0 (well above threshold)
        notificationService.checkAndTriggerStockNotification(testProduct, new BigDecimal("50.0"));

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("markAsRead: Should update notification read flag to true")
    void testMarkAsRead() {
        Notification notification = new Notification(
                NotificationType.LOW_STOCK, "Low stock", NotificationSeverity.WARNING, testProduct
        );
        notification.setId(101L);
        notification.setRead(false);

        when(notificationRepository.findById(101L)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> i.getArgument(0));

        NotificationDto result = notificationService.markAsRead(101L);

        assertThat(result.isRead()).isTrue();
        assertThat(notification.isRead()).isTrue();
        verify(notificationRepository).save(notification);
    }

    @Test
    @DisplayName("markAllAsRead: Should call repository batch update")
    void testMarkAllAsRead() {
        when(notificationRepository.markAllAsRead()).thenReturn(5);

        int updated = notificationService.markAllAsRead();

        assertThat(updated).isEqualTo(5);
        verify(notificationRepository).markAllAsRead();
    }
}
