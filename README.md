# FreshCart Grocery Store POS

> Enterprise-grade, modular Grocery Store Point of Sale (POS) architecture engineered with **Spring Boot 3.3**, **PostgreSQL 15**, and **React 19 + TypeScript**.

---

## 1. Architectural Overview

The application adheres strictly to decoupled, layered clean architecture:

```text
Frontend (React + TypeScript)
       │
       ▼ (HTTP/1.1 REST + JSON DTOs)
  Spring Boot REST API
       │
       ▼
Controller Layer (@RestController)
       │
       ▼
Service Layer (@Service)
       │
       ▼
Repository Layer (Spring Data JPA)
       │
       ▼
PostgreSQL Database
```

### Architectural Principles:
1. **Strict DTO Boundary**: Database entities are never exposed directly to client consumers. All responses are encapsulated inside typed `ApiResponse<T>` envelopes.
2. **Loosely Coupled Modules**: Modules are packaged by domain (`health`, `products`, `inventory`, `invoices`, `checkout`) for maintainability.
3. **100% Free and Open Source**: Built using only open-source libraries and runtimes (Java 17, Spring Boot, PostgreSQL, Tesseract OCR, Docker, Vite, Tailwind CSS). No paid APIs or subscriptions required.

---

## 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend** | Java 17 + Spring Boot 3.3.4 | Spring Web, Spring Data JPA, Bean Validation, Actuator |
| **Database** | PostgreSQL 15 | Relational ACID storage (HikariCP connection pool) |
| **Testing DB** | H2 Database | Embedded in-memory database used exclusively for JUnit test profiles |
| **API Docs** | Springdoc OpenAPI 3.0 / Swagger | Automated OpenAPI specs and UI (`/swagger-ui.html`) |
| **Testing** | JUnit 5 + Mockito + MockMvc | Unit and slice tests |
| **Containerization** | Docker & Docker Compose | Multi-container local development stack |
| **Frontend** | React 19 + TypeScript + Tailwind CSS | Responsive POS terminal interface |

---

## 3. Project Structure

```text
.
├── docker-compose.yml              # Local multi-container environment (Postgres + Backend + Frontend)
├── Dockerfile.frontend             # Production container for React frontend
├── server.ts                       # Full-stack Node/Express server with Vite middleware
├── package.json                    # Frontend dependencies & build configurations
├── README.md                       # This setup and architecture guide
│
├── backend/                        # Spring Boot Java 17 Maven project
│   ├── pom.xml                     # Maven project descriptor & dependencies
│   ├── Dockerfile                  # Multi-stage build for Spring Boot application
│   ├── src/main/java/com/grocerypos/
│   │   ├── GroceryPosApplication.java        # Spring Boot entry point
│   │   ├── config/
│   │   │   ├── CorsConfig.java               # CORS configuration for frontend
│   │   │   └── OpenApiConfig.java            # Swagger / OpenAPI 3.0 metadata
│   │   ├── common/
│   │   │   ├── dto/ApiResponse.java          # Uniform response envelope DTO
│   │   │   ├── dto/ApiErrorResponse.java     # Error response DTO
│   │   │   └── exception/GlobalExceptionHandler.java # @RestControllerAdvice
│   │   └── health/
│   │       ├── controller/HealthCheckController.java # /api/v1/health endpoint
│   │       ├── service/HealthCheckService.java       # DB connectivity & metrics
│   │       └── dto/HealthStatusDto.java              # Health payload DTO
│   │
│   ├── src/main/resources/
│   │   ├── application.yml         # Main config (PostgreSQL, JPA, OpenAPI)
│   │   ├── application-dev.yml     # Local dev profile
│   │   └── application-test.yml    # H2 test profile
│   │
│   └── src/test/java/com/grocerypos/
│       └── health/HealthCheckControllerTest.java # JUnit 5 + Mockito test suite
│
└── src/                            # React 19 + TypeScript POS UI
    ├── api/healthApi.ts            # Typed fetch client with latency benchmark
    ├── types/health.ts             # TypeScript DTO interfaces
    ├── components/
    │   ├── Header.tsx              # Store terminal status & clock
    │   ├── Sidebar.tsx             # POS navigation & phased module roadmap
    │   ├── HealthDashboard.tsx     # Live health metrics & raw JSON inspector
    │   ├── ArchitectureView.tsx    # Interactive pipeline visualization
    │   ├── ApiExplorer.tsx         # In-browser REST API tester
    │   └── DevSetupGuide.tsx       # On-screen local development guide
    └── App.tsx                     # Shell application
```

