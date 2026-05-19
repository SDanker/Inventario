import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth";
import { buildInventoryWorkbook } from "@/lib/excel/reports";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") ?? "global") as "global" | "unit";
  const unitId = searchParams.get("unitId") ?? undefined;

  try {
    const buffer = await buildInventoryWorkbook(user, { scope, unitId });

    // Auditoría de exportación
    await recordAudit(prisma, {
      userId: user.id,
      action: "export",
      tableName: "reports",
      recordId: `inventory:${scope}${unitId ? `:${unitId}` : ""}`,
      newValue: { scope, unitId },
    });

    const filename = scope === "global" ? "inventario_consolidado.xlsx" : `inventario_${unitId ?? "unidad"}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const status = (err as Error).name === "ForbiddenError" ? 403 : 400;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
