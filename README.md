# SIIB — Sistema Integral de Inventario de Bomberos

Aplicación web multiunidad para administrar el inventario de un Cuerpo de Bomberos:
**22 cuarteles + 1 campo de entrenamiento + 3 bodegas**, supervisados por Comandancia.

## Stack

- **Next.js 15** (App Router) + **TypeScript** estricto
- **PostgreSQL 16** + **Prisma 5**
- **Auth.js v5** (sesiones JWT, cookies httpOnly)
- **Tailwind CSS**
- **ExcelJS**, **Zod**, **bcryptjs**

## Cómo levantarlo

El proyecto se puede ejecutar de **dos formas**. La base de código es la misma; solo cambia el método de arranque.

| Modalidad | Guía | Cuándo usarla |
|---|---|---|
| 🐳 **Con Docker** | [`INSTALL-DOCKER.md`](INSTALL-DOCKER.md) | Producción, instalación rápida y portable, on-premise. Un solo comando: `docker compose up -d --build`. |
| 💻 **Sin Docker** (nativa) | [`INSTALL-NATIVE.md`](INSTALL-NATIVE.md) | Desarrollo activo, mejor experiencia con hot-reload. Requiere Node 20 + PostgreSQL local. |

Ambas guías incluyen instrucciones específicas para **Windows, Linux y macOS**.

## Usuario administrador inicial

Tras el primer arranque (cualquier modalidad) el seed crea:

| Email | Contraseña | Rol | Unidad |
|---|---|---|---|
| `admin@bomberos.local` | `Admin1234!` | Administrador Comandancia | — |
| `encargado1@bomberos.local` | `Encargado1!` | Encargado de Unidad | Cuartel 1 |
| `operativo1@bomberos.local` | `Operativo1!` | Usuario Operativo | Cuartel 1 |

> ⚠ **En producción cambia estas contraseñas inmediatamente.**

## Estructura del proyecto

```
prisma/              schema.prisma + seed.ts
docker/              entrypoint.sh del contenedor app
scripts/             jobs CLI (scan-alerts.ts)
storage/uploads/     PDFs subidos (montado como volumen en Docker)
src/
  app/               Next.js App Router (UI + /api)
    (admin)/         Layout y vistas de Comandancia
    (unidad)/        Layout y vistas de Encargado de Unidad
    (op)/            Layout y vista de Usuario Operativo
    api/             Route handlers REST
    login/           Pantalla de login
  components/        UI reutilizable
  lib/
    db.ts            Cliente Prisma (singleton)
    auth/            Permisos y scope por unidad
    services/        Lógica de negocio + auditoría
    storage/         Almacenamiento de archivos
    excel/           Generación de reportes
  auth.ts            Configuración de Auth.js
  auth.config.ts     Callbacks (shared con middleware)
  middleware.ts      Protección de rutas
Dockerfile           Imagen multi-stage para modo Docker
docker-compose.yml   Stack completo (postgres + app)
docker-compose.db.yml  Solo PostgreSQL (atajo para modo nativo)
.env.example         Variables compartidas por ambas modalidades
```

## Estado del MVP

Los módulos marcados **[TODO]** ya tienen el servicio backend y la ruta API; falta UI siguiendo el patrón de **Unidades** ([`src/app/(admin)/admin/unidades/`](src/app/(admin)/admin/unidades)).

| Módulo | Backend | UI |
|---|---|---|
| Autenticación + roles + middleware | ✅ | ✅ Login |
| Unidades (CRUD completo) | ✅ | ✅ Patrón completo |
| Usuarios | ✅ Servicio | ⚠ Listado solo |
| Categorías | ✅ Servicio | ⚠ Listado solo |
| Materiales | ✅ Servicio | ⚠ Listado solo |
| Activos | ✅ Servicio | ⚠ [TODO] form + ficha |
| Insumos | ✅ Servicio | ⚠ [TODO] form |
| Movimientos (consumo atómico + alerta auto) | ✅ Servicio | ⚠ [TODO] form |
| Traslados (máquina de estados) | ✅ Servicio | ⚠ [TODO] bandeja |
| Mantenciones (cambia estado del activo) | ✅ Servicio | ⚠ [TODO] form |
| Documentos PDF (validación magic bytes) | ✅ Servicio | ⚠ [TODO] form |
| Alertas (job idempotente) | ✅ Servicio + job | ✅ Listado |
| Excel (inventario consolidado) | ✅ | ✅ Botón en dashboard |
| Auditoría | ✅ Escrita por cada servicio | ✅ Listado |
| Dashboards | ✅ KPIs reales | ✅ Comandancia + Unidad |

## Próximos pasos del desarrollo

1. Replicar el patrón de Unidades para los CRUDs marcados `[TODO]`.
2. Completar resto de reportes Excel (stock bajo, vencidos, mantenciones, etc).
3. Hardening: rate limit de login, CSP headers, 2FA opcional.
4. Post-MVP: QR de activos, PWA móvil, notificaciones por correo.

## Diseño y decisiones técnicas

Las decisiones de arquitectura, modelo de datos, matriz de permisos y flujos están documentadas en el chat de implementación. Resumen rápido:

- **Scoping multi-unidad** vía `lib/auth/scope.ts` — todas las queries no-Comandancia se filtran por `unit_id` automáticamente.
- **Auditoría inmutable** dentro de la misma transacción que cada mutación (`lib/audit.ts`).
- **Traslados** con máquina de estados; el inventario solo se mueve al pasar a `RECIBIDO`.
- **Consumo de stock** con lock optimista (`updateMany` condicional) — evita carreras entre dos requests simultáneos.
- **PDFs** validados por *magic bytes* (los primeros 4 bytes deben ser `%PDF`), no por header MIME del cliente.
- **Storage** abstraído tras una interfaz para migrar a S3-compatible sin tocar la lógica de negocio.

## Soporte

- Errores comunes: ver la sección final de [INSTALL-DOCKER.md](INSTALL-DOCKER.md) y [INSTALL-NATIVE.md](INSTALL-NATIVE.md).
- Logs en modo Docker: `docker compose logs -f app`.
- Logs en modo nativo: salida de `npm run dev`.
