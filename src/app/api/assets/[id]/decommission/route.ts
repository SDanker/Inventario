import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { decommissionAsset } from "@/lib/services/assets.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  return withErrorHandling(() => decommissionAsset(user, id, body.reason ?? "Baja registrada", clientIp(req)));
}
