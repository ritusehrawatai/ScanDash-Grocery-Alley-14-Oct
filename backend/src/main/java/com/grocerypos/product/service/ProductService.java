package com.grocerypos.product.service;

import com.grocerypos.product.dto.CreateProductRequestDto;
import com.grocerypos.product.dto.ProductResponseDto;
import com.grocerypos.product.dto.UpdateProductRequestDto;

import java.util.List;

public interface ProductService {

    ProductResponseDto createProduct(CreateProductRequestDto request);

    List<ProductResponseDto> getAllProducts(String search, Long categoryId, Boolean activeOnly);

    ProductResponseDto getProductById(Long id);

    List<ProductResponseDto> searchProducts(String query, Boolean activeOnly);

    ProductResponseDto updateProduct(Long id, UpdateProductRequestDto request);

    void deleteProduct(Long id);
}
