import { z } from "zod";
import { Prisma, TransferStatus, MovementType, ConsumableStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";

export const transferCreateSchema = z.object({
  destinationUnitId: z.string().cuid(),
  reason: z.string().trim().max(500).optional().nullable(),
  items: z.array(z.object({
    assetId: z.string().cuid().optional().nullable(),
    materialId: z.string().cuid().optional().nullable(),
    quantity: z.coerce.number().positive(),
    notes: z.string().trim().max(500).optional().nullable(),
  })).min(1).refine(
    (items) => items.every((i) => !!i.assetId !== !!i.materialId),
    { message: "Cada item debe ser un activo o un material, no ambos" },
  ),
});

function genCode(): string {
  return `TR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function listTransfers(user: SessionUser, filter?: { status?: TransferStatus; unitId?: string }) {
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "transfers.read.own");
  const unitFilter =
    user.role === "COMANDANCIA_ADMIN"
      ? filter?.unitId
        ? { OR: [{ originUnitId: filter.unitId }, { destinationUnitId: filter.unitId }] }
        : {}
      : { OR: [{ originUnitId: user.unitId! }, { destinationUnitId: user.unitId! }] };

  return prisma.transfer.findMany({
    where: {
      ...unitFilter,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    include: {
      originUnit: { select: { id: true, name: true, code: true } },
      destinationUnit: { select: { id: true, name: true, code: true } },
      requestedBy: { select: { id: true, name: true } },
      items: { include: { asset: true, material: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestTransfer(user: SessionUser, input: z.infer<typeof transferCreateSchema>, ip?: string | null) {
  requirePermission(user, "transfers.request");
  const data = transferCreateSchema.parse(input);
  const originUnitId =
    user.role === "COMANDANCIA_ADMIN" ? null : user.unitId;
  if (user.role !== "COMANDANCIA_ADMIN" && !originUnitId) {
    throw new ForbiddenError("Usuario sin unidad asignada");
  }
  if (originUnitId === data.destinationUnitId) {
    throw new Error("La unidad de origen y destino no pueden ser la misma");
  }

  return prisma.$transaction(async (tx) => {
    // Si el origen es Comandancia (global) y mueven un activo, derivamos origen del activo.
    let resolvedOrigin = originUnitId;
    if (!resolvedOrigin) {
      const firstAsset = data.items.find((i) => i.assetId);
      if (!firstAsset?.assetId) throw new Error("Comandancia debe transferir al menos un activo identificable o especificar origen");
      const asset = await tx.asset.findUnique({ where: { id: firstAsset.assetId } });
      if (!asset) throw new Error("Activo de origen no encontrado");
      resolvedOrigin = asset.unitId;
    }

    const created = await tx.transfer.create({
      data: {
        code: genCode(),
        originUnitId: resolvedOrigin,
        destinationUnitId: data.destinationUnitId,
        reason: data.reason,
        status: TransferStatus.SOLICITADO,
        requestedById: user.id,
        items: {
          create: data.items.map((i) => ({
            assetId: i.assetId ?? null,
            materialId: i.materialId ?? null,
            quantity: new Prisma.Decimal(i.quantity),
            notes: i.notes ?? null,
          })),
        },
      },
      include: { items: true },
    });

    await recordAudit(tx, {
      userId: user.id, action: "request", tableName: "transfers", recordId: created.id, newValue: created, ipAddress: ip,
    });
    return created;
  });
}

async function changeStatus(
  user: SessionUser,
  id: string,
  expected: TransferStatus[],
  next: TransferStatus,
  ip?: string | null,
  extra?: Partial<{ approvedById: string; approvedAt: Date; receivedById: string; receivedAt: Date; rejectionReason: string }>,
  beforeUpdate?: (transfer: { originUnitId: string }) => void,
) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({ where: { id } });
    if (!transfer) throw new Error("Traslado no encontrado");
    if (!expected.includes(transfer.status)) {
      throw new Error(`Transición no válida desde ${transfer.status} a ${next}`);
    }
    beforeUpdate?.(transfer);
    const updated = await tx.transfer.update({ where: { id }, data: { status: next, ...extra } });
    await recordAudit(tx, {
      userId: user.id, action: `status:${next.toLowerCase()}`, tableName: "transfers", recordId: id,
      oldValue: { status: transfer.status }, newValue: { status: next }, ipAddress: ip,
    });
    return { tx, transfer, updated };
  });
}

function requireOriginUnit(user: SessionUser, transfer: { originUnitId: string }) {
  if (user.role === "COMANDANCIA_ADMIN") {
    throw new ForbiddenError("Sólo la unidad de origen puede realizar esta acción");
  }
  if (user.unitId !== transfer.originUnitId) {
    throw new ForbiddenError("Sólo la unidad de origen puede realizar esta acción");
  }
}

export async function approveTransfer(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "transfers.approve");
  await changeStatus(user, id, [TransferStatus.SOLICITADO], TransferStatus.APROBADO, ip, {
    approvedById: user.id, approvedAt: new Date(),
  });
}
export async function prepareTransfer(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "transfers.request"); // origen prepara
  await changeStatus(user, id, [TransferStatus.APROBADO], TransferStatus.PREPARADO, ip, undefined, (transfer) => {
    requireOriginUnit(user, transfer);
  });
}
export async function dispatchTransfer(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "transfers.request");
  await changeStatus(user, id, [TransferStatus.PREPARADO], TransferStatus.EN_TRANSITO, ip, undefined, (transfer) => {
    requireOriginUnit(user, transfer);
  });
}
export async function rejectTransfer(user: SessionUser, id: string, reason: string, ip?: string | null) {
  requirePermission(user, "transfers.reject");
  await changeStatus(user, id, [TransferStatus.SOLICITADO, TransferStatus.APROBADO], TransferStatus.RECHAZADO, ip, {
    rejectionReason: reason,
  });
}
export async function cancelTransfer(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "transfers.request");
  await changeStatus(user, id, [TransferStatus.SOLICITADO, TransferStatus.APROBADO, TransferStatus.PREPARADO], TransferStatus.CANCELADO, ip, undefined, (transfer) => {
    requireOriginUnit(user, transfer);
  });
}

/**
 * Marca traslado como recibido y aplica el cambio de inventario:
 * - Para activos: muta `assets.unit_id` al destino.
 * - Para insumos: descuenta del origen, suma al destino (upsert por lote).
 * - Crea movimientos SALIDA + INGRESO ligados al traslado.
 */
export async function receiveTransfer(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "transfers.receive");

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new Error("Traslado no encontrado");
    if (transfer.status !== TransferStatus.EN_TRANSITO && transfer.status !== TransferStatus.APROBADO && transfer.status !== TransferStatus.PREPARADO) {
      throw new Error(`Sólo se puede recibir desde APROBADO/PREPARADO/EN_TRANSITO. Estado actual: ${transfer.status}`);
    }
    if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== transfer.destinationUnitId) {
      throw new ForbiddenError("Sólo la unidad destino puede recibir");
    }

    for (const item of transfer.items) {
      if (item.assetId) {
        const asset = await tx.asset.findUnique({ where: { id: item.assetId } });
        if (!asset) throw new Error("Activo del item no existe");
        if (asset.unitId !== transfer.originUnitId) {
          throw new Error(`El activo ${asset.internalCode} ya no está en la unidad de origen`);
        }
        await tx.asset.update({ where: { id: asset.id }, data: { unitId: transfer.destinationUnitId } });
        await tx.inventoryMovement.create({
          data: {
            materialId: asset.materialId, assetId: asset.id,
            originUnitId: transfer.originUnitId, destinationUnitId: transfer.destinationUnitId,
            movementType: MovementType.TRASLADO, quantity: new Prisma.Decimal(1),
            userId: user.id, transferId: transfer.id, movementStatus: "CONFIRMADO",
          },
        });
      } else if (item.materialId) {
        // Para insumos: tomar el primer lote disponible del origen (FIFO) y descontar.
        // Si quieren control fino por lote, agregar `batchNumber` al transfer_item.
        const sourceRows = await tx.consumableInventory.findMany({
          where: { materialId: item.materialId, unitId: transfer.originUnitId, currentStock: { gt: 0 } },
          orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
        });
        let remaining = new Prisma.Decimal(item.quantity);
        for (const row of sourceRows) {
          if (remaining.lessThanOrEqualTo(0)) break;
          const take = Prisma.Decimal.min(row.currentStock, remaining);
          const newStock = row.currentStock.minus(take);
          await tx.consumableInventory.update({
            where: { id: row.id },
            data: {
              currentStock: newStock,
              status: newStock.lessThanOrEqualTo(0) ? ConsumableStatus.AGOTADO : row.status,
            },
          });
          remaining = remaining.minus(take);
        }
        if (remaining.greaterThan(0)) {
          throw new Error("Stock insuficiente en origen para completar el traslado");
        }

        // En destino: upsert por (material, unidad, sin lote específico).
        const destRow = await tx.consumableInventory.findFirst({
          where: { materialId: item.materialId, unitId: transfer.destinationUnitId, batchNumber: null },
        });
        if (destRow) {
          await tx.consumableInventory.update({
            where: { id: destRow.id },
            data: {
              currentStock: destRow.currentStock.plus(item.quantity),
              status: ConsumableStatus.DISPONIBLE,
            },
          });
        } else {
          await tx.consumableInventory.create({
            data: {
              materialId: item.materialId,
              unitId: transfer.destinationUnitId,
              currentStock: new Prisma.Decimal(item.quantity),
              minimumStock: new Prisma.Decimal(0),
              unitOfMeasure: "u",
              entryDate: new Date(),
            },
          });
        }

        await tx.inventoryMovement.createMany({
          data: [
            {
              materialId: item.materialId, originUnitId: transfer.originUnitId, destinationUnitId: transfer.destinationUnitId,
              movementType: MovementType.TRASLADO, quantity: new Prisma.Decimal(item.quantity),
              userId: user.id, transferId: transfer.id, movementStatus: "CONFIRMADO",
            },
          ],
        });
      }
    }

    const updated = await tx.transfer.update({
      where: { id }, data: { status: TransferStatus.RECIBIDO, receivedById: user.id, receivedAt: new Date() },
    });
    await recordAudit(tx, {
      userId: user.id, action: "receive", tableName: "transfers", recordId: id,
      oldValue: { status: transfer.status }, newValue: { status: TransferStatus.RECIBIDO }, ipAddress: ip,
    });
    return updated;
  });
}
