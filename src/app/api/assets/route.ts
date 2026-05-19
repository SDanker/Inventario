import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listAssets, createAsset } from "@/lib/services/assets.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { AssetStatus } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  return withErrorHandling(() =>
    listAssets(user, {
      unitId: searchParams.get("unitId") ?? undefined,
      status: (searchParams.get("status") as AssetStatus | null) ?? undefined,
      materialId: searchParams.get("materialId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    }),
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createAsset(user, body, clientIp(req)));
}
