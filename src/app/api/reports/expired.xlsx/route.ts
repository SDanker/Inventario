import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { buildExpiredWorkbook } from "@/lib/excel/reports";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const buffer = await buildExpiredWorkbook(user);

    // Auditoría de exportación
    await recordAudit(prisma, {
      userId: user.id,
      action: "export",
      tableName: "reports",
      recordId: "expired:all",
      newValue: { report: "expired" },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="material_vencido.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const status = (err as Error).name === "ForbiddenError" ? 403 : 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