---

## 4. Local Development Setup

### Prerequisites
Make sure the following open-source tools are installed:
- **Java Development Kit (JDK) 17+**: `java -version`
- **Apache Maven 3.8+**: `mvn -version`
- **Node.js 18+ & npm**: `node -v`
- **Docker & Docker Compose** (recommended): `docker --version`

---

### Option A: One-Command Startup (Docker Compose)

The easiest way to start PostgreSQL, Spring Boot, and the React frontend together:

```bash
# 1. Clone repository and navigate to root directory
git clone <repo-url>
cd grocery-store-pos

# 2. Launch all services
docker-compose up -d

# 3. Check container status
docker-compose ps
```

Services will be available at:
- **Frontend POS Interface**: [http://localhost:3000](http://localhost:3000)
- **Spring Boot REST API**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
- **OpenAPI / Swagger UI**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **PostgreSQL Database**: `localhost:5432` (db: `grocerypos`, user: `postgres`, pass: `postgres`)

To stop:
```bash
docker-compose down
```

---

### Option B: Native Local Setup (Maven + Node)

#### 1. Start PostgreSQL
You can run PostgreSQL either with Docker or via your native PostgreSQL installation:

```bash
docker run -d \
  --name grocerypos-db \
  -p 5432:5432 \
  -e POSTGRES_DB=grocerypos \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15-alpine
```

#### 2. Run Spring Boot Backend
```bash
cd backend

# Compile and start Spring Boot
mvn clean spring-boot:run
```

The Spring Boot backend will run on port `8080`.

#### 3. Run JUnit & Mockito Tests
```bash
cd backend
mvn test
```
The test suite utilizes the H2 in-memory database profile (`application-test.yml`) and MockMvc so that tests execute without needing an external database.

#### 4. Run React Frontend
In a separate terminal at the project root:

```bash
# Install dependencies
npm install

# (Optional) Point frontend to external Spring Boot backend
export VITE_API_BASE_URL="http://localhost:8080"

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. REST API Specifications

### Product Management REST API

| Method | Endpoint | Description | Status Code | Error Handling |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/products` | Create a new grocery product | `201 Created` | `400 Bad Request` (invalid price, tax, threshold, name, SKU), `409 Conflict` (duplicate SKU, duplicate barcode) |
| **GET** | `/api/products` | Retrieve all products (supports `?search=`, `?categoryId=`, `?activeOnly=`) | `200 OK` | `500 Internal Error` |
| **GET** | `/api/products/{id}` | Retrieve specific product by ID | `200 OK` | `404 Not Found` (if product does not exist) |
| **GET** | `/api/products/search?q={q}` | Search products by name, SKU, barcode, or category (partial match) | `200 OK` | `200 OK` (empty list if no match) |
| **PUT** | `/api/products/{id}` | Update product details and pricing | `200 OK` | `404 Not Found`, `400 Bad Request`, `409 Conflict` (duplicate SKU/barcode on another product) |
| **DELETE** | `/api/products/{id}` | Delete product item | `204 No Content` | `404 Not Found` |

#### Create Product Sample Request (`POST /api/products`):
```json
{
  "name": "Organic Hass Avocados",
  "sku": "SKU-AVO-001",
  "barcode": "012345678903",
  "description": "Ripe Hass avocados, bag of 4",
  "purchasePrice": 2.20,
  "sellingPrice": 3.99,
  "taxRate": 0.00,
  "unit": "BAG",
  "minimumInventoryThreshold": 10,
  "active": true
}
```

#### Sample Response (`201 Created`):
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 3,
    "name": "Organic Hass Avocados",
    "sku": "SKU-AVO-001",
    "barcode": "012345678903",
    "description": "Ripe Hass avocados, bag of 4",
    "purchasePrice": 2.2,
    "sellingPrice": 3.99,
    "taxRate": 0.0,
    "unit": "BAG",
    "minimumInventoryThreshold": 10,
    "active": true,
    "createdAt": "2026-10-05T20:30:00Z",
    "updatedAt": "2026-10-05T20:30:00Z"
  },
  "timestamp": "2026-10-05T20:30:00Z"
}
```

### Sale Processing REST API

| Method | Endpoint | Description | Status Code | Error Handling |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/sales` | Complete a POS sale transactionally (validates cart, checks stock, calculates subtotal/tax/total, deducts inventory, records SALE audit transactions, recalculates inventory status, triggers notifications) | `201 Created` | `400 Bad Request` (empty cart, invalid qty, inactive product, insufficient inventory), `404 Not Found` |
| **GET** | `/api/sales` | List all historical completed sales (newest first) | `200 OK` | `500 Internal Error` |
| **GET** | `/api/sales/{id}` | Get sale by internal ID | `200 OK` | `404 Not Found` |
| **GET** | `/api/sales/receipt/{receiptNumber}` | Lookup sale details by receipt number | `200 OK` | `404 Not Found` |

