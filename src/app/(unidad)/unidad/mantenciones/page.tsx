import { getSessionUser } from "@/auth";
import { listMaintenance } from "@/lib/services/maintenance.service";
import { Card, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default async function UnitMaintenancePage() {
  const user = (await getSessionUser())!;
  const items = await listMaintenance(user);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mantenciones</h1>
      <Card>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState>Sin mantenciones registradas. {/* TODO: form */}</EmptyState>
          ) : (
            <Table>
              <THead><TR><TH>Fecha</TH><TH>Activo</TH><TH>Tipo</TH><TH>Resultado</TH><TH>Próxima</TH></TR></THead>
              <TBody>
                {items.map((m) => (
                  <TR key={m.id}>
                    <TD>{formatDate(m.maintenanceDate)}</TD>
                    <TD>{m.asset.internalCode} — {m.asset.material.name}</TD>
                    <TD>{m.maintenanceType}</TD>
                    <TD>{m.resultingStatus}</TD>
                    <TD>{formatDate(m.nextMaintenanceDate)}</TD>
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
