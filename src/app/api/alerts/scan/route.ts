import { NextResponse } from "next/server";
import { scanAlerts } from "@/lib/services/alerts.service";

/**
 * Job protegido por token. Programar con Task Scheduler (cron diario):
 *   curl -X POST http://localhost:3000/api/alerts/scan -H "Authorization: Bearer <ALERTS_SCAN_TOKEN>"
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.ALERTS_SCAN_TOKEN ?? ""}`;
  if (!process.env.ALERTS_SCAN_TOKEN || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await scanAlerts();
  return NextResponse.json(result);
}
