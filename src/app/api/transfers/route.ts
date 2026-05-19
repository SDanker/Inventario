import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { listTransfers, requestTransfer } from "@/lib/services/transfers.service";
import { withErrorHandling, clientIp } from "@/lib/http";
import { TransferStatus } from "@prisma/client";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  return withErrorHandling(() =>
    listTransfers(user, {
      status: (searchParams.get("status") as TransferStatus | null) ?? undefined,
      unitId: searchParams.get("unitId") ?? undefined,
    }),
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json();
  return withErrorHandling(() => requestTransfer(user, body, clientIp(req)));
}
