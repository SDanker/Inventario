import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listUsers, createUser } from "@/lib/services/users.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { UserRole } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") as UserRole | null;
  const unitId = searchParams.get("unitId");
  return withErrorHandling(() => listUsers(user, { role: role ?? undefined, unitId: unitId ?? undefined }));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createUser(user, body, clientIp(req)));
}
