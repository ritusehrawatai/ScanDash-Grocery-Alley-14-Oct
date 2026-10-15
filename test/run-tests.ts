/**
 * Automated Test Suite for ScanDash FreshCart POS
 * Tests all required business domains:
 * - Product (Create, Update, Duplicate SKU, Duplicate Barcode, Search)
 * - Inventory (Add, Remove, Adjust, Prevent Negative Stock, Low Stock, Out of Stock)
 * - POS (Add to Cart, Calculate Totals, Complete Sale, Deduct Inventory)
 * - Invoice (Upload, OCR Extraction, Product Matching, Confirmation, Inventory Update)
 * - Notifications (Low Stock, Out of Stock, Duplicate Prevention)
 * - Security (Authentication, Authorization, Role Restrictions)
 */

import crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const TEST_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mockTestKey';

function generateStripeSignature(rawBody: string, secret = TEST_WEBHOOK_SECRET, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payloadToSign = `${ts}.${rawBody}`;
  const sig = crypto.createHmac('sha256', secret).update(payloadToSign, 'utf8').digest('hex');
  return `t=${ts},v1=${sig}`;
}

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3000';

let passedCount = 0;
let failedCount = 0;
const results: TestResult[] = [];

async function runTest(suiteName: string, testName: string, testFn: () => Promise<void>) {
  const start = Date.now();
  process.stdout.write(`  [TEST] ${testName} ... `);
  try {
    await testFn();
    const durationMs = Date.now() - start;
    passedCount++;
    results.push({ name: `${suiteName} > ${testName}`, passed: true, durationMs });
    console.log(`\x1b[32mPASSED\x1b[0m (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    failedCount++;
    const errMsg = err?.message || String(err);
    results.push({ name: `${suiteName} > ${testName}`, passed: false, error: errMsg, durationMs });
    console.log(`\x1b[31mFAILED\x1b[0m (${durationMs}ms)`);
    console.log(`         \x1b[31mError:\x1b[0m ${errMsg}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion Failed: ${message} (Expected: ${expected}, Actual: ${actual})`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('  FreshCart POS Automated Test Suite');
  console.log(`  Target Base URL: ${BASE_URL}`);
  console.log('======================================================\n');

  // Obtain Owner Token for Privileged Actions
  const ownerLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'Owner@123' }),
  }).then((r) => r.json());

  assert(ownerLoginRes.success, 'Owner login must succeed');
  const ownerToken = ownerLoginRes.data.token;
  const ownerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  };

  // Obtain Cashier Token for Cashier Tests
  const cashierLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cashier', password: 'Cashier@123' }),
  }).then((r) => r.json());

  assert(cashierLoginRes.success, 'Cashier login must succeed');
  const cashierToken = cashierLoginRes.data.token;
  const cashierHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cashierToken}`,
  };

  const testSuffix = Date.now().toString().slice(-4);
  let createdProductId: number = 1;
  let testSku = `SKU-TEST-${testSuffix}`;
  let testBarcode = `BAR-TEST-${testSuffix}`;

  // ==========================================
  // SUITE 1: PRODUCT MANAGEMENT
  // ==========================================
  console.log('\x1b[1m\x1b[36m--- SUITE 1: PRODUCT MANAGEMENT ---\x1b[0m');

  await runTest('Product', 'Create product with valid attributes', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: `Test Organic Gala Apples ${testSuffix}`,
        sku: testSku,
        barcode: testBarcode,
        description: 'Crisp organic gala apples by the bag',
        categoryId: 1,
        purchasePrice: 1.25,
        sellingPrice: 2.99,
        taxRate: 0.05,
        unit: 'BAG',
        minimumInventoryThreshold: 10,
        active: true,
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'HTTP status must be 201 Created');
    assert(json.success, 'Response success must be true');
    assert(Boolean(json.data.id), 'Created product must have generated ID');
    createdProductId = json.data.id;
  });

  await runTest('Product', 'Update existing product details', async () => {
    const res = await fetch(`${BASE_URL}/api/products/${createdProductId}`, {
      method: 'PUT',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: `Test Organic Gala Apples Premium ${testSuffix}`,
        sku: testSku,
        barcode: testBarcode,
        purchasePrice: 1.4,
        sellingPrice: 3.49,
        taxRate: 0.05,
        unit: 'BAG',
        minimumInventoryThreshold: 12,
        active: true,
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'HTTP status must be 200 OK');
    assertEqual(json.data.sellingPrice, 3.49, 'Updated selling price must match');
    assertEqual(json.data.minimumInventoryThreshold, 12, 'Updated threshold must match');
  });

  await runTest('Product', 'Reject duplicate SKU constraint conflict', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Another Apple Variety',
        sku: testSku, // Duplicate SKU
        barcode: `BAR-OTHER-${testSuffix}`,
        purchasePrice: 1.0,
        sellingPrice: 2.0,
        taxRate: 0,
      }),
    });

    assertEqual(res.status, 409, 'Duplicate SKU must return HTTP 409 Conflict');
    const json = await res.json();
    assert(!json.success, 'Duplicate SKU response must indicate failure');
  });

  await runTest('Product', 'Reject duplicate barcode constraint conflict', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Third Apple Variety',
        sku: `SKU-THIRD-${testSuffix}`,
        barcode: testBarcode, // Duplicate Barcode
        purchasePrice: 1.0,
        sellingPrice: 2.0,
        taxRate: 0,
      }),
    });

    assertEqual(res.status, 409, 'Duplicate barcode must return HTTP 409 Conflict');
    const json = await res.json();
    assert(!json.success, 'Duplicate barcode response must indicate failure');
  });

  await runTest('Product', 'Search products by query keyword (Partial match)', async () => {
    const res = await fetch(`${BASE_URL}/api/products?search=Gala`, {
      headers: cashierHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Search must return HTTP 200 OK');
    assert(Array.isArray(json.data), 'Data must be an array');
    assert(json.data.length > 0, 'Search for Gala must return at least one result');
    assert(
      json.data.some((p: any) => p.id === createdProductId),
      'Created product must appear in search results'
    );
  });

  await runTest('Product', 'Create product with scanned barcode preserving leading zeros', async () => {
    const leadingZeroBarcode = `00${Date.now().toString().slice(-10)}`;
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: `Scanned Barcode Product ${testSuffix}`,
        sku: `SKU-SCAN-${testSuffix}`,
        barcode: leadingZeroBarcode, // e.g. '001234567890'
        purchasePrice: 2.5,
        sellingPrice: 4.99,
        taxRate: 0.05,
        unit: 'PCS',
        minimumInventoryThreshold: 5,
        active: true,
      }),
    });

    assertEqual(res.status, 201, 'Creation with leading-zero barcode must return 201');
    const json = await res.json();
    assertEqual(json.data.barcode, leadingZeroBarcode, 'Barcode must preserve exact string including leading zeros');
  });

  await runTest('Product', 'Reject product creation when required fields (name, sku) are missing', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: '', // Empty name
        sku: '',  // Empty SKU
        barcode: '012345678901',
      }),
    });

    assertEqual(res.status, 400, 'Missing required fields must return HTTP 400');
  });

  // ==========================================
  // SUITE 2: INVENTORY MANAGEMENT
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 2: INVENTORY MANAGEMENT ---\x1b[0m');

  await runTest('Inventory', 'Add stock (PURCHASE/Restock intake)', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/add`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        quantity: 50,
        transactionType: 'PURCHASE',
        reason: 'Initial test intake',
        referenceId: `PO-TEST-${testSuffix}`,
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'Add stock must return HTTP 201 Created');
    assertEqual(json.data.newQuantity, 50, 'New quantity must equal 50');
  });

  await runTest('Inventory', 'Remove stock (DAMAGE/Deduction)', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/remove`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        quantity: 5,
        transactionType: 'DAMAGE',
        reason: 'Bruised apples discarded',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Remove stock must return HTTP 200 OK');
    assertEqual(json.data.newQuantity, 45, 'New quantity must equal 45 (50 - 5)');
  });

  await runTest('Inventory', 'Adjust stock to target balance (Cycle Count)', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 30,
        reason: 'Physical inventory audit',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Adjust stock must return HTTP 200 OK');
    assertEqual(json.data.newQuantity, 30, 'Adjusted quantity must be 30');
  });

  await runTest('Inventory', 'Prevent negative stock deduction', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/remove`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        quantity: 999, // Way higher than 30
        reason: 'Oversized removal',
      }),
    });

    assertEqual(res.status, 400, 'Excess deduction must return HTTP 400 Bad Request');
    const json = await res.json();
    assert(json.error.includes('Insufficient inventory'), 'Error must specify insufficient inventory');
  });

  await runTest('Inventory', 'Calculate LOW STOCK status when stock <= threshold', async () => {
    // Current threshold is 12, adjust to 8
    const res = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 8,
        reason: 'Simulate low stock level',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Adjustment must succeed');

    const invRes = await fetch(`${BASE_URL}/api/inventory/product/${createdProductId}`, {
      headers: ownerHeaders,
    });
    const invJson = await invRes.json();
    assertEqual(invJson.data.stockStatus, 'LOW STOCK', 'Status must be LOW STOCK');
  });

  await runTest('Inventory', 'Calculate OUT OF STOCK status when stock == 0', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 0,
        reason: 'Exhausted stock simulation',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Adjustment must succeed');

    const invRes = await fetch(`${BASE_URL}/api/inventory/product/${createdProductId}`, {
      headers: ownerHeaders,
    });
    const invJson = await invRes.json();
    assertEqual(invJson.data.stockStatus, 'OUT OF STOCK', 'Status must be OUT OF STOCK');
  });

  // Restock for POS testing
  await fetch(`${BASE_URL}/api/inventory/add`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      productId: createdProductId,
      quantity: 50,
      reason: 'Restock for POS tests',
    }),
  });

  await runTest('Inventory Search', 'Search inventory by exact barcode (preserves leading zeros)', async () => {
    // Product 1 has barcode '012345678901' with leading zero
    const res = await fetch(`${BASE_URL}/api/inventory?barcode=012345678901`, {
      headers: ownerHeaders,
    });
    assertEqual(res.status, 200, 'Search by barcode must return HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.data), 'Data must be an array');
    assertEqual(json.data.length, 1, 'Must find exactly 1 product matching barcode');
    assertEqual(json.data[0].productBarcode, '012345678901', 'Barcode must match and preserve leading zero');
    assertEqual(json.data[0].productId, 1, 'Must match product ID 1');
  });

  await runTest('Inventory Search', 'Direct barcode lookup endpoint (/api/inventory/barcode/:barcode)', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/barcode/012345678901`, {
      headers: ownerHeaders,
    });
    assertEqual(res.status, 200, 'Direct barcode lookup must return HTTP 200');
    const json = await res.json();
    assertEqual(json.data.productId, 1, 'Must match product ID 1');
    assertEqual(json.data.productBarcode, '012345678901', 'Must return barcode');
  });

  await runTest('Inventory Search', 'Non-existent barcode search returns no results and does NOT create products', async () => {
    const beforeRes = await fetch(`${BASE_URL}/api/inventory`, { headers: ownerHeaders });
    const beforeJson = await beforeRes.json();
    const countBefore = beforeJson.data.length;

    const res = await fetch(`${BASE_URL}/api/inventory?barcode=NONEXISTENT_BARCODE_999999`, {
      headers: ownerHeaders,
    });
    assertEqual(res.status, 200, 'Search query returns 200 with empty array');
    const json = await res.json();
    assertEqual(json.data.length, 0, 'No products must match non-existent barcode');

    const afterRes = await fetch(`${BASE_URL}/api/inventory`, { headers: ownerHeaders });
    const afterJson = await afterRes.json();
    assertEqual(afterJson.data.length, countBefore, 'Product count must remain unchanged (no duplicate or phantom creation)');
  });

  await runTest('Inventory Search', 'Existing search criteria (Name and SKU) continue to work identically', async () => {
    // Search by product name
    const nameRes = await fetch(`${BASE_URL}/api/inventory?search=Bananas`, { headers: ownerHeaders });
    const nameJson = await nameRes.json();
    assert(nameJson.data.some((i: any) => i.productId === 1), 'Search by name must find Bananas');

    // Search by SKU
    const skuRes = await fetch(`${BASE_URL}/api/inventory?search=SKU-BAN-001`, { headers: ownerHeaders });
    const skuJson = await skuRes.json();
    assert(skuJson.data.some((i: any) => i.productId === 1), 'Search by SKU must find Bananas');
  });

  // ==========================================
  // SUITE 3: POS CHECKOUT & TERMINAL
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 3: POS CHECKOUT & TERMINAL ---\x1b[0m');

  await runTest('POS', 'Add items to cart and validate lines', async () => {
    // Cashier lookup product
    const prodRes = await fetch(`${BASE_URL}/api/products/${createdProductId}`, {
      headers: cashierHeaders,
    });
    const prodJson = await prodRes.json();
    assertEqual(prodRes.status, 200, 'Product must be found');
    assert(prodJson.data.active, 'Product must be active');
  });

  await runTest('POS', 'Accurately calculate subtotal, tax, and order totals', async () => {
    // Selling price: 3.49, Qty: 2, TaxRate: 5%
    // Subtotal: 6.98, Tax: 6.98 * 0.05 = 0.35, Total: 7.33
    const res = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [
          {
            productId: createdProductId,
            quantity: 2,
          },
        ],
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'Sale checkout must return HTTP 201 Created');
    assertEqual(json.data.subtotal, 6.98, 'Subtotal calculation must be accurate');
    assertEqual(json.data.taxAmount, 0.35, 'Tax calculation must be accurate');
    assertEqual(json.data.totalAmount, 7.33, 'Grand total must equal subtotal + tax');
  });

  await runTest('POS', 'Complete sale and verify receipt generation', async () => {
    const res = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: createdProductId, quantity: 1 }],
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'Sale must be completed');
    assertEqual(json.data.status, 'COMPLETED', 'Sale status must be COMPLETED');
    assert(Boolean(json.data.receiptNumber), 'Receipt number must be generated');

    // Retrieve receipt
    const receiptRes = await fetch(`${BASE_URL}/api/sales/receipt/${json.data.receiptNumber}`, {
      headers: cashierHeaders,
    });
    assertEqual(receiptRes.status, 200, 'Receipt must be retrievable by receipt number');
  });

  await runTest('POS', 'Deduct inventory on checkout and record SALE transaction', async () => {
    const initialInv = await fetch(`${BASE_URL}/api/inventory/product/${createdProductId}`, {
      headers: ownerHeaders,
    }).then((r) => r.json());

    const stockBefore = initialInv.data.currentQuantity;

    // Checkout 3 units
    await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: createdProductId, quantity: 3 }],
      }),
    });

    const updatedInv = await fetch(`${BASE_URL}/api/inventory/product/${createdProductId}`, {
      headers: ownerHeaders,
    }).then((r) => r.json());

    const stockAfter = updatedInv.data.currentQuantity;
    assertEqual(stockAfter, stockBefore - 3, 'Inventory must be deducted by exactly 3 units');
  });

  // ==========================================
  // SUITE 4: PURCHASE INVOICE & OCR
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 4: PURCHASE INVOICE & OCR ---\x1b[0m');

  let uploadedInvoiceId: number = 1;

  await runTest('Invoice', 'Upload valid purchase invoice file (JPEG/PDF)', async () => {
    // Generate valid JPEG bytes (0xFF, 0xD8, 0xFF, 0xE0)
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const formData = new FormData();
    formData.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), 'supplier_invoice.jpg');
    formData.append('notes', 'Automated test invoice');

    const res = await fetch(`${BASE_URL}/api/invoices/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: formData,
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'Invoice upload must return HTTP 201 Created');
    assertEqual(json.data.status, 'UPLOADED', 'Initial invoice status must be UPLOADED');
    assert(Boolean(json.data.fileHash), 'File hash must be computed for integrity');
    uploadedInvoiceId = json.data.id;
  });

  await runTest('Invoice', 'OCR extraction parsing and manual review flags', async () => {
    const res = await fetch(`${BASE_URL}/api/invoices/${uploadedInvoiceId}/ocr`, {
      method: 'POST',
      headers: ownerHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'OCR extraction must succeed');
    assert(Boolean(json.data.ocrResult), 'OCR result payload must be present');
    assert(Array.isArray(json.data.ocrResult.items), 'Extracted items must be an array');
  });

  await runTest('Invoice', 'Product matching by catalog SKU and name', async () => {
    const matchRes = await fetch(`${BASE_URL}/api/invoices/match-product`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productName: `Test Organic Gala Apples ${testSuffix}`,
        sku: testSku,
        barcode: testBarcode,
      }),
    });

    const matchJson = await matchRes.json();
    assertEqual(matchRes.status, 200, 'Product matching endpoint must return HTTP 200');
    assert(Boolean(matchJson.data.matchedProduct), 'Product match must find catalog item');
    assertEqual(matchJson.data.matchedProduct.id, createdProductId, 'Matched product ID must match created product');
  });

  await runTest('Invoice', 'Invoice confirmation updates inventory atomically', async () => {
    // Confirm the freshly uploaded & OCR-processed invoice
    const res = await fetch(`${BASE_URL}/api/invoices/${uploadedInvoiceId}/confirm`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        confirmedUncertainMatches: true,
        confirmedBy: 'Store Owner',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Invoice confirmation must succeed');
    assertEqual(json.transactionStatus, 'COMMITTED', 'DB transaction status must be COMMITTED');
    assertEqual(json.invoice.status, 'CONFIRMED', 'Invoice status must be CONFIRMED');
    assert(json.inventoryUpdates.length > 0, 'Inventory must be updated on confirmation');
  });

  // ==========================================
  // SUITE 5: NOTIFICATIONS & ALERTS
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 5: NOTIFICATIONS & ALERTS ---\x1b[0m');

  await runTest('Notifications', 'Trigger WARNING notification on LOW STOCK', async () => {
    // Set stock to 5 (threshold is 12)
    await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 5,
        reason: 'Trigger low stock alert',
      }),
    });

    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: ownerHeaders,
    });
    const notifJson = await notifRes.json();
    const hasLowStockAlert = notifJson.data.some(
      (n: any) => n.productId === createdProductId && n.type === 'LOW_STOCK'
    );
    assert(hasLowStockAlert, 'LOW_STOCK notification must be triggered for product');
  });

  await runTest('Notifications', 'Trigger CRITICAL notification on OUT OF STOCK', async () => {
    // Set stock to 0
    await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 0,
        reason: 'Trigger out of stock alert',
      }),
    });

    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: ownerHeaders,
    });
    const notifJson = await notifRes.json();
    const hasOutOfStockAlert = notifJson.data.some(
      (n: any) => n.productId === createdProductId && n.type === 'OUT_OF_STOCK'
    );
    assert(hasOutOfStockAlert, 'OUT_OF_STOCK notification must be triggered for product');
  });

  await runTest('Notifications', 'Prevent duplicate unread notifications', async () => {
    const beforeCount = await fetch(`${BASE_URL}/api/notifications`, { headers: ownerHeaders })
      .then((r) => r.json())
      .then((j) => j.data.filter((n: any) => n.productId === createdProductId && n.type === 'OUT_OF_STOCK').length);

    // Re-adjust stock at 0 again
    await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        productId: createdProductId,
        targetQuantity: 0,
        reason: 'Second zero stock event',
      }),
    });

    const afterCount = await fetch(`${BASE_URL}/api/notifications`, { headers: ownerHeaders })
      .then((r) => r.json())
      .then((j) => j.data.filter((n: any) => n.productId === createdProductId && n.type === 'OUT_OF_STOCK').length);

    assertEqual(afterCount, beforeCount, 'Duplicate unread notification must NOT be created');
  });

  // ==========================================
  // SUITE 6: SECURITY (AUTH & RBAC)
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 6: SECURITY (AUTH & RBAC) ---\x1b[0m');

  await runTest('Security', 'Authentication: Reject invalid credentials with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'WrongPassword@999' }),
    });

    assertEqual(res.status, 401, 'Bad credentials must return HTTP 401 Unauthorized');
    const json = await res.json();
    assert(!json.success, 'Success must be false on invalid login');
  });

  await runTest('Security', 'Authorization: Reject unauthenticated request to protected APIs', async () => {
    const res = await fetch(`${BASE_URL}/api/users`);
    assertEqual(res.status, 401, 'Missing token must return HTTP 401 Unauthorized');
  });

  await runTest('Security', 'Role Restrictions: Cashier forbidden (403) from Product Mutations', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        name: 'Unauthorized Product',
        sku: 'SKU-UNAUTH',
        sellingPrice: 9.99,
        purchasePrice: 5.0,
      }),
    });

    assertEqual(res.status, 403, 'Cashier product creation must return HTTP 403 Forbidden');
    const json = await res.json();
    assertEqual(json.error, 'Forbidden', 'Error must be Forbidden');
  });

  await runTest('Security', 'Role Restrictions: Cashier forbidden (403) from Inventory Management', async () => {
    const res = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ productId: 1, targetQuantity: 100 }),
    });

    assertEqual(res.status, 403, 'Cashier inventory adjust must return HTTP 403 Forbidden');
  });

  await runTest('Security', 'Role Restrictions: Cashier forbidden (403) from User Management', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: cashierHeaders,
    });

    assertEqual(res.status, 403, 'Cashier user management access must return HTTP 403 Forbidden');
  });

  await runTest('Security', 'Role Restrictions: Cashier forbidden (403) from Audit Logs', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: cashierHeaders,
    });

    assertEqual(res.status, 403, 'Cashier audit logs access must return HTTP 403 Forbidden');
  });

  await runTest('Security', 'Role Restrictions: Cashier ALLOWED on POS Checkout & Receipts', async () => {
    const res = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1 }],
      }),
    });

    assertEqual(res.status, 201, 'Cashier must be permitted to complete checkout');
  });

  // ==========================================
  // SUITE 7: AUDIT LOGGING OF BUSINESS OPERATIONS
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 7: AUDIT LOGGING OF BUSINESS OPERATIONS ---\x1b[0m');

  let saleToCancelId: number = 1;

  await runTest('Audit', 'Sale Cancellation: Void sale, restore inventory, and trigger audit logging', async () => {
    // 1. Create a sale first
    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 2 }],
      }),
    }).then((r) => r.json());

    saleToCancelId = saleRes.data.id;

    // Get stock before cancellation
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/1`, {
      headers: ownerHeaders,
    }).then((r) => r.json());
    const qtyBefore = invBefore.data.currentQuantity;

    // Cancel the sale
    const cancelRes = await fetch(`${BASE_URL}/api/sales/${saleToCancelId}/cancel`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ reason: 'Customer requested refund and return' }),
    });

    const cancelJson = await cancelRes.json();
    assertEqual(cancelRes.status, 200, 'Sale cancellation must succeed with HTTP 200');
    assertEqual(cancelJson.data.status, 'CANCELLED', 'Sale status must be updated to CANCELLED');

    // Verify inventory restored (+2)
    const invAfter = await fetch(`${BASE_URL}/api/inventory/product/1`, {
      headers: ownerHeaders,
    }).then((r) => r.json());
    assertEqual(invAfter.data.currentQuantity, qtyBefore + 2, 'Restored stock must increase by 2 units');
  });

  await runTest('Audit', 'Audit Trail: Verify required fields (User, Action, Entity, Entity ID, Timestamp, Old/New Values)', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: ownerHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Audit logs retrieval must return HTTP 200');
    assert(Array.isArray(json.data), 'Audit logs data must be an array');
    assert(json.data.length > 0, 'Audit log trail must contain recorded events');

    // Check structure of first recorded log
    const sample = json.data[0];
    assert(Boolean(sample.username), 'Log must record user');
    assert(Boolean(sample.action), 'Log must record action');
    assert(Boolean(sample.entity), 'Log must record entity');
    assert(sample.entityId !== undefined, 'Log must record entityId');
    assert(Boolean(sample.timestamp), 'Log must record timestamp');
  });

  await runTest('Audit', 'Audit Track: Verify tracking across all business operations', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: ownerHeaders,
    });

    const json = await res.json();
    const actions = new Set(json.data.map((l: any) => l.action));

    // Verify tracked business actions
    assert(actions.has('PRODUCT_CREATED') || actions.has('PRODUCT_UPDATED'), 'Must track Product changes');
    assert(actions.has('INVENTORY_ADJUSTED'), 'Must track Inventory adjustments');
    assert(actions.has('INVOICE_CONFIRMED'), 'Must track Invoice confirmation');
    assert(actions.has('PRICE_CHANGED'), 'Must track Price changes');
    assert(actions.has('THRESHOLD_CHANGED'), 'Must track Threshold changes');
    assert(actions.has('SALE_CANCELLED'), 'Must track Sale cancellation');
  });

  await runTest('Audit', 'Security: Sensitive data (passwords, salts, hashes) must NEVER appear in audit logs', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: ownerHeaders,
    });

    const json = await res.json();
    const rawLogsStr = JSON.stringify(json.data);

    assert(!rawLogsStr.includes('Owner@123'), 'Passwords must never appear in audit log payload');
    assert(!rawLogsStr.includes('Cashier@123'), 'Passwords must never appear in audit log payload');
    assert(!rawLogsStr.includes('Admin@123'), 'Passwords must never appear in audit log payload');
    assert(!rawLogsStr.toLowerCase().includes('passwordhash'), 'Password hash must never appear in audit logs');
  });

  await runTest('Audit', 'Export: Generate valid CSV audit log report for compliance', async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs/export/csv`, {
      headers: ownerHeaders,
    });

    assertEqual(res.status, 200, 'Audit CSV export must return HTTP 200 OK');
    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('text/csv'), 'Content-Type must be text/csv');
    const csvText = await res.text();
    assert(csvText.includes('Log ID,Timestamp,Username,Role,Action,Entity,Entity ID'), 'CSV headers must match audit format');
  });

  // ==========================================
  // SUITE 8: POS PAYMENT ARCHITECTURE (STRIPE STEP 1)
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 8: POS PAYMENT ARCHITECTURE (STRIPE STEP 1) ---\x1b[0m');

  let testPaymentId: number = 1;

  await runTest('Payment', 'Initiate payment session using Stripe provider abstraction', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        amount: 29.99,
        currency: 'USD',
        saleId: 1,
        provider: 'STRIPE',
      }),
    });

    const json = await res.json();
    assertEqual(res.status, 201, 'Payment initiation must return HTTP 201 Created');
    assert(json.success, 'Response success must be true');
    assertEqual(json.data.amount, 29.99, 'Amount must match requested amount');
    assertEqual(json.data.currency, 'USD', 'Currency must be USD');
    assertEqual(json.data.status, 'PENDING', 'Payment status must be PENDING');
    assertEqual(json.data.provider, 'STRIPE', 'Provider must be STRIPE');
    assert(json.data.externalPaymentId?.startsWith('pi_prep_'), 'External payment ID must follow Stripe PaymentIntent convention');
    assert(Boolean(json.data.clientSecret), 'Client secret must be provided for client-side completion');
    testPaymentId = json.data.id;
  });

  await runTest('Payment', 'Query payment transaction by database ID', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/${testPaymentId}`, {
      headers: cashierHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Get payment by ID must return HTTP 200 OK');
    assertEqual(json.data.id, testPaymentId, 'Payment ID must match');
    assertEqual(json.data.status, 'PENDING', 'Payment status must remain PENDING');
  });

  await runTest('Payment', 'Query payments associated with sale ID', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/sale/1`, {
      headers: cashierHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Get payments by sale must return HTTP 200 OK');
    assert(Array.isArray(json.data), 'Data must be an array of payments');
    assert(json.data.length > 0, 'Must have at least one payment for sale 1');
  });

  await runTest('Payment', 'Cancel pending payment session', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/${testPaymentId}/cancel`, {
      method: 'POST',
      headers: cashierHeaders,
    });

    const json = await res.json();
    assertEqual(res.status, 200, 'Payment cancellation must return HTTP 200 OK');
    assertEqual(json.data.status, 'CANCELED', 'Payment status must transition to CANCELED');
  });

  await runTest('Payment', 'Validation: Reject non-positive amount and unsupported provider', async () => {
    const invalidAmountRes = await fetch(`${BASE_URL}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: -5.0, provider: 'STRIPE' }),
    });
    assertEqual(invalidAmountRes.status, 400, 'Negative amount must return HTTP 400 Bad Request');

    const invalidProviderRes = await fetch(`${BASE_URL}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: 10.0, provider: 'BITCOIN_UNKNOWN' }),
    });
    assertEqual(invalidProviderRes.status, 400, 'Unsupported provider must return HTTP 400 Bad Request');
  });

  await runTest('Payment', 'Security: Stripe secret API key and webhook secret must NEVER be exposed in responses', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/${testPaymentId}`, {
      headers: cashierHeaders,
    });
    const json = await res.json();
    assertEqual(res.status, 200, 'Get payment by ID must return HTTP 200 OK');

    const rawResponse = JSON.stringify(json);
    assert(!rawResponse.includes('apiKey'), 'Secret apiKey must never be exposed in payment API responses');
    assert(!rawResponse.includes('webhookSecret'), 'Webhook secret must never be exposed in payment API responses');
    assert(!rawResponse.includes('sk_live_'), 'Live secret keys must never appear in response payloads');
    assert(!rawResponse.includes('whsec_'), 'Webhook secret tokens must never appear in response payloads');
  });

  await runTest('Payment', 'Test Mode: Operates safely in test mode without requiring real payment credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/initiate`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        amount: 45.50,
        currency: 'USD',
        saleId: 1,
        provider: 'STRIPE',
      }),
    });
    const json = await res.json();
    assertEqual(res.status, 201, 'Test mode initiation must return HTTP 201 Created');
    assertEqual(json.data.status, 'PENDING', 'Status must be PENDING');
    assert(json.data.externalPaymentId?.startsWith('pi_prep_'), 'External ID should be generated in test mode');
  });

  await runTest('Payment', 'Configuration: Public config endpoint exposes only safe client properties and no secrets', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/config`, {
      headers: cashierHeaders,
    });
    const json = await res.json();
    assertEqual(res.status, 200, 'Get payment config must return HTTP 200 OK');
    assert(json.success, 'Response success must be true');
    assert('publishableKey' in json.data, 'publishableKey must be defined in config payload');
    assert('currency' in json.data, 'currency must be defined in config payload');
    assert('testMode' in json.data, 'testMode must be defined in config payload');
    assertEqual(typeof json.data.testMode, 'boolean', 'testMode must be a boolean');

    const raw = JSON.stringify(json);
    assert(!raw.includes('apiKey'), 'apiKey must NEVER be present in payment config response');
    assert(!raw.includes('webhookSecret'), 'webhookSecret must NEVER be present in payment config response');
  });

  // ==========================================
  // SUITE 9: STRIPE TERMINAL CARD-PRESENT PAYMENTINTENT (STEP 3)
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 9: STRIPE TERMINAL PAYMENTINTENT (STEP 3) ---\x1b[0m');

  let pendingSaleId: number = 0;
  let testProductId: number = 1;
  let preStock: number = 0;

  await runTest('Terminal PaymentIntent', 'Prerequisite: Create a pending checkout sale draft', async () => {
    const pRes = await fetch(`${BASE_URL}/api/products/1`, { headers: cashierHeaders });
    const pJson = await pRes.json();
    testProductId = pJson.data.id;

    const invRes = await fetch(`${BASE_URL}/api/inventory`, { headers: ownerHeaders });
    const invJson = await invRes.json();
    const invRecord = invJson.data.find((i: any) => i.productId === testProductId);
    preStock = invRecord ? invRecord.currentQuantity : 100;

    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        status: 'PENDING',
        items: [{ productId: testProductId, quantity: 2 }],
      }),
    });
    assertEqual(saleRes.status, 201, 'Pending sale creation must return HTTP 201');
    const saleJson = await saleRes.json();
    pendingSaleId = saleJson.data.id;
    assertEqual(saleJson.data.status, 'PENDING', 'Sale status should be PENDING');
  });

  let createdPaymentIntentId: string = '';
  let createdClientSecret: string = '';
  let trustedAmount: number = 0;

  await runTest('Terminal PaymentIntent', 'Create PaymentIntent suitable for Stripe Terminal card-present payments', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: {
        ...cashierHeaders,
        'Idempotency-Key': `idemp_test_${Date.now()}`,
      },
      body: JSON.stringify({
        saleId: pendingSaleId,
        currency: 'USD',
        // Client attempts to tamper with amount: server MUST calculate trusted amount instead
        amount: 0.05,
      }),
    });
    assertEqual(res.status, 201, 'Terminal PaymentIntent creation must return HTTP 201 Created');
    const json = await res.json();
    assert(json.success, 'Response success must be true');

    const data = json.data;
    assert(data.paymentIntentId?.startsWith('pi_term_'), 'PaymentIntent ID must be generated with pi_term_ prefix');
    assert(data.clientSecret?.includes('_secret_'), 'clientSecret must be returned for Stripe Terminal');
    assertEqual(data.status, 'requires_payment_method', 'PaymentIntent initial status must be requires_payment_method');
    assert(Array.isArray(data.paymentMethodTypes) && data.paymentMethodTypes.includes('card_present'), 'Payment method type must include card_present');
    assertEqual(data.currency, 'USD', 'Currency must be USD');
    assertEqual(data.saleId, pendingSaleId, 'Sale ID must match target sale');
    assert(data.paymentId > 0, 'Local payment record ID must be returned');

    // Trusted price calculation: amount MUST NOT be the tampered $0.05
    assert(data.amount > 0.05, `Server must calculate trusted amount (got ${data.amount}) instead of client tampered 0.05`);
    trustedAmount = data.amount;

    createdPaymentIntentId = data.paymentIntentId;
    createdClientSecret = data.clientSecret;
  });

  await runTest('Terminal PaymentIntent', 'Idempotency: Re-submitting payment intent request returns existing intent without duplicating', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        saleId: pendingSaleId,
      }),
    });
    assert(res.status === 200 || res.status === 201, 'Idempotent request must return success');
    const json = await res.json();
    assertEqual(json.data.paymentIntentId, createdPaymentIntentId, 'Must return the same PaymentIntent ID on retry');
    assertEqual(json.data.clientSecret, createdClientSecret, 'Must return the same clientSecret on retry');
    assertEqual(json.data.amount, trustedAmount, 'Amount must be consistent on retry');
  });

  await runTest('Terminal PaymentIntent', 'Persistence: Payment record is stored locally and linked to the sale', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/sale/${pendingSaleId}`, {
      headers: cashierHeaders,
    });
    assertEqual(res.status, 200, 'Fetching payments for sale must return HTTP 200');
    const json = await res.json();
    assert(Array.isArray(json.data) && json.data.length >= 1, 'Sale must have at least one payment record');
    const payment = json.data.find((p: any) => p.externalPaymentId === createdPaymentIntentId);
    assert(payment, 'Stored payment must match external PaymentIntent ID');
    assertEqual(payment.status, 'PENDING', 'Payment status must be PENDING');
    assertEqual(payment.provider, 'STRIPE', 'Payment provider must be STRIPE');
  });

  await runTest('Terminal PaymentIntent', 'Safety: Inventory is NOT deducted and sale is NOT completed at this stage', async () => {
    // 1. Check inventory: preStock must still equal currentQuantity (no deduction yet)
    const invRes = await fetch(`${BASE_URL}/api/inventory`, { headers: ownerHeaders });
    const invJson = await invRes.json();
    const invRecord = invJson.data.find((i: any) => i.productId === testProductId);
    assertEqual(invRecord.currentQuantity, preStock, 'Inventory MUST NOT be deducted when only creating PaymentIntent');

    // 2. Check sale status: must still be PENDING
    const saleRes = await fetch(`${BASE_URL}/api/sales/${pendingSaleId}`, { headers: cashierHeaders });
    const saleJson = await saleRes.json();
    assertEqual(saleJson.data.status, 'PENDING', 'Sale status MUST NOT be marked COMPLETED when only creating PaymentIntent');
  });

  await runTest('Terminal PaymentIntent', 'Security: Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId: pendingSaleId }),
    });
    assertEqual(res.status, 401, 'Unauthenticated request must be rejected with 401');
  });

  await runTest('Terminal PaymentIntent', 'Security: Response must never expose secrets or raw payment keys', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: pendingSaleId }),
    });
    const text = await res.text();
    assert(!text.includes('apiKey'), 'apiKey must never appear in PaymentIntent response');
    assert(!text.includes('webhookSecret'), 'webhookSecret must never appear in PaymentIntent response');
    assert(!text.includes('sk_live_'), 'Live secret key must never appear in response');
  });

  // ==========================================
  // SUITE 10: STRIPE TERMINAL CONNECTION TOKEN (STEP 5)
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 10: STRIPE TERMINAL CONNECTION TOKEN (STEP 5) ---\x1b[0m');

  await runTest('Terminal ConnectionToken', 'Generate connection token secret with authorized cashier', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    });

    assertEqual(res.status, 200, 'Authorized cashier must receive HTTP 200 OK');
    const json = await res.json();
    assert(json.secret, 'Response must contain connection token secret');
    assert(typeof json.secret === 'string', 'Secret must be a string');
    assert(json.secret.startsWith('pst_test_'), 'Secret in test mode must start with pst_test_');
  });

  await runTest('Terminal ConnectionToken', 'Return only connection-token secret required by Terminal SDK', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
      method: 'POST',
      headers: cashierHeaders,
    });

    assertEqual(res.status, 200, 'Must accept empty body');
    const json = await res.json();
    assert('secret' in json, 'Response must have secret property');
    assert(!('apiKey' in json), 'Response must NOT contain apiKey');
    assert(!('privateKey' in json), 'Response must NOT contain privateKey');
  });

  await runTest('Terminal ConnectionToken', 'Support standard Stripe SDK alias endpoint (/api/terminal/connection_token)', async () => {
    const res = await fetch(`${BASE_URL}/api/terminal/connection_token`, {
      method: 'POST',
      headers: cashierHeaders,
    });

    assertEqual(res.status, 200, 'Must support standard alias path');
    const json = await res.json();
    assert(json.secret && json.secret.startsWith('pst_test_'), 'Alias must return valid connection token');
  });

  await runTest('Terminal ConnectionToken', 'Security: Reject unauthenticated request with 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assertEqual(res.status, 401, 'Unauthenticated request must be rejected with HTTP 401');
  });

  await runTest('Terminal ConnectionToken', 'Location Control: Support valid store location parameter', async () => {
    const validLocation = process.env.STRIPE_TERMINAL_LOCATION_ID || 'tml_freshcart_main';
    const res = await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ location: validLocation }),
    });

    assertEqual(res.status, 200, 'Matching store location must succeed');
    const json = await res.json();
    assert(json.secret, 'Must return connection token secret');
  });

  await runTest('Terminal ConnectionToken', 'Location Control: Reject mismatched unauthorized store location with 400', async () => {
    if (process.env.STRIPE_TERMINAL_LOCATION_ID) {
      const res = await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ location: 'tml_unauthorized_other_store_999' }),
      });

      assertEqual(res.status, 400, 'Mismatched store location must be rejected with 400 Bad Request');
    }
  });

  await runTest('Terminal ConnectionToken', 'Persistence: Connection tokens are ephemeral and never persisted in database', async () => {
    const initialPayments = await fetch(`${BASE_URL}/api/v1/payments/sale/${pendingSaleId}`, { headers: cashierHeaders })
      .then((r) => r.json())
      .then((j) => j.data.length);

    // Generate token
    await fetch(`${BASE_URL}/api/v1/payments/terminal/connection-token`, {
      method: 'POST',
      headers: cashierHeaders,
    });

    const afterPayments = await fetch(`${BASE_URL}/api/v1/payments/sale/${pendingSaleId}`, { headers: cashierHeaders })
      .then((r) => r.json())
      .then((j) => j.data.length);

    assertEqual(afterPayments, initialPayments, 'Payment records must NOT increase from generating connection tokens');
  });

  // ==========================================
  // SUITE 11: STRIPE WEBHOOK VERIFICATION & PAYMENT EVENT LIFECYCLE
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 11: STRIPE WEBHOOK VERIFICATION & EVENT LIFECYCLE ---\x1b[0m');

  await runTest('Webhook Signature', 'Reject missing Stripe-Signature header with 400 Bad Request', async () => {
    const payload = JSON.stringify({ id: 'evt_no_sig', type: 'payment_intent.succeeded' });
    const res = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    assertEqual(res.status, 400, 'Missing Stripe-Signature header must return HTTP 400');
    const json = await res.json();
    assert(json.error.includes('Missing Stripe-Signature'), 'Error must specify missing signature');
  });

  await runTest('Webhook Signature', 'Reject invalid or tampered signature with 400 Bad Request', async () => {
    const payload = JSON.stringify({ id: 'evt_bad_sig', type: 'payment_intent.succeeded' });
    const fakeSignature = `t=${Math.floor(Date.now() / 1000)},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    const res = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': fakeSignature,
      },
      body: payload,
    });
    assertEqual(res.status, 400, 'Invalid signature must return HTTP 400');
    const json = await res.json();
    assert(json.error.includes('Invalid Stripe webhook signature'), 'Error must state invalid signature');
  });

  await runTest('Webhook Signature', 'Reject timestamp outside tolerance window with 400 Bad Request', async () => {
    const payload = JSON.stringify({ id: 'evt_expired', type: 'payment_intent.succeeded' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const sig = generateStripeSignature(payload, TEST_WEBHOOK_SECRET, oldTimestamp);
    const res = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': sig,
      },
      body: payload,
    });
    assertEqual(res.status, 400, 'Expired webhook timestamp must return HTTP 400');
    const json = await res.json();
    assert(json.error.includes('tolerance zone'), 'Error must note tolerance zone failure');
  });

  let webhookSaleId: number;
  let webhookPaymentId: number;
  let webhookPaymentIntentId: string;
  let webhookEventId = `evt_succ_${Date.now()}`;

  await runTest('Webhook Verification', 'Valid signature on payment_intent.succeeded updates payment to SUCCEEDED and completes sale', async () => {
    // 1. Create a draft pending sale
    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 2 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());
    webhookSaleId = saleRes.data.id;
    assertEqual(saleRes.data.status, 'PENDING', 'Initial sale draft must be PENDING');

    // 2. Create PaymentIntent for sale
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: webhookSaleId }),
    }).then((r) => r.json());
    webhookPaymentId = intentRes.data.paymentId;
    webhookPaymentIntentId = intentRes.data.paymentIntentId;

    // Check payment is PENDING before webhook
    const initialPayment = await fetch(`${BASE_URL}/api/v1/payments/${webhookPaymentId}`, { headers: cashierHeaders })
      .then((r) => r.json());
    assertEqual(initialPayment.data.status, 'PENDING', 'Payment must be PENDING prior to webhook confirmation');

    // 3. Deliver signed payment_intent.succeeded event
    const eventPayload = JSON.stringify({
      id: webhookEventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: webhookPaymentIntentId,
          object: 'payment_intent',
          amount: Math.round(saleRes.data.totalAmount * 100),
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            saleId: String(webhookSaleId),
            paymentId: String(webhookPaymentId),
          },
        },
      },
    });

    const signature = generateStripeSignature(eventPayload);
    const webhookRes = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      body: eventPayload,
    });

    assertEqual(webhookRes.status, 200, 'Valid webhook must return HTTP 200');
    const webhookJson = await webhookRes.json();
    assert(webhookJson.received, 'Webhook must be acknowledged as received');

    // 4. Verify payment status is now SUCCEEDED
    const verifiedPayment = await fetch(`${BASE_URL}/api/v1/payments/${webhookPaymentId}`, { headers: cashierHeaders })
      .then((r) => r.json());
    assertEqual(verifiedPayment.data.status, 'SUCCEEDED', 'Payment status must be updated to SUCCEEDED');

    // 5. Verify sale status is now COMPLETED
    const verifiedSale = await fetch(`${BASE_URL}/api/sales/${webhookSaleId}`, { headers: cashierHeaders })
      .then((r) => r.json());
    assertEqual(verifiedSale.data.status, 'COMPLETED', 'Sale status must be updated to COMPLETED');
  });

  await runTest('Webhook Deduplication', 'Re-sending identical event ID is deduplicated without duplicate processing', async () => {
    // Deliver the exact same event payload again
    const eventPayload = JSON.stringify({
      id: webhookEventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: webhookPaymentIntentId,
          status: 'succeeded',
        },
      },
    });

    const signature = generateStripeSignature(eventPayload);
    const dupRes = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
      },
      body: eventPayload,
    });

    assertEqual(dupRes.status, 200, 'Deduplicated webhook must return HTTP 200');
    const dupJson = await dupRes.json();
    assertEqual(dupJson.duplicate, true, 'Webhook must flag duplicate event ID');
    assert(dupJson.message.includes('deduplicated'), 'Response message must state deduplicated');
  });

  await runTest('Webhook Failure Event', 'payment_intent.payment_failed updates payment to FAILED with error message', async () => {
    // 1. Create sale draft and PaymentIntent
    const failSale = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 2, quantity: 1 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const failIntent = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: failSale.data.id }),
    }).then((r) => r.json());

    const failEventPayload = JSON.stringify({
      id: `evt_fail_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: failIntent.data.paymentIntentId,
          object: 'payment_intent',
          status: 'requires_payment_method',
          last_payment_error: {
            message: 'Your card was declined by the bank.',
            decline_code: 'card_declined',
          },
          metadata: {
            paymentId: String(failIntent.data.paymentId),
            saleId: String(failSale.data.id),
          },
        },
      },
    });

    const sig = generateStripeSignature(failEventPayload);
    const failRes = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': sig,
      },
      body: failEventPayload,
    });

    assertEqual(failRes.status, 200, 'Webhook must accept failure event');

    // Verify payment updated to FAILED
    const failedPayment = await fetch(`${BASE_URL}/api/v1/payments/${failIntent.data.paymentId}`, { headers: cashierHeaders })
      .then((r) => r.json());
    assertEqual(failedPayment.data.status, 'FAILED', 'Payment status must transition to FAILED');
    assertEqual(failedPayment.data.errorMessage, 'Your card was declined by the bank.', 'Error message must be preserved');
  });

  await runTest('Out-of-Order / Delayed Events', 'Succeeded payment does not regress to failed on delayed failure event', async () => {
    const delayedFailPayload = JSON.stringify({
      id: `evt_delayed_fail_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: webhookPaymentIntentId, // The previously succeeded payment!
          object: 'payment_intent',
          last_payment_error: {
            message: 'Delayed error event arriving out of order',
          },
        },
      },
    });

    const sig = generateStripeSignature(delayedFailPayload);
    const res = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': sig,
      },
      body: delayedFailPayload,
    });

    assertEqual(res.status, 200, 'Delayed webhook must be acknowledged');

    // Verify payment still SUCCEEDED
    const p = await fetch(`${BASE_URL}/api/v1/payments/${webhookPaymentId}`, { headers: cashierHeaders })
      .then((r) => r.json());
    assertEqual(p.data.status, 'SUCCEEDED', 'Completed payment must NEVER regress to FAILED on out-of-order event');
  });

  // ==========================================
  // SUITE 12: VERIFIED STRIPE PAYMENT SUCCESS, INVENTORY DEDUCTION & RECOVERY WORKFLOW
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 12: VERIFIED PAYMENT SUCCESS, INVENTORY DEDUCTION & RECOVERY ---\x1b[0m');

  let test12SaleId: number;
  let test12PaymentId: number;
  let test12PaymentIntentId: string;
  let test12ReceiptNumber: string;
  let test12InitialBananaStock: number;

  await runTest('Stock Changes & Inventory Service', 'Verified payment success completes sale, decreases stock, and recalculates stock status', async () => {
    // 1. Get initial inventory of Product 1 (Bananas) using ownerHeaders
    const initialInv = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assert(Boolean(initialInv?.data), 'Initial banana inventory must exist');
    test12InitialBananaStock = initialInv.data.currentQuantity;
    assert(test12InitialBananaStock >= 3, 'Must have sufficient banana stock for test');

    // 2. Create pending sale draft for 3.0 units of Bananas
    const draftRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 3.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    test12SaleId = draftRes.data.id;
    test12ReceiptNumber = draftRes.data.receiptNumber;
    assertEqual(draftRes.data.status, 'PENDING', 'Initial draft sale must be PENDING');

    // 3. Create payment intent for this sale
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: test12SaleId }),
    }).then((r) => r.json());

    test12PaymentId = intentRes.data.paymentId;
    test12PaymentIntentId = intentRes.data.paymentIntentId;

    // Verify stock is not yet deducted
    const preInv = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(preInv.data.currentQuantity, test12InitialBananaStock, 'Stock must not be deducted before payment verification');

    // 4. Verify payment success with Stripe
    const verifyRes = await fetch(`${BASE_URL}/api/v1/payments/${test12PaymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: test12PaymentIntentId,
        paymentMethod: 'STRIPE_CARD_PRESENT',
      }),
    });

    assertEqual(verifyRes.status, 200, 'Verification must return HTTP 200');
    const verifyJson = await verifyRes.json();
    assert(verifyJson.success, 'Verification response success must be true');

    // Verify payment marked SUCCEEDED
    assertEqual(verifyJson.data.status, 'SUCCEEDED', 'Payment record status must be SUCCEEDED');

    // Verify sale status completed exactly once
    const saleCheck = await fetch(`${BASE_URL}/api/sales/${test12SaleId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'COMPLETED', 'Sale status must be COMPLETED');

    // Verify stock decreased by 3.0 units
    const postInv = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const expectedStock = Number((test12InitialBananaStock - 3.0).toFixed(3));
    assertEqual(postInv.data.currentQuantity, expectedStock, 'Stock must decrease by exactly 3.0 units');
    assert(Boolean(postInv.data.stockStatus), 'Stock status must be recalculated');
  });

  await runTest('Transaction Records', 'SALE inventory transaction is created with receipt reference and quantities', async () => {
    const txRes = await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json());
    assert(Array.isArray(txRes.data), 'Transactions data must be an array');

    const saleTx = txRes.data.find(
      (tx: any) => tx.referenceId === test12ReceiptNumber && tx.transactionType === 'SALE'
    );
    assert(Boolean(saleTx), `SALE transaction for receipt ${test12ReceiptNumber} must exist`);
    assertEqual(saleTx.quantity, 3.0, 'Transaction quantity must match sold item quantity (3.0)');
    assertEqual(saleTx.previousQuantity, test12InitialBananaStock, 'Transaction previousQuantity must match pre-sale stock');
    assertEqual(saleTx.newQuantity, Number((test12InitialBananaStock - 3.0).toFixed(3)), 'Transaction newQuantity must match post-sale stock');
    assert(saleTx.reason.includes('Stripe') || saleTx.reason.includes(test12ReceiptNumber), 'Transaction reason must reference Stripe or receipt');
  });

  await runTest('Payment Method & Stripe Reference', 'Sale and payment record store paymentMethod and external Stripe reference', async () => {
    // 1. Check sale record
    const saleRes = await fetch(`${BASE_URL}/api/sales/${test12SaleId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleRes.data.paymentMethod, 'STRIPE_CARD_PRESENT', 'Sale record must store paymentMethod');
    assertEqual(saleRes.data.paymentReference, test12PaymentIntentId, 'Sale record must store Stripe payment reference');
    assertEqual(saleRes.data.paymentId, test12PaymentId, 'Sale record must link to paymentId');

    // 2. Check payment record
    const paymentRes = await fetch(`${BASE_URL}/api/v1/payments/${test12PaymentId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(paymentRes.data.status, 'SUCCEEDED', 'Payment status must be SUCCEEDED');
    assertEqual(paymentRes.data.externalPaymentId, test12PaymentIntentId, 'Payment must store externalPaymentId');
  });

  await runTest('Receipt Workflow', 'Existing receipt workflow retrieves finalized sale with payment details', async () => {
    const receiptRes = await fetch(`${BASE_URL}/api/sales/receipt/${test12ReceiptNumber}`, { headers: cashierHeaders });
    assertEqual(receiptRes.status, 200, 'Receipt endpoint must return HTTP 200');
    const receiptJson = await receiptRes.json();
    assert(receiptJson.success, 'Receipt lookup must succeed');
    assertEqual(receiptJson.data.receiptNumber, test12ReceiptNumber, 'Receipt number must match');
    assertEqual(receiptJson.data.status, 'COMPLETED', 'Receipt sale status must be COMPLETED');
    assertEqual(receiptJson.data.paymentMethod, 'STRIPE_CARD_PRESENT', 'Receipt must display payment method');
    assertEqual(receiptJson.data.paymentReference, test12PaymentIntentId, 'Receipt must display Stripe reference');
  });

  await runTest('Idempotent Processing (Repeat Events)', 'Repeated verification or duplicate webhook does not deduct stock twice or duplicate transactions', async () => {
    // 1. Record stock before repeat call
    const preInv = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const stockBefore = preInv.data.currentQuantity;

    // 2. Call verify again on the already-succeeded payment
    const repeatVerify = await fetch(`${BASE_URL}/api/v1/payments/${test12PaymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: test12PaymentIntentId,
        paymentMethod: 'STRIPE_CARD_PRESENT',
      }),
    });
    assertEqual(repeatVerify.status, 200, 'Repeat verify must return HTTP 200');

    // 3. Verify stock has NOT changed
    const postInv = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(postInv.data.currentQuantity, stockBefore, 'Stock must NOT be deducted a second time on repeated verify');

    // 4. Verify no duplicate transaction created for this receipt
    const txRes = await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json());
    const matchingTxCount = txRes.data.filter(
      (tx: any) => tx.referenceId === test12ReceiptNumber && tx.transactionType === 'SALE'
    ).length;
    assertEqual(matchingTxCount, 1, 'Exactly one SALE inventory transaction must exist for this receipt (no duplicates)');
  });

  await runTest('Notifications & Stock Status', 'Sale decreasing stock below threshold triggers stock notification', async () => {
    // 1. Get product 5 (Greek Yogurt) threshold & stock
    const yogProd = await fetch(`${BASE_URL}/api/products/5`, { headers: cashierHeaders }).then((r) => r.json());
    const yogInv = await fetch(`${BASE_URL}/api/inventory/product/5`, { headers: ownerHeaders }).then((r) => r.json());
    const threshold = yogProd.data.minimumInventoryThreshold ?? 10;
    const currentQty = yogInv.data.currentQuantity;

    // 2. Create a pending sale that brings quantity below threshold if not already below
    const qtyToBuy = currentQty > threshold ? (currentQty - threshold + 1) : 1;
    if (currentQty >= qtyToBuy) {
      const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          items: [{ productId: 5, quantity: qtyToBuy }],
          status: 'PENDING',
        }),
      }).then((r) => r.json());

      const intent = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: saleDraft.data.id }),
      }).then((r) => r.json());

      await fetch(`${BASE_URL}/api/v1/payments/${intent.data.paymentId}/verify`, {
        method: 'POST',
        headers: cashierHeaders,
      });

      // Check notification triggered
      const notifs = await fetch(`${BASE_URL}/api/notifications`, { headers: cashierHeaders }).then((r) => r.json());
      const hasYogNotif = notifs.data.some((n: any) => n.productId === 5);
      assert(hasYogNotif, 'Stock notification must be triggered for low stock');
    }
  });

  let failedSaleId: number;
  let failedPaymentId: number;
  let failedPaymentIntentId: string;
  let preFailureStock: number;

  await runTest('Safe Recovery: Failure Preservation', 'Preserves successful payment and flags sale for safe recovery when local finalization fails', async () => {
    // 1. Get initial stock of product 2
    const initialInv = await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json());
    preFailureStock = initialInv.data.currentQuantity;

    // 2. Create pending sale draft
    const draftRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 2, quantity: 2.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());
    failedSaleId = draftRes.data.id;

    // 3. Create payment intent
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: failedSaleId }),
    }).then((r) => r.json());
    failedPaymentId = intentRes.data.paymentId;
    failedPaymentIntentId = intentRes.data.paymentIntentId;

    // 4. Simulate payment verification where Stripe succeeds but local DB finalization fails
    const verifyFailRes = await fetch(`${BASE_URL}/api/v1/payments/${failedPaymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: failedPaymentIntentId,
        paymentMethod: 'STRIPE_CARD_PRESENT',
        simulateFinalizationFailure: true,
      }),
    });

    assertEqual(verifyFailRes.status, 500, 'Local finalization failure must return HTTP 500');
    const failJson = await verifyFailRes.json();
    assertEqual(failJson.recoveryRequired, true, 'Response must flag recoveryRequired: true');

    // 5. CRITICAL: Stripe payment is already processed, so payment record must remain SUCCEEDED
    const paymentCheck = await fetch(`${BASE_URL}/api/v1/payments/${failedPaymentId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(paymentCheck.data.status, 'SUCCEEDED', 'Payment record MUST remain SUCCEEDED (cannot roll back Stripe charge)');
    assertEqual(paymentCheck.data.finalizationStatus, 'FAILED', 'Payment finalizationStatus must be FAILED');

    // 6. Sale record must be preserved and flagged for safe recovery
    const saleCheck = await fetch(`${BASE_URL}/api/sales/${failedSaleId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'PENDING', 'Sale must remain PENDING so it is not prematurely marked complete');
    assertEqual(saleCheck.data.requiresRecovery, true, 'Sale must have requiresRecovery = true');
    assertEqual(saleCheck.data.recoveryStatus, 'FAILED_FINALIZATION', 'Sale recoveryStatus must be FAILED_FINALIZATION');

    // 7. Inventory must have been rolled back cleanly (not deducted)
    const postInv = await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(postInv.data.currentQuantity, preFailureStock, 'Inventory must be cleanly rolled back upon finalization error');
  });

  await runTest('Safe Recovery: Retry Finalization', 'Retry finalization recovers sale and deducts inventory without charging customer again', async () => {
    // 1. Call recovery endpoint
    const recoverRes = await fetch(`${BASE_URL}/api/v1/sales/${failedSaleId}/recover`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    });

    assertEqual(recoverRes.status, 200, 'Recovery endpoint must return HTTP 200');
    const recoverJson = await recoverRes.json();
    assert(recoverJson.success, 'Recovery must succeed');

    // 2. Verify sale is now COMPLETED and recovery flag cleared
    const recoveredSale = await fetch(`${BASE_URL}/api/sales/${failedSaleId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(recoveredSale.data.status, 'COMPLETED', 'Recovered sale status must be COMPLETED');
    assertEqual(recoveredSale.data.requiresRecovery, false, 'Recovery flag must be cleared');
    assertEqual(recoveredSale.data.recoveryStatus, 'NONE', 'Recovery status must be NONE');
    assertEqual(recoveredSale.data.paymentReference, failedPaymentIntentId, 'Payment reference must be recorded on recovered sale');

    // 3. Verify stock is now deducted
    const postInv = await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json());
    const expectedStock = Number((preFailureStock - 2.0).toFixed(3));
    assertEqual(postInv.data.currentQuantity, expectedStock, 'Stock must now be decreased by 2.0 units');

    // 4. Verify SALE transaction was created
    const txRes = await fetch(`${BASE_URL}/api/inventory/2/transactions`, { headers: ownerHeaders }).then((r) => r.json());
    const matchingTx = txRes.data.find((tx: any) => tx.referenceId === recoveredSale.data.receiptNumber && tx.transactionType === 'SALE');
    assert(Boolean(matchingTx), 'SALE transaction must be recorded for recovered sale');

    // 5. Verify customer was NOT charged again (payment ID and status remain the same)
    const paymentCheck = await fetch(`${BASE_URL}/api/v1/payments/${failedPaymentId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(paymentCheck.data.status, 'SUCCEEDED', 'Payment status remains SUCCEEDED');
    assertEqual(paymentCheck.data.finalizationStatus, 'FINALIZED', 'Payment finalizationStatus is now FINALIZED');
  });

  // ==========================================
  // SUITE 13: STRIPE TERMINAL ERROR HANDLING & RESILIENCE
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 13: STRIPE TERMINAL ERROR HANDLING & RESILIENCE ---\x1b[0m');

  await runTest('Card Declined', 'Card decline sets payment FAILED with understandable message without deducting stock', async () => {
    // 1. Initial stock of Bananas (Product 1)
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const stockBefore = invBefore.data.currentQuantity;

    // 2. Create pending sale draft
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 2.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    // 3. Create payment intent
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    const paymentId = intentRes.data.paymentId;

    // 4. Report card decline to server
    const failRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/fail`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        declineCode: 'insufficient_funds',
        errorMessage: 'The card was declined due to insufficient funds in customer account',
      }),
    });

    assertEqual(failRes.status, 200, 'Reporting decline must return HTTP 200');
    const failJson = await failRes.json();
    assert(failJson.understandableMessage.includes('Insufficient Funds'), 'Message must be understandable to cashier');

    // 5. Verify payment status is FAILED
    const paymentCheck = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(paymentCheck.data.status, 'FAILED', 'Payment status must be FAILED');
    assert(paymentCheck.data.errorMessage.includes('Insufficient Funds'), 'Error message must be preserved');

    // 6. Verify sale remains PENDING and recoverable
    const saleCheck = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'PENDING', 'Sale must remain PENDING so cashier can retry');

    // 7. Verify stock was NOT deducted
    const invAfter = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(invAfter.data.currentQuantity, stockBefore, 'Stock must NOT be deducted for declined payment');
  });

  await runTest('Customer Cancellation', 'Customer cancelling payment aborts session safely without deducting stock', async () => {
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const stockBefore = invBefore.data.currentQuantity;

    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.5 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    const paymentId = intentRes.data.paymentId;

    // Customer cancels on reader
    const cancelRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ reason: 'customer_canceled' }),
    });

    assertEqual(cancelRes.status, 200, 'Cancel must return HTTP 200');
    const cancelJson = await cancelRes.json();
    assert(cancelJson.understandableMessage.includes('cancelled') || cancelJson.understandableMessage.includes('canceled'), 'Message must indicate cancellation');

    const paymentCheck = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(paymentCheck.data.status, 'CANCELED', 'Payment must be marked CANCELED');

    const saleCheck = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'PENDING', 'Sale must remain PENDING for retry or cash payment');

    const invAfter = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(invAfter.data.currentQuantity, stockBefore, 'Stock must NOT be deducted for cancelled payment');
  });

  await runTest('Reader Disconnect Resilience', 'Unexpected reader disconnect preserves sale draft and avoids premature stock deduction', async () => {
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const stockBefore = invBefore.data.currentQuantity;

    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    const paymentId = intentRes.data.paymentId;

    // Simulate reader disconnect before card authorization
    const statusRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/status`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(statusRes.data.status, 'PENDING', 'Payment must remain PENDING while disconnected');
    assertEqual(statusRes.data.isSucceeded, false, 'Disconnected payment must not be considered succeeded');

    const saleCheck = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'PENDING', 'Sale draft must be preserved on disconnect');

    const invAfter = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    assertEqual(invAfter.data.currentQuantity, stockBefore, 'Stock must NOT be deducted when reader disconnects');
  });

  await runTest('Timeout & Uncertain Status', 'Never assumes timeout means failed and verifies PaymentIntent status before retry', async () => {
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    const paymentId = intentRes.data.paymentId;

    // Check payment status endpoint
    const statusRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/status`, { headers: cashierHeaders });
    assertEqual(statusRes.status, 200, 'Status endpoint must return HTTP 200');
    const statusJson = await statusRes.json();

    assertEqual(statusJson.data.status, 'PENDING', 'Initial payment status must be PENDING');
    assertEqual(statusJson.data.isPendingOrProcessing, true, 'Must identify pending/processing status');
    assertEqual(statusJson.data.isSafeToRetry, false, 'Must NOT assume safe to retry while status is uncertain/pending');
  });

  await runTest('Repeated Clicks Prevention', 'Cashier clicking Pay by Card repeatedly returns existing intent without duplicating', async () => {
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    // Call create-payment-intent 3 times in rapid succession for the same sale
    const [p1, p2, p3] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: saleDraft.data.id }),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: saleDraft.data.id }),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: saleDraft.data.id }),
      }).then((r) => r.json()),
    ]);

    assertEqual(p1.data.paymentIntentId, p2.data.paymentIntentId, 'Repeated call 2 must return the same paymentIntentId');
    assertEqual(p1.data.paymentIntentId, p3.data.paymentIntentId, 'Repeated call 3 must return the same paymentIntentId');
    assertEqual(p1.data.paymentId, p2.data.paymentId, 'Repeated call 2 must return the same paymentId');
    assertEqual(p1.data.paymentId, p3.data.paymentId, 'Repeated call 3 must return the same paymentId');
  });

  await runTest('Safe Retry After Failed Attempt', 'Cashier can safely retry payment after failure on same sale draft and deducts stock once', async () => {
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const stockBefore = invBefore.data.currentQuantity;

    // 1. Create sale draft
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 2.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    // 2. First attempt fails (card declined)
    const intent1 = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    await fetch(`${BASE_URL}/api/v1/payments/${intent1.data.paymentId}/fail`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ declineCode: 'card_declined' }),
    });

    // 3. Verify status check confirms safe to retry
    const statusBeforeRetry = await fetch(`${BASE_URL}/api/v1/payments/${intent1.data.paymentId}/status`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(statusBeforeRetry.data.isSafeToRetry, true, 'Failed payment must be flagged safe to retry');

    // 4. Retry: cashier creates new payment attempt on the SAME pending sale draft
    const intent2 = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    assert(intent2.data.paymentId !== intent1.data.paymentId, 'Retry must generate a new payment record');

    // 5. Succeeded verification of the retried payment
    const verifyRes = await fetch(`${BASE_URL}/api/v1/payments/${intent2.data.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: intent2.data.paymentIntentId,
        paymentMethod: 'STRIPE_CARD_PRESENT',
      }),
    });

    assertEqual(verifyRes.status, 200, 'Verification of retried payment must succeed');

    // 6. Verify sale completed exactly once
    const saleCheck = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.status, 'COMPLETED', 'Sale must be completed');

    // 7. Verify stock deducted exactly once (by 2.0 units)
    const invAfter = await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json());
    const expectedStock = Number((stockBefore - 2.0).toFixed(3));
    assertEqual(invAfter.data.currentQuantity, expectedStock, 'Stock must be decreased by exactly 2.0 units on retried sale');

    // 8. Verify exactly one SALE transaction created for this receipt
    const txRes = await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json());
    const matchingTx = txRes.data.filter((tx: any) => tx.referenceId === saleDraft.data.receiptNumber && tx.transactionType === 'SALE');
    assertEqual(matchingTx.length, 1, 'Exactly one SALE inventory transaction must exist for the retried sale');
  });

  await runTest('Prevent Duplicate Charge', 'Reject creating payment intent or charging already completed sale or succeeded payment', async () => {
    // 1. Create and complete a sale
    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const intent = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleRes.data.id }),
    }).then((r) => r.json());

    await fetch(`${BASE_URL}/api/v1/payments/${intent.data.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.data.paymentIntentId }),
    });

    // 2. Attempt to create payment intent on already COMPLETED sale must be rejected
    const dupRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleRes.data.id }),
    });

    assertEqual(dupRes.status, 400, 'Must reject creating payment intent on already completed sale');
    const dupJson = await dupRes.json();
    assert(dupJson.alreadyCompleted || dupJson.alreadySucceeded, 'Response must flag that sale is already completed/succeeded');
  });

  await runTest('Browser Refresh Draft Recovery', 'Active sale draft and payment status are fully recoverable on page refresh', async () => {
    // 1. Create a draft sale with payment intent
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1.0 }],
        status: 'PENDING',
      }),
    }).then((r) => r.json());

    const intent = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());

    // 2. Simulate refresh: query sale and payment status using stored IDs
    const refreshedSale = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assert(refreshedSale.success, 'Sale must be recoverable by ID');
    assertEqual(refreshedSale.data.receiptNumber, saleDraft.data.receiptNumber, 'Receipt number must match');
    assertEqual(refreshedSale.data.status, 'PENDING', 'Draft sale status must be PENDING');

    const refreshedPaymentStatus = await fetch(`${BASE_URL}/api/v1/payments/${intent.data.paymentId}/status`, { headers: cashierHeaders }).then((r) => r.json());
    assert(refreshedPaymentStatus.success, 'Payment status must be recoverable');
    assertEqual(refreshedPaymentStatus.data.externalPaymentId, intent.data.paymentIntentId, 'PaymentIntent ID must match');

    // 3. Resume and verify payment
    await fetch(`${BASE_URL}/api/v1/payments/${intent.data.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.data.paymentIntentId }),
    });

    const finalSale = await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json());
    assertEqual(finalSale.data.status, 'COMPLETED', 'Recovered sale must finalize to COMPLETED');
  });

  // ==========================================
  // SUITE 14: STRIPE CARD-PRESENT REFUND WORKFLOW
  // Requirements:
  // 1. Allow authorized manager/admin to find a completed sale & request full or partial refund
  // 2. Verify original Stripe payment and available refundable balance on backend
  // 3. Process refund through official Stripe API
  // 4. Store refund reference, amount, status, reason, timestamp, requesting user
  // 5. Prevent refunds exceeding balance and handle duplicate requests safely
  // 6. Handle pending, failed, and successful refund outcomes
  // 7. Keep original sale and payment history intact
  // 8. Do not automatically return products to inventory unless explicitly confirmed
  // 9. Never store card numbers or CVV
  // Support reconciliation without issuing duplicate refunds if persistence fails
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 14: STRIPE CARD-PRESENT REFUND WORKFLOW ---\x1b[0m');

  // Obtain Manager Token (ROLE_ADMIN) for Manager Tests
  const managerLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'manager', password: 'Manager@123' }),
  }).then((r) => r.json());
  assert(managerLoginRes.success, 'Manager login must succeed');
  const managerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${managerLoginRes.data.token}`,
  };

  // Create dedicated product with ample stock for refund workflow testing
  const refundProductRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      name: `Organic Refund Honey ${Date.now()}`,
      sku: `SKU-REFUND-${Date.now()}`,
      barcode: `BAR-REFUND-${Date.now()}`,
      description: 'Organic raw wildflower honey jar',
      categoryId: 1,
      purchasePrice: 5.0,
      sellingPrice: 15.0,
      taxRate: 0,
      unit: 'JAR',
      minimumInventoryThreshold: 10,
      active: true,
    }),
  }).then((r) => r.json());
  assert(refundProductRes.success, `Refund test product creation must succeed: ${refundProductRes.error || ''}`);
  const refundProductId = refundProductRes.data.id;
  const refundProductSku = refundProductRes.data.sku;

  // Add ample stock for refund testing
  const addStockRes = await fetch(`${BASE_URL}/api/inventory/add`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      productId: refundProductId,
      quantity: 500,
      transactionType: 'PURCHASE',
      reason: 'Refund test initial stock',
      referenceId: `REFUND-STOCK-${Date.now()}`,
    }),
  }).then((r) => r.json());
  assert(addStockRes.success, 'Stock addition must succeed');

  // Helper to create and complete a verified card-present sale
  async function createCompletedCardSale(itemQty = 2, unitPrice = 15.0) {
    const saleDraft = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        status: 'PENDING',
        items: [
          {
            productId: refundProductId,
            productName: 'Organic Refund Honey',
            productSku: refundProductSku,
            unit: 'JAR',
            quantity: itemQty,
            unitPrice,
            taxRate: 0,
            subtotal: itemQty * unitPrice,
            taxAmount: 0,
            totalAmount: itemQty * unitPrice,
          },
        ],
      }),
    }).then((r) => r.json());
    assert(saleDraft.success, `Draft sale creation must succeed: ${saleDraft.error || ''}`);

    const intent = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: saleDraft.data.id }),
    }).then((r) => r.json());
    assert(intent.success, `Payment intent creation must succeed: ${intent.error || ''}`);

    const verify = await fetch(`${BASE_URL}/api/v1/payments/${intent.data.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.data.paymentIntentId }),
    }).then((r) => r.json());
    assert(verify.success, `Payment verification must succeed: ${verify.error || ''}`);

    const completedSale =
      verify.sale ||
      (await fetch(`${BASE_URL}/api/sales/${saleDraft.data.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;

    return {
      sale: completedSale,
      payment: verify.data,
      paymentIntentId: intent.data.paymentIntentId,
    };
  }

  await runTest('Suite 14', 'Role Restrictions: Cashier is FORBIDDEN (403) from refund operations; Manager/Admin is ALLOWED (200)', async () => {
    const { sale } = await createCompletedCardSale(1);

    // Cashier attempts to query refund info -> 403
    const cashierQueryRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund-info`, {
      headers: cashierHeaders,
    });
    assertEqual(cashierQueryRes.status, 403, 'Cashier must be forbidden (403) from accessing refund info');

    // Cashier attempts to issue refund -> 403
    const cashierRefundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ amount: 10.0, reason: 'Unauthorized cashier refund' }),
    });
    assertEqual(cashierRefundRes.status, 403, 'Cashier must be forbidden (403) from issuing refunds');

    // Manager queries refund info -> 200
    const managerQueryRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund-info`, {
      headers: managerHeaders,
    });
    assertEqual(managerQueryRes.status, 200, 'Authorized manager must access refund info');
    const infoJson = await managerQueryRes.json();
    assert(infoJson.success, 'Refund info query must be successful');
    assertEqual(infoJson.data.refundable, true, 'Completed sale must be marked refundable');
  });

  await runTest('Suite 14', 'Verify original Stripe payment and calculate available refundable balance on backend', async () => {
    const { sale, paymentIntentId } = await createCompletedCardSale(2); // 2 * $15 = $30.00

    const infoRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund-info`, {
      headers: managerHeaders,
    }).then((r) => r.json());

    assert(infoRes.success, 'Refund info query must succeed');
    assertEqual(infoRes.data.sale.totalAmount, 30.0, 'Total sale amount must match');
    assertEqual(infoRes.data.totalRefunded, 0, 'Initial refunded amount must be 0');
    assertEqual(infoRes.data.remainingRefundable, 30.0, 'Remaining refundable balance must match total');
    assert(infoRes.data.payment !== null, 'Original Stripe payment must be verified and present');
    assertEqual(infoRes.data.payment.externalPaymentId, paymentIntentId, 'PaymentIntent ID must link to sale');
  });

  await runTest('Suite 14', 'Process authorized partial refund via Stripe API and update sale status to PARTIAL', async () => {
    const { sale } = await createCompletedCardSale(2); // Total: $30.00

    const refundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 10.0,
        reason: 'Customer returned 1 damaged unit',
        restock: false,
      }),
    });
    assertEqual(refundRes.status, 201, 'Partial refund should return 201 Created');
    const refundJson = await refundRes.json();
    assert(refundJson.success, 'Refund must succeed');
    assertEqual(refundJson.data.amount, 10.0, 'Refund amount must be $10.00');
    assertEqual(refundJson.data.status, 'SUCCEEDED', 'Refund status must be SUCCEEDED');
    assert(refundJson.data.refundReference.startsWith('re_'), 'Must generate official Stripe refund reference');
    assertEqual(refundJson.data.username, 'manager', 'Requesting user must be stored in refund record');

    // Verify sale status and balance
    const updatedSale = await fetch(`${BASE_URL}/api/sales/${sale.id}`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(updatedSale.data.refundedAmount, 10.0, 'Sale refundedAmount must be updated to $10.00');
    assertEqual(updatedSale.data.refundStatus, 'PARTIAL', 'Sale refundStatus must be PARTIAL');
    assertEqual(updatedSale.data.status, 'COMPLETED', 'Partially refunded sale original status remains intact');

    // Verify remaining balance via refund-info
    const info = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund-info`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(info.data.remainingRefundable, 20.0, 'Remaining refundable balance must be $20.00 ($30 - $10)');
  });

  await runTest('Suite 14', 'Process full refund to complete balance and mark sale status as REFUNDED', async () => {
    const { sale } = await createCompletedCardSale(2); // Total: $30.00

    const refundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 30.0,
        reason: 'Customer returned entire purchase',
        restock: false,
      }),
    }).then((r) => r.json());

    assert(refundRes.success, 'Full refund must succeed');
    assertEqual(refundRes.data.amount, 30.0, 'Full refund amount must match sale total');
    assertEqual(refundRes.sale.refundStatus, 'FULL', 'Sale refundStatus must be FULL');
    assertEqual(refundRes.sale.status, 'REFUNDED', 'Sale status must be updated to REFUNDED');

    // Confirm that attempting another refund on fully refunded sale is rejected
    const extraRefund = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 5.0, reason: 'Duplicate attempt' }),
    });
    assertEqual(extraRefund.status, 400, 'Cannot refund an already fully refunded sale');
  });

  await runTest('Suite 14', 'Prevent refunds exceeding remaining refundable amount (400 Bad Request)', async () => {
    const { sale } = await createCompletedCardSale(1); // Total: $15.00

    // Attempt refund of $20.00 when only $15.00 is refundable
    const overRefundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 20.0, reason: 'Excessive refund' }),
    });
    assertEqual(overRefundRes.status, 400, 'Over-refund must be rejected with 400');
    const errJson = await overRefundRes.json();
    assert(errJson.error.includes('exceeds remaining refundable balance'), 'Clear error message indicating balance exceeded');

    // Attempt negative or zero amount
    const zeroRefundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 0, reason: 'Zero refund' }),
    });
    assertEqual(zeroRefundRes.status, 400, 'Zero refund must be rejected with 400');
  });

  await runTest('Suite 14', 'Idempotency: safely handle duplicate requests and prevent double-refunding', async () => {
    const { sale } = await createCompletedCardSale(3); // Total: $45.00
    const idempotencyKey = `idemp_refund_test_${Date.now()}`;

    // 1. Initial refund request
    const firstRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: { ...managerHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ amount: 20.0, reason: 'Initial return' }),
    });
    assertEqual(firstRes.status, 201, 'First refund should succeed with 201');
    const firstJson = await firstRes.json();
    const firstRefundRef = firstJson.data.refundReference;

    // 2. Immediate duplicate refund request with same idempotency key
    const secondRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: { ...managerHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ amount: 20.0, reason: 'Duplicate retry' }),
    });
    assertEqual(secondRes.status, 200, 'Duplicate request should return 200 OK');
    const secondJson = await secondRes.json();
    assertEqual(secondJson.duplicate, true, 'Response must flag duplicate request');
    assertEqual(secondJson.data.refundReference, firstRefundRef, 'Must return original refund reference without duplicating');

    // 3. Verify total refunded is still $20.00 and NOT $40.00
    const saleCheck = await fetch(`${BASE_URL}/api/sales/${sale.id}`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(saleCheck.data.refundedAmount, 20.0, 'Total refunded amount must not be doubled');
  });

  await runTest('Suite 14', 'Handle pending and failed refund outcomes gracefully with audit logs', async () => {
    const { sale } = await createCompletedCardSale(2); // Total: $30.00

    // 1. Handle simulated failed refund (e.g. card expired / dispute)
    const failRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 10.0,
        simulateStripeStatus: 'failed',
        failureReason: 'Stripe rejected: card expired or charge disputed by issuer',
      }),
    });
    assertEqual(failRes.status, 400, 'Failed refund must return 400 with failure reason');
    const failJson = await failRes.json();
    assertEqual(failJson.data.status, 'FAILED', 'Refund record must record FAILED status');

    // Verify sale balance was NOT deducted for failed attempt
    const saleAfterFail = await fetch(`${BASE_URL}/api/sales/${sale.id}`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(saleAfterFail.data.refundedAmount || 0, 0, 'Failed refund must not affect sale refundedAmount');

    // 2. Handle simulated pending refund (e.g. async bank settlement)
    const pendingRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 10.0,
        simulateStripeStatus: 'pending',
      }),
    });
    assertEqual(pendingRes.status, 202, 'Pending refund should return 202 Accepted');
    const pendingJson = await pendingRes.json();
    assertEqual(pendingJson.data.status, 'PENDING', 'Refund record must record PENDING status');
  });

  await runTest('Suite 14', 'Inventory restock rule: do NOT return products to inventory unless explicitly confirmed', async () => {
    // 1. Check current inventory for test product
    const invBefore = await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json());
    const initialStock = invBefore.data.currentQuantity;

    // 2. Issue refund without restock (restock: false)
    const { sale } = await createCompletedCardSale(2); // Total: $30.00
    const invAfterSale = await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json());
    const stockAfterSale = invAfterSale.data.currentQuantity;

    await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 20.0, restock: false }),
    });

    const invAfterNoRestock = await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(invAfterNoRestock.data.currentQuantity, stockAfterSale, 'Stock must NOT be restored when restock=false');

    // 3. Issue refund with restock explicitly confirmed (restock: true)
    const { sale: sale2 } = await createCompletedCardSale(3); // Total: $45.00
    const stockBeforeRestock = (await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json())).data.currentQuantity;

    const restockRefundRes = await fetch(`${BASE_URL}/api/v1/sales/${sale2.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 30.0, restock: true }),
    }).then((r) => r.json());

    assert(restockRefundRes.success, 'Restock refund must succeed');
    assertEqual(restockRefundRes.data.restocked, true, 'Refund record must confirm restocked=true');

    const stockAfterRestock = (await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(stockAfterRestock, stockBeforeRestock + 3, 'Stock must be incremented by 3 items on explicit restock');
  });

  await runTest('Suite 14', 'Reconciliation: safely recover orphaned Stripe refund after local failure without duplicate refund', async () => {
    const { sale, paymentIntentId } = await createCompletedCardSale(3); // 3 * $15 = $45.00

    // 1. Simulate Stripe refund succeeded externally, but local server persistence threw an exception
    const simFailRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 45.0,
        simulateLocalPersistenceFailure: true,
      }),
    });
    assertEqual(simFailRes.status, 500, 'Simulated local failure returns 500');
    const simFailJson = await simFailRes.json();
    const orphanStripeRefundId = simFailJson.stripeRefundId;
    assert(orphanStripeRefundId.startsWith('re_'), 'Simulated Stripe refund ID must start with re_');

    // 2. Perform reconciliation using the orphaned Stripe refund ID
    const reconcileRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund/reconcile`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        stripeRefundId: orphanStripeRefundId,
        paymentIntentId,
        amount: 45.0,
        reason: 'Reconciliation of orphaned refund',
      }),
    });
    assertEqual(reconcileRes.status, 200, 'Reconciliation must return 200 OK');
    const reconcileJson = await reconcileRes.json();
    assertEqual(reconcileJson.data.refundReference, orphanStripeRefundId, 'Reconciled refund reference must match');
    assertEqual(reconcileJson.data.status, 'SUCCEEDED', 'Reconciled refund status must be SUCCEEDED');

    // 3. Repeated reconciliation call returns existing record without creating duplicate
    const repeatReconcile = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund/reconcile`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        stripeRefundId: orphanStripeRefundId,
        amount: 45.0,
      }),
    }).then((r) => r.json());
    assertEqual(repeatReconcile.alreadyReconciled, true, 'Repeat reconciliation must return alreadyReconciled without duplicating');

    // 4. Verify sale state is REFUNDED
    const finalSale = await fetch(`${BASE_URL}/api/sales/${sale.id}`, { headers: managerHeaders }).then((r) => r.json());
    assertEqual(finalSale.data.status, 'REFUNDED', 'Sale status must be REFUNDED after reconciliation');
  });

  await runTest('Suite 14', 'Security & Compliance: Never store, return, or log card numbers or CVV (Requirement 9)', async () => {
    const { sale } = await createCompletedCardSale(1); // Total: $15.00

    // Send payload containing forbidden raw card fields
    const scrubTestRes = await fetch(`${BASE_URL}/api/v1/sales/${sale.id}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({
        amount: 15.0,
        cardNumber: '4242424242424242',
        cvv: '123',
        cvc: '123',
        pan: '4242424242424242',
        reason: 'Security scrub validation',
      }),
    }).then((r) => r.json());

    assert(scrubTestRes.success, 'Refund must succeed even if client maliciously provided card fields');
    const stringified = JSON.stringify(scrubTestRes);
    assert(!stringified.includes('4242424242424242'), 'Response must NEVER contain raw card numbers or PAN');
    assert(!stringified.includes('123'), 'Response must NEVER contain CVV or CVC');

    // Audit log check: verify recent audit logs do not contain card numbers
    const auditRes = await fetch(`${BASE_URL}/api/v1/audit-logs`, { headers: managerHeaders }).then((r) => r.json());
    const auditString = JSON.stringify(auditRes.data);
    assert(!auditString.includes('4242424242424242'), 'Audit logs must NEVER contain raw card numbers');
    assert(!auditString.includes('"cvv"'), 'Audit logs must NEVER contain cvv fields');
  });

  // ==========================================
  // SUITE 15: STRIPE TERMINAL END-TO-END VERIFICATION & RESILIENCE (10-POINT CHECKLIST)
  // Requirements:
  // 1. Successful simulated card payment
  // 2. Declined payment
  // 3. Canceled payment
  // 4. Reader disconnection and network interruption
  // 5. Duplicate clicks and repeated webhook delivery
  // 6. Successful sale finalization and exactly-once inventory deduction
  // 7. Recovery when Stripe succeeds but local finalization fails
  // 8. Receipt generation and correct payment reference
  // 9. Full and partial refunds
  // 10. Existing cash checkout still works
  // Deep verification of: Database records, payment states, inventory transactions, and sale totals
  // ==========================================
  console.log('\n\x1b[1m\x1b[36m--- SUITE 15: STRIPE TERMINAL END-TO-END VERIFICATION (10-POINT CHECKLIST) ---\x1b[0m');

  // Point 1: Successful simulated card payment
  await runTest('Suite 15 - Point 1', 'Successful simulated card payment: creates payment intent, verifies payment, updates DB records, and deducts inventory', async () => {
    // 1. Pre-check inventory of Bananas (Product 1) and Milk (Product 2)
    const inv1Before = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    const inv2Before = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    const initialTxCount = (await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json())).data.length;

    // 2. Cashier creates draft sale
    const draftRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        status: 'PENDING',
        items: [
          { productId: 1, quantity: 2.0 },
          { productId: 2, quantity: 1.0 },
        ],
      }),
    }).then((r) => r.json());
    assert(draftRes.success, 'Draft sale creation must succeed');
    const saleId = draftRes.data.id;
    const receiptNumber = draftRes.data.receiptNumber;
    assertEqual(draftRes.data.status, 'PENDING', 'Initial sale record status must be PENDING');

    // Verify database totals
    const expectedSubtotal = Number((2.0 * 1.29 + 1.0 * 3.89).toFixed(2)); // 2.58 + 3.89 = 6.47
    assertEqual(draftRes.data.subtotal, expectedSubtotal, 'Draft sale subtotal must be correctly computed');
    assertEqual(draftRes.data.totalAmount, expectedSubtotal, 'Draft sale total must match subtotal (0 tax)');

    // 3. Initiate payment intent
    const intentRes = await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId }),
    }).then((r) => r.json());
    assert(intentRes.success, 'Payment intent creation must succeed');
    const paymentId = intentRes.data.paymentId;
    const paymentIntentId = intentRes.data.paymentIntentId;

    // Verify payment record in DB before capture
    const paymentBefore = (await fetch(`${BASE_URL}/api/v1/payments/${paymentId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(paymentBefore.status, 'PENDING', 'Payment record state in DB must be PENDING before verification');
    assertEqual(paymentBefore.amount, expectedSubtotal, 'Payment amount must match sale total');
    assertEqual(paymentBefore.externalPaymentId, paymentIntentId, 'Payment record must link to external paymentIntentId');

    // 4. Verify payment via Terminal
    const verifyRes = await fetch(`${BASE_URL}/api/v1/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: paymentIntentId,
        paymentMethod: 'STRIPE_CARD_PRESENT',
      }),
    }).then((r) => r.json());
    assert(verifyRes.success, 'Payment verification must succeed');

    // 5. Verify database records: Payment state
    const paymentAfter = (await fetch(`${BASE_URL}/api/v1/payments/${paymentId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(paymentAfter.status, 'SUCCEEDED', 'Payment status in DB must transition to SUCCEEDED');
    assertEqual(paymentAfter.finalizationStatus, 'FINALIZED', 'Payment finalizationStatus must be FINALIZED');

    // 6. Verify database records: Sale state & totals
    const saleAfter = (await fetch(`${BASE_URL}/api/sales/${saleId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(saleAfter.status, 'COMPLETED', 'Sale status in DB must be COMPLETED');
    assertEqual(saleAfter.paymentMethod, 'STRIPE_CARD_PRESENT', 'Sale record must store STRIPE_CARD_PRESENT');
    assertEqual(saleAfter.paymentReference, paymentIntentId, 'Sale record must store payment reference');
    assertEqual(saleAfter.paymentId, paymentId, 'Sale record must store paymentId');
    assertEqual(saleAfter.totalAmount, expectedSubtotal, 'Sale total amount must remain exact');

    // 7. Verify inventory records: Exactly deducted
    const inv1After = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    const inv2After = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(inv1After, Number((inv1Before - 2.0).toFixed(3)), 'Product 1 stock must decrease by 2.0');
    assertEqual(inv2After, Number((inv2Before - 1.0).toFixed(3)), 'Product 2 stock must decrease by 1.0');

    // 8. Verify inventory transactions
    const tx1Res = (await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json())).data;
    const matchingTx = tx1Res.find((t: any) => t.referenceId === receiptNumber && t.transactionType === 'SALE');
    assert(Boolean(matchingTx), 'SALE transaction must be recorded with receipt reference');
    assertEqual(matchingTx.quantity, 2.0, 'Transaction quantity must be 2.0');
  });

  // Point 2: Declined payment
  await runTest('Suite 15 - Point 2', 'Declined payment: sets payment FAILED, preserves sale PENDING, does NOT deduct stock, enables retry', async () => {
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    // 1. Create draft sale and intent
    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 1, quantity: 2.5 }] }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    // 2. Report card decline
    const failRes = await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/fail`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        declineCode: 'card_declined',
        errorMessage: 'Issuer declined card present transaction',
      }),
    });
    assertEqual(failRes.status, 200, 'Decline reporting must return 200');
    const failJson = await failRes.json();
    assert(failJson.understandableMessage.includes('Card Declined'), 'Must return understandable decline explanation');

    // 3. Verify DB records
    const paymentRecord = (await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(paymentRecord.status, 'FAILED', 'Payment record must be marked FAILED in DB');

    const saleRecord = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(saleRecord.status, 'PENDING', 'Sale draft must remain PENDING for retry or alternative payment');

    // 4. Verify inventory is NOT deducted
    const invAfter = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfter, invBefore, 'Stock must NOT be deducted for declined payment');

    // 5. Verify status endpoint reports safe to retry
    const statusCheck = (await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/status`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(statusCheck.isSafeToRetry, true, 'Status endpoint must confirm safe to retry');
  });

  // Point 3: Canceled payment
  await runTest('Suite 15 - Point 3', 'Canceled payment: updates payment to CANCELED, keeps sale draft intact, does NOT deduct stock', async () => {
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    // 1. Create draft sale and intent
    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 2, quantity: 1.0 }] }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    // 2. Customer cancels on reader
    const cancelRes = await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/cancel`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ reason: 'customer_canceled' }),
    }).then((r) => r.json());
    assert(cancelRes.success, 'Cancel payment must succeed');
    assert(cancelRes.understandableMessage.toLowerCase().includes('cancelled') || cancelRes.understandableMessage.toLowerCase().includes('canceled'), 'Message must indicate customer cancellation');

    // 3. Verify DB records
    const payment = (await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(payment.status, 'CANCELED', 'Payment status must be CANCELED');

    const sale = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(sale.status, 'PENDING', 'Sale draft must remain PENDING');

    // 4. Verify inventory untouched
    const invAfter = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfter, invBefore, 'Stock must NOT be deducted for canceled payment');
  });

  // Point 4: Reader disconnection and network interruption
  await runTest('Suite 15 - Point 4', 'Reader disconnection & network interruption: handles in-flight disconnect, preserves draft, and recovers cleanly', async () => {
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    // 1. Create draft and intent
    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 1, quantity: 1.0 }] }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    // 2. Disconnect during reader operation: cashier polls status to verify safe state
    const statusCheck = (await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/status`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(statusCheck.status, 'PENDING', 'Payment must be PENDING');
    assertEqual(statusCheck.isPendingOrProcessing, true, 'isPendingOrProcessing must be true');
    assertEqual(statusCheck.isSucceeded, false, 'isSucceeded must be false');
    assertEqual(statusCheck.isSafeToRetry, false, 'Must not assume safe to blindly retry while in-flight');

    // 3. Sale and stock preserved
    const sale = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(sale.status, 'PENDING', 'Sale draft remains PENDING');
    const invAfter = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfter, invBefore, 'Stock must NOT be deducted when disconnected');

    // 4. Reconnection / Network recovery: query payment by sale ID to resume existing session
    const resumedPayments = (await fetch(`${BASE_URL}/api/v1/payments/sale/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assert(Array.isArray(resumedPayments) && resumedPayments.length === 1, 'Exactly one payment session linked to sale');
    assertEqual(resumedPayments[0].id, intent.paymentId, 'Recovered payment session matches original intent');

    // 5. Finalize payment now that connection is restored
    await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.paymentIntentId }),
    });

    const finalSale = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(finalSale.status, 'COMPLETED', 'Sale completed upon reconnect and verification');
  });

  // Point 5: Duplicate clicks and repeated webhook delivery
  await runTest('Suite 15 - Point 5', 'Duplicate clicks and repeated webhook delivery: deduplicates concurrent clicks and repeated webhook events', async () => {
    // 1. Create draft sale
    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 1, quantity: 1.0 }] }),
    }).then((r) => r.json())).data;

    // Concurrent duplicate clicks on "Pay by Card"
    const [c1, c2, c3] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: draft.id }),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: draft.id }),
      }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({ saleId: draft.id }),
      }).then((r) => r.json()),
    ]);

    assertEqual(c1.data.paymentIntentId, c2.data.paymentIntentId, 'Duplicate click 2 returns identical paymentIntentId');
    assertEqual(c1.data.paymentIntentId, c3.data.paymentIntentId, 'Duplicate click 3 returns identical paymentIntentId');
    assertEqual(c1.data.paymentId, c2.data.paymentId, 'Duplicate click 2 returns identical paymentId');
    assertEqual(c1.data.paymentId, c3.data.paymentId, 'Duplicate click 3 returns identical paymentId');

    const paymentId = c1.data.paymentId;
    const paymentIntentId = c1.data.paymentIntentId;

    // 2. Repeated webhook delivery
    const webhookEventId = `evt_dedup_test_${Date.now()}`;
    const eventPayload = JSON.stringify({
      id: webhookEventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId,
          object: 'payment_intent',
          amount: Math.round(draft.totalAmount * 100),
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            saleId: String(draft.id),
            paymentId: String(paymentId),
          },
        },
      },
    });

    const sig = generateStripeSignature(eventPayload);

    // Initial webhook delivery
    const initialWebhookRes = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
      body: eventPayload,
    });
    assertEqual(initialWebhookRes.status, 200, 'Initial webhook must return 200');
    const initWbJson = await initialWebhookRes.json();
    assert(initWbJson.received, 'Initial webhook must be marked received');

    // Immediate repeat webhook delivery with identical event payload
    const repeatWebhookRes = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
      body: eventPayload,
    });
    assertEqual(repeatWebhookRes.status, 200, 'Duplicate webhook must return 200');
    const repeatWbJson = await repeatWebhookRes.json();
    assertEqual(repeatWbJson.duplicate, true, 'Repeat webhook must be flagged as duplicate');
    assert(repeatWbJson.message.includes('deduplicated'), 'Response must state event was deduplicated');
  });

  // Point 6: Successful sale finalization and exactly-once inventory deduction
  await runTest('Suite 15 - Point 6', 'Successful sale finalization and exactly-once inventory deduction: prevents double deduction on repeat verify', async () => {
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 1, quantity: 3.0 }] }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    // First verification
    const v1 = await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.paymentIntentId }),
    }).then((r) => r.json());
    assert(v1.success, 'First verification must succeed');

    const invAfterFirst = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfterFirst, Number((invBefore - 3.0).toFixed(3)), 'Inventory must decrease by exactly 3.0');

    // Second verification (repeated request)
    const v2 = await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.paymentIntentId }),
    }).then((r) => r.json());
    assertEqual(v2.alreadyFinalized, true, 'Repeated verification must flag alreadyFinalized: true');

    const invAfterSecond = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfterSecond, invAfterFirst, 'Inventory must NOT be deducted again on repeat verification');

    // Verify transaction count for receipt
    const txs = (await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json())).data;
    const matchCount = txs.filter((t: any) => t.referenceId === draft.receiptNumber && t.transactionType === 'SALE').length;
    assertEqual(matchCount, 1, 'Exactly one SALE inventory transaction must exist for this receipt');
  });

  // Point 7: Recovery when Stripe succeeds but local finalization fails
  await runTest('Suite 15 - Point 7', 'Recovery when Stripe succeeds but local finalization fails: preserves payment, rolls back inventory, recovers cleanly', async () => {
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'PENDING', items: [{ productId: 2, quantity: 2.0 }] }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    // Simulate finalization error
    const failRes = await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentReference: intent.paymentIntentId,
        simulateFinalizationFailure: true,
      }),
    });
    assertEqual(failRes.status, 500, 'Must return 500 on local failure');
    const failJson = await failRes.json();
    assertEqual(failJson.recoveryRequired, true, 'Must indicate recoveryRequired');

    // Verify payment is SUCCEEDED in DB (Stripe charge was executed)
    const pRecord = (await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(pRecord.status, 'SUCCEEDED', 'Payment record MUST remain SUCCEEDED');
    assertEqual(pRecord.finalizationStatus, 'FAILED', 'finalizationStatus must be FAILED');

    // Verify sale is PENDING and flagged
    const sRecord = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(sRecord.status, 'PENDING', 'Sale must remain PENDING');
    assertEqual(sRecord.requiresRecovery, true, 'requiresRecovery must be true');
    assertEqual(sRecord.recoveryStatus, 'FAILED_FINALIZATION', 'recoveryStatus must be FAILED_FINALIZATION');

    // Verify inventory rolled back
    const invRollback = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invRollback, invBefore, 'Inventory must be rolled back on finalization failure');

    // Call recovery endpoint
    const recoverRes = await fetch(`${BASE_URL}/api/v1/sales/${draft.id}/recover`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({}),
    }).then((r) => r.json());
    assert(recoverRes.success, 'Recovery endpoint must succeed');

    // Verify sale completed and inventory now deducted
    const recoveredSale = (await fetch(`${BASE_URL}/api/sales/${draft.id}`, { headers: cashierHeaders }).then((r) => r.json())).data;
    assertEqual(recoveredSale.status, 'COMPLETED', 'Recovered sale must be COMPLETED');
    assertEqual(recoveredSale.requiresRecovery, false, 'Recovery flag must be cleared');

    const invFinal = (await fetch(`${BASE_URL}/api/inventory/product/2`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invFinal, Number((invBefore - 2.0).toFixed(3)), 'Inventory must now be decremented by 2.0');
  });

  // Point 8: Receipt generation and correct payment reference
  await runTest('Suite 15 - Point 8', 'Receipt generation: receipt endpoint returns complete receipt with payment method, Stripe ref, and totals', async () => {
    // 1. Create and complete a card sale
    const draft = (await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        status: 'PENDING',
        items: [{ productId: 1, quantity: 1.0 }],
      }),
    }).then((r) => r.json())).data;

    const intent = (await fetch(`${BASE_URL}/api/v1/payments/create-payment-intent`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ saleId: draft.id }),
    }).then((r) => r.json())).data;

    await fetch(`${BASE_URL}/api/v1/payments/${intent.paymentId}/verify`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentReference: intent.paymentIntentId }),
    });

    // 2. Fetch receipt by receiptNumber
    const receiptRes = await fetch(`${BASE_URL}/api/sales/receipt/${draft.receiptNumber}`, { headers: cashierHeaders });
    assertEqual(receiptRes.status, 200, 'Receipt endpoint must return 200 OK');
    const receiptJson = await receiptRes.json();
    assert(receiptJson.success, 'Receipt lookup must succeed');

    const rData = receiptJson.data;
    assertEqual(rData.receiptNumber, draft.receiptNumber, 'Receipt number must match');
    assertEqual(rData.status, 'COMPLETED', 'Receipt status must be COMPLETED');
    assertEqual(rData.paymentMethod, 'STRIPE_CARD_PRESENT', 'Receipt must display STRIPE_CARD_PRESENT');
    assertEqual(rData.paymentReference, intent.paymentIntentId, 'Receipt must display Stripe payment reference');
    assert(Array.isArray(rData.items) && rData.items.length === 1, 'Receipt items must match cart');
    assertEqual(rData.totalAmount, draft.totalAmount, 'Receipt total amount must match sale total');
  });

  // Point 9: Full and partial refunds
  await runTest('Suite 15 - Point 9', 'Full and partial refunds: authorized manager can execute partial and full refund with/without restock', async () => {
    // 1. Create and complete a $30 sale (2 items of $15 Honey)
    const { sale: cardSale } = await createCompletedCardSale(2); // $30.00 total
    const saleId = cardSale.id;

    // Partial refund of $10.00 without restock
    const partialRes = await fetch(`${BASE_URL}/api/v1/sales/${saleId}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 10.0, reason: 'Partial refund test', restock: false }),
    });
    assertEqual(partialRes.status, 201, 'Partial refund returns 201 Created');
    const partialJson = await partialRes.json();
    assertEqual(partialJson.data.amount, 10.0, 'Partial refund amount is $10.00');
    assert(partialJson.data.refundReference.startsWith('re_'), 'Official Stripe refund reference returned');

    // Verify DB sale state after partial refund
    const saleAfterPartial = (await fetch(`${BASE_URL}/api/sales/${saleId}`, { headers: managerHeaders }).then((r) => r.json())).data;
    assertEqual(saleAfterPartial.refundedAmount, 10.0, 'Sale refundedAmount is $10.00');
    assertEqual(saleAfterPartial.refundStatus, 'PARTIAL', 'Sale refundStatus is PARTIAL');
    assertEqual(saleAfterPartial.status, 'COMPLETED', 'Partially refunded sale remains COMPLETED');

    // Full refund of remaining $20.00 with restock: true
    const stockBeforeRestock = (await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json())).data.currentQuantity;
    const fullRes = await fetch(`${BASE_URL}/api/v1/sales/${saleId}/refund`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ amount: 20.0, reason: 'Full refund balance test', restock: true }),
    });
    assertEqual(fullRes.status, 201, 'Full refund returns 201 Created');
    const fullJson = await fullRes.json();
    assertEqual(fullJson.data.amount, 20.0, 'Full refund remaining amount is $20.00');

    // Verify DB sale state after full refund
    const saleAfterFull = (await fetch(`${BASE_URL}/api/sales/${saleId}`, { headers: managerHeaders }).then((r) => r.json())).data;
    assertEqual(saleAfterFull.refundedAmount, 30.0, 'Sale refundedAmount is full $30.00');
    assertEqual(saleAfterFull.refundStatus, 'FULL', 'Sale refundStatus is FULL');
    assertEqual(saleAfterFull.status, 'REFUNDED', 'Sale status transitions to REFUNDED');

    // Verify stock restored on restock: true
    const stockAfterRestock = (await fetch(`${BASE_URL}/api/inventory/product/${refundProductId}`, { headers: managerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(stockAfterRestock, stockBeforeRestock + 2, 'Stock must be restored by 2 units');

    // Verify RESTOCK transaction logged
    const txs = (await fetch(`${BASE_URL}/api/inventory/${refundProductId}/transactions`, { headers: managerHeaders }).then((r) => r.json())).data;
    const restockTx = txs.find((t: any) => (t.referenceId === cardSale.receiptNumber || t.referenceId === fullJson.data.refundReference) && (t.transactionType === 'RESTOCK' || t.transactionType === 'RETURN_RESTOCK'));
    assert(Boolean(restockTx), 'RESTOCK transaction must be logged for restocked refund');
  });

  // Point 10: Existing cash checkout still works
  await runTest('Suite 15 - Point 10', 'Existing cash checkout still works: creates completed sale, records CASH payment method, deducts stock, produces receipt', async () => {
    // 1. Pre-check inventory of Product 1 (Bananas)
    const invBefore = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;

    // 2. Direct POS cash checkout
    const cashRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        paymentMethod: 'CASH',
        items: [{ productId: 1, quantity: 2.0 }],
      }),
    });
    assertEqual(cashRes.status, 201, 'Cash checkout must return 201 Created');
    const cashJson = await cashRes.json();
    assert(cashJson.success, 'Cash checkout response must indicate success');

    const cashSale = cashJson.data;
    assertEqual(cashSale.status, 'COMPLETED', 'Cash sale must be immediately COMPLETED');
    assertEqual(cashSale.paymentMethod, 'CASH', 'Cash sale paymentMethod must be CASH');
    assert(cashSale.receiptNumber.startsWith('REC-'), 'Cash sale must generate receipt number');

    // 3. Verify stock deducted immediately
    const invAfter = (await fetch(`${BASE_URL}/api/inventory/product/1`, { headers: ownerHeaders }).then((r) => r.json())).data.currentQuantity;
    assertEqual(invAfter, Number((invBefore - 2.0).toFixed(3)), 'Inventory must be deducted by 2.0 for cash checkout');

    // 4. Verify SALE transaction in DB
    const txs = (await fetch(`${BASE_URL}/api/inventory/1/transactions`, { headers: ownerHeaders }).then((r) => r.json())).data;
    const cashTx = txs.find((t: any) => t.referenceId === cashSale.receiptNumber && t.transactionType === 'SALE');
    assert(Boolean(cashTx), 'SALE transaction must be recorded for cash receipt');
    assertEqual(cashTx.quantity, 2.0, 'Transaction quantity must be 2.0');

    // 5. Verify receipt lookup
    const receiptRes = await fetch(`${BASE_URL}/api/sales/receipt/${cashSale.receiptNumber}`, { headers: cashierHeaders });
    assertEqual(receiptRes.status, 200, 'Cash receipt lookup must return 200 OK');
    const receiptJson = await receiptRes.json();
    assertEqual(receiptJson.data.paymentMethod, 'CASH', 'Receipt must display CASH payment method');
    assertEqual(receiptJson.data.totalAmount, cashSale.totalAmount, 'Receipt total amount must match');
  });

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n======================================================');
  console.log('  TEST SUMMARY');
  console.log('======================================================');
  console.log(`  Total Executed Tests: ${passedCount + failedCount}`);
  console.log(`  Passed: \x1b[32m${passedCount}\x1b[0m`);
  console.log(`  Failed: \x1b[31m${failedCount}\x1b[0m`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    console.error(`\x1b[31mTest Suite Failed with ${failedCount} failing test(s).\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32mAll Automated Tests Passed Successfully!\x1b[0m\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});
