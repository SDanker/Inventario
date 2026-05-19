import { z } from "zod";
import { UnitType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser } from "@/lib/auth/permissions";

export const unitCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  unitType: z.nativeEnum(UnitType),
  address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  responsibleUserId: z.string().cuid().optional().nullable(),
});

export const unitUpdateSchema = unitCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export async function listUnits(user: SessionUser) {
  // COMANDANCIA ve todas; otros sólo la suya.
  if (user.role === "COMANDANCIA_ADMIN") {
    return prisma.unit.findMany({
      orderBy: [{ unitType: "asc" }, { code: "asc" }],
      include: { responsibleUser: { select: { id: true, name: true, email: true } } },
    });
  }
  requirePermission(user, "units.read.own");
  if (!user.unitId) return [];
  return prisma.unit.findMany({
    where: { id: user.unitId },
    include: { responsibleUser: { select: { id: true, name: true, email: true } } },
  });
}

export async function getUnit(user: SessionUser, id: string) {
  if (user.role !== "COMANDANCIA_ADMIN" && user.unitId !== id) {
    requirePermission(user, "units.read.any");
  }
  return prisma.unit.findUnique({
    where: { id },
    include: { responsibleUser: { select: { id: true, name: true, email: true } } },
  });
}

export async function createUnit(user: SessionUser, input: z.infer<typeof unitCreateSchema>, ip?: string | null) {
  requirePermission(user, "units.write");
  const data = unitCreateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({ data });
    await recordAudit(tx, {
      userId: user.id,
      action: "create",
      tableName: "units",
      recordId: created.id,
      newValue: created,
      ipAddress: ip,
    });
    return created;
  });
}

export async function updateUnit(
  user: SessionUser,
  id: string,
  input: z.infer<typeof unitUpdateSchema>,
  ip?: string | null,
) {
  requirePermission(user, "units.write");
  const data = unitUpdateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const previous = await tx.unit.findUnique({ where: { id } });
    if (!previous) throw new Error("Unidad no encontrada");
    const updated = await tx.unit.update({ where: { id }, data });
    await recordAudit(tx, {
      userId: user.id,
      action: "update",
      tableName: "units",
      recordId: updated.id,
      oldValue: previous,
      newValue: updated,
      ipAddress: ip,
    });
    return updated;
  });
}

export async function deactivateUnit(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "units.deactivate");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.unit.findUnique({ where: { id } });
    if (!previous) throw new Error("Unidad no encontrada");
    const updated = await tx.unit.update({ where: { id }, data: { active: false } });
    await recordAudit(tx, {
      userId: user.id,
      action: "deactivate",
      tableName: "units",
      recordId: id,
      oldValue: { active: previous.active },
      newValue: { active: false },
      ipAddress: ip,
    });
    return updated;
  });
}
