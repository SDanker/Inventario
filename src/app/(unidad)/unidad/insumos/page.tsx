import { getSessionUser } from "@/auth";
import { listConsumables } from "@/lib/services/consumables.service";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function UnitConsumablesPage() {
  const user = (await getSessionUser())!;
  const items = await listConsumables(user);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Insumos</h1>
      <Card>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState>Sin insumos cargados.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR><TH>Material</TH><TH>Stock</TH><TH>Mínimo</TH><TH>Lote</TH><TH>Vence</TH><TH>Estado</TH></TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.material.name}</TD>
                    <TD className="font-mono">{c.currentStock.toString()} {c.unitOfMeasure}</TD>
                    <TD>{c.minimumStock.toString()}</TD>
                    <TD>{c.batchNumber ?? "—"}</TD>
                    <TD>{formatDate(c.expirationDate)}</TD>
                    <TD><Badge tone={c.status === "DISPONIBLE" ? "success" : c.status === "VENCIDO" || c.status === "AGOTADO" ? "danger" : "warning"}>{c.status}</Badge></TD>
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
