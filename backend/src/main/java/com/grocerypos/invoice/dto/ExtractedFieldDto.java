package com.grocerypos.invoice.dto;

import java.io.Serializable;

public class ExtractedFieldDto<T> implements Serializable {

    private T value;
    private int confidence; // 0 to 100
    private boolean flaggedForReview;
    private String reason;

    public ExtractedFieldDto() {
    }

    public ExtractedFieldDto(T value, int confidence, boolean flaggedForReview, String reason) {
        this.value = value;
        this.confidence = confidence;
        this.flaggedForReview = flaggedForReview;
        this.reason = reason;
    }

    public static <T> ExtractedFieldDto<T> of(T value, int confidence, boolean flaggedForReview, String reason) {
        return new ExtractedFieldDto<>(value, confidence, flaggedForReview, reason);
    }

    public static <T> ExtractedFieldDto<T> of(T value, int confidence) {
        return new ExtractedFieldDto<>(value, confidence, confidence < 75, confidence < 75 ? "Low confidence score (" + confidence + "%)" : null);
    }

    public T getValue() {
        return value;
    }

    public void setValue(T value) {
        this.value = value;
    }

    public int getConfidence() {
        return confidence;
    }

    public void setConfidence(int confidence) {
        this.confidence = confidence;
    }

    public boolean isFlaggedForReview() {
        return flaggedForReview;
    }

    public void setFlaggedForReview(boolean flaggedForReview) {
        this.flaggedForReview = flaggedForReview;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
