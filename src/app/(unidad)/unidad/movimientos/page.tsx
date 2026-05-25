import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const typeConfig: Record<string, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  INGRESO: { tone: "success", label: "Ingreso" },
  CONSUMO: { tone: "warning", label: "Consumo" },
  TRASLADO: { tone: "info", label: "Traslado" },
  AJUSTE: { tone: "neutral", label: "Ajuste" },
  BAJA: { tone: "danger", label: "Baja" },
};

export default async function UnitMovementsPage() {
  const user = (await getSessionUser())!;
  if (!user.unitId) redirect("/forbidden");

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      OR: [{ originUnitId: user.unitId }, { destinationUnitId: user.unitId }],
    },
    include: {
      material: true,
      asset: true,
      user: { select: { name: true } },
      originUnit: { select: { code: true } },
      destinationUnit: { select: { code: true } },
    },
    orderBy: { movementDate: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Movimientos</h1>
      <Card>
        <CardHeader><CardTitle>{movements.length} movimientos recientes</CardTitle></CardHeader>
        <CardBody>
          {movements.length === 0 ? (
            <EmptyState>Sin movimientos registrados.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Tipo</TH>
                  <TH>Material</TH>
                  <TH>Cantidad</TH>
                  <TH>Origen → Destino</TH>
                  <TH>Usuario</TH>
                  <TH>Motivo</TH>
                </TR>
              </THead>
              <TBody>
                {movements.map((m) => {
                  const config = typeConfig[m.movementType] ?? {
                    tone: "neutral" as const,
                    label: m.movementType,
                  };
                  return (
                    <TR key={m.id}>
                      <TD className="text-sm">{formatDateTime(m.movementDate)}</TD>
                      <TD>
                        <Badge tone={config.tone}>{config.label}</Badge>
                      </TD>
                      <TD>
                        {m.asset ? `${m.asset.internalCode} - ` : ""}
                        {m.material.name}
                      </TD>
                      <TD className="font-mono">{m.quantity.toString()}</TD>
                      <TD className="text-sm">
                        {m.originUnit?.code ?? "—"} → {m.destinationUnit?.code ?? "—"}
                      </TD>
                      <TD>{m.user.name}</TD>
                      <TD className="text-sm">{m.reason || "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
