import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requirePermission, type SessionUser, ForbiddenError } from "@/lib/auth/permissions";
import { getStorage, isPdfBuffer } from "@/lib/storage";

const MAX_SIZE = Number(process.env.STORAGE_MAX_FILE_SIZE_MB ?? 20) * 1024 * 1024;

export const documentUploadMetaSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  assetId: z.string().cuid().optional().nullable(),
  maintenanceRecordId: z.string().cuid().optional().nullable(),
  observations: z.string().trim().max(1000).optional().nullable(),
}).refine(
  (v) => !!v.assetId || !!v.maintenanceRecordId,
  { message: "Debe asociarse a un activo o a una mantención" },
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

  const saved = await getStorage().save({
    buffer: file.buffer, originalName: file.originalName, mimeType: file.mimeType,
  });

  return prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        documentType: meta.documentType,
        assetId: meta.assetId ?? null,
        maintenanceRecordId: meta.maintenanceRecordId ?? null,
        fileName: file.originalName,
        filePath: saved.path,
        fileSize: saved.size,
        uploadedByUserId: user.id,
        observations: meta.observations ?? null,
      },
    });
    await recordAudit(tx, {
      userId: user.id, action: "upload", tableName: "documents", recordId: created.id,
      newValue: { fileName: created.fileName, type: created.documentType, size: created.fileSize },
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
  if (user.role !== "COMANDANCIA_ADMIN") {
    const ownerUnit = doc.asset?.unitId ?? null;
    if (!ownerUnit || ownerUnit !== user.unitId) throw new ForbiddenError("Documento de otra unidad");
  }

  const buffer = await getStorage().read(doc.filePath);
  return { doc, buffer };
}
