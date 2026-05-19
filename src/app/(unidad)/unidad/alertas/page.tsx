import { getSessionUser } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function UnitAlertsPage() {
  const user = (await getSessionUser())!;
  if (!user.unitId) redirect("/forbidden");
  const alerts = await prisma.alert.findMany({
    where: { unitId: user.unitId, status: "ABIERTA" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alertas</h1>
      <Card>
        <CardHeader><CardTitle>{alerts.length} alertas abiertas</CardTitle></CardHeader>
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState>Sin alertas.</EmptyState>
          ) : (
            <Table>
              <THead><TR><TH>Tipo</TH><TH>Detalle</TH><TH>Creada</TH></TR></THead>
              <TBody>
                {alerts.map((a) => (
                  <TR key={a.id}>
                    <TD><Badge tone="warning">{a.alertType}</Badge></TD>
                    <TD>{a.title}</TD>
                    <TD>{formatDateTime(a.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
