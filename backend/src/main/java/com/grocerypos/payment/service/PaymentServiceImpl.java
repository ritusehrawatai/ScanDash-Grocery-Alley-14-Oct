package com.grocerypos.payment.service;

import com.grocerypos.common.exception.InvalidRequestException;
import com.grocerypos.common.exception.ResourceNotFoundException;
import com.grocerypos.payment.dto.ConnectionTokenResponseDto;
import com.grocerypos.payment.dto.CreatePaymentIntentRequestDto;
import com.grocerypos.payment.dto.PaymentIntentResponseDto;
import com.grocerypos.payment.dto.PaymentRequestDto;
import com.grocerypos.payment.dto.PaymentResponseDto;
import com.grocerypos.payment.entity.Payment;
import com.grocerypos.payment.entity.PaymentStatus;
import com.grocerypos.payment.provider.PaymentProvider;
import com.grocerypos.payment.repository.PaymentRepository;
import com.grocerypos.product.entity.Product;
import com.grocerypos.product.repository.ProductRepository;
import com.grocerypos.sale.entity.Sale;
import com.grocerypos.sale.entity.SaleItem;
import com.grocerypos.sale.entity.SaleStatus;
import com.grocerypos.sale.repository.SaleRepository;
import com.grocerypos.inventory.entity.Inventory;
import com.grocerypos.inventory.entity.InventoryStatus;
import com.grocerypos.inventory.entity.InventoryTransaction;
import com.grocerypos.inventory.entity.InventoryTransactionType;
import com.grocerypos.inventory.repository.InventoryRepository;
import com.grocerypos.inventory.repository.InventoryTransactionRepository;
import com.grocerypos.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.grocerypos.payment.config.StripeProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Standard implementation of PaymentService coordinating between POS sales
 * and modular PaymentProviders (Stripe, etc.).
 */
