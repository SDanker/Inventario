import Link from "next/link";
import { getSessionUser } from "@/auth";
import { unitDashboard } from "@/lib/services/dashboards.service";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function UnitDashboardPage() {
  const user = (await getSessionUser())!;
  const data = await unitDashboard(user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.unit.name}</h1>
          <p className="text-sm text-slate-500">{data.unit.unitType.replaceAll("_", " ").toLowerCase()}</p>
        </div>
        <Link href={`/api/reports/inventory.xlsx?scope=unit&unitId=${data.unit.id}`}>
          <Button>Exportar inventario (Excel)</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Activos" value={data.totals.assets} />
        <StatCard label="Insumos (registros)" value={data.totals.consumables} />
        <StatCard label="Alertas abiertas" value={data.totals.openAlerts} tone={data.totals.openAlerts > 0 ? "warning" : "default"} />
        <StatCard label="Insumos bajos / agotados" value={data.issues.lowStock} tone={data.issues.lowStock > 0 ? "warning" : "default"} />
        <StatCard label="Insumos vencidos" value={data.issues.expired} tone={data.issues.expired > 0 ? "danger" : "default"} />
        <StatCard label="En mantención" value={data.issues.mantencion} tone={data.issues.mantencion > 0 ? "warning" : "default"} />
        <StatCard label="Fuera de servicio" value={data.issues.fueraServicio} tone={data.issues.fueraServicio > 0 ? "danger" : "default"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Próximas mantenciones</CardTitle></CardHeader>
          <CardBody>
            {data.upcomingMaintenance.length === 0 ? (
              <EmptyState>Sin mantenciones próximas.</EmptyState>
            ) : (
              <Table>
                <THead><TR><TH>Activo</TH><TH>Fecha</TH></TR></THead>
                <TBody>
                  {data.upcomingMaintenance.map((m) => (
                    <TR key={m.id}>
                      <TD>{m.asset.internalCode} — {m.asset.material.name}</TD>
                      <TD>{formatDate(m.nextMaintenanceDate)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimos movimientos</CardTitle></CardHeader>
          <CardBody>
            {data.recentMovements.length === 0 ? (
              <EmptyState>Sin movimientos aún.</EmptyState>
            ) : (
              <Table>
                <THead><TR><TH>Fecha</TH><TH>Tipo</TH><TH>Material</TH><TH>Cant.</TH></TR></THead>
                <TBody>
                  {data.recentMovements.map((m) => (
                    <TR key={m.id}>
                      <TD>{formatDateTime(m.movementDate)}</TD>
                      <TD>{m.movementType}</TD>
                      <TD>{m.asset?.internalCode ?? m.material.name}</TD>
                      <TD>{m.quantity.toString()}</TD>
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
