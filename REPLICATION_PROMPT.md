# Prompt to Replicate SIIB - Fire Department Inventory Management System

> Use this prompt with an LLM or code assistant to recreate the project from scratch.

---

## Prompt

Build a full-stack web application called **SIIB (Sistema Integral de Inventario de Bomberos)** — a comprehensive inventory management system for a fire department with multiple stations. The system must manage assets (vehicles, equipment), consumable supplies, inter-unit transfers, maintenance records, PDF documents, automatic alerts, and Excel reports, all with full audit trails and role-based access control.

---

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.7 in strict mode
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.22
- **Authentication**: Auth.js v5 (NextAuth) with JWT strategy and credentials provider (email/password)
- **UI**: React 19 + Tailwind CSS 3.4 with custom theme (red colors for fire department branding)
- **Hashing**: bcryptjs (salt rounds = 12)
- **Validation**: Zod 3.23
- **Reports**: ExcelJS 4.4
- **Utilities**: date-fns, clsx, tailwind-merge, pino (logging)
- **Containers**: Docker multi-stage with node:20-alpine
- **Runtime**: Node 20+

---

### Project Structure

```
/
├── prisma/
│   ├── schema.prisma          # Complete schema with 18 models
│   └── seed.ts                # Idempotent seed (categories, units, demo users, materials)
├── docker/
│   └── entrypoint.sh          # Runs migrations + seed on startup
├── src/
│   ├── auth.ts                # Auth.js config + credentials provider
│   ├── auth.config.ts         # Shared config (edge-runtime compatible)
│   ├── middleware.ts          # Route protection by authentication
│   ├── app/
│   │   ├── (admin)/admin/     # Command HQ role pages (dashboard, units, users, etc.)
│   │   ├── (unidad)/unidad/   # Unit Manager role pages
│   │   ├── (op)/op/           # Operational user pages
│   │   ├── api/               # REST API routes (28 endpoints)
│   │   ├── login/             # Authentication UI
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── ui/                # Reusable: Button, Card, Table, Badge, Input, Label
│   │   ├── forms/             # Specific: maintenance forms, transfer forms, etc.
│   │   ├── sidebar.tsx        # Navigation sidebar
│   │   ├── topbar.tsx         # Top navigation bar
│   │   └── stat-card.tsx      # KPI display card
│   ├── lib/
│   │   ├── db.ts              # Prisma singleton with logging
│   │   ├── audit.ts           # Audit log recording within transactions
│   │   ├── http.ts            # Error handling and response formatting
│   │   ├── utils.ts           # Date formatting, maintenance calculations
│   │   ├── auth/
│   │   │   ├── permissions.ts # Permission matrix (3 roles x 35 actions)
│   │   │   └── scope.ts       # Unit-scoping logic
│   │   ├── services/          # Business logic layer (11 services)
│   │   ├── storage/           # File storage abstraction
│   │   └── excel/
│   │       └── reports.ts     # Excel report generation
│   └── types/
│       └── next-auth.d.ts     # Session type extensions
├── scripts/
│   └── scan-alerts.ts         # CLI job for alert scanning
├── docker-compose.yml         # Full stack: PostgreSQL + app
├── docker-compose.db.yml      # Database only (for native development)
├── Dockerfile                 # Multi-stage production image
├── next.config.mjs            # Server action body limit: 25MB
├── tailwind.config.ts         # Custom brand colors
└── tsconfig.json              # Strict TypeScript config
```

---

### Database Schema (18 Models)

#### Core Models

**User** - Authentication and role assignment
- Fields: id, name, email (unique), password (hashed), role (enum), unitId (FK), active, createdAt, updatedAt
- Roles: `COMANDANCIA_ADMIN`, `UNIT_MANAGER`, `OPERATIONAL`

**Unit** - 26 organizational units (fire stations, warehouses, training field, HQ)
- Fields: id, name, code (unique), type (enum), address, phone, active, responsibleUserId, createdAt, updatedAt
- Types: `CUARTEL` (station), `CAMPO_ENTRENAMIENTO` (training field), `BODEGA` (warehouse), `COMANDANCIA` (HQ)

**Category** - 14 material categories
- Fields: id, name, code (unique), description, active, createdAt

**Material** - Equipment and supply catalog
- Fields: id, name, code (unique), description, categoryId (FK), isConsumable, unit (unit of measure), maintenanceIntervalDays, expirationDays, minStock, active, createdAt, updatedAt

#### Inventory

**Asset** - Individual equipment with lifecycle tracking
- Fields: id, materialId (FK), unitId (FK), serialNumber (unique), status (enum), acquisitionDate, expirationDate, responsiblePerson, location, notes, nextReviewDate, nextMaintenanceDate, createdAt, updatedAt
- Statuses: `OPERATIVO` (operational), `DISPONIBLE` (available), `OBSERVADO` (observed), `EN_MANTENCION` (in maintenance), `FUERA_DE_SERVICIO` (out of service), `RESERVADO` (reserved), `DADO_DE_BAJA` (decommissioned)

