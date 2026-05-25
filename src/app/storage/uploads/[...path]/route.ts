import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { getStorage } from "@/lib/storage";

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { path: parts } = await params;
  const relativePath = parts.join("/");
  const contentType = contentTypes[path.extname(relativePath).toLowerCase()];

  if (!relativePath || !contentType) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const buffer = await getStorage().read(relativePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
