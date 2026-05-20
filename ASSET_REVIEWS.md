# Sistema de Revisiones y Bitácora de Activos

## Descripción

Se ha implementado un sistema completo de revisiones y bitácora para los activos (materiales no consumibles). Este sistema permite:

1. **Configurar un intervalo de revisión** para cada activo (ej: cada 1 mes, 3 meses, 1 año, etc.)
2. **Recibir alertas automáticas** cuando una revisión se vence
3. **Registrar revisiones** con tres estados posibles: OK, Con observaciones, Inoperativa
4. **Mantener una bitácora** de todas las revisiones realizadas
5. **Visualizar el historial** de revisiones por activo

## Cambios en el Schema de Prisma

### Tabla `Asset` (actualizada)
Se agregaron los siguientes campos:
- `nextReviewDate`: Fecha de próxima revisión (DateTime, opcional)
- `reviewIntervalValue`: Cantidad de unidades de tiempo (Int, opcional)
- `reviewIntervalUnit`: Tipo de unidad ('days', 'weeks', 'months', 'years')

### Nueva tabla `AssetReview`
```
- id: String (CUID)
- assetId: String (referencia a Asset)
- reviewDate: DateTime (por defecto ahora)
- status: String ('OK', 'CON_OBSERVACIONES', 'INOPERATIVA')
- comments: String (opcional)
- reviewedBy: String (referencia a User)
- createdAt: DateTime
```

### Actualización del Enum `AlertType`
Se agregaron dos nuevos tipos de alerta:
- `REVISION_VENCIDA`: Se dispara cuando una revisión está vencida
- `REVISION_PROXIMA`: Se dispara cuando está próxima a vencer (7 días)

## Nuevas Páginas

### 1. `/admin/revisiones`
**Lista de activos que requieren revisión**
- Muestra todos los activos cuya fecha de próxima revisión ya pasó
- Columnas: Código, Material, Unidad, Última revisión, Vencimiento, Días vencido
- Código de color para urgencia (rojo si >7 días vencido, naranja si <7 días, azul si dentro del rango)
- Botón "Revisar" para cada activo

### 2. `/admin/activos/[id]/revisar`
**Página de revisión de un activo específico**
- Información del activo (código, material, número de serie, etc.)
- **Bitácora de revisiones** con tabla de historial
  - Fecha y hora de la revisión
  - Estado (OK, Con observaciones, Inoperativa)
  - Nombre del usuario que revisó
  - Comentarios registrados
  
- **Formulario de nueva revisión**
  - Selector de estado (OK, Con observaciones, Inoperativa)
  - Campo de comentarios (requerido si no es OK)
  - Botón para registrar
  
- **Sección de configuración de intervalo** (si no está configurado)
  - Campo para cantidad de unidades
  - Selector de tipo de unidad (Días, Semanas, Meses, Años)
  - Botón para configurar

## Nuevos Servicios

### `src/lib/services/asset-reviews.service.ts`

**Funciones principales:**

```typescript
// Obtener un activo con su historial de revisiones
async function getAssetWithReviews(user: SessionUser, assetId: string)

// Listar activos que necesitan revisión
async function listAssetsNeedingReview(user: SessionUser)

// Registrar una nueva revisión
async function submitAssetReview(
  user: SessionUser,
  input: { assetId, status, comments? },
  ip?: string
)

// Configurar el intervalo de revisión
async function setAssetReviewSchedule(
  user: SessionUser,
  assetId: string,
  intervalValue: number,
  intervalUnit: 'days' | 'weeks' | 'months' | 'years',
  ip?: string
)
```

## Nuevo Componente

### `src/components/asset-review-status.tsx`
Componente para mostrar el estado de revisión de un activo en otras páginas.

**Props:**
- `assetId`: ID del activo

**Renderiza:**
- Badge con estado (vencida, próxima a vencer, al día)
- Link directo a la página de revisión
- Intervalo configurado
- Última revisión registrada

## Flujo de Uso

### Como Encargado de Unidad (crear intervalo)

1. Ir a `/admin/revisiones`
2. Ver lista de activos pendientes (al principio estará vacía)
3. Ir a la página de un activo específico (desde materiales o inventario)
4. En la sección "Configurar intervalo de revisión", establecer:
   - Cada cuántas unidades de tiempo se debe revisar
   - Tipo de unidad (días, semanas, meses, años)
5. Sistema calcula automáticamente la próxima fecha de revisión

### Como Operario (marcar revisión)

1. Ir a `/admin/revisiones`
2. Ver lista de activos que requieren revisión
3. Hacer clic en "Revisar" en el activo a revisar
4. Ver bitácora de revisiones anteriores
5. En "Nueva revisión":
   - Seleccionar estado: OK, Con observaciones, o Inoperativa
   - Si NO es OK, agregar comentarios obligatorios (ej: "Necesita mantenimiento", "Cilindro averiado")
   - Hacer clic en "Registrar revisión"
6. Sistema automáticamente:
   - Registra la revisión en la bitácora con fecha, hora y usuario
   - Calcula la próxima fecha de revisión
   - Actualiza el intervalo

## Permisos Requeridos

- `assets.read`: Para ver activos y revisiones
- `assets.write`: Para registrar nuevas revisiones y configurar intervalos

## Instalación / Migraciones

1. Ejecutar generación de cliente Prisma:
```bash
npm run db:generate
```

2. Ejecutar migración:
```bash
npm run db:migrate
```

Nombre sugerido: `add_asset_reviews_and_schedule`

3. (Opcional) Ver la base de datos con:
```bash
npm run db:studio
```

## Alertas Automáticas (Próximo)

Se puede integrar con el sistema de alertas para:
- Enviar notificaciones cuando una revisión vence
- Listar activos con revisiones vencidas en el dashboard
- Generar reportes de cumplimiento de revisiones

## Campos de Comentarios

- **Si estado es OK**: Comentarios opcionales (ej: "Funcionando perfectamente")
- **Si estado es CON_OBSERVACIONES**: Comentarios obligatorios (ej: "Requiere limpieza", "Válvula lenta")
- **Si estado es INOPERATIVA**: Comentarios obligatorios (ej: "Cilindro roto", "No mantiene presión")

## Ejemplo de Configuración de Intervalos

| Tipo de Activo | Intervalo Recomendado |
|---|---|
| Extintor | 1 año |
| Bomba de agua | 6 meses |
| Mangueras | 3 meses |
| Escaleras | 6 meses |
| Cascos/Equipos | 1 mes |
| Vehículos | 3 meses |
