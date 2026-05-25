import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listConsumables } from "@/lib/services/consumables.service";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function UnitConsumablesPage() {
  const user = (await getSessionUser())!;
  const items = await listConsumables(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Insumos</h1>
        <Link href="/unidad/insumos/nuevo">
          <Button>Nuevo insumo</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{items.length} insumos</CardTitle></CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState>Sin insumos cargados.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Material</TH>
                  <TH>Stock</TH>
                  <TH>Mínimo</TH>
                  <TH>Lote</TH>
                  <TH>Vence</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.material.name}</TD>
                    <TD className="font-mono">
                      {c.currentStock.toString()} {c.unitOfMeasure}
                    </TD>
                    <TD>{c.minimumStock.toString()}</TD>
                    <TD>{c.batchNumber ?? "—"}</TD>
                    <TD>{formatDate(c.expirationDate)}</TD>
                    <TD>
                      <Badge
                        tone={
                          c.status === "DISPONIBLE"
                            ? "success"
                            : c.status === "VENCIDO" || c.status === "AGOTADO"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/unidad/insumos/${c.id}`}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Ver detalles
                      </Link>
                    </TD>
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
