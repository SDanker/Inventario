import { prisma } from "@/lib/db";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function AlertsAdminPage() {
  const alerts = await prisma.alert.findMany({
    where: { status: "ABIERTA" },
    include: { unit: true, asset: true, consumable: { include: { material: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alertas abiertas</h1>
      <Card>
        <CardHeader><CardTitle>{alerts.length} alertas</CardTitle></CardHeader>
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState>Sin alertas abiertas. Ejecuta el job: <code>npm run alerts:scan</code></EmptyState>
          ) : (
            <Table>
              <THead><TR><TH>Tipo</TH><TH>Unidad</TH><TH>Detalle</TH><TH>Creada</TH></TR></THead>
              <TBody>
                {alerts.map((a) => (
                  <TR key={a.id}>
                    <TD><Badge tone="warning">{a.alertType}</Badge></TD>
                    <TD>{a.unit.code}</TD>
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
