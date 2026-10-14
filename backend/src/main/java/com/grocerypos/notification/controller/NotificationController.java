package com.grocerypos.notification.controller;

import com.grocerypos.common.dto.ApiResponse;
import com.grocerypos.notification.dto.NotificationDto;
import com.grocerypos.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "In-App Notifications API", description = "Endpoints for managing inventory low-stock alerts, reading status, and unread counts")
public class NotificationController {

    private final NotificationService notificationService;

    @Autowired
    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /**
     * Get all notifications (or unread notifications only).
     * GET /api/notifications?unreadOnly=true
     */
    @GetMapping
    @Operation(summary = "Get Notifications", description = "Retrieves in-app stock notifications with newest first")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getNotifications(
            @RequestParam(value = "unreadOnly", required = false, defaultValue = "false") Boolean unreadOnly) {
        List<NotificationDto> notifications = notificationService.getNotifications(unreadOnly);
        return ResponseEntity.ok(ApiResponse.ok(notifications, "Notifications retrieved successfully"));
    }

    /**
     * Get the count of unread notifications for badge display.
     * GET /api/notifications/unread-count
     */
    @GetMapping("/unread-count")
    @Operation(summary = "Get Unread Count", description = "Returns the total number of unread in-app alerts")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount() {
        long count = notificationService.getUnreadCount();
        return ResponseEntity.ok(ApiResponse.ok(Collections.singletonMap("count", count), "Unread count retrieved"));
    }

    /**
     * Mark a specific notification as read.
     * PUT /api/notifications/{id}/read or PATCH /api/notifications/{id}/read
     */
    @RequestMapping(value = "/{id}/read", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @Operation(summary = "Mark Notification as Read", description = "Sets an individual notification read flag to true")
    public ResponseEntity<ApiResponse<NotificationDto>> markAsRead(@PathVariable Long id) {
        NotificationDto updated = notificationService.markAsRead(id);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Notification marked as read"));
    }

    /**
     * Mark all unread notifications as read.
     * PUT /api/notifications/read-all or POST /api/notifications/read-all
     */
    @RequestMapping(value = "/read-all", method = {RequestMethod.PUT, RequestMethod.POST})
    @Operation(summary = "Mark All as Read", description = "Batch updates all unread notifications to read status")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> markAllAsRead() {
        int updatedCount = notificationService.markAllAsRead();
        return ResponseEntity.ok(ApiResponse.ok(Collections.singletonMap("updatedCount", updatedCount), "All notifications marked as read"));
    }
}
