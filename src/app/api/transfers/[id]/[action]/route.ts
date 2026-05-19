import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import {
  approveTransfer, prepareTransfer, dispatchTransfer, receiveTransfer, rejectTransfer, cancelTransfer,
} from "@/lib/services/transfers.service";
import { withErrorHandling, clientIp } from "@/lib/http";

/**
 * Endpoint genérico para transiciones de estado de un traslado.
 *   POST /api/transfers/:id/approve
 *   POST /api/transfers/:id/prepare
 *   POST /api/transfers/:id/dispatch
 *   POST /api/transfers/:id/receive
 *   POST /api/transfers/:id/reject   { reason: "..." }
 *   POST /api/transfers/:id/cancel
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id, action } = await params;
  const ip = clientIp(req);

  return withErrorHandling(async () => {
    switch (action) {
      case "approve": return approveTransfer(user, id, ip);
      case "prepare": return prepareTransfer(user, id, ip);
      case "dispatch": return dispatchTransfer(user, id, ip);
      case "receive": return receiveTransfer(user, id, ip);
      case "cancel": return cancelTransfer(user, id, ip);
      case "reject": {
        const body = (await req.json().catch(() => ({}))) as { reason?: string };
        return rejectTransfer(user, id, body.reason ?? "Rechazado", ip);
      }
      default:
        throw new Error(`Acción de traslado no soportada: ${action}`);
    }
  });
}
