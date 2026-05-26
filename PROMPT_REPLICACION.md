# Prompt para Replicar SIIB - Sistema Integral de Inventario de Bomberos

> Usa este prompt con un LLM o asistente de código para recrear el proyecto desde cero.

---

## Prompt

Crea una aplicación web completa llamada **SIIB (Sistema Integral de Inventario de Bomberos)** para gestionar el inventario de un cuerpo de bomberos con múltiples cuarteles. El sistema debe permitir administrar activos (vehículos, equipos), insumos consumibles, traslados entre unidades, mantenciones, documentos PDF, alertas automáticas y reportes Excel, todo con auditoría completa y control de acceso por roles.

---

### Stack Tecnológico

- **Framework**: Next.js 15 con App Router
- **Lenguaje**: TypeScript 5.7 en modo estricto
- **Base de datos**: PostgreSQL 16
- **ORM**: Prisma 5.22
- **Autenticación**: Auth.js v5 (NextAuth) con estrategia JWT y provider de credenciales (email/password)
- **UI**: React 19 + Tailwind CSS 3.4 con tema personalizado (colores rojos para bomberos)
- **Hashing**: bcryptjs (salt rounds = 12)
- **Validación**: Zod 3.23
- **Reportes**: ExcelJS 4.4
- **Utilidades**: date-fns, clsx, tailwind-merge, pino (logging)
- **Contenedores**: Docker multi-stage con node:20-alpine
- **Runtime**: Node 20+

---

### Estructura del Proyecto

```
/
├── prisma/
│   ├── schema.prisma          # Esquema completo con 18 modelos
│   └── seed.ts                # Seed idempotente (categorías, unidades, usuarios demo, materiales)
├── docker/
│   └── entrypoint.sh          # Ejecuta migraciones + seed al iniciar
├── src/
│   ├── auth.ts                # Configuración Auth.js + credentials provider
│   ├── auth.config.ts         # Config compartida (compatible con edge runtime)
│   ├── middleware.ts          # Protección de rutas por autenticación
│   ├── app/
│   │   ├── (admin)/admin/     # Páginas del rol Comandancia (dashboard, unidades, usuarios, etc.)
│   │   ├── (unidad)/unidad/   # Páginas del rol Encargado de Unidad
│   │   ├── (op)/op/           # Páginas del rol Operativo
│   │   ├── api/               # Rutas API REST (28 endpoints)
│   │   ├── login/             # UI de autenticación
│   │   └── layout.tsx         # Layout raíz
│   ├── components/
│   │   ├── ui/                # Reutilizables: Button, Card, Table, Badge, Input, Label
│   │   ├── forms/             # Específicos: formularios de mantención, traslados, etc.
│   │   ├── sidebar.tsx        # Barra lateral de navegación
│   │   ├── topbar.tsx         # Barra superior
│   │   └── stat-card.tsx      # Tarjeta de KPI
│   ├── lib/
│   │   ├── db.ts              # Singleton de Prisma con logging
│   │   ├── audit.ts           # Registro de auditoría dentro de transacciones
│   │   ├── http.ts            # Manejo de errores y formateo de respuestas
│   │   ├── utils.ts           # Formateo de fechas, cálculo de mantenciones
│   │   ├── auth/
│   │   │   ├── permissions.ts # Matriz de permisos (3 roles x 35 acciones)
│   │   │   └── scope.ts       # Lógica de scope por unidad
│   │   ├── services/          # Capa de lógica de negocio (11 servicios)
│   │   ├── storage/           # Abstracción de almacenamiento de archivos
│   │   └── excel/
│   │       └── reports.ts     # Generación de reportes Excel
│   └── types/
│       └── next-auth.d.ts     # Extensiones de tipos de sesión
├── scripts/
│   └── scan-alerts.ts         # Job CLI para escaneo de alertas
├── docker-compose.yml         # Stack completo: PostgreSQL + app
├── docker-compose.db.yml      # Solo base de datos (desarrollo nativo)
├── Dockerfile                 # Imagen de producción multi-stage
├── next.config.mjs            # Límite de body para server actions: 25MB
├── tailwind.config.ts         # Colores de marca personalizados
└── tsconfig.json              # TypeScript estricto
```

