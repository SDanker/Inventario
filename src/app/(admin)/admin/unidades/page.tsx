import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listUnits } from "@/lib/services/units.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function UnitsListPage() {
  const user = (await getSessionUser())!;
  const units = await listUnits(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unidades</h1>
        <Link href="/admin/unidades/nuevo">
          <Button>Nueva unidad</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{units.length} unidades registradas</CardTitle></CardHeader>
        <CardBody>
          {units.length === 0 ? (
            <EmptyState>No hay unidades. Crea la primera.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Nombre</TH>
                  <TH>Tipo</TH>
                  <TH>Responsable</TH>
                  <TH>Estado</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {units.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-mono">{u.code}</TD>
                    <TD className="font-medium">{u.name}</TD>
                    <TD>{u.unitType.replaceAll("_", " ").toLowerCase()}</TD>
                    <TD>{u.responsibleUser?.name ?? "—"}</TD>
                    <TD>
                      {u.active ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}
                    </TD>
                    <TD className="text-right">
                      <Link href={`/admin/unidades/${u.id}`} className="text-sm text-brand-600 hover:underline">
                        Editar
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
