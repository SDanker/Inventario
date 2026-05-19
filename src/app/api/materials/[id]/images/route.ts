import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { addMaterialImage, removeMaterialImage } from "@/lib/services/catalog.service";
import { withErrorHandling, clientIp } from "@/lib/http";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

function isImageBuffer(buf: Buffer, mimeType: string): boolean {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false;

  if (mimeType === "image/jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8;
  }
  if (mimeType === "image/png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mimeType === "image/webp") {
    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  }
  if (mimeType === "image/gif") {
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  }

  return false;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: materialId } = await params;
  const user = await getSessionUser();

  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  return withErrorHandling(async () => {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

    const existingCount = await prisma.materialImage.count({ where: { materialId } });
    if (existingCount >= MAX_IMAGES) {
      return NextResponse.json({ error: "Max 6 images per material" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isImageBuffer(buffer, file.type)) {
      return NextResponse.json({ error: "Invalid image file" }, { status: 400 });
    }

    const storage = getStorage();
    const saved = await storage.save({
      buffer,
      originalName: file.name,
      mimeType: file.type,
    });

    const order = existingCount;
    const image = await addMaterialImage(
      user,
      {
        materialId,
        fileUrl: `/storage/uploads/${saved.path}`,
        order,
      },
      clientIp(req)
    );

    return NextResponse.json(image, { status: 201 });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: materialId } = await params;
  const user = await getSessionUser();

  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  return withErrorHandling(async () => {
    const { imageId } = (await req.json()) as { imageId: string };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    const image = await prisma.materialImage.findUnique({ where: { id: imageId } });
    if (!image || image.materialId !== materialId) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    try {
      const storage = getStorage();
      await storage.delete(image.fileUrl.replace("/storage/uploads/", ""));
    } catch (err) {
      console.error("Failed to delete file:", err);
    }

    await removeMaterialImage(user, imageId, clientIp(req));

    return NextResponse.json({ success: true });
  });
}
