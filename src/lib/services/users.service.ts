import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser } from "@/lib/auth/permissions";

const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(100, "Máximo 100 caracteres");

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: passwordSchema,
    role: z.nativeEnum(UserRole),
    unitId: z.string().cuid().nullable().optional(),
  })
  .refine(
    (d) => d.role === "COMANDANCIA_ADMIN" || !!d.unitId,
    { message: "UNIT_MANAGER y OPERATIONAL requieren unitId", path: ["unitId"] },
  );

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.nativeEnum(UserRole).optional(),
  unitId: z.string().cuid().nullable().optional(),
  active: z.boolean().optional(),
});

export async function listUsers(user: SessionUser, filter?: { role?: UserRole; unitId?: string }) {
  requirePermission(user, "users.read");
  return prisma.user.findMany({
    where: {
      ...(filter?.role ? { role: filter.role } : {}),
      ...(filter?.unitId ? { unitId: filter.unitId } : {}),
    },
    select: {
      id: true, name: true, email: true, role: true, unitId: true, active: true,
      unit: { select: { id: true, name: true, code: true } },
      createdAt: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createUser(user: SessionUser, input: z.infer<typeof userCreateSchema>, ip?: string | null) {
  requirePermission(user, "users.write");
  const data = userCreateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { email: data.email } });
    if (exists) throw new Error("Ya existe un usuario con ese correo");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const created = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        unitId: data.unitId ?? null,
      },
      select: { id: true, name: true, email: true, role: true, unitId: true, active: true, createdAt: true },
    });
    await recordAudit(tx, {
      userId: user.id, action: "create", tableName: "users", recordId: created.id, newValue: created, ipAddress: ip,
    });
    return created;
  });
}

export async function updateUser(user: SessionUser, id: string, input: z.infer<typeof userUpdateSchema>, ip?: string | null) {
  requirePermission(user, "users.write");
  const data = userUpdateSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const previous = await tx.user.findUnique({ where: { id } });
    if (!previous) throw new Error("Usuario no encontrado");
    const targetRole = data.role ?? previous.role;
    const targetUnit = data.unitId === undefined ? previous.unitId : data.unitId;
    if (targetRole !== "COMANDANCIA_ADMIN" && !targetUnit) {
      throw new Error("UNIT_MANAGER y OPERATIONAL requieren unidad");
    }
    const updated = await tx.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, unitId: true, active: true },
    });
    await recordAudit(tx, {
      userId: user.id, action: "update", tableName: "users", recordId: id,
      oldValue: { name: previous.name, role: previous.role, unitId: previous.unitId, active: previous.active },
      newValue: updated,
      ipAddress: ip,
    });
    return updated;
  });
}

export async function resetPassword(user: SessionUser, id: string, newPassword: string, ip?: string | null) {
  requirePermission(user, "users.write");
  passwordSchema.parse(newPassword);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await recordAudit(tx, { userId: user.id, action: "reset_password", tableName: "users", recordId: id, ipAddress: ip });
  });
}

export async function deactivateUser(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "users.deactivate");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.user.findUnique({ where: { id } });
    if (!previous) throw new Error("Usuario no encontrado");
    await tx.user.update({ where: { id }, data: { active: false } });
    await recordAudit(tx, {
      userId: user.id, action: "deactivate", tableName: "users", recordId: id,
      oldValue: { active: previous.active }, newValue: { active: false }, ipAddress: ip,
    });
  });
}
