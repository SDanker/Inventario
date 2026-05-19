import { getSessionUser } from "@/auth";
import { listAssets } from "@/lib/services/assets.service";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function UnitAssetsPage() {
  const user = (await getSessionUser())!;
  const assets = await listAssets(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activos de la unidad</h1>
        <span className="text-sm text-slate-500">
          {/* TODO: form de crear activo replicando patrón de Unidades */}
          Crear/editar pendiente.
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>{assets.length} activos</CardTitle></CardHeader>
        <CardBody>
          {assets.length === 0 ? (
            <EmptyState>Sin activos. Crea el primero.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR><TH>Código</TH><TH>Material</TH><TH>Marca/Modelo</TH><TH>Ingreso</TH><TH>Estado</TH></TR>
              </THead>
              <TBody>
                {assets.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono">{a.internalCode}</TD>
                    <TD>{a.material.name}</TD>
                    <TD>{[a.brand, a.model].filter(Boolean).join(" / ") || "—"}</TD>
                    <TD>{formatDate(a.entryDate)}</TD>
                    <TD>
                      <Badge tone={a.status === "OPERATIVO" ? "success" : a.status === "FUERA_DE_SERVICIO" ? "danger" : "warning"}>
                        {a.status}
                      </Badge>
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