---

### Esquema de Base de Datos (18 Modelos)

#### Modelos Principales

**User** - Autenticación y asignación de rol
- Campos: id, name, email (unique), password (hashed), role (enum), unitId (FK), active, createdAt, updatedAt
- Roles: `COMANDANCIA_ADMIN`, `UNIT_MANAGER`, `OPERATIONAL`

**Unit** - 26 unidades organizacionales
- Campos: id, name, code (unique), type (enum), address, phone, active, responsibleUserId, createdAt, updatedAt
- Tipos: `CUARTEL`, `CAMPO_ENTRENAMIENTO`, `BODEGA`, `COMANDANCIA`

**Category** - 14 categorías de materiales
- Campos: id, name, code (unique), description, active, createdAt

**Material** - Catálogo de equipos e insumos
- Campos: id, name, code (unique), description, categoryId (FK), isConsumable, unit (unidad de medida), maintenanceIntervalDays, expirationDays, minStock, active, createdAt, updatedAt

#### Inventario

**Asset** - Equipamiento individual con ciclo de vida
- Campos: id, materialId (FK), unitId (FK), serialNumber (unique), status (enum), acquisitionDate, expirationDate, responsiblePerson, location, notes, nextReviewDate, nextMaintenanceDate, createdAt, updatedAt
- Estados: `OPERATIVO`, `DISPONIBLE`, `OBSERVADO`, `EN_MANTENCION`, `FUERA_DE_SERVICIO`, `RESERVADO`, `DADO_DE_BAJA`

**ConsumableInventory** - Materiales por cantidad (stock, lote, vencimiento)
- Campos: id, materialId (FK), unitId (FK), batchNumber, quantity, minStock, expirationDate, status (enum), createdAt, updatedAt
- Unique constraint: (materialId, unitId, batchNumber)
- Estados: `DISPONIBLE`, `BAJO_STOCK`, `VENCIDO`, `PROXIMO_VENCER`, `RESERVADO`, `AGOTADO`

**UnitMaterialStock** - Stock por unidad (desnormalizado para dashboards)

**MaterialSerialNumber** - Seguimiento individual de unidades específicas

#### Mantención y Ciclo de Vida

**MaintenanceRecord** - Mantenciones preventivas y correctivas
- Campos: id, assetId (FK), type (enum), date, description, cost, performedBy, resultStatus, nextMaintenanceDate, cancelled, createdAt
- 10 tipos: `PREVENTIVA`, `CORRECTIVA`, `CERTIFICACION`, `CALIBRACION`, `PRUEBA_HIDRAULICA`, `INSPECCION`, `RECARGA`, `REPARACION`, `LIMPIEZA_TECNICA`, `CAMBIO_PIEZAS`

**AssetReview** - Inspecciones de campo
- Campos: id, assetId (FK), reviewerId (FK), date, status (enum), observations, createdAt
- Estados de revisión: `OK`, `CON_OBSERVACIONES`, `INOPERATIVA`

**Document** - PDFs adjuntos con validación de magic bytes
- Campos: id, name, type (enum), filePath, fileSize, mimeType, assetId, maintenanceId, materialId, uploadedById, createdAt
- 12 tipos de documento: `ORDEN_MANTENCION`, `CERTIFICADO`, `FACTURA`, `GUIA_DESPACHO`, `MANUAL`, etc.
- Validación: verificar que los primeros bytes sean `%PDF`

#### Movimientos y Traslados

