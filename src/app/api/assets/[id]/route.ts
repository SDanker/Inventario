import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { getAssetWithHistory, updateAsset } from "@/lib/services/assets.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  return withErrorHandling(() => getAssetWithHistory(user, id));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  return withErrorHandling(() => updateAsset(user, id, body, clientIp(req)));
}
