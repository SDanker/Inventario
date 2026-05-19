import { prisma } from "@/lib/db";
import { AlertStatus, AlertType, ConsumableStatus } from "@prisma/client";

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
