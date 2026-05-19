import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listConsumables, createConsumable } from "@/lib/services/consumables.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { ConsumableStatus } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  return withErrorHandling(() =>
    listConsumables(user, {
      unitId: searchParams.get("unitId") ?? undefined,
      status: (searchParams.get("status") as ConsumableStatus | null) ?? undefined,
      materialId: searchParams.get("materialId") ?? undefined,
    }),
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createConsumable(user, body, clientIp(req)));
}
