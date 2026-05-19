import { z } from "zod";
import { MaterialType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser } from "@/lib/auth/permissions";

// ── Categorías ────────────────────────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function listCategories(user: SessionUser) {
  requirePermission(user, "categories.read");
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function createCategory(user: SessionUser, input: z.infer<typeof categoryCreateSchema>, ip?: string | null) {
  requirePermission(user, "categories.write");
  const data = categoryCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const created = await tx.category.create({ data });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "categories", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

// ── Materiales ────────────────────────────────────────────────

export const materialCreateSchema = z.object({
  code: z.string().trim().min(1).max(30).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().max(100).optional().nullable(),
  partNumber: z.string().trim().max(50).optional().nullable(),
  categoryId: z.string().cuid(),
  materialType: z.nativeEnum(MaterialType),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const materialUpdateSchema = materialCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export async function listMaterials(user: SessionUser, filter?: { type?: MaterialType; q?: string }) {
  requirePermission(user, "materials.read");
  return prisma.material.findMany({
    where: {
      active: true,
      ...(filter?.type ? { materialType: filter.type } : {}),
      ...(filter?.q
        ? { OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { code: { contains: filter.q, mode: "insensitive" } }] }
        : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function generateMaterialCode(
  tx: any,
  categoryId: string,
  materialType: MaterialType
): Promise<string> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { name: true },
  });
  if (!category) throw new Error("Categoría no encontrada");

  const categoryPrefix = category.name.substring(0, 3).toUpperCase();
  const typePrefix = materialType.substring(0, 3).toUpperCase();

  const lastMaterial = await tx.material.findFirst({
    where: {
      code: { startsWith: `${categoryPrefix}-${typePrefix}` },
    },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let nextNumber = 1;
  if (lastMaterial) {
    const match = lastMaterial.code.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${categoryPrefix}-${typePrefix}-${String(nextNumber).padStart(4, "0")}`;
}

export async function createMaterial(user: SessionUser, input: z.infer<typeof materialCreateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = materialCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const code = data.code || (await generateMaterialCode(tx, data.categoryId, data.materialType));
    const created = await tx.material.create({
      data: {
        ...data,
        code,
      },
    });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "materials", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

export async function getMaterial(user: SessionUser, id: string) {
  requirePermission(user, "materials.read");
  return prisma.material.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function updateMaterial(user: SessionUser, id: string, input: z.infer<typeof materialUpdateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const parsed = materialUpdateSchema.parse(input);
  const data = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  return prisma.$transaction(async (tx) => {
    const previous = await tx.material.findUnique({ where: { id } });
    if (!previous) throw new Error("Material no encontrado");
    const updated = await tx.material.update({ where: { id }, data: data as any });
    await recordAudit(tx, { userId: user.id, action: "update", tableName: "materials", recordId: id, oldValue: previous, newValue: updated, ipAddress: ip });
    return updated;
  });
}

export async function deactivateMaterial(user: SessionUser, id: string, ip?: string | null) {
  requirePermission(user, "materials.write");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.material.findUnique({ where: { id } });
    if (!previous) throw new Error("Material no encontrado");
    const updated = await tx.material.update({ where: { id }, data: { active: false } });
    await recordAudit(tx, {
      userId: user.id,
      action: "deactivate",
      tableName: "materials",
      recordId: id,
      oldValue: { active: previous.active },
      newValue: { active: false },
      ipAddress: ip,
    });
    return updated;
  });
}

// ── Imágenes de Materiales ────────────────────────────────────────

export const materialImageCreateSchema = z.object({
  materialId: z.string().cuid(),
  fileUrl: z.string().url(),
  order: z.number().int().min(0).max(5),
});

export async function addMaterialImage(user: SessionUser, input: z.infer<typeof materialImageCreateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = materialImageCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const countImages = await tx.materialImage.count({ where: { materialId: data.materialId } });
    if (countImages >= 6) throw new Error("Máximo 6 imágenes por material");
    const created = await tx.materialImage.create({ data });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "material_images", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

export async function removeMaterialImage(user: SessionUser, imageId: string, ip?: string | null) {
  requirePermission(user, "materials.write");
  return prisma.$transaction(async (tx) => {
    const image = await tx.materialImage.findUnique({ where: { id: imageId } });
    if (!image) throw new Error("Imagen no encontrada");
    const deleted = await tx.materialImage.delete({ where: { id: imageId } });
    await recordAudit(tx, { userId: user.id, action: "delete", tableName: "material_images", recordId: imageId, oldValue: deleted, ipAddress: ip });
    return deleted;
  });
}

// ── Stock por Unidad ──────────────────────────────────────────

export const unitMaterialStockCreateSchema = z.object({
  materialId: z.string().cuid(),
  unitId: z.string().cuid(),
  quantity: z.number().int().min(0),
});

export const unitMaterialStockUpdateSchema = z.object({
  quantity: z.number().int().min(0),
});

export async function assignMaterialToUnit(user: SessionUser, input: z.infer<typeof unitMaterialStockCreateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = unitMaterialStockCreateSchema.parse(input);

  // Validar que UNIT_MANAGER solo asigne a su unidad
  if (user.role !== "COMANDANCIA_ADMIN" && data.unitId !== user.unitId) {
    throw new Error("Solo puedes asignar materiales a tu unidad");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.unitMaterialStock.findFirst({
      where: { materialId: data.materialId, unitId: data.unitId },
    });
    if (existing) throw new Error("Material ya asignado a esta unidad");

    const created = await tx.unitMaterialStock.create({ data });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "unit_material_stocks", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

export async function updateMaterialQuantityInUnit(user: SessionUser, materialId: string, unitId: string, input: z.infer<typeof unitMaterialStockUpdateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = unitMaterialStockUpdateSchema.parse(input);

  // Validar que no-admin solo actualice en su unidad
  if (user.role !== "COMANDANCIA_ADMIN" && unitId !== user.unitId) {
    throw new Error("Solo puedes actualizar materiales en tu unidad");
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.unitMaterialStock.findFirst({
      where: { materialId, unitId },
    });
    if (!stock) throw new Error("Stock no encontrado");

    const updated = await tx.unitMaterialStock.update({
      where: { id: stock.id },
      data,
    });
    await recordAudit(tx, { userId: user.id, action: "update", tableName: "unit_material_stocks", recordId: stock.id, oldValue: { quantity: stock.quantity }, newValue: { quantity: updated.quantity }, ipAddress: ip });
    return updated;
  });
}

export async function getMaterialStocks(user: SessionUser, materialId: string) {
  requirePermission(user, "materials.read");

  // Si es UNIT_MANAGER u OPERATIONAL, filtrar por su unidad
  const whereClause = user.role === "COMANDANCIA_ADMIN" ? {} : { unitId: user.unitId || "" };

  return prisma.unitMaterialStock.findMany({
    where: { materialId, ...whereClause },
    include: { unit: { select: { id: true, name: true, code: true } } },
    orderBy: { unit: { name: "asc" } },
  });
}

// ── Resumen de Inventario ────────────────────────────────────────

export async function getInventorySummary(user: SessionUser, filter?: { categoryId?: string; unitId?: string }) {
  requirePermission(user, "materials.read");

  // Si no es admin, filtrar por su unidad
  const unitFilter = user.role === "COMANDANCIA_ADMIN" ? {} : { unitId: user.unitId || "" };
  const overrideUnitFilter = filter?.unitId && user.role === "COMANDANCIA_ADMIN" ? { unitId: filter.unitId } : unitFilter;

  return prisma.unitMaterialStock.findMany({
    where: {
      ...overrideUnitFilter,
      ...(filter?.categoryId ? { material: { categoryId: filter.categoryId } } : {}),
    },
    include: {
      material: {
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          materialType: true,
        },
      },
      unit: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ material: { name: "asc" } }, { unit: { name: "asc" } }],
  });
}

// ── Números de Serie ──────────────────────────────────────────────

export const materialSerialNumberCreateSchema = z.object({
  materialId: z.string().cuid(),
  serialNumber: z.string().trim().min(1).max(100),
  assignedToUserId: z.string().cuid().optional().nullable(),
  assignedToUnitId: z.string().cuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const materialSerialNumberUpdateSchema = materialSerialNumberCreateSchema.partial();

export async function addMaterialSerialNumber(user: SessionUser, input: z.infer<typeof materialSerialNumberCreateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = materialSerialNumberCreateSchema.parse(input);
  if (data.assignedToUserId && data.assignedToUnitId) {
    throw new Error("No se puede asignar a usuario y unidad simultáneamente");
  }
  return prisma.$transaction(async (tx) => {
    const created = await tx.materialSerialNumber.create({ data });
    await recordAudit(tx, { userId: user.id, action: "create", tableName: "material_serial_numbers", recordId: created.id, newValue: created, ipAddress: ip });
    return created;
  });
}

export async function updateMaterialSerialNumber(user: SessionUser, serialNumberId: string, input: z.infer<typeof materialSerialNumberUpdateSchema>, ip?: string | null) {
  requirePermission(user, "materials.write");
  const data = materialSerialNumberUpdateSchema.parse(input);
  if (data.assignedToUserId && data.assignedToUnitId) {
    throw new Error("No se puede asignar a usuario y unidad simultáneamente");
  }
  return prisma.$transaction(async (tx) => {
    const previous = await tx.materialSerialNumber.findUnique({ where: { id: serialNumberId } });
    if (!previous) throw new Error("Número de serie no encontrado");
    const updated = await tx.materialSerialNumber.update({ where: { id: serialNumberId }, data });
    await recordAudit(tx, { userId: user.id, action: "update", tableName: "material_serial_numbers", recordId: serialNumberId, oldValue: previous, newValue: updated, ipAddress: ip });
    return updated;
  });
}

export async function removeMaterialSerialNumber(user: SessionUser, serialNumberId: string, ip?: string | null) {
  requirePermission(user, "materials.write");
  return prisma.$transaction(async (tx) => {
    const sn = await tx.materialSerialNumber.findUnique({ where: { id: serialNumberId } });
    if (!sn) throw new Error("Número de serie no encontrado");
    const deleted = await tx.materialSerialNumber.delete({ where: { id: serialNumberId } });
    await recordAudit(tx, { userId: user.id, action: "delete", tableName: "material_serial_numbers", recordId: serialNumberId, oldValue: deleted, ipAddress: ip });
    return deleted;
  });
}
