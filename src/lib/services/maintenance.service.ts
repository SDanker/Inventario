import { z } from "zod";
import { Prisma, AssetStatus, MaintenanceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";

export const maintenanceCreateSchema = z.object({
  assetId: z.string().cuid(),
  maintenanceDate: z.coerce.date(),
  maintenanceType: z.nativeEnum(MaintenanceType),
  description: z.string().trim().min(1).max(2000),
  responsiblePerson: z.string().trim().max(120).optional().nullable(),
  externalCompany: z.string().trim().max(200).optional().nullable(),
  workOrderNumber: z.string().trim().max(50).optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  resultingStatus: z.nativeEnum(AssetStatus),
  nextMaintenanceDate: z.coerce.date().optional().nullable(),
});

export async function listMaintenance(user: SessionUser, filter?: { assetId?: string; unitId?: string }) {
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "maintenance.read.own");
  return prisma.maintenanceRecord.findMany({
    where: {
      ...(filter?.assetId ? { assetId: filter.assetId } : {}),
      ...(user.role !== "COMANDANCIA_ADMIN" && user.unitId
        ? { asset: { unitId: user.unitId } }
        : filter?.unitId
          ? { asset: { unitId: filter.unitId } }
          : {}),
      cancelled: false,
    },
    include: {
      asset: { include: { material: true, unit: true } },
      registeredBy: { select: { id: true, name: true } },
    },
    orderBy: { maintenanceDate: "desc" },
  });
}

export async function createMaintenance(user: SessionUser, input: z.infer<typeof maintenanceCreateSchema>, ip?: string | null) {
  requirePermission(user, "maintenance.write.own");
  const data = maintenanceCreateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new Error("Activo no encontrado");
    if (user.role !== "COMANDANCIA_ADMIN" && asset.unitId !== user.unitId) {
      throw new ForbiddenError("Activo de otra unidad");
    }

    const created = await tx.maintenanceRecord.create({
      data: {
        ...data,
        cost: data.cost == null ? null : new Prisma.Decimal(data.cost),
        registeredByUserId: user.id,
      },
    });

    // Aplica el estado resultante al activo.
    await tx.asset.update({ where: { id: asset.id }, data: { status: data.resultingStatus } });

    await recordAudit(tx, {
      userId: user.id, action: "create", tableName: "maintenance_records", recordId: created.id,
      newValue: created, ipAddress: ip,
    });
    return created;
  });
}

export async function cancelMaintenance(user: SessionUser, id: string, reason: string, ip?: string | null) {
  requirePermission(user, "maintenance.write.own");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.maintenanceRecord.findUnique({ where: { id } });
    if (!previous) throw new Error("Mantención no encontrada");
    const updated = await tx.maintenanceRecord.update({
      where: { id },
      data: { cancelled: true, cancelReason: reason },
    });
    await recordAudit(tx, {
      userId: user.id, action: "cancel", tableName: "maintenance_records", recordId: id,
      oldValue: { cancelled: previous.cancelled }, newValue: { cancelled: true, reason }, ipAddress: ip,
    });
    return updated;
  });
}
