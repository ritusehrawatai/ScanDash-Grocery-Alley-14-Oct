package com.grocerypos.sale.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class CreateSaleRequestDto {

    @NotEmpty(message = "Cart cannot be empty")
    @Valid
    private List<CreateSaleItemRequestDto> items;

    private String status;

    public CreateSaleRequestDto() {
    }

    public CreateSaleRequestDto(List<CreateSaleItemRequestDto> items) {
        this.items = items;
    }

    public CreateSaleRequestDto(List<CreateSaleItemRequestDto> items, String status) {
        this.items = items;
        this.status = status;
    }

    public List<CreateSaleItemRequestDto> getItems() {
        return items;
    }

    public void setItems(List<CreateSaleItemRequestDto> items) {
        this.items = items;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
