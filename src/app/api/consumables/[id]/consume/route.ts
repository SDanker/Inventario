import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { recordConsumption } from "@/lib/services/consumables.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { quantity: number; reason?: string };
  return withErrorHandling(() => recordConsumption(user, id, body.quantity, body.reason ?? "Consumo", clientIp(req)));
}
