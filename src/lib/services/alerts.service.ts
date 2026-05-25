import { prisma } from "@/lib/db";
import { AlertStatus, AlertType, ConsumableStatus, MovementType, MovementStatus } from "@prisma/client";
import { requirePermission, ForbiddenError, type SessionUser } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

/**
 * Job idempotente: detecta condiciones que generan alertas y las crea/actualiza.
 * Ejecutar diariamente (Windows Task Scheduler o cron):
 *   - vía CLI:   npm run alerts:scan
 *   - vía HTTP:  POST /api/alerts/scan con Authorization: Bearer $ALERTS_SCAN_TOKEN
 */
export async function scanAlerts() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  let created = 0;

  // 1. Insumos vencidos
  const expired = await prisma.consumableInventory.findMany({
    where: { expirationDate: { lt: now }, status: { not: ConsumableStatus.VENCIDO } },
    include: { material: true },
  });
  for (const c of expired) {
    await prisma.consumableInventory.update({ where: { id: c.id }, data: { status: ConsumableStatus.VENCIDO } });
    created += await upsertAlert(c.unitId, { consumableId: c.id }, AlertType.INSUMO_VENCIDO, `Insumo vencido: ${c.material.name}`, c.expirationDate);
  }

  // 2. Insumos próximos a vencer
  const upcoming = await prisma.consumableInventory.findMany({
    where: { expirationDate: { gte: now, lte: in30 } },
    include: { material: true },
  });
  for (const c of upcoming) {
    created += await upsertAlert(c.unitId, { consumableId: c.id }, AlertType.INSUMO_PROXIMO_VENCER, `Vence pronto: ${c.material.name}`, c.expirationDate);
  }

  // 3. Stock bajo / agotado (re-detecta por si quedó pendiente)
  const lowStock = await prisma.consumableInventory.findMany({
    where: { OR: [{ status: ConsumableStatus.BAJO_STOCK }, { status: ConsumableStatus.AGOTADO }] },
    include: { material: true },
  });
  for (const c of lowStock) {
    const type = c.status === ConsumableStatus.AGOTADO ? AlertType.STOCK_AGOTADO : AlertType.STOCK_BAJO;
    created += await upsertAlert(c.unitId, { consumableId: c.id }, type, `${type === AlertType.STOCK_AGOTADO ? "Agotado" : "Stock bajo"}: ${c.material.name}`);
  }

  // 4. Mantenciones vencidas
  const overdue = await prisma.maintenanceRecord.findMany({
    where: { cancelled: false, nextMaintenanceDate: { lt: now } },
    include: { asset: { include: { material: true } } },
  });
  for (const m of overdue) {
    created += await upsertAlert(m.asset.unitId, { assetId: m.asset.id }, AlertType.MANTENCION_VENCIDA, `Mantención vencida: ${m.asset.internalCode} (${m.asset.material.name})`, m.nextMaintenanceDate);
  }

  // 5. Mantenciones próximas
  const upcomingMant = await prisma.maintenanceRecord.findMany({
    where: { cancelled: false, nextMaintenanceDate: { gte: now, lte: in30 } },
    include: { asset: { include: { material: true } } },
  });
  for (const m of upcomingMant) {
    created += await upsertAlert(m.asset.unitId, { assetId: m.asset.id }, AlertType.MANTENCION_PROXIMA, `Mantención próxima: ${m.asset.internalCode}`, m.nextMaintenanceDate);
  }

  return { ok: true, created };
}

async function upsertAlert(
  unitId: string,
  ref: { consumableId?: string; assetId?: string },
  alertType: AlertType,
  title: string,
  dueDate?: Date | null,
): Promise<number> {
  const exists = await prisma.alert.findFirst({
    where: {
      unitId, alertType, status: AlertStatus.ABIERTA,
      ...(ref.consumableId ? { consumableId: ref.consumableId } : {}),
      ...(ref.assetId ? { assetId: ref.assetId } : {}),
    },
  });
  if (exists) return 0;
  await prisma.alert.create({
    data: { unitId, alertType, title, dueDate: dueDate ?? null, ...ref },
  });
  return 1;
}

/**
 * Marca una alerta como revisada/resuelta y deja constancia en la bitácora del
 * material asociado:
 *   - Si la alerta tiene assetId crea un AssetReview (status OK por defecto) con
 *     `description` en comments.
 *   - Si la alerta tiene consumableId crea un InventoryMovement de tipo AJUSTE
 *     con `description` como reason.
 * Cualquier usuario con `alerts.dismiss` y acceso a la unidad puede usarlo.
 */
export async function acknowledgeAlert(
  user: SessionUser,
  alertId: string,
  description: string,
  ip?: string | null,
) {
  requirePermission(user, "alerts.dismiss");

  const cleanDescription = description.trim();
  if (!cleanDescription) throw new Error("La descripción es obligatoria.");
  if (cleanDescription.length > 1000) throw new Error("La descripción no puede superar 1000 caracteres.");

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      consumable: { select: { id: true, materialId: true, unitId: true } },
    },
  });
  if (!alert) throw new Error("Alerta no encontrada");
  if (alert.status !== AlertStatus.ABIERTA) throw new Error("La alerta ya fue resuelta o descartada.");

  if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== alert.unitId) {
    throw new ForbiddenError("No tienes permiso para resolver alertas de otra unidad.");
  }

  return prisma.$transaction(async (tx) => {
    if (alert.assetId) {
      await tx.assetReview.create({
        data: {
          assetId: alert.assetId,
          status: "OK",
          comments: `[Alerta resuelta] ${cleanDescription}`,
          reviewedBy: user.id,
        },
      });
    } else if (alert.consumable) {
      await tx.inventoryMovement.create({
        data: {
          materialId: alert.consumable.materialId,
          originUnitId: alert.consumable.unitId,
          movementType: MovementType.AJUSTE,
          movementStatus: MovementStatus.REGISTRADO,
          quantity: 0,
          userId: user.id,
          reason: `[Alerta ${alert.alertType} resuelta] ${cleanDescription}`,
        },
      });
    }

    const updated = await tx.alert.update({
      where: { id: alertId },
      data: { status: AlertStatus.RESUELTA, description: cleanDescription },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "acknowledge",
      tableName: "alerts",
      recordId: alertId,
      oldValue: { status: alert.status },
      newValue: { status: AlertStatus.RESUELTA, description: cleanDescription },
      ipAddress: ip,
    });

    return updated;
  });
}