**ConsumableInventory** - Bulk materials tracked by stock quantity, batch, and expiration
- Fields: id, materialId (FK), unitId (FK), batchNumber, quantity, minStock, expirationDate, status (enum), createdAt, updatedAt
- Unique constraint: (materialId, unitId, batchNumber)
- Statuses: `DISPONIBLE` (available), `BAJO_STOCK` (low stock), `VENCIDO` (expired), `PROXIMO_VENCER` (expiring soon), `RESERVADO` (reserved), `AGOTADO` (depleted)

**UnitMaterialStock** - Stock levels per unit (denormalized for dashboard queries)

**MaterialSerialNumber** - Individual tracking of specific equipment units

#### Maintenance & Lifecycle

**MaintenanceRecord** - Preventive and corrective maintenance
- Fields: id, assetId (FK), type (enum), date, description, cost, performedBy, resultStatus, nextMaintenanceDate, cancelled, createdAt
- 10 types: `PREVENTIVA` (preventive), `CORRECTIVA` (corrective), `CERTIFICACION` (certification), `CALIBRACION` (calibration), `PRUEBA_HIDRAULICA` (hydrostatic test), `INSPECCION` (inspection), `RECARGA` (recharge), `REPARACION` (repair), `LIMPIEZA_TECNICA` (technical cleaning), `CAMBIO_PIEZAS` (parts replacement)

**AssetReview** - Field inspections
- Fields: id, assetId (FK), reviewerId (FK), date, status (enum), observations, createdAt
- Review statuses: `OK`, `CON_OBSERVACIONES` (with observations), `INOPERATIVA` (inoperative)

**Document** - PDF attachments with magic-byte validation
- Fields: id, name, type (enum), filePath, fileSize, mimeType, assetId, maintenanceId, materialId, uploadedById, createdAt
- 12 document types: `ORDEN_MANTENCION` (maintenance order), `CERTIFICADO` (certificate), `FACTURA` (invoice), `GUIA_DESPACHO` (dispatch guide), `MANUAL`, etc.
- Validation: verify first bytes are `%PDF`

#### Movements & Transfers

**InventoryMovement** - Atomic stock operations
- Fields: id, consumableId (FK), type (enum), quantity, date, userId (FK), status (enum), notes, createdAt
- 10 types: `INGRESO` (entry), `SALIDA` (exit), `CONSUMO` (consumption), `TRASLADO` (transfer), `BAJA` (write-off), `ENVIO_MANTENCION` (sent to maintenance), `RETORNO_MANTENCION` (returned from maintenance), `RESERVA` (reservation), `AJUSTE` (adjustment), `ASIGNACION_VEHICULO` (vehicle assignment)
- Use optimistic locking to prevent race conditions

**Transfer** and **TransferItem** - State machine for inter-unit transfers
- Transfer fields: id, code (unique, format TR-{timestamp}-{random}), originUnitId, destinationUnitId, status (enum), requesterId, approverId, receiverId, rejectionReason, requestedAt, resolvedAt
- States: `SOLICITADO` (requested) → `APROBADO` (approved) → `PREPARADO` (prepared) → `EN_TRANSITO` (in transit) → `RECIBIDO` (received) — or `RECHAZADO` (rejected) / `CANCELADO` (cancelled)
- Inventory only moves when status reaches `RECIBIDO`

#### Alerts & Auditing

**Alert** - 15 alert types generated automatically
- Fields: id, type (enum), severity, message, unitId, assetId, consumableId, status (enum), acknowledgedById, acknowledgedAt, acknowledgeReason, createdAt
- Types: `STOCK_BAJO` (low stock), `STOCK_AGOTADO` (depleted), `INSUMO_VENCIDO` (expired supply), `INSUMO_PROXIMO_VENCER` (supply expiring soon), `ACTIVO_FUERA_SERVICIO` (asset out of service), `ACTIVO_EN_MANTENCION` (asset in maintenance), `MANTENCION_VENCIDA` (overdue maintenance), `MANTENCION_PROXIMA` (upcoming maintenance), `CERTIFICACION_VENCIDA` (expired certification), `EPP_VENCIDO` (expired PPE), `PRUEBA_HIDRAULICA_VENCIDA` (overdue hydrostatic test), `ACTIVO_SIN_HOJA_VIDA` (asset without service record), `DOCUMENTO_PENDIENTE` (pending document), `REVISION_VENCIDA` (overdue review), `REVISION_PROXIMA` (upcoming review)
- Statuses: `ABIERTA` (open), `DESCARTADA` (dismissed), `RESUELTA` (resolved)