**InventoryMovement** - Operaciones atómicas sobre stock
- Campos: id, consumableId (FK), type (enum), quantity, date, userId (FK), status (enum), notes, createdAt
- 10 tipos: `INGRESO`, `SALIDA`, `CONSUMO`, `TRASLADO`, `BAJA`, `ENVIO_MANTENCION`, `RETORNO_MANTENCION`, `RESERVA`, `AJUSTE`, `ASIGNACION_VEHICULO`
- Usar bloqueo optimista para prevenir condiciones de carrera

**Transfer** y **TransferItem** - Máquina de estados para traslados
- Campos Transfer: id, code (unique, formato TR-{timestamp}-{random}), originUnitId, destinationUnitId, status (enum), requesterId, approverId, receiverId, rejectionReason, requestedAt, resolvedAt
- Estados: `SOLICITADO` → `APROBADO` → `PREPARADO` → `EN_TRANSITO` → `RECIBIDO` (o `RECHAZADO`/`CANCELADO`)
- El inventario solo se mueve cuando el estado es `RECIBIDO`

#### Alertas y Auditoría

**Alert** - 15 tipos de alerta generados automáticamente
- Campos: id, type (enum), severity, message, unitId, assetId, consumableId, status (enum), acknowledgedById, acknowledgedAt, acknowledgeReason, createdAt
- Tipos: `STOCK_BAJO`, `STOCK_AGOTADO`, `INSUMO_VENCIDO`, `INSUMO_PROXIMO_VENCER`, `ACTIVO_FUERA_SERVICIO`, `ACTIVO_EN_MANTENCION`, `MANTENCION_VENCIDA`, `MANTENCION_PROXIMA`, `CERTIFICACION_VENCIDA`, `EPP_VENCIDO`, `PRUEBA_HIDRAULICA_VENCIDA`, `ACTIVO_SIN_HOJA_VIDA`, `DOCUMENTO_PENDIENTE`, `REVISION_VENCIDA`, `REVISION_PROXIMA`
- Estados: `ABIERTA`, `DESCARTADA`, `RESUELTA`

**AuditLog** - Registro inmutable de toda mutación
- Campos: id, entity, entityId, action (CREATE/UPDATE/DELETE), userId, userName, oldValues (JSON), newValues (JSON), ipAddress, createdAt
- Cada mutación debe registrar auditoría dentro de la misma transacción

#### Modelos Auth.js
- **Account**, **Session**, **VerificationToken** - Estándar de Auth.js/NextAuth

---

### Sistema de Autenticación y Autorización

**Autenticación:**
- Provider de credenciales (email + password)
- Sesiones JWT en cookies httpOnly
- Hashing con bcryptjs (salt rounds = 12)
- Middleware que protege todas las rutas excepto `/login`, `/api/auth/*`, `/api/alerts/scan`, `/forbidden`

**Tres Roles con Permisos Granulares:**

| Rol | Acceso a Unidades | Escritura | Aprobación Traslados |
|-----|-------------------|-----------|---------------------|
| `COMANDANCIA_ADMIN` | Todas | Total | Sí |
| `UNIT_MANAGER` | Solo su unidad | Su unidad | Solo su unidad |
| `OPERATIONAL` | Solo su unidad | Limitada | No |

**Matriz de 35 Acciones:**
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

**Función `scopeByUnit(user, requestedUnitId)`:**
- Comandancia: sin filtro (ve todo)
- Otros roles: `{ unitId: user.unitId }`

---

### Endpoints API (28 rutas)

**Unidades:** GET/POST `/api/units`, GET/PUT `/api/units/[id]`, PATCH `/api/units/[id]/deactivate`

**Usuarios:** GET/POST `/api/users`, GET/PUT `/api/users/[id]`

**Categorías y Materiales:** GET/POST `/api/categories`, GET/POST `/api/materials`, GET/PUT `/api/materials/[id]`, POST `/api/materials/[id]/images`, GET `/api/materials/import-template.xlsx`

