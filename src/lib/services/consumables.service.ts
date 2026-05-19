import { z } from "zod";
import { Prisma, ConsumableStatus, MovementType, AlertType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";
import { scopeByUnit, resolveTargetUnitId } from "@/lib/auth/scope";

export const consumableCreateSchema = z.object({
  materialId: z.string().cuid(),
  unitId: z.string().cuid(),
  currentStock: z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0).default(0),
  unitOfMeasure: z.string().trim().min(1).max(20),
  batchNumber: z.string().trim().max(50).optional().nullable(),
  expirationDate: z.coerce.date().optional().nullable(),
  entryDate: z.coerce.date(),
  location: z.string().trim().max(200).optional().nullable(),
  observations: z.string().trim().max(2000).optional().nullable(),
});

export async function listConsumables(
  user: SessionUser,
  filter?: { unitId?: string; status?: ConsumableStatus; materialId?: string },
) {
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "consumables.read.own");
  const scope = scopeByUnit(user, filter?.unitId ?? null);
  return prisma.consumableInventory.findMany({
    where: {
      ...scope,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.materialId ? { materialId: filter.materialId } : {}),
    },
    include: {
      material: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ status: "asc" }, { material: { name: "asc" } }],
  });
}

export async function createConsumable(user: SessionUser, input: z.infer<typeof consumableCreateSchema>, ip?: string | null) {
  requirePermission(user, "consumables.write.own");
  const data = consumableCreateSchema.parse(input);
  const unitId = resolveTargetUnitId(user, data.unitId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.consumableInventory.create({
      data: {
        ...data,
        unitId,
        currentStock: new Prisma.Decimal(data.currentStock),
        minimumStock: new Prisma.Decimal(data.minimumStock),
        status: data.currentStock <= 0
          ? ConsumableStatus.AGOTADO
          : data.currentStock <= data.minimumStock
            ? ConsumableStatus.BAJO_STOCK
            : ConsumableStatus.DISPONIBLE,
      },
    });
    if (data.currentStock > 0) {
      await tx.inventoryMovement.create({
        data: {
          materialId: data.materialId,
          destinationUnitId: unitId,
          movementType: MovementType.INGRESO,
          quantity: new Prisma.Decimal(data.currentStock),
          userId: user.id,
          reason: "Alta de stock inicial",
          movementStatus: "CONFIRMADO",
        },
      });
    }
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "consumable_inventory", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

/**
 * Registra un consumo descontando stock de forma atómica.
 * Si tras descontar `currentStock <= minimumStock`, crea/mantiene una alerta abierta.
 */
export async function recordConsumption(
  user: SessionUser,
  consumableId: string,
  quantity: number,
  reason: string,
  ip?: string | null,
) {
  requirePermission(user, "movements.consume");
  if (quantity <= 0) throw new Error("La cantidad debe ser mayor a 0");

  return prisma.$transaction(async (tx) => {
    // Lock pesimista a través de un UPDATE conditional (Postgres: usar SELECT FOR UPDATE).
    // Prisma no expone FOR UPDATE directo en findUnique, así que hacemos UPDATE con WHERE en current_stock.
    const before = await tx.consumableInventory.findUnique({ where: { id: consumableId }, include: { material: true } });
    if (!before) throw new Error("Insumo no encontrado");
    if (user.role !== "COMANDANCIA_ADMIN" && before.unitId !== user.unitId) {
      throw new ForbiddenError("Insumo de otra unidad");
    }
    const qty = new Prisma.Decimal(quantity);
    const newStock = before.currentStock.minus(qty);
    if (newStock.lessThan(0)) throw new Error("Stock insuficiente");

    // Update con condición de stock previo: garantiza que no haya carrera incluso si dos requests entran a la vez.
    const result = await tx.consumableInventory.updateMany({
      where: { id: consumableId, currentStock: before.currentStock },
      data: {
        currentStock: newStock,
        status: newStock.lessThanOrEqualTo(0)
          ? ConsumableStatus.AGOTADO
          : newStock.lessThanOrEqualTo(before.minimumStock)
            ? ConsumableStatus.BAJO_STOCK
            : before.status,
      },
    });
    if (result.count === 0) throw new Error("Conflicto de concurrencia, vuelva a intentar");

    await tx.inventoryMovement.create({
      data: {
        materialId: before.materialId,
        originUnitId: before.unitId,
        movementType: MovementType.CONSUMO,
        quantity: qty,
        userId: user.id,
        reason,
        movementStatus: "CONFIRMADO",
      },
    });

    // Alerta de stock bajo (upsert: una sola abierta por consumable + tipo)
    if (newStock.lessThanOrEqualTo(before.minimumStock)) {
      const exists = await tx.alert.findFirst({
        where: { consumableId, alertType: AlertType.STOCK_BAJO, status: "ABIERTA" },
      });
      if (!exists) {
        await tx.alert.create({
          data: {
            unitId: before.unitId,
            consumableId,
            alertType: newStock.lessThanOrEqualTo(0) ? AlertType.STOCK_AGOTADO : AlertType.STOCK_BAJO,
            title: `${newStock.lessThanOrEqualTo(0) ? "Agotado" : "Stock bajo"}: ${before.material.name}`,
          },
        });
      }
    }

    await recordAudit(tx, {
      userId: user.id, action: "consume", tableName: "consumable_inventory", recordId: consumableId,
      oldValue: { currentStock: before.currentStock.toString() },
      newValue: { currentStock: newStock.toString(), quantity: qty.toString() },
      ipAddress: ip,
    });
  });
}
