import { prisma } from "@/lib/db";
import { AlertStatus, AlertType, AssetStatus, ConsumableStatus, MovementType, MovementStatus } from "@prisma/client";
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
  const in7 = new Date(now.getTime() + 7 * 86400000);
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

  // 6. Mantenciones periódicas configuradas en la ficha del material
  const today = startOfDay(now);
  const materialSchedules = await prisma.material.findMany({
    where: {
      active: true,
      maintenanceStartDate: { not: null },
      maintenanceIntervalValue: { not: null },
      maintenanceIntervalUnit: { not: null },
    },
    include: {
      assets: {
        where: { status: { not: AssetStatus.DADO_DE_BAJA } },
      },
      unitStocks: {
        where: { quantity: { gt: 0 } },
      },
    },
  });
  for (const material of materialSchedules) {
    const dueDates = scheduledDatesToCheck(
      material.maintenanceStartDate!,
      material.maintenanceIntervalValue!,
      material.maintenanceIntervalUnit!,
      today,
      startOfDay(in30),
    );
    if (dueDates.length === 0) continue;

    for (const asset of material.assets) {
      created += await upsertMaterialScheduleAlert(
        asset.unitId,
        `${asset.internalCode} (${material.name})`,
        dueDates,
        today,
        { assetId: asset.id },
      );
    }

    if (material.assets.length === 0) {
      for (const stock of material.unitStocks) {
        created += await upsertMaterialScheduleAlert(
          stock.unitId,
          `${material.code} (${material.name})`,
          dueDates,
          today,
        );
      }
    }
  }

  // 7. Revisiones de activos vencidas
  const overdueReviews = await prisma.asset.findMany({
    where: {
      nextReviewDate: { lte: now },
      NOT: { nextReviewDate: null },
    },
    include: { material: true },
  });
  for (const asset of overdueReviews) {
    created += await upsertAlert(
      asset.unitId,
      { assetId: asset.id },
      AlertType.REVISION_VENCIDA,
      `Revisión vencida: ${asset.internalCode} (${asset.material.name})`,
      asset.nextReviewDate,
    );
  }

  // 8. Revisiones de activos próximas a vencer
  const upcomingReviews = await prisma.asset.findMany({
    where: {
      nextReviewDate: { gt: now, lte: in7 },
      NOT: { nextReviewDate: null },
    },
    include: { material: true },
  });
  for (const asset of upcomingReviews) {
    created += await upsertAlert(
      asset.unitId,
      { assetId: asset.id },
      AlertType.REVISION_PROXIMA,
      `Revisión próxima: ${asset.internalCode} (${asset.material.name})`,
      asset.nextReviewDate,
    );
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
  const hasRef = Boolean(ref.consumableId || ref.assetId);
  const exists = await prisma.alert.findFirst({
    where: {
      unitId, alertType, status: AlertStatus.ABIERTA,
      ...(ref.consumableId ? { consumableId: ref.consumableId } : {}),
      ...(ref.assetId ? { assetId: ref.assetId } : {}),
      ...(!hasRef ? { title } : {}),
    },
  });
  if (exists) return 0;
  await prisma.alert.create({
    data: { unitId, alertType, title, dueDate: dueDate ?? null, ...ref },
  });
  return 1;
}

async function upsertMaterialScheduleAlert(
  unitId: string,
  subject: string,
  dueDates: Date[],
  today: Date,
  ref: { assetId?: string } = {},
): Promise<number> {
  const title = `Mantención programada: ${subject}`;
  const legacyTitles = [
    title,
    `Mantención próxima: ${subject}`,
    `Mantención vencida: ${subject}`,
  ];

  for (const dueDate of dueDates) {
    const alertType = dueDate < today ? AlertType.MANTENCION_VENCIDA : AlertType.MANTENCION_PROXIMA;
    const existing = await prisma.alert.findFirst({
      where: {
        unitId,
        dueDate,
        title: { in: legacyTitles },
        ...(ref.assetId ? { assetId: ref.assetId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.status === AlertStatus.ABIERTA) {
      if (existing.alertType !== alertType || existing.title !== title) {
        await prisma.alert.update({
          where: { id: existing.id },
          data: { alertType, title },
        });
      }
      return 0;
    }

    if (existing) continue;

    await prisma.alert.create({
      data: { unitId, alertType, title, dueDate, ...ref },
    });
    return 1;
  }

  return 0;
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
      asset: {
        select: {
          id: true,
          reviewIntervalValue: true,
          reviewIntervalUnit: true,
        },
      },
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

      const isReviewAlert =
        alert.alertType === AlertType.REVISION_VENCIDA ||
        alert.alertType === AlertType.REVISION_PROXIMA;

      if (isReviewAlert && alert.asset?.reviewIntervalValue && alert.asset.reviewIntervalUnit) {
        await tx.asset.update({
          where: { id: alert.assetId },
          data: {
            nextReviewDate: addInterval(new Date(), alert.asset.reviewIntervalValue, alert.asset.reviewIntervalUnit),
          },
        });
      }
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

function addInterval(date: Date, value: number, unit: string) {
  const next = new Date(date);
  if (unit === "days") {
    next.setDate(next.getDate() + value);
  } else if (unit === "weeks") {
    next.setDate(next.getDate() + value * 7);
  } else if (unit === "months") {
    next.setMonth(next.getMonth() + value);
  } else if (unit === "quarters") {
    next.setMonth(next.getMonth() + value * 3);
  } else if (unit === "years") {
    next.setFullYear(next.getFullYear() + value);
  }
  return next;
}

function scheduledDatesToCheck(startDate: Date, value: number, unit: string, today: Date, windowEnd: Date) {
  if (value < 1 || !["days", "weeks", "months", "quarters", "years"].includes(unit)) return [];

  const futureDates: Date[] = [];
  let lastDueOrPast: Date | null = null;
  let next = startOfDay(startDate);
  let guard = 0;

  while (next <= windowEnd && guard < 10000) {
    if (next <= today) {
      lastDueOrPast = next;
    } else {
      futureDates.push(next);
    }
    next = addInterval(next, value, unit);
    guard += 1;
  }

  return lastDueOrPast ? [lastDueOrPast, ...futureDates] : futureDates;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