**Activos:** GET/POST `/api/assets`, GET/PUT `/api/assets/[id]`, PATCH `/api/assets/[id]/decommission`

**Consumibles:** GET/POST `/api/consumables`, POST `/api/consumables/[id]/consume`

**Traslados:** GET/POST `/api/transfers`, POST `/api/transfers/[id]/[action]` (approve, prepare, dispatch, receive, reject)

**Mantenciones:** POST `/api/maintenance`

**Documentos:** GET/POST `/api/documents`, GET `/api/documents/[id]/download`

**Reportes Excel:** GET `/api/reports/inventory.xlsx`, GET `/api/reports/low-stock.xlsx`, GET `/api/reports/expired.xlsx`, GET `/api/reports/maintenance.xlsx`, GET `/api/reports/transfers.xlsx`, GET `/api/reports/audit.xlsx`

**Alertas:** GET `/api/alerts`, POST `/api/alerts/[id]/acknowledge`, POST `/api/alerts/scan`

Todos los endpoints usan respuestas JSON consistentes con manejo de errores centralizado via `withErrorHandling()` y `errorResponse()`.

---

### Páginas UI (3 layouts por rol)

**Admin (Comandancia) - `/admin/*`:**
- Dashboard con KPIs (unidades, activos, consumibles, mantenciones, alertas)
- CRUD de Unidades, Usuarios, Categorías, Materiales (con importación masiva desde Excel)
- Vista consolidada de Inventario
- Gestión de Revisiones, Traslados, Alertas (con descarte masivo)
- 6 tipos de Reportes exportables
- Log de Auditoría completo

**Encargado de Unidad - `/unidad/*`:**
- Dashboard de KPIs de su unidad
- Gestión de Activos, Insumos, Movimientos, Traslados, Documentos, Mantenciones, Revisiones
- Alertas de su unidad
- Reportes de inventario de su unidad

**Operativo - `/op/*`:**
- Dashboard simplificado (solo lectura)
- Movimientos y alertas limitados

**Patrones UI:**
- Listas con tabla responsive y estados vacíos
- Formularios con validación Zod inline y toasts de éxito/error
- Badges de estado con colores semánticos
- Modales de confirmación para acciones destructivas (desactivar, rechazar)
- Sidebar de navegación colapsable + topbar con usuario

---

### Capa de Servicios (11 módulos)

Cada servicio encapsula lógica de dominio, verificación de permisos y registro de auditoría dentro de transacciones Prisma:

1. **units.service** - CRUD unidades, asignación de responsable, auditoría
2. **users.service** - CRUD usuarios, hashing de password, desactivación
3. **catalog.service** - Categorías + Materiales CRUD, importación masiva desde Excel, imágenes
4. **assets.service** - Ciclo de vida de activos, cálculo de próxima revisión, baja
5. **consumables.service** - Tracking de stock por lote, consumo con bloqueo optimista, detección automática de estados
6. **transfers.service** - Máquina de estados, generación de código único, movimiento de inventario solo en RECIBIDO
7. **maintenance.service** - Registro de mantenciones, cálculo de próxima fecha
8. **asset-reviews.service** - Inspecciones de campo
9. **documents.service** - Upload PDF con validación de magic bytes, protección path-traversal
10. **alerts.service** - Escaneo idempotente de 15 tipos de alerta, descarte con razón
11. **dashboards.service** - Agregación de KPIs con Prisma groupBy/count

---

### Reglas de Negocio Clave

1. **Traslados**: Solo se mueve inventario al estado RECIBIDO. La unidad de origen prepara y despacha; Comandancia no puede recibir.
2. **Consumo**: Bloqueo optimista con `updateMany` condicional para evitar race conditions en stock.
3. **Alertas**: El job `scanAlerts()` es idempotente (seguro de ejecutar múltiples veces). Usa upsert para no duplicar.
4. **Auditoría**: Toda mutación registra old/new values, usuario, timestamp e IP dentro de la misma transacción.
5. **Documentos**: Validación de PDF por magic bytes (`%PDF`), no por MIME type. Protección contra path-traversal en la resolución de rutas.
6. **Activos**: Ciclo de vida completo: OPERATIVO → EN_MANTENCION → FUERA_DE_SERVICIO → DADO_DE_BAJA.

