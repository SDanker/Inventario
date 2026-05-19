import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listUnits, createUnit } from "@/lib/services/units.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return withErrorHandling(() => listUnits(user));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createUnit(user, body, clientIp(req)));
}
