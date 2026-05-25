import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, can, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";
import { getStorage, isPdfBuffer } from "@/lib/storage";

const MAX_SIZE = Number(process.env.STORAGE_MAX_FILE_SIZE_MB ?? 20) * 1024 * 1024;

export const documentUploadMetaSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  assetId: z.string().cuid().optional().nullable(),
  maintenanceRecordId: z.string().cuid().optional().nullable(),
  materialId: z.string().cuid().optional().nullable(),
  observations: z.string().trim().max(1000).optional().nullable(),
}).refine(
  (v) => !!v.assetId || !!v.maintenanceRecordId || !!v.materialId,
  { message: "Debe asociarse a un activo, una mantención o un material" },
);

export async function uploadDocument(
  user: SessionUser,
  meta: z.infer<typeof documentUploadMetaSchema>,
  file: { buffer: Buffer; originalName: string; mimeType: string },
  ip?: string | null,
) {
  requirePermission(user, "documents.write.own");
  documentUploadMetaSchema.parse(meta);

  if (file.buffer.byteLength > MAX_SIZE) throw new Error("Archivo demasiado grande");
  if (!isPdfBuffer(file.buffer)) throw new Error("El archivo no es un PDF válido");

  // Verifica que el usuario pueda escribir en la unidad del activo asociado.
  if (meta.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: meta.assetId } });
    if (!asset) throw new Error("Activo no encontrado");
    if (user.role !== "COMANDANCIA_ADMIN" && asset.unitId !== user.unitId) {
      throw new ForbiddenError("Activo de otra unidad");
    }
  }

  // Material: validamos existencia. La autorización ya pasó por documents.write.own.
  if (meta.materialId) {
    const material = await prisma.material.findUnique({ where: { id: meta.materialId } });
    if (!material) throw new Error("Material no encontrado");
  }

  const saved = await getStorage().save({
    buffer: file.buffer, originalName: file.originalName, mimeType: file.mimeType,
  });

  return prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        documentType: meta.documentType,
        assetId: meta.assetId ?? null,
        maintenanceRecordId: meta.maintenanceRecordId ?? null,
        materialId: meta.materialId ?? null,
        fileName: file.originalName,
        filePath: saved.path,
        fileSize: saved.size,
        uploadedByUserId: user.id,
        observations: meta.observations ?? null,
      },
    });
    await recordAudit(tx, {
      userId: user.id, action: "upload", tableName: "documents", recordId: created.id,
      newValue: { fileName: created.fileName, type: created.documentType, size: created.fileSize, materialId: created.materialId, assetId: created.assetId },
      ipAddress: ip,
    });
    return created;
  });
}

export async function getDocumentForDownload(user: SessionUser, id: string) {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { asset: { select: { unitId: true } } },
  });
  if (!doc) return null;

  // Permiso: COMANDANCIA todo; UNIT_MANAGER/OPERATIONAL sólo su unidad.
  // Documentos asociados a un material (sin activo) son visibles para cualquier rol con permiso de lectura.
  if (user.role !== "COMANDANCIA_ADMIN") {
    if (doc.assetId) {
      const ownerUnit = doc.asset?.unitId ?? null;
      if (!ownerUnit || ownerUnit !== user.unitId) throw new ForbiddenError("Documento de otra unidad");
    } else if (!doc.materialId) {
      // Sin material ni activo (mantención por sí sola): denegamos por defecto.
      throw new ForbiddenError("Documento sin contexto accesible");
    }
  }

  const buffer = await getStorage().read(doc.filePath);
  return { doc, buffer };
}

export async function listMaterialDocuments(user: SessionUser, materialId: string) {
  // Admin tiene documents.read.any; encargado/operario read.own. Cualquiera sirve.
  if (!can(user, "documents.read.any") && !can(user, "documents.read.own")) {
    throw new ForbiddenError();
  }
  return prisma.document.findMany({
    where: { materialId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { uploadDate: "desc" },
  });
}

export async function deleteMaterialDocument(user: SessionUser, id: string, ip?: string | null) {
  // Admin tiene documents.delete; encargado tiene documents.write.own.
  if (!can(user, "documents.delete") && !can(user, "documents.write.own")) {
    throw new ForbiddenError();
  }
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new Error("Documento no encontrado");
  if (!doc.materialId) throw new Error("Documento no pertenece a un material");

  // Intentamos borrar el archivo físico (no bloquea el borrado lógico).
  try {
    await getStorage().delete(doc.filePath);
  } catch (err) {
    console.error("No se pudo eliminar el archivo físico:", err);
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.document.delete({ where: { id } });
    await recordAudit(tx, {
      userId: user.id, action: "delete", tableName: "documents", recordId: id,
      oldValue: { fileName: deleted.fileName, type: deleted.documentType, materialId: deleted.materialId },
      ipAddress: ip,
    });
    return deleted;
  });
}
