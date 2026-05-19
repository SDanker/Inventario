import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listMaintenance, createMaintenance } from "@/lib/services/maintenance.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  return withErrorHandling(() =>
    listMaintenance(user, {
      assetId: searchParams.get("assetId") ?? undefined,
      unitId: searchParams.get("unitId") ?? undefined,
    }),
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createMaintenance(user, body, clientIp(req)));
}
