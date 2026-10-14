package com.grocerypos.payment.repository;

import com.grocerypos.payment.entity.Payment;
import com.grocerypos.payment.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByExternalPaymentId(String externalPaymentId);

    List<Payment> findBySaleId(Long saleId);

    List<Payment> findByStatus(PaymentStatus status);
}
