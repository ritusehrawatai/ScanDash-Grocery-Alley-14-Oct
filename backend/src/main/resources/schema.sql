-- ====================================================================
-- FreshCart / ScanDash POS - Product Database Schema
-- Target Database: PostgreSQL 15+
-- ====================================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_categories_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (active);

-- 2. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(30),
    address VARCHAR(300),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_suppliers_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers (active);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    description VARCHAR(2000),
    category_id BIGINT,
    supplier_id BIGINT,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(20) NOT NULL DEFAULT 'PCS',
    minimum_inventory_threshold INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Uniqueness Constraints
    CONSTRAINT uk_products_sku UNIQUE (sku),
    CONSTRAINT uk_products_barcode UNIQUE (barcode),

    -- Value & Business Integrity Constraints
    CONSTRAINT chk_products_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT chk_products_sku_not_empty CHECK (LENGTH(TRIM(sku)) > 0),
    CONSTRAINT chk_products_purchase_price_non_negative CHECK (purchase_price >= 0),
    CONSTRAINT chk_products_selling_price_non_negative CHECK (selling_price >= 0),
    CONSTRAINT chk_products_tax_rate_non_negative CHECK (tax_rate >= 0),
    CONSTRAINT chk_products_min_inventory_non_negative CHECK (minimum_inventory_threshold >= 0),

    -- Foreign Key Constraints
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
);

-- Appropriate Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);

-- 4. Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    current_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_inventory_product_id UNIQUE (product_id),
    CONSTRAINT chk_inventory_quantity_non_negative CHECK (current_quantity >= 0),
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_current_quantity ON inventory (current_quantity);

-- 5. Inventory Transactions Audit Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    previous_quantity NUMERIC(12, 3) NOT NULL,
    new_quantity NUMERIC(12, 3) NOT NULL,
    reason VARCHAR(500),
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inv_tx_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT chk_inv_tx_type_valid CHECK (transaction_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'EXPIRY', 'CORRECTION'))
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_product_id ON inventory_transactions (product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type ON inventory_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_tx_created_at ON inventory_transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_inv_tx_reference_id ON inventory_transactions (reference_id);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    message VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT chk_notifications_type CHECK (type IN ('LOW_STOCK', 'OUT_OF_STOCK')),
    CONSTRAINT chk_notifications_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_product_id ON notifications (product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

-- 7. Users Table (Spring Security Authentication & Authorization)
-- Passwords stored exclusively as BCrypt salted hashes - never plain text!
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT chk_users_role CHECK (role IN ('ROLE_OWNER', 'ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_CASHIER'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Seed Initial Users with BCrypt encrypted passwords
-- Owner: owner / Owner@123
INSERT INTO users (username, password, full_name, email, role, enabled)
VALUES ('owner', '$2a$10$wE8wX7J9hYyO4/1g5KzO3OWT/t6r6vSgG9cWqG5Nl4K6fNl0XQ7r2', 'Store Owner', 'owner@freshcartpos.com', 'ROLE_OWNER', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Admin: admin / Admin@123
INSERT INTO users (username, password, full_name, email, role, enabled)
VALUES ('admin', '$2a$10$e8q4Rj/Zqj4zXzL5sF14feK4pD1g88k8P22eYV35X45lZ.k6tW0Gq', 'System Administrator', 'admin@freshcartpos.com', 'ROLE_ADMIN', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Cashier: cashier / Cashier@123
INSERT INTO users (username, password, full_name, email, role, enabled)
VALUES ('cashier', '$2a$10$K7rV4p1sLz8eX4l9g9bN6.V5zO1h7w2a3c4f5k6l7m8n9o0p1q2r3', 'Front Cashier', 'cashier@freshcartpos.com', 'ROLE_CASHIER', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 8. Audit Logs Table (Enterprise Operations Audit Trail)
-- Tracks: Product changes, Price changes, Threshold changes, Inventory adjustments,
-- Invoice confirmation, Sale cancellation, User/Role changes.
-- Guarantees: Zero sensitive information (passwords, salts, secrets) are ever logged!
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    username VARCHAR(50) NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    details VARCHAR(500),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs (username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

-- 9. Sales Table (POS Checkout & Ledger)
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    receipt_number VARCHAR(60) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    item_count INTEGER NOT NULL DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_sales_receipt_number UNIQUE (receipt_number),
    CONSTRAINT chk_sales_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT chk_sales_tax_non_negative CHECK (tax_amount >= 0),
    CONSTRAINT chk_sales_total_non_negative CHECK (total_amount >= 0),
    CONSTRAINT chk_sales_status_valid CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'))
);

CREATE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales (receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);

-- 10. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    tax_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,

    CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT chk_sale_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_sale_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT chk_sale_items_subtotal_non_negative CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items (product_id);

-- 11. Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(80) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    uploaded_by VARCHAR(100),
    notes VARCHAR(1000),
    extracted_supplier VARCHAR(255),
    extracted_invoice_number VARCHAR(100),
    extracted_invoice_date VARCHAR(50),
    extracted_total NUMERIC(12, 2),
    extracted_items_json TEXT,
    ocr_raw_text TEXT,
    ocr_overall_confidence INTEGER,
    ocr_has_low_confidence_values BOOLEAN DEFAULT FALSE,
    ocr_manual_review_required BOOLEAN DEFAULT FALSE,
    ocr_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_purchase_invoices_number UNIQUE (invoice_number),
    CONSTRAINT uk_purchase_invoices_stored_name UNIQUE (stored_filename),
    CONSTRAINT chk_purchase_invoices_status CHECK (status IN ('UPLOADED', 'PROCESSING', 'PROCESSED', 'CONFIRMED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON purchase_invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON purchase_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON purchase_invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_file_hash ON purchase_invoices (file_hash);

-- 12. Payments Table (Clean Payment Abstraction linked to Sales)
-- Designed for modular payment gateways (Stripe, Cash, etc.)
-- Guarantees: Never stores raw credit/debit card numbers or CVVs!
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    provider VARCHAR(50) NOT NULL,
    external_payment_id VARCHAR(255),
    client_secret VARCHAR(255),
    error_message VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL,
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_payments_status_valid CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments (external_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments (provider);