### System Health Check
- **Endpoint**: `GET /api/v1/health`
- **Description**: Returns overall system operational state, PostgreSQL connectivity, memory statistics, and module readiness.
- **Sample Response**:
```json
{
  "success": true,
  "message": "System is healthy and operational",
  "data": {
    "status": "UP",
    "service": "grocery-pos-backend",
    "version": "1.0.0-SNAPSHOT",
    "environment": "dev",
    "uptimeSeconds": 84,
    "database": {
      "status": "CONNECTED",
      "databaseProductName": "PostgreSQL 15.4",
      "url": "jdbc:postgresql://localhost:5432/grocerypos"
    },
    "memory": {
      "totalMemoryMb": 512,
      "freeMemoryMb": 384,
      "maxMemoryMb": 2048
    },
    "modules": {
      "core-architecture": "READY (Initialized)",
      "database-layer": "READY (PostgreSQL JPA configured)",
      "health-check-api": "READY (Operational)",
      "product-management": "PLANNED (Phase 2)",
      "inventory-management": "PLANNED (Phase 2)",
      "invoice-ocr-tesseract": "PLANNED (Phase 3)",
      "pos-checkout": "PLANNED (Phase 4)",
      "sales-reporting": "PLANNED (Phase 5)",
      "auth-rbac": "PLANNED (Phase 6)"
    },
    "timestamp": "2026-10-05T20:25:00Z"
  },
  "timestamp": "2026-10-05T20:25:00Z"
}
```

### Lightweight Heartbeat Ping
- **Endpoint**: `GET /api/v1/health/ping`
- **Sample Response**:
```json
{
  "success": true,
  "message": "FreshCart POS API heartbeat",
  "data": "pong",
  "timestamp": "2026-10-05T20:25:00Z"
}
```

---

## 6. Phased Implementation Roadmap

- [x] **Phase 1: Architecture Initialization** *(Current)*
  - Maven, Spring Boot 3.3, and PostgreSQL configurations
  - Decoupled layered architecture (`Controller -> Service -> Repository -> PostgreSQL`)
  - Clean DTO layer with `ApiResponse<T>` wrapper
  - Health check REST API & ping probe
  - React 19 + TypeScript responsive POS interface
  - Docker Compose and Dockerfile specifications
  - JUnit 5 and Mockito test suite
- [ ] **Phase 2**: Product Management, Barcodes & Inventory Tracking
- [ ] **Phase 3**: Invoice Image/PDF Scanning & Tesseract OCR Extraction
- [ ] **Phase 4**: POS Checkout Terminal & Payment Processing
- [ ] **Phase 5**: Sales Management & Reporting Analytics
- [ ] **Phase 6**: Spring Security, User Authentication & Role-Based Access Control (RBAC)
