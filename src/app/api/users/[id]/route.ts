import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { updateUser, deactivateUser } from "@/lib/services/users.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  return withErrorHandling(() => updateUser(user, id, body, clientIp(req)));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  return withErrorHandling(() => deactivateUser(user, id, clientIp(req)));
}