@Service
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentServiceImpl.class);

    private final PaymentRepository paymentRepository;
    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final StripeProperties stripeProperties;
    private final Map<String, PaymentProvider> providers;
    private final Set<String> processedWebhookEvents = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired(required = false)
    private InventoryRepository inventoryRepository;

    @Autowired(required = false)
    private InventoryTransactionRepository transactionRepository;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired
    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            SaleRepository saleRepository,
            @Autowired(required = false) ProductRepository productRepository,
            @Autowired(required = false) StripeProperties stripeProperties,
            List<PaymentProvider> paymentProviders) {
        this.paymentRepository = paymentRepository;
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.stripeProperties = stripeProperties != null ? stripeProperties : new StripeProperties();
        this.providers = paymentProviders.stream()
                .collect(Collectors.toMap(
                        p -> p.getProviderName().toUpperCase(),
                        Function.identity()
                ));
    }

    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            SaleRepository saleRepository,
            List<PaymentProvider> paymentProviders) {
        this(paymentRepository, saleRepository, null, new StripeProperties(), paymentProviders);
    }

    public PaymentServiceImpl(
            PaymentRepository paymentRepository,
            SaleRepository saleRepository,
            StripeProperties stripeProperties,
            List<PaymentProvider> paymentProviders) {
        this(paymentRepository, saleRepository, null, stripeProperties, paymentProviders);
    }

    @Override
    public PaymentResponseDto initiatePayment(PaymentRequestDto request, String providerName) {
        if (request == null || request.getAmount() == null) {
            throw new InvalidRequestException("Payment request and amount are required");
        }

        String resolvedProviderName = (providerName != null && !providerName.isBlank())
                ? providerName.toUpperCase()
                : (request.getProvider() != null && !request.getProvider().isBlank() ? request.getProvider().toUpperCase() : "STRIPE");

        PaymentProvider provider = providers.get(resolvedProviderName);
        if (provider == null) {
            throw new InvalidRequestException("Unsupported payment provider: '" + resolvedProviderName +
                    "'. Registered providers: " + providers.keySet());
        }

        Sale sale = null;
        if (request.getSaleId() != null) {
            sale = saleRepository.findById(request.getSaleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Sale not found with ID: " + request.getSaleId()));
        }

        // Delegate initiation to chosen provider abstraction
        PaymentResponseDto providerResponse = provider.initiatePayment(request);

        // Persist payment entity linked to sale
        Payment payment = new Payment(sale, request.getAmount(), request.getCurrency(), provider.getProviderName());
        payment.setExternalPaymentId(providerResponse.getExternalPaymentId());
        payment.setClientSecret(providerResponse.getClientSecret());
        payment.setStatus(PaymentStatus.PENDING);

        Payment saved = paymentRepository.save(payment);
        return PaymentResponseDto.fromEntity(saved);
    }

    @Override
    public PaymentIntentResponseDto createPaymentIntent(CreatePaymentIntentRequestDto request) {
        if (request == null || request.getSaleId() == null) {
            throw new InvalidRequestException("Sale ID is required to create a payment intent");
        }

        Sale sale = saleRepository.findById(request.getSaleId())
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found with ID: " + request.getSaleId()));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new InvalidRequestException("Cannot create payment intent for a CANCELLED sale: " + sale.getReceiptNumber());
        }
        if (sale.getStatus() == SaleStatus.REFUNDED) {
            throw new InvalidRequestException("Cannot create payment intent for a REFUNDED sale: " + sale.getReceiptNumber());
        }

        // Idempotency: Check if an active PENDING payment already exists for this sale
        List<Payment> existingPayments = paymentRepository.findBySaleId(sale.getId());
        Optional<Payment> activePendingPayment = existingPayments.stream()
                .filter(p -> "STRIPE".equalsIgnoreCase(p.getProvider())
                        && p.getStatus() == PaymentStatus.PENDING
                        && p.getExternalPaymentId() != null
                        && p.getClientSecret() != null)
                .findFirst();

        if (activePendingPayment.isPresent()) {
            Payment existing = activePendingPayment.get();
            PaymentIntentResponseDto cachedResponse = new PaymentIntentResponseDto();
            cachedResponse.setPaymentIntentId(existing.getExternalPaymentId());
            cachedResponse.setClientSecret(existing.getClientSecret());
            cachedResponse.setAmount(existing.getAmount());
            cachedResponse.setCurrency(existing.getCurrency());
            cachedResponse.setStatus("requires_payment_method");
            cachedResponse.setPaymentMethodTypes(List.of("card_present"));
            cachedResponse.setSaleId(sale.getId());
            cachedResponse.setPaymentId(existing.getId());
            cachedResponse.setReceiptNumber(sale.getReceiptNumber());
            cachedResponse.setIdempotencyKey(request.getIdempotencyKey());
            return cachedResponse;
        }

        // Trusted Server-Side Amount Calculation:
        // Calculate strictly from trusted database product prices, quantities, and configured taxes.
        // Never trust client-supplied totals!
        BigDecimal trustedSubtotal = BigDecimal.ZERO;
        BigDecimal trustedTax = BigDecimal.ZERO;

        if (sale.getItems() != null && !sale.getItems().isEmpty()) {
            for (SaleItem item : sale.getItems()) {
                Product product = item.getProduct();
                BigDecimal unitPrice;
                BigDecimal taxRate;

                if (product != null && product.getId() != null && productRepository != null) {
                    Product freshProduct = productRepository.findById(product.getId()).orElse(product);
                    unitPrice = freshProduct.getSellingPrice() != null ? freshProduct.getSellingPrice() : BigDecimal.ZERO;
                    taxRate = freshProduct.getTaxRate() != null ? freshProduct.getTaxRate() : BigDecimal.ZERO;
                } else if (item.getUnitPrice() != null) {
                    unitPrice = item.getUnitPrice();
                    taxRate = item.getTaxRate() != null ? item.getTaxRate() : BigDecimal.ZERO;
                } else {
                    unitPrice = BigDecimal.ZERO;
                    taxRate = BigDecimal.ZERO;
                }

                BigDecimal qty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE;
                BigDecimal lineSubtotal = unitPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);

                BigDecimal taxMultiplier = taxRate.compareTo(BigDecimal.ONE) > 0
                        ? taxRate.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
                        : taxRate;
                BigDecimal lineTax = lineSubtotal.multiply(taxMultiplier).setScale(2, RoundingMode.HALF_UP);

                trustedSubtotal = trustedSubtotal.add(lineSubtotal);
                trustedTax = trustedTax.add(lineTax);
            }
        } else if (sale.getSubtotal() != null && sale.getTotalAmount() != null) {
            trustedSubtotal = sale.getSubtotal();
            trustedTax = sale.getTaxAmount() != null ? sale.getTaxAmount() : BigDecimal.ZERO;
        }

        BigDecimal trustedTotal = trustedSubtotal.add(trustedTax).setScale(2, RoundingMode.HALF_UP);
        if (trustedTotal.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("Calculated sale total must be greater than zero");
        }

        String currency = (request.getCurrency() != null && !request.getCurrency().isBlank())
                ? request.getCurrency().toUpperCase()
                : "USD";

        String idempotencyKey = (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank())
                ? request.getIdempotencyKey()
                : "pos_sale_" + sale.getId() + "_" + (sale.getReceiptNumber() != null ? sale.getReceiptNumber() : System.currentTimeMillis()) + "_stripe";

        PaymentProvider provider = providers.get("STRIPE");
        if (provider == null) {
            throw new InvalidRequestException("Stripe payment provider is not configured");
        }

        // Create Stripe Terminal PaymentIntent
        PaymentIntentResponseDto intentResponse = provider.createTerminalPaymentIntent(sale, trustedTotal, currency, idempotencyKey);

        // Store PaymentIntent ID against local payment record linked to the sale
        Payment payment = new Payment(sale, trustedTotal, currency, "STRIPE");
        payment.setExternalPaymentId(intentResponse.getPaymentIntentId());
        payment.setClientSecret(intentResponse.getClientSecret());
        payment.setStatus(PaymentStatus.PENDING);

        Payment saved = paymentRepository.save(payment);
        intentResponse.setPaymentId(saved.getId());

        // Note: As required, inventory is NOT deducted and sale status is NOT marked COMPLETED yet.
        return intentResponse;
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponseDto getPaymentById(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with ID: " + id));
        return PaymentResponseDto.fromEntity(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentResponseDto getPaymentByExternalId(String externalPaymentId) {
        Payment payment = paymentRepository.findByExternalPaymentId(externalPaymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with external ID: " + externalPaymentId));
        return PaymentResponseDto.fromEntity(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentResponseDto> getPaymentsBySaleId(Long saleId) {
        return paymentRepository.findBySaleId(saleId).stream()
                .map(PaymentResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    public PaymentResponseDto cancelPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with ID: " + paymentId));

        if (payment.getStatus() == PaymentStatus.SUCCEEDED) {
            throw new InvalidRequestException("Cannot cancel an already completed (SUCCEEDED) payment: " + paymentId);
        }

        PaymentProvider provider = providers.get(payment.getProvider().toUpperCase());
        if (provider != null && payment.getExternalPaymentId() != null) {
            provider.cancelPayment(payment.getExternalPaymentId());
        }

        payment.setStatus(PaymentStatus.CANCELED);
        Payment saved = paymentRepository.save(payment);
        return PaymentResponseDto.fromEntity(saved);
    }

    @Override
    public ConnectionTokenResponseDto createTerminalConnectionToken(String locationId) {
        // Enforce cashier/authorized POS role if security context is populated
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated()
                && !"anonymousUser".equals(authentication.getPrincipal())) {
            boolean isAuthorized = authentication.getAuthorities().stream().anyMatch(a -> {
                String role = a.getAuthority();
                return "ROLE_CASHIER".equals(role) || "ROLE_ADMIN".equals(role)
                        || "ROLE_OWNER".equals(role) || "ROLE_MANAGER".equals(role);
            });

            if (!isAuthorized) {
                throw new InvalidRequestException(
                        "Forbidden: User '" + authentication.getName() + "' is not authorized to generate Terminal connection tokens."
                );
            }
        }

        PaymentProvider provider = providers.get("STRIPE");
        if (provider == null) {
            throw new InvalidRequestException("Stripe payment provider is not configured or unavailable.");
        }

        // Return connection token secret; NEVER persist to database or repository!
        return provider.createTerminalConnectionToken(locationId);
    }

    @Override
    public PaymentResponseDto verifyPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with ID: " + paymentId));

        if (payment.getStatus() == PaymentStatus.SUCCEEDED && payment.getSale() != null && payment.getSale().getStatus() == SaleStatus.COMPLETED) {
            return PaymentResponseDto.fromEntity(payment);
        }

        if (payment.getExternalPaymentId() != null && !payment.getExternalPaymentId().isBlank()) {
            finalizeSaleFromVerifiedPayment(payment.getSale(), payment, "STRIPE_CARD_PRESENT", payment.getExternalPaymentId());
            return PaymentResponseDto.fromEntity(payment);
        }

        throw new InvalidRequestException("Payment " + paymentId + " does not have an external payment reference to verify.");
    }

    @Transactional(rollbackFor = Exception.class)
    public void finalizeSaleFromVerifiedPayment(Sale sale, Payment payment, String paymentMethod, String stripePaymentRef) {
        if (payment != null) {
            payment.setStatus(PaymentStatus.SUCCEEDED);
            payment.setUpdatedAt(Instant.now());
            if (stripePaymentRef != null) {
                payment.setExternalPaymentId(stripePaymentRef);
            }
            paymentRepository.save(payment);
        }

        if (sale == null) {
            return;
        }

        // Idempotency: If sale is already COMPLETED, do not deduct inventory again
        if (sale.getStatus() == SaleStatus.COMPLETED) {
            if (sale.getPaymentMethod() == null && paymentMethod != null) sale.setPaymentMethod(paymentMethod);
            if (sale.getPaymentReference() == null && stripePaymentRef != null) sale.setPaymentReference(stripePaymentRef);
            saleRepository.save(sale);
            return;
        }

        try {
            if (sale.getItems() != null && inventoryRepository != null) {
                for (SaleItem item : sale.getItems()) {
                    Product product = item.getProduct();
                    if (product != null) {
                        Inventory inventory = inventoryRepository.findByProductId(product.getId())
                                .orElse(new Inventory(product, BigDecimal.ZERO));
                        BigDecimal prevQty = inventory.getCurrentQuantity();
                        BigDecimal deductQty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE;
                        BigDecimal newQty = prevQty.subtract(deductQty);
                        inventory.setCurrentQuantity(newQty);
                        inventory.setStockStatus(InventoryStatus.calculate(newQty, product.getMinimumInventoryThreshold()));
                        inventory.setLastUpdated(Instant.now());
                        inventoryRepository.save(inventory);

                        if (transactionRepository != null) {
                            InventoryTransaction tx = new InventoryTransaction(
                                    product,
                                    InventoryTransactionType.SALE,
                                    deductQty,
                                    prevQty,
                                    newQty,
                                    "Sale completed via Stripe (" + (stripePaymentRef != null ? stripePaymentRef : "Terminal") + ") - " + sale.getReceiptNumber(),
                                    sale.getReceiptNumber()
                            );
                            transactionRepository.save(tx);
                        }

                        if (notificationService != null) {
                            notificationService.checkAndTriggerStockNotification(product, newQty);
                        }
                    }
                }
            }

            sale.setStatus(SaleStatus.COMPLETED);
            sale.setPaymentMethod(paymentMethod != null ? paymentMethod : "STRIPE_CARD_PRESENT");
            sale.setPaymentReference(stripePaymentRef != null ? stripePaymentRef : (payment != null ? payment.getExternalPaymentId() : null));
            if (payment != null) sale.setPaymentId(payment.getId());
            sale.setRequiresRecovery(false);
            sale.setRecoveryStatus("NONE");
            sale.setRecoveryReason(null);
            saleRepository.save(sale);
        } catch (Exception e) {
            log.error("Local sale finalization failed for sale {}: {}", sale.getId(), e.getMessage());
            if (payment != null) {
                payment.setStatus(PaymentStatus.SUCCEEDED);
                paymentRepository.save(payment);
            }
            sale.setStatus(SaleStatus.PENDING);
            sale.setRequiresRecovery(true);
            sale.setRecoveryStatus("FAILED_FINALIZATION");
            sale.setRecoveryReason(e.getMessage());
            if (payment != null) sale.setPaymentId(payment.getId());
            if (paymentMethod != null) sale.setPaymentMethod(paymentMethod);
            if (stripePaymentRef != null) sale.setPaymentReference(stripePaymentRef);
            saleRepository.save(sale);
            throw e;
        }
    }

    @Override
    public void processStripeWebhook(String rawPayload, String signatureHeader) {
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new InvalidRequestException("Missing Stripe-Signature header");
        }
        if (rawPayload == null || rawPayload.isBlank()) {
            throw new InvalidRequestException("Missing webhook request payload");
        }

        String webhookSecret = stripeProperties != null ? stripeProperties.getWebhookSecret() : "";
        if (webhookSecret == null || webhookSecret.isBlank()) {
            webhookSecret = "whsec_test_mockTestKey";
        }

        // 1 & 2. Cryptographic signature verification with replay tolerance
        verifyWebhookSignature(rawPayload, signatureHeader, webhookSecret, 300);

        // Parse event JSON
        JsonNode rootNode;
        try {
            rootNode = objectMapper.readTree(rawPayload);
        } catch (Exception e) {
            throw new InvalidRequestException("Malformed JSON webhook payload: " + e.getMessage());
        }

        String eventId = rootNode.path("id").asText(null);
        String eventType = rootNode.path("type").asText(null);

        if (eventId == null || eventId.isBlank()) {
            throw new InvalidRequestException("Malformed Stripe event: missing event ID");
        }

        // 3. Deduplicate events using Stripe event ID
        if (processedWebhookEvents.contains(eventId)) {
            log.info("[StripeWebhook] Event {} of type {} already processed (deduplicated)", eventId, eventType);
            return;
        }

        // 4. Match event to local payment and sale
        JsonNode dataObject = rootNode.path("data").path("object");
        String paymentIntentId = dataObject.path("id").asText(null);
        JsonNode metadata = dataObject.path("metadata");

        Long metaPaymentId = metadata.has("paymentId") ? metadata.path("paymentId").asLong() : null;
        Long metaSaleId = metadata.has("saleId") ? metadata.path("saleId").asLong() : null;

        Payment payment = null;
        if (paymentIntentId != null && !paymentIntentId.isBlank()) {
            payment = paymentRepository.findByExternalPaymentId(paymentIntentId).orElse(null);
        }
        if (payment == null && metaPaymentId != null) {
            payment = paymentRepository.findById(metaPaymentId).orElse(null);
        }
        if (payment == null && metaSaleId != null) {
            List<Payment> bySale = paymentRepository.findBySaleId(metaSaleId);
            if (!bySale.isEmpty()) {
                payment = bySale.get(0);
            }
        }

        Sale sale = null;
        if (payment != null && payment.getSale() != null) {
            sale = payment.getSale();
        } else if (metaSaleId != null) {
            sale = saleRepository.findById(metaSaleId).orElse(null);
        }

        // 5. Update payment and sale status safely and consistently
        if ("payment_intent.succeeded".equalsIgnoreCase(eventType)) {
            finalizeSaleFromVerifiedPayment(sale, payment, "STRIPE_CARD_PRESENT", paymentIntentId);
        } else if ("payment_intent.payment_failed".equalsIgnoreCase(eventType)) {
            if (payment != null) {
                if (payment.getStatus() != PaymentStatus.SUCCEEDED) {
                    payment.setStatus(PaymentStatus.FAILED);
                    String declineMsg = dataObject.path("last_payment_error").path("message").asText("Payment failed on reader");
                    payment.setErrorMessage(declineMsg);
                    payment.setUpdatedAt(Instant.now());
                    paymentRepository.save(payment);
                }
            }
        } else if ("payment_intent.canceled".equalsIgnoreCase(eventType)) {
            if (payment != null && payment.getStatus() != PaymentStatus.SUCCEEDED) {
                payment.setStatus(PaymentStatus.CANCELED);
                payment.setUpdatedAt(Instant.now());
                paymentRepository.save(payment);
            }
        }

        // Record event ID for deduplication
        processedWebhookEvents.add(eventId);
        log.info("[StripeWebhook] Processed event {} ({}) for payment {}", eventId, eventType, payment != null ? payment.getId() : "none");
    }

    private void verifyWebhookSignature(String rawPayload, String signatureHeader, String secret, int toleranceSeconds) {
        String[] parts = signatureHeader.split(",");
        Long timestamp = null;
        List<String> signatures = new ArrayList<>();

        for (String part : parts) {
            String trimmed = part.trim();
            int eq = trimmed.indexOf('=');
            if (eq > 0) {
                String key = trimmed.substring(0, eq).trim();
                String val = trimmed.substring(eq + 1).trim();
                if ("t".equals(key)) {
                    try {
                        timestamp = Long.parseLong(val);
                    } catch (NumberFormatException ignored) {}
                } else if ("v1".equals(key)) {
                    signatures.add(val);
                }
            }
        }

        if (timestamp == null || signatures.isEmpty()) {
            throw new InvalidRequestException("Invalid Stripe-Signature header format");
        }

        long nowSec = Instant.now().getEpochSecond();
        if (Math.abs(nowSec - timestamp) > toleranceSeconds) {
            throw new InvalidRequestException("Webhook timestamp outside tolerance zone");
        }

        String payloadToSign = timestamp + "." + rawPayload;
        String expectedSignature;
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(payloadToSign.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) sb.append('0');
                sb.append(hex);
            }
            expectedSignature = sb.toString();
        } catch (Exception e) {
            throw new InvalidRequestException("Failed to compute webhook signature HMAC: " + e.getMessage());
        }

        boolean matched = false;
        byte[] expectedBytes = expectedSignature.getBytes(StandardCharsets.UTF_8);
        for (String sig : signatures) {
            byte[] sigBytes = sig.getBytes(StandardCharsets.UTF_8);
            if (MessageDigest.isEqual(sigBytes, expectedBytes)) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            throw new InvalidRequestException("Invalid Stripe webhook signature");
        }
    }
}
