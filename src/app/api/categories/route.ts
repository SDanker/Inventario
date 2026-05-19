import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listCategories, createCategory } from "@/lib/services/catalog.service";
import { withErrorHandling, clientIp } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return withErrorHandling(() => listCategories(user));
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => createCategory(user, body, clientIp(req)));
}