**AuditLog** - Immutable record of every mutation
- Fields: id, entity, entityId, action (CREATE/UPDATE/DELETE), userId, userName, oldValues (JSON), newValues (JSON), ipAddress, createdAt
- Every mutation must record audit within the same database transaction

#### Auth.js Models
- **Account**, **Session**, **VerificationToken** - Standard Auth.js/NextAuth models

---

### Authentication & Authorization

**Authentication:**
- Credentials provider (email + password)
- JWT sessions in httpOnly cookies
- Password hashing with bcryptjs (salt rounds = 12)
- Middleware protects all routes except `/login`, `/api/auth/*`, `/api/alerts/scan`, `/forbidden`

**Three Roles with Granular Permissions:**

| Role | Unit Access | Write Access | Transfer Approval |
|------|------------|--------------|-------------------|
| `COMANDANCIA_ADMIN` | All units | Full | Yes |
| `UNIT_MANAGER` | Own unit only | Own unit | Own unit only |
| `OPERATIONAL` | Own unit only | Limited | No |

**35-Action Permission Matrix:**
- units: read.any, read.own, write, deactivate
- users: read, write, deactivate
- categories: read, write
- materials: read, write
- assets: read.any, read.own, write.own, decommission
- consumables: read.any, read.own, write.own
- movements: read.any, read.own, write, consume
- transfers: read.any, read.own, request, approve, receive, reject
- maintenance: read.any, read.own, write.own
- documents: read.any, read.own, write.own, delete
- alerts: read.any, read.own, dismiss
- reports: export.any, export.own
- audit: read
- dashboard: commandancia, unit

**`scopeByUnit(user, requestedUnitId)` function:**
- Comandancia: no filter (sees everything)
- Other roles: `{ unitId: user.unitId }`

---

### API Endpoints (28 routes)

**Units:** GET/POST `/api/units`, GET/PUT `/api/units/[id]`, PATCH `/api/units/[id]/deactivate`

**Users:** GET/POST `/api/users`, GET/PUT `/api/users/[id]`

**Categories & Materials:** GET/POST `/api/categories`, GET/POST `/api/materials`, GET/PUT `/api/materials/[id]`, POST `/api/materials/[id]/images`, GET `/api/materials/import-template.xlsx`

**Assets:** GET/POST `/api/assets`, GET/PUT `/api/assets/[id]`, PATCH `/api/assets/[id]/decommission`

**Consumables:** GET/POST `/api/consumables`, POST `/api/consumables/[id]/consume`

**Transfers:** GET/POST `/api/transfers`, POST `/api/transfers/[id]/[action]` (approve, prepare, dispatch, receive, reject)

**Maintenance:** POST `/api/maintenance`

**Documents:** GET/POST `/api/documents`, GET `/api/documents/[id]/download`

**Excel Reports:** GET `/api/reports/inventory.xlsx`, GET `/api/reports/low-stock.xlsx`, GET `/api/reports/expired.xlsx`, GET `/api/reports/maintenance.xlsx`, GET `/api/reports/transfers.xlsx`, GET `/api/reports/audit.xlsx`

**Alerts:** GET `/api/alerts`, POST `/api/alerts/[id]/acknowledge`, POST `/api/alerts/scan`

All endpoints use consistent JSON responses with centralized error handling via `withErrorHandling()` and `errorResponse()`.

---

### UI Pages (3 role-based layouts)

**Admin (Command HQ) - `/admin/*`:**
- Dashboard with KPIs (units, assets, consumables, maintenance, alerts)
- CRUD for Units, Users, Categories, Materials (with bulk import from Excel)
- Consolidated Inventory view
- Management of Reviews, Transfers, Alerts (with bulk dismissal)
- 6 exportable Report types
- Complete Audit Log

**Unit Manager - `/unidad/*`:**
- Unit KPI Dashboard
- Management of Assets, Supplies, Movements, Transfers, Documents, Maintenance, Reviews
- Unit-specific Alerts
- Unit inventory Reports

**Operational - `/op/*`:**
- Simplified read-only Dashboard
- Limited Movements and Alerts access

**UI Patterns:**
- List pages with responsive tables and empty states
- Forms with inline Zod validation and success/error toasts
- Status badges with semantic colors
- Confirmation modals for destructive actions (deactivate, reject)
- Collapsible navigation sidebar + topbar with user info

---

### Service Layer (11 modules)

Each service encapsulates domain logic, permission checks, and audit recording within Prisma transactions:

