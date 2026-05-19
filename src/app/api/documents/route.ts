import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { uploadDocument } from "@/lib/services/documents.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { DocumentType } from "@prisma/client";

/**
 * Subida vía multipart/form-data:
 *   file: <pdf>
 *   documentType: ORDEN_MANTENCION | CERTIFICADO | …
 *   assetId?: cuid
 *   maintenanceRecordId?: cuid
 *   observations?: string
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  return withErrorHandling(async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Archivo no enviado");
    const buffer = Buffer.from(await file.arrayBuffer());

    return uploadDocument(
      user,
      {
        documentType: form.get("documentType") as DocumentType,
        assetId: (form.get("assetId") as string) || null,
        maintenanceRecordId: (form.get("maintenanceRecordId") as string) || null,
        observations: (form.get("observations") as string) || null,
      },
      { buffer, originalName: file.name, mimeType: file.type || "application/pdf" },
      clientIp(req),
    );
  });
}
