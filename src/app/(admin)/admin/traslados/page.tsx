import Link from "next/link";
import { getSessionUser } from "@/auth";
import { listTransfers } from "@/lib/services/transfers.service";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusConfig = {
  SOLICITADO: { tone: "warning", label: "Solicitado" },
  APROBADO: { tone: "info", label: "Aprobado" },
  PREPARADO: { tone: "info", label: "Preparado" },
  EN_TRANSITO: { tone: "warning", label: "En tránsito" },
  RECIBIDO: { tone: "success", label: "Recibido" },
  RECHAZADO: { tone: "danger", label: "Rechazado" },
  CANCELADO: { tone: "neutral", label: "Cancelado" },
};

export default async function TransfersAdminPage() {
  const user = (await getSessionUser())!;
  const transfers = await listTransfers(user);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Traslados</h1>
        <Link href="/admin/traslados/nuevo">
          <Button>Nuevo traslado</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{transfers.length} traslados registrados</CardTitle></CardHeader>
        <CardBody>
          {transfers.length === 0 ? (
            <EmptyState>No hay traslados. Crea el primero.</EmptyState>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Origen</TH>
                  <TH>Destino</TH>
                  <TH>Solicitado por</TH>
                  <TH>Estado</TH>
                  <TH>Fecha</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {transfers.map((t) => {
                  const config = statusConfig[t.status as keyof typeof statusConfig];
                  return (
                    <TR key={t.id}>
                      <TD className="font-mono">{t.code}</TD>
                      <TD className="font-medium">{t.originUnit.code}</TD>
                      <TD className="font-medium">{t.destinationUnit.code}</TD>
                      <TD>{t.requestedBy.name}</TD>
                      <TD>
                        <Badge tone={config.tone as any}>{config.label}</Badge>
                      </TD>
                      <TD>{new Date(t.createdAt).toLocaleDateString("es-CL")}</TD>
                      <TD className="text-right">
                        <Link href={`/admin/traslados/${t.id}`} className="text-sm text-brand-600 hover:underline">
                          Ver detalles
                        </Link>
                      </TD>
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