1. **units.service** - Unit CRUD, responsible user assignment, audit
2. **users.service** - User CRUD, password hashing, soft-delete deactivation
3. **catalog.service** - Categories + Materials CRUD, bulk import from Excel, image management
4. **assets.service** - Asset lifecycle, next review date calculation, decommissioning
5. **consumables.service** - Stock tracking per batch, consumption with optimistic locking, automatic status detection
6. **transfers.service** - State machine, unique code generation, inventory moves only on RECIBIDO status
7. **maintenance.service** - Maintenance recording, next maintenance date calculation
8. **asset-reviews.service** - Field inspections
9. **documents.service** - PDF upload with magic-byte validation, path-traversal protection
10. **alerts.service** - Idempotent scanning of 15 alert types, dismissal with reason
11. **dashboards.service** - KPI aggregation with Prisma groupBy/count

---

### Key Business Rules

1. **Transfers**: Inventory only moves when status reaches RECIBIDO. The origin unit prepares and dispatches; Command HQ cannot receive transfers.
2. **Consumption**: Optimistic locking with conditional `updateMany` to prevent stock race conditions.
3. **Alerts**: The `scanAlerts()` job is idempotent (safe to run multiple times). Uses upsert to avoid duplicates.
4. **Auditing**: Every mutation records old/new values, user, timestamp, and IP within the same database transaction.
5. **Documents**: PDF validation by magic bytes (`%PDF`), not MIME type. Path-traversal protection in file path resolution.
6. **Assets**: Full lifecycle: OPERATIVO → EN_MANTENCION → FUERA_DE_SERVICIO → DADO_DE_BAJA.

---

### Seed Data

**14 Categories:** Heavy Equipment (Material Mayor), Light Equipment (Material Menor), PPE (EPP), Rescue, Water, Medical, Communications, Tools, Training, Logistics, Cleaning, Spare Parts, Food, Warehouse

**26 Units:**
- 22 Fire Stations (CU01 through CU22)
- 1 Training Field (CE01)
- 3 Warehouses (BO01, BO02, BO03)
- 1 Virtual Command HQ (CMD)

**13 Sample Materials:** Fire engine, Water tanker, Ambulance, Hose, Adjustable nozzle, Structural helmet, Structural jacket, SCBA, Air cylinder, VHF Radio, Nitrile gloves, Dressings, etc.

**3 Demo Users:**
- `admin@bomberos.local` / `Admin1234!` → COMANDANCIA_ADMIN
- `encargado1@bomberos.local` / `Encargado1!` → UNIT_MANAGER (Station 1)
- `operativo1@bomberos.local` / `Operativo1!` → OPERATIONAL (Station 1)

---

### Environment Variables

```env
DATABASE_URL=postgresql://siib:siib_dev@localhost:5432/siib
POSTGRES_USER=siib
POSTGRES_PASSWORD=siib_dev
POSTGRES_DB=siib
AUTH_SECRET=<random-32-char-secret>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=http://localhost:3000
STORAGE_LOCAL_PATH=./storage/uploads
STORAGE_MAX_FILE_SIZE_MB=20
ALERTS_SCAN_TOKEN=<random-token>
SEED_ON_BOOT=true
NODE_ENV=development
APP_PORT=3000
```

---

### Deployment

**Docker (production):**
```bash
docker compose up -d --build
# PostgreSQL 16 + Next.js in separate containers
# Auto-runs migrations and seed on startup
```

**Native development:**
```bash
npm install
cp .env.example .env  # Configure variables
docker compose -f docker-compose.db.yml up -d  # PostgreSQL only
npm run db:deploy && npm run db:seed
npm run dev
```

**npm Scripts:**
- `dev` / `build` / `start` - Next.js
- `lint` / `typecheck` - Code quality
- `db:generate` / `db:migrate` / `db:deploy` / `db:seed` / `db:studio` - Prisma
- `alerts:scan` - Manual alert scanning job

---

### Architectural Patterns

1. **Service + API Handler**: Service (pure logic) → Route Handler (auth + HTTP) → Client
2. **Transactional Auditing**: Every mutation uses `prisma.$transaction()` with `recordAudit()` inside
3. **Unit Scoping**: Automatic query filtering based on user role
4. **Permission Matrix**: `can(user, action)` checks a 3x35 lookup table
5. **Optimistic Locking**: For stock consumption, conditional `updateMany`
6. **State Machine**: Transfers with explicit state transitions
7. **Idempotent Job**: Alerts with upsert, safe to run repeatedly
8. **Storage Abstraction**: `FileStorage` interface with local implementation (ready for S3)

---

### Security

- bcryptjs hashing with salt rounds 12
- JWT in httpOnly cookies
- Parameterized queries via Prisma (SQL injection prevention)
- Path-traversal protection in storage via `resolveSafe()`
- File validation by magic bytes (not MIME type)
- CSRF protection via Next.js/Auth.js
- Structured logging with pino for traceability
