import { getSessionUser } from "@/auth";
import { listAssets } from "@/lib/services/assets.service";
import { listConsumables } from "@/lib/services/consumables.service";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function OpHomePage() {
  const user = (await getSessionUser())!;
  const [assets, consumables] = await Promise.all([listAssets(user), listConsumables(user)]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventario de tu unidad</h1>
      <p className="text-sm text-slate-500">Vista de solo lectura. Si necesitas modificar algo, contacta a tu encargado de unidad.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Activos ({assets.length})</CardTitle></CardHeader>
          <CardBody>
            {assets.length === 0 ? <EmptyState>Sin activos.</EmptyState> : (
              <Table>
                <THead><TR><TH>Código</TH><TH>Material</TH><TH>Estado</TH></TR></THead>
                <TBody>
                  {assets.slice(0, 50).map((a) => (
                    <TR key={a.id}>
                      <TD className="font-mono">{a.internalCode}</TD>
                      <TD>{a.material.name}</TD>
                      <TD><Badge tone={a.status === "OPERATIVO" ? "success" : "warning"}>{a.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Insumos ({consumables.length})</CardTitle></CardHeader>
          <CardBody>
            {consumables.length === 0 ? <EmptyState>Sin insumos.</EmptyState> : (
              <Table>
                <THead><TR><TH>Material</TH><TH>Stock</TH><TH>Estado</TH></TR></THead>
                <TBody>
                  {consumables.slice(0, 50).map((c) => (
                    <TR key={c.id}>
                      <TD>{c.material.name}</TD>
                      <TD className="font-mono">{c.currentStock.toString()} {c.unitOfMeasure}</TD>
                      <TD><Badge tone={c.status === "DISPONIBLE" ? "success" : "warning"}>{c.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
