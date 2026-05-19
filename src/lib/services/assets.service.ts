import { z } from "zod";
import { AssetStatus, MovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";
import { scopeByUnit, resolveTargetUnitId } from "@/lib/auth/scope";

export const assetCreateSchema = z.object({
  materialId: z.string().cuid(),
  unitId: z.string().cuid(),
  internalCode: z.string().trim().min(1).max(50),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  model: z.string().trim().max(100).optional().nullable(),
  licensePlate: z.string().trim().max(20).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  specificLocation: z.string().trim().max(200).optional().nullable(),
  responsibleName: z.string().trim().max(120).optional().nullable(),
  entryDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(AssetStatus).default(AssetStatus.OPERATIVO),
  observations: z.string().trim().max(2000).optional().nullable(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export async function listAssets(user: SessionUser, filter?: { unitId?: string; status?: AssetStatus; materialId?: string; q?: string }) {
  // permiso
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "assets.read.own");

  const scope = scopeByUnit(user, filter?.unitId ?? null);
  return prisma.asset.findMany({
    where: {
      ...scope,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.materialId ? { materialId: filter.materialId } : {}),
      ...(filter?.q
        ? {
            OR: [
              { internalCode: { contains: filter.q, mode: "insensitive" } },
              { serialNumber: { contains: filter.q, mode: "insensitive" } },
              { brand: { contains: filter.q, mode: "insensitive" } },
              { model: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      material: { select: { id: true, name: true, code: true, materialType: true } },
      unit: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ status: "asc" }, { internalCode: "asc" }],
  });
}

export async function getAssetWithHistory(user: SessionUser, id: string) {
  if (user.role !== "COMANDANCIA_ADMIN") requirePermission(user, "assets.read.own");
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      material: { include: { category: true } },
      unit: true,
      maintenances: { orderBy: { maintenanceDate: "desc" } },
      documents: { orderBy: { uploadDate: "desc" } },
      movements: { orderBy: { movementDate: "desc" }, take: 100 },
    },
  });
  if (!asset) return null;
  if (user.role !== "COMANDANCIA_ADMIN" && asset.unitId !== user.unitId) {
    throw new ForbiddenError("Activo de otra unidad");
  }
  return asset;
}

export async function createAsset(user: SessionUser, input: z.infer<typeof assetCreateSchema>, ip?: string | null) {
  requirePermission(user, "assets.write.own");
  const data = assetCreateSchema.parse(input);
  const unitId = resolveTargetUnitId(user, data.unitId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({ data: { ...data, unitId } });
    await tx.inventoryMovement.create({
      data: {
        materialId: created.materialId,
        assetId: created.id,
        destinationUnitId: unitId,
        movementType: MovementType.INGRESO,
        quantity: 1,
        userId: user.id,
        reason: "Alta de activo",
        movementStatus: "CONFIRMADO",
      },
    });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "assets", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

export async function updateAsset(user: SessionUser, id: string, input: z.infer<typeof assetUpdateSchema>, ip?: string | null) {
  requirePermission(user, "assets.write.own");
  const data = assetUpdateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const previous = await tx.asset.findUnique({ where: { id } });
    if (!previous) throw new Error("Activo no encontrado");
    if (user.role !== "COMANDANCIA_ADMIN" && previous.unitId !== user.unitId) {
      throw new ForbiddenError("Activo de otra unidad");
    }
    // Cambio de unidad sólo vía traslado, no por edición directa.
    if (data.unitId && data.unitId !== previous.unitId) {
      throw new Error("Para cambiar la unidad del activo, usar el flujo de traslado");
    }
    const updated = await tx.asset.update({ where: { id }, data });
    await recordAudit(tx, { userId: user.id, action: "update", tableName: "assets", recordId: id, oldValue: previous, newValue: updated, ipAddress: ip });
    return updated;
  });
}

export async function decommissionAsset(user: SessionUser, id: string, reason: string, ip?: string | null) {
  requirePermission(user, "assets.decommission");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.asset.findUnique({ where: { id } });
    if (!previous) throw new Error("Activo no encontrado");
    const updated = await tx.asset.update({
      where: { id },
      data: { status: AssetStatus.DADO_DE_BAJA, observations: reason ?? previous.observations },
    });
    await tx.inventoryMovement.create({
      data: {
        materialId: previous.materialId,
        assetId: previous.id,
        originUnitId: previous.unitId,
        movementType: MovementType.BAJA,
        quantity: 1,
        userId: user.id,
        reason,
        movementStatus: "CONFIRMADO",
      },
    });
    await recordAudit(tx, {
      userId: user.id, action: "decommission", tableName: "assets", recordId: id,
      oldValue: { status: previous.status }, newValue: { status: AssetStatus.DADO_DE_BAJA }, ipAddress: ip,
    });
    return updated;
  });
}