---

### Datos Semilla

**14 Categorías:** Material Mayor, Material Menor, EPP, Rescate, Agua, Médico, Comunicaciones, Herramientas, Entrenamiento, Logística, Aseo, Repuestos, Alimentación, Bodega

**26 Unidades:**
- 22 Cuarteles (CU01 a CU22)
- 1 Campo de Entrenamiento (CE01)
- 3 Bodegas (BO01, BO02, BO03)
- 1 Comandancia virtual (CMD)

**13 Materiales de ejemplo:** Carro bomba, Carro aljibe, Ambulancia, Manguera, Pitón regulable, Casco estructural, Chaqueta estructural, ERA, Cilindro aire, Radio VHF, Guantes nitrilo, Apósitos, etc.

**3 Usuarios Demo:**
- `admin@bomberos.local` / `Admin1234!` → COMANDANCIA_ADMIN
- `encargado1@bomberos.local` / `Encargado1!` → UNIT_MANAGER (Cuartel 1)
- `operativo1@bomberos.local` / `Operativo1!` → OPERATIONAL (Cuartel 1)

---

### Variables de Entorno

```env
DATABASE_URL=postgresql://siib:siib_dev@localhost:5432/siib
POSTGRES_USER=siib
POSTGRES_PASSWORD=siib_dev
POSTGRES_DB=siib
AUTH_SECRET=<secreto-aleatorio-32-caracteres>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=http://localhost:3000
STORAGE_LOCAL_PATH=./storage/uploads
STORAGE_MAX_FILE_SIZE_MB=20
ALERTS_SCAN_TOKEN=<token-aleatorio>
SEED_ON_BOOT=true
NODE_ENV=development
APP_PORT=3000
```

---

### Despliegue

**Docker (producción):**
```bash
docker compose up -d --build
# PostgreSQL 16 + Next.js en contenedores separados
# Auto-ejecuta migraciones y seed al iniciar
```

**Desarrollo nativo:**
```bash
npm install
cp .env.example .env  # Configurar variables
docker compose -f docker-compose.db.yml up -d  # Solo PostgreSQL
npm run db:deploy && npm run db:seed
npm run dev
```

**Scripts npm:**
- `dev` / `build` / `start` - Next.js
- `lint` / `typecheck` - Calidad de código
- `db:generate` / `db:migrate` / `db:deploy` / `db:seed` / `db:studio` - Prisma
- `alerts:scan` - Job manual de alertas

---

### Patrones Arquitectónicos

1. **Service + API Handler**: Servicio (lógica pura) → Route Handler (auth + HTTP) → Cliente
2. **Auditoría Transaccional**: Cada mutación usa `prisma.$transaction()` con `recordAudit()` dentro
3. **Scope por Unidad**: Filtrado automático de queries según rol del usuario
4. **Matriz de Permisos**: `can(user, action)` consulta tabla de lookup 3x35
5. **Bloqueo Optimista**: Para consumo de stock, `updateMany` condicional
6. **Máquina de Estados**: Traslados con transiciones explícitas
7. **Job Idempotente**: Alertas con upsert, seguro de ejecutar repetidamente
8. **Abstracción de Storage**: Interfaz `FileStorage` con implementación local (preparada para S3)

---

### Seguridad

- Hashing bcryptjs con salt 12
- JWT en cookies httpOnly
- Queries parametrizadas via Prisma (anti SQL injection)
- Protección path-traversal en storage con `resolveSafe()`
- Validación de archivos por magic bytes (no MIME)
- CSRF protection via Next.js/Auth.js
- Logging con pino para trazabilidad
