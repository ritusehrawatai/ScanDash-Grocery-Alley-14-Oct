package com.grocerypos.common.dto;

import java.time.Instant;
import java.util.List;

public class ApiErrorResponse {

    private boolean success;
    private String error;
    private int status;
    private String path;
    private Instant timestamp;
    private List<String> details;

    public ApiErrorResponse() {
        this.success = false;
        this.timestamp = Instant.now();
    }

    public ApiErrorResponse(String error, int status, String path, List<String> details) {
        this.success = false;
        this.error = error;
        this.status = status;
        this.path = path;
        this.details = details;
        this.timestamp = Instant.now();
    }

    public boolean isSuccess() {
        return success;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public List<String> getDetails() {
        return details;
    }

    public void setDetails(List<String> details) {
        this.details = details;
    }
}
