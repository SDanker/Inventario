import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { deactivateUnit } from "@/lib/services/units.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  return withErrorHandling(() => deactivateUnit(user, id, clientIp(req)));
}
