import Link from "next/link";
import { getSessionUser } from "@/auth";
import { commandanciaDashboard } from "@/lib/services/dashboards.service";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const user = (await getSessionUser())!;
  const data = await commandanciaDashboard(user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Comandancia</h1>
        <Link href="/api/reports/inventory.xlsx?scope=global">
          <Button>Exportar inventario (Excel)</Button>
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Unidades</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={data.units.total} />
          <StatCard label="Cuarteles" value={data.units.cuarteles} />
          <StatCard label="Bodegas" value={data.units.bodegas} />
          <StatCard label="Campo entrenamiento" value={data.units.campos} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Activos</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={data.assets.total} />
          <StatCard label="Operativos" value={data.assets.operativos} tone="success" />
          <StatCard label="Observados" value={data.assets.observados} tone="warning" />
          <StatCard label="En mantención" value={data.assets.mantencion} tone="warning" />
          <StatCard label="Fuera de servicio" value={data.assets.fueraServicio} tone="danger" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Insumos y mantenciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Insumos (registros)" value={data.consumables.total} />
          <StatCard label="Stock bajo / agotado" value={data.consumables.lowStock} tone="warning" />
          <StatCard label="Vencidos" value={data.consumables.expired} tone="danger" />
          <StatCard label="Mant. próximas (30d)" value={data.maintenance.upcoming} tone="warning" />
          <StatCard label="Mant. vencidas" value={data.maintenance.overdue} tone="danger" />
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Últimos movimientos</CardTitle></CardHeader>
          <CardBody>
            {data.recentMovements.length === 0 ? (
              <EmptyState>Sin movimientos aún.</EmptyState>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Fecha</TH><TH>Tipo</TH><TH>Material</TH><TH>Cant.</TH><TH>Usuario</TH></TR>
                </THead>
                <TBody>
                  {data.recentMovements.map((m) => (
                    <TR key={m.id}>
                      <TD>{formatDateTime(m.movementDate)}</TD>
                      <TD>{m.movementType}</TD>
                      <TD>{m.asset?.internalCode ?? m.material.name}</TD>
                      <TD>{m.quantity.toString()}</TD>
                      <TD>{m.user.name}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimos traslados</CardTitle></CardHeader>
          <CardBody>
            {data.recentTransfers.length === 0 ? (
              <EmptyState>Sin traslados aún.</EmptyState>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Código</TH><TH>Origen</TH><TH>Destino</TH><TH>Estado</TH></TR>
                </THead>
                <TBody>
                  {data.recentTransfers.map((t) => (
                    <TR key={t.id}>
                      <TD>{t.code}</TD>
                      <TD>{t.originUnit.code}</TD>
                      <TD>{t.destinationUnit.code}</TD>
                      <TD>{t.status}</TD>
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
