import { UnitType, AssetStatus, ConsumableStatus, AlertStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";

export async function commandanciaDashboard(user: SessionUser) {
  requirePermission(user, "dashboard.commandancia");

  const [unitCounts, totalAssets, totalConsumables, assetsByStatus, lowStock, expired, upcomingMaintenance, overdueMaintenance, recentMovements, recentTransfers] =
    await Promise.all([
      prisma.unit.groupBy({ by: ["unitType"], _count: { _all: true }, where: { active: true } }),
      prisma.asset.count({ where: { status: { not: AssetStatus.DADO_DE_BAJA } } }),
      prisma.consumableInventory.count(),
      prisma.asset.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.consumableInventory.count({ where: { status: { in: [ConsumableStatus.BAJO_STOCK, ConsumableStatus.AGOTADO] } } }),
      prisma.consumableInventory.count({ where: { status: ConsumableStatus.VENCIDO } }),
      prisma.maintenanceRecord.count({
        where: {
          cancelled: false,
          nextMaintenanceDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
      prisma.maintenanceRecord.count({
        where: { cancelled: false, nextMaintenanceDate: { lt: new Date() } },
      }),
      prisma.inventoryMovement.findMany({
        take: 10, orderBy: { movementDate: "desc" },
        include: { material: { select: { name: true } }, asset: { select: { internalCode: true } }, user: { select: { name: true } } },
      }),
      prisma.transfer.findMany({
        take: 10, orderBy: { createdAt: "desc" },
        include: { originUnit: { select: { name: true, code: true } }, destinationUnit: { select: { name: true, code: true } } },
      }),
    ]);

  const byType = Object.fromEntries(unitCounts.map((u) => [u.unitType, u._count._all])) as Record<UnitType, number>;
  const statusMap = Object.fromEntries(assetsByStatus.map((a) => [a.status, a._count._all])) as Partial<Record<AssetStatus, number>>;

  return {
    units: {
      total: Object.values(byType).reduce((a, b) => a + b, 0),
      cuarteles: byType.CUARTEL ?? 0,
      campos: byType.CAMPO_ENTRENAMIENTO ?? 0,
      bodegas: byType.BODEGA ?? 0,
    },
    assets: {
      total: totalAssets,
      operativos: statusMap.OPERATIVO ?? 0,
      observados: statusMap.OBSERVADO ?? 0,
      mantencion: statusMap.EN_MANTENCION ?? 0,
      fueraServicio: statusMap.FUERA_DE_SERVICIO ?? 0,
    },
    consumables: { total: totalConsumables, lowStock, expired },
    maintenance: { upcoming: upcomingMaintenance, overdue: overdueMaintenance },
    recentMovements,
    recentTransfers,
  };
}

export async function unitDashboard(user: SessionUser, unitId?: string) {
  requirePermission(user, "dashboard.unit");
  const resolvedUnitId = user.role === "COMANDANCIA_ADMIN" ? unitId ?? null : user.unitId;
  if (!resolvedUnitId) throw new ForbiddenError("Unidad no especificada");

  const unit = await prisma.unit.findUnique({ where: { id: resolvedUnitId } });
  if (!unit) throw new Error("Unidad no encontrada");

  const [totalAssets, totalConsumables, lowStock, expired, mantencion, fueraServicio, upcomingMaintenance, openAlerts, recentMovements] =
    await Promise.all([
      prisma.asset.count({ where: { unitId: resolvedUnitId, status: { not: AssetStatus.DADO_DE_BAJA } } }),
      prisma.consumableInventory.count({ where: { unitId: resolvedUnitId } }),
      prisma.consumableInventory.count({
        where: { unitId: resolvedUnitId, status: { in: [ConsumableStatus.BAJO_STOCK, ConsumableStatus.AGOTADO] } },
      }),
      prisma.consumableInventory.count({ where: { unitId: resolvedUnitId, status: ConsumableStatus.VENCIDO } }),
      prisma.asset.count({ where: { unitId: resolvedUnitId, status: AssetStatus.EN_MANTENCION } }),
      prisma.asset.count({ where: { unitId: resolvedUnitId, status: AssetStatus.FUERA_DE_SERVICIO } }),
      prisma.maintenanceRecord.findMany({
        where: {
          cancelled: false,
          asset: { unitId: resolvedUnitId },
          nextMaintenanceDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
        },
        take: 5,
        orderBy: { nextMaintenanceDate: "asc" },
        include: { asset: { include: { material: true } } },
      }),
      prisma.alert.count({ where: { unitId: resolvedUnitId, status: AlertStatus.ABIERTA } }),
      prisma.inventoryMovement.findMany({
        where: { OR: [{ originUnitId: resolvedUnitId }, { destinationUnitId: resolvedUnitId }] },
        take: 10, orderBy: { movementDate: "desc" },
        include: { material: { select: { name: true } }, asset: { select: { internalCode: true } } },
      }),
    ]);

  return {
    unit,
    totals: { assets: totalAssets, consumables: totalConsumables, openAlerts },
    issues: { lowStock, expired, mantencion, fueraServicio },
    upcomingMaintenance,
    recentMovements,
  };
}
