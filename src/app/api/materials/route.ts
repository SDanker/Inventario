import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listMaterials, createMaterial } from "@/lib/services/catalog.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { MaterialType } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as MaterialType | null;
  const q = searchParams.get("q");
  return withErrorHandling(() => listMaterials(user, { type: type ?? undefined, q: q ?? undefined }));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createMaterial(user, body, clientIp(req)));
}
